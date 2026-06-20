import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BUCKET = 'inpi-resource-evidence';

interface FileInput {
  name: string;
  type: string; // mime
  base64: string;
}

interface EvidenceRow {
  resource_id: string;
  storage_path: string;
  page_number: number | null;
  source_file_name: string;
  mime_type: string;
  caption: string | null;
  ocr_text: string | null;
  placement: 'inline' | 'annex';
  display_order: number;
  included: boolean;
}

async function ensureBucket(supabase: ReturnType<typeof createClient>) {
  try {
    const { data } = await supabase.storage.getBucket(BUCKET);
    if (data) return;
  } catch (_) { /* ignore */ }
  try {
    await supabase.storage.createBucket(BUCKET, { public: false });
  } catch (e) {
    console.warn('createBucket warn:', (e as Error).message);
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Extract embedded images from a PDF using pdf-lib (pure JS, Deno-compatible).
// Returns one PNG/JPG per embedded image, in document order.
async function extractPdfEmbeddedImages(pdfBytes: Uint8Array): Promise<Array<{ bytes: Uint8Array; mime: string; page: number }>> {
  // @ts-ignore npm import
  const { PDFDocument, PDFName, PDFRawStream, PDFDict, PDFArray } = await import('https://esm.sh/pdf-lib@1.17.1');
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const out: Array<{ bytes: Uint8Array; mime: string; page: number }> = [];

  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const page = pages.at(i);
    if (!page) continue;
    const resources = page.node.Resources();
    if (!resources) continue;
    const xobjects = resources.lookup(PDFName.of('XObject'), PDFDict);
    if (!xobjects) continue;

    const entries = xobjects.entries();
    for (const [, ref] of entries) {
      const xobj = doc.context.lookup(ref);
      if (!xobj || !(xobj instanceof PDFRawStream)) continue;
      const dict = xobj.dict;
      const subtype = dict.lookup(PDFName.of('Subtype'));
      if (!subtype || subtype.toString() !== '/Image') continue;
      const filter = dict.lookup(PDFName.of('Filter'));
      const filterName = filter ? filter.toString() : '';
      const contents = xobj.contents;
      if (filterName.includes('DCTDecode')) {
        out.push({ bytes: new Uint8Array(contents), mime: 'image/jpeg', page: i + 1 });
      } else if (filterName.includes('JPXDecode')) {
        out.push({ bytes: new Uint8Array(contents), mime: 'image/jp2', page: i + 1 });
      } else if (filterName.includes('FlateDecode')) {
        // Raw pixel stream — skip (would need DeviceRGB/Gray decode). Most embedded
        // photos in INPI documents are DCT (JPEG), so we still cover the main case.
        continue;
      }
    }
  }
  return out;
}

async function ocrAndCaptionImage(pngBytes: Uint8Array, contextHint: string, mime: string = 'image/png'): Promise<{ caption: string; ocr: string }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return { caption: contextHint, ocr: '' };

  // Convert to base64
  let bin = '';
  for (let i = 0; i < pngBytes.length; i++) bin += String.fromCharCode(pngBytes[i]);
  const b64 = btoa(bin);

  try {
    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Você analisa páginas de documentos jurídicos do INPI. Responda em JSON: {"caption": "legenda curta (até 120 caracteres) descrevendo o que a página mostra como evidência (ex.: \\"Print do site do concorrente em 12/2024\\", \\"Decisão de indeferimento INPI fls. 03\\", \\"Foto do rótulo do produto\\")", "ocr": "texto integral visível na página (máx. 3000 chars)"}. Apenas JSON válido.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Contexto: ${contextHint}` },
              { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
            ],
          },
        ],
      }),
    });
    if (!resp.ok) {
      console.warn('OCR gateway non-200:', resp.status);
      return { caption: contextHint, ocr: '' };
    }
    const data = await resp.json();
    const txt: string = data?.choices?.[0]?.message?.content || '';
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return { caption: contextHint, ocr: txt.slice(0, 3000) };
    try {
      const obj = JSON.parse(m[0]);
      return {
        caption: String(obj.caption || contextHint).slice(0, 160),
        ocr: String(obj.ocr || '').slice(0, 3000),
      };
    } catch {
      return { caption: contextHint, ocr: txt.slice(0, 3000) };
    }
  } catch (e) {
    console.warn('OCR error:', (e as Error).message);
    return { caption: contextHint, ocr: '' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: uErr } = await userClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (uErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: isAdmin } = await userClient.rpc('has_role', { _user_id: userData.user.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Acesso de administrador necessário' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const resourceId: string = body.resource_id;
    const files: FileInput[] = body.files || [];
    const doOcr: boolean = body.ocr !== false;

    if (!resourceId || files.length === 0) {
      return new Response(JSON.stringify({ error: 'resource_id e files são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    await ensureBucket(admin);

    // Find current max display_order
    const { data: existing } = await admin
      .from('inpi_resource_evidences')
      .select('display_order')
      .eq('resource_id', resourceId)
      .order('display_order', { ascending: false })
      .limit(1);
    let order = (existing && existing[0]?.display_order) ? existing[0].display_order + 1 : 1;

    const inserted: EvidenceRow[] = [];

    for (const f of files) {
      const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
      const isImage = f.type.startsWith('image/');
      if (!isPdf && !isImage) continue;

      if (isImage) {
        const bytes = base64ToBytes(f.base64);
        const path = `${resourceId}/${crypto.randomUUID()}.${(f.type.split('/')[1] || 'png')}`;
        const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
          contentType: f.type, upsert: false,
        });
        if (upErr) { console.warn('upload img err:', upErr.message); continue; }
        const meta = doOcr ? await ocrAndCaptionImage(bytes, `Imagem anexa: ${f.name}`) : { caption: f.name, ocr: '' };
        const row: EvidenceRow = {
          resource_id: resourceId,
          storage_path: path,
          page_number: null,
          source_file_name: f.name,
          mime_type: f.type,
          caption: meta.caption,
          ocr_text: meta.ocr,
          placement: 'annex',
          display_order: order++,
          included: true,
        };
        const { data: ins } = await admin.from('inpi_resource_evidences').insert(row).select().single();
        if (ins) inserted.push(ins as unknown as EvidenceRow);
        continue;
      }

      // PDF
      try {
        const pdfBytes = base64ToBytes(f.base64);
        const imgs = await extractPdfEmbeddedImages(pdfBytes);
        if (imgs.length === 0) {
          console.log('No embedded images in PDF:', f.name);
        }
        for (const im of imgs) {
          const ext = im.mime === 'image/jpeg' ? 'jpg' : (im.mime === 'image/jp2' ? 'jp2' : 'bin');
          const path = `${resourceId}/${crypto.randomUUID()}_p${im.page}.${ext}`;
          const { error: upErr } = await admin.storage.from(BUCKET).upload(path, im.bytes, {
            contentType: im.mime, upsert: false,
          });
          if (upErr) { console.warn('upload img err:', upErr.message); continue; }
          // OCR only for jpeg (gateway accepts data:image/jpeg). Skip jp2.
          const meta = (doOcr && im.mime === 'image/jpeg')
            ? await ocrAndCaptionImage(im.bytes, `${f.name} — pág. ${im.page}`, 'image/jpeg')
            : { caption: `${f.name} — pág. ${im.page}`, ocr: '' };
          const row: EvidenceRow = {
            resource_id: resourceId,
            storage_path: path,
            page_number: im.page,
            source_file_name: f.name,
            mime_type: im.mime,
            caption: meta.caption,
            ocr_text: meta.ocr,
            placement: 'annex',
            display_order: order++,
            included: true,
          };
          const { data: ins } = await admin.from('inpi_resource_evidences').insert(row).select().single();
          if (ins) inserted.push(ins as unknown as EvidenceRow);
        }
      } catch (e) {
        console.error('PDF render failed for', f.name, (e as Error).message);
      }
    }

    return new Response(JSON.stringify({ success: true, count: inserted.length, evidences: inserted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('extract-resource-evidences error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
