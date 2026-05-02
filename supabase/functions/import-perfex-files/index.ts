import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_URL = 'https://webmarcas1.lovable.app';
const PERFEX_BASE = 'https://crm.webmarcas.net/uploads';
const MASTER_EMAIL = 'davillys@gmail.com';

interface FileRecord {
  perfex_id: number;
  rel_id: number;
  rel_type: string;
  file_name: string;
  filetype: string | null;
  client_email: string | null;
  date_added: string | null;
  attachment_key?: string | null;
}

async function fetchNdjsonGz(url: string): Promise<string[]> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('text/html')) throw new Error(`URL ${url} returned HTML, not gzip`);
  const ds = new DecompressionStream('gzip');
  const decompressed = res.body!.pipeThrough(ds);
  const text = await new Response(decompressed).text();
  return text.split('\n').filter(l => l.trim());
}

async function loadNdjson(supabase: ReturnType<typeof createClient>, fileName: string, fallbackUrl: string): Promise<string[]> {
  const storagePath = `generated/${fileName}`;
  const { data: signed } = await supabase.storage.from('perfex-import').createSignedUrl(storagePath, 60);
  if (signed?.signedUrl) {
    try { return await fetchNdjsonGz(signed.signedUrl); } catch (_) { /* fall through */ }
  }
  return fetchNdjsonGz(fallbackUrl);
}

function buildCandidates(f: FileRecord): string[] {
  const c: string[] = [
    `${PERFEX_BASE}/${f.rel_type}/${f.rel_id}/${f.file_name}`,
    `${PERFEX_BASE}/${f.rel_type}_files/${f.rel_id}/${f.file_name}`,
    `${PERFEX_BASE}/${f.rel_type}s/${f.rel_id}/${f.file_name}`,
    `${PERFEX_BASE}/clients/${f.rel_id}/${f.file_name}`,
    `${PERFEX_BASE}/contracts/${f.rel_id}/${f.file_name}`,
  ];
  if (f.attachment_key) {
    c.push(`https://crm.webmarcas.net/download/file/${f.attachment_key}`);
  }
  return [...new Set(c)];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user || user.email !== MASTER_EMAIL) {
      return new Response(JSON.stringify({ error: 'Forbidden — Master only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const url = new URL(req.url);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const dryRun = url.searchParams.get('dryRun') === '1' || url.searchParams.get('dryRun') === 'true';

    const lines = await loadNdjson(supabase, 'files.ndjson.gz', `${APP_URL}/perfex-data/files.ndjson.gz`);
    const total = lines.length;
    const slice = lines.slice(offset, offset + limit);

    let imported = 0, skipped = 0, errors = 0, notFound = 0;
    const errorDetails: string[] = [];
    const samples: any[] = [];

    for (const line of slice) {
      let f: FileRecord;
      try { f = JSON.parse(line); } catch { errors++; continue; }
      const email = (f.client_email || '').toLowerCase().trim();
      if (!email) { skipped++; continue; }

      try {
        const { data: profile } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
        if (!profile) { skipped++; continue; }

        const candidates = buildCandidates(f);

        if (dryRun) {
          samples.push({ file: f.file_name, rel_type: f.rel_type, email, candidates_count: candidates.length });
          imported++;
          continue;
        }

        const storagePath = `imported/perfex/${f.rel_type}/${f.rel_id}/${f.file_name}`;
        const { data: existingDoc } = await supabase.from('documents').select('id').eq('user_id', profile.id)
          .like('file_url', `%${storagePath}%`).maybeSingle();
        if (existingDoc) { skipped++; continue; }

        let bytes: ArrayBuffer | null = null;
        for (const u of candidates) {
          try {
            const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
            const ct = r.headers.get('content-type') || '';
            if (r.ok && !ct.includes('text/html')) {
              bytes = await r.arrayBuffer();
              break;
            }
          } catch { /* try next */ }
        }
        if (!bytes) { notFound++; continue; }

        const { error: upErr } = await supabase.storage.from('documents').upload(
          storagePath, bytes,
          { contentType: f.filetype || 'application/octet-stream', upsert: true }
        );
        if (upErr) { errors++; errorDetails.push(`${f.file_name}: upload ${upErr.message}`); continue; }

        const { data: publicUrl } = supabase.storage.from('documents').getPublicUrl(storagePath);

        let contractId: string | null = null;
        if (f.rel_type === 'contract') {
          const perfexMarker = `[PERFEX_ID:${f.rel_id}]`;
          const { data: ct } = await supabase.from('contracts').select('id').eq('user_id', profile.id)
            .ilike('description', `%${perfexMarker}%`).maybeSingle();
          if (ct) contractId = ct.id;
        }

        await supabase.from('documents').insert({
          user_id: profile.id, contract_id: contractId,
          name: f.file_name, file_url: publicUrl.publicUrl,
          mime_type: f.filetype, uploaded_by: 'import_perfex',
          document_type: f.rel_type === 'contract' ? 'contrato' : 'documento',
        });
        imported++;
      } catch (e) {
        errors++;
        errorDetails.push(`${f.file_name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const nextOffset = offset + slice.length;
    const done = nextOffset >= total;
    return new Response(JSON.stringify({
      imported, skipped, errors, notFound,
      errorDetails: errorDetails.slice(0, 30),
      samples: dryRun ? samples.slice(0, 10) : undefined,
      total, processed: nextOffset, nextOffset, done, dryRun,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('import-perfex-files error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
