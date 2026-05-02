import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_URL = 'https://webmarcas1.lovable.app';
const PERFEX_HOST = 'https://crm.webmarcas.net';
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

// ── Perfex session management ────────────────────────────────────────────────
// Parses Set-Cookie headers into a single cookie string.
function parseCookies(headers: Headers, jar: Map<string, string>) {
  const setCookies = (headers as any).getSetCookie?.() ?? [];
  for (const sc of setCookies) {
    const [pair] = sc.split(';');
    const eq = pair.indexOf('=');
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}
function jarToHeader(jar: Map<string, string>): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function perfexLogin(): Promise<{ jar: Map<string, string> } | null> {
  const email = Deno.env.get('PERFEX_LOGIN_EMAIL');
  const password = Deno.env.get('PERFEX_LOGIN_PASSWORD');
  if (!email || !password) {
    console.error('PERFEX_LOGIN_EMAIL / PERFEX_LOGIN_PASSWORD not set');
    return null;
  }
  const jar = new Map<string, string>();
  // 1) GET login page → cookies + csrf token
  const getRes = await fetch(`${PERFEX_HOST}/admin/authentication`, {
    headers: { 'User-Agent': 'Mozilla/5.0 WebMarcasImporter' },
    redirect: 'manual',
  });
  parseCookies(getRes.headers, jar);
  const html = await getRes.text();
  const csrfMatch = html.match(/name="csrf_token_name"\s+value="([^"]+)"/);
  const csrfToken = csrfMatch?.[1] ?? jar.get('csrf_cookie_name');
  if (!csrfToken) {
    console.error('Could not extract csrf_token from Perfex login page');
    return null;
  }
  // 2) POST login
  const form = new URLSearchParams();
  form.set('csrf_token_name', csrfToken);
  form.set('email', email);
  form.set('password', password);
  form.set('remember', '1');
  const postRes = await fetch(`${PERFEX_HOST}/admin/authentication`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': jarToHeader(jar),
      'User-Agent': 'Mozilla/5.0 WebMarcasImporter',
      'Referer': `${PERFEX_HOST}/admin/authentication`,
    },
    body: form.toString(),
    redirect: 'manual',
  });
  parseCookies(postRes.headers, jar);
  // Successful login → 302/303 to /admin
  if (postRes.status >= 300 && postRes.status < 400) {
    console.log('Perfex login OK, status', postRes.status, 'cookies:', jar.size);
    return { jar };
  }
  console.error('Perfex login failed, status', postRes.status);
  return null;
}

// Folder name used by Perfex for download/file/{folder}/{rel_id}/{file_name}
function folderForRelType(relType: string): string {
  const map: Record<string, string> = {
    customer: 'customer',
    client: 'customer',
    contract: 'contract',
    lead: 'lead',
    project: 'project',
    task: 'task',
    expense: 'expense',
    invoice: 'invoice',
    estimate: 'estimate',
    proposal: 'proposal',
    ticket: 'ticket',
    company: 'company',
  };
  return map[relType] || relType;
}

function buildCandidates(f: FileRecord): string[] {
  const folder = folderForRelType(f.rel_type);
  const c: string[] = [
    `${PERFEX_HOST}/download/file/${folder}/${f.rel_id}/${f.file_name}`,
    `${PERFEX_HOST}/download/preview_image/${folder}/${f.file_name}`,
    `${PERFEX_HOST}/uploads/${folder}/${f.rel_id}/${f.file_name}`,
    `${PERFEX_HOST}/uploads/${folder}_files/${f.rel_id}/${f.file_name}`,
    `${PERFEX_HOST}/uploads/${folder}s/${f.rel_id}/${f.file_name}`,
  ];
  if (f.attachment_key) {
    c.push(`${PERFEX_HOST}/download/file_by_id/${f.perfex_id}`);
  }
  return [...new Set(c)];
}

function inferDocumentType(f: FileRecord): string {
  if (f.rel_type === 'contract') return 'contrato';
  const n = (f.file_name || '').toLowerCase();
  if (n.includes('procura')) return 'procuracao';
  if (n.includes('distrato')) return 'distrato';
  if (n.includes('certificado')) return 'certificado';
  if (n.includes('rpi')) return 'rpi';
  if (n.includes('parecer')) return 'parecer';
  if (n.includes('comprovante') || n.includes('boleto') || n.includes('nf') || n.includes('fatura')) return 'comprovante';
  if (n.includes('busca') || n.includes('inpi')) return 'busca_inpi';
  return 'anexo';
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

    // Login once per invocation, reuse for all downloads in this batch
    const session = dryRun ? null : await perfexLogin();
    if (!dryRun && !session) {
      return new Response(JSON.stringify({ error: 'Perfex login failed — verifique PERFEX_LOGIN_EMAIL/PERFEX_LOGIN_PASSWORD' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const cookieHeader = session ? jarToHeader(session.jar) : '';

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
        let triedUrls: string[] = [];
        for (const u of candidates) {
          triedUrls.push(u);
          try {
            const r = await fetch(u, {
              headers: {
                'Cookie': cookieHeader,
                'User-Agent': 'Mozilla/5.0 WebMarcasImporter',
                'Referer': PERFEX_HOST + '/admin',
              },
              redirect: 'follow',
              signal: AbortSignal.timeout(20000),
            });
            const ct = r.headers.get('content-type') || '';
            // Reject HTML (login page) and zero-byte responses
            if (r.ok && !ct.includes('text/html')) {
              bytes = await r.arrayBuffer();
              if (bytes.byteLength < 100) { bytes = null; continue; }
              break;
            }
          } catch { /* try next */ }
        }
        if (!bytes) {
          notFound++;
          if (errorDetails.length < 30) errorDetails.push(`${f.file_name} [${f.rel_type}/${f.rel_id}]: not found in any of ${triedUrls.length} URLs`);
          continue;
        }

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
          document_type: inferDocumentType(f),
          file_size: bytes.byteLength,
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
