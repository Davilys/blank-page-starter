import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MASTER_EMAIL = 'davillys@gmail.com';

interface ContractRecord {
  perfex_id: number;
  perfex_client_id: number | null;
  client_email: string | null;
  subject: string | null;
  description: string | null;
  content_html: string | null;
  contract_value: number | null;
  start_date: string | null;
  end_date: string | null;
  signed: boolean;
  signed_at: string | null;
  signature_ip: string | null;
  signatory_name: string | null;
  signatory_email: string | null;
  date_added: string | null;
  hash: string | null;
}

async function loadNdjsonFromStorage(supabase: ReturnType<typeof createClient>, fileName: string): Promise<string[]> {
  const path = `generated/${fileName}`;
  const { data: blob, error } = await supabase.storage.from('perfex-import').download(path);
  if (error || !blob) {
    throw new Error(`Arquivo gerado ausente: ${path}. Execute o parse do dump primeiro.`);
  }
  const buf = new Uint8Array(await blob.arrayBuffer());
  if (buf.length < 2 || buf[0] !== 0x1f || buf[1] !== 0x8b) {
    throw new Error(`Arquivo ${path} não é gzip válido. Reexecute o parse.`);
  }
  const ds = new DecompressionStream('gzip');
  const stream = new Blob([buf]).stream().pipeThrough(ds);
  const text = await new Response(stream).text();
  return text.split('\n').filter(l => l.trim());
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
    const limit = parseInt(url.searchParams.get('limit') || '25');
    const dryRun = url.searchParams.get('dryRun') === '1' || url.searchParams.get('dryRun') === 'true';

    const lines = await loadNdjsonFromStorage(supabase, 'contracts.ndjson.gz');
    const total = lines.length;
    const slice = lines.slice(offset, offset + limit);

    let imported = 0, skipped = 0, errors = 0, missingClient = 0;
    const errorDetails: string[] = [];
    const samples: any[] = [];

    for (const line of slice) {
      let c: ContractRecord;
      try { c = JSON.parse(line); } catch { errors++; continue; }
      const email = (c.client_email || '').toLowerCase().trim();
      if (!email) { missingClient++; skipped++; continue; }

      try {
        const { data: profile } = await supabase
          .from('profiles').select('id').eq('email', email).maybeSingle();
        if (!profile) { missingClient++; skipped++; continue; }

        const perfexMarker = `[PERFEX_ID:${c.perfex_id}]`;
        const { data: existing } = await supabase
          .from('contracts').select('id').eq('user_id', profile.id)
          .ilike('description', `%${perfexMarker}%`).maybeSingle();

        if (dryRun) {
          samples.push({ perfex_id: c.perfex_id, email, client_found: true, contract_exists: !!existing, value: c.contract_value });
          if (existing) skipped++; else imported++;
          continue;
        }

        if (existing) { skipped++; continue; }

        await supabase.from('contracts').insert({
          user_id: profile.id,
          subject: c.subject || `Contrato Perfex #${c.perfex_id}`,
          description: `${c.description || ''}\n\n${perfexMarker}`,
          contract_html: c.content_html,
          contract_value: c.contract_value,
          start_date: c.start_date,
          end_date: c.end_date,
          signature_status: c.signed ? 'signed' : 'not_signed',
          signed_at: c.signed_at,
          signature_ip: c.signature_ip,
          signatory_name: c.signatory_name,
          contract_type: 'registro_marca',
          created_by: user.id,
          visible_to_client: true,
        });

        imported++;
      } catch (e) {
        errors++;
        errorDetails.push(`Contrato #${c.perfex_id} (${email}): ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const nextOffset = offset + slice.length;
    const done = nextOffset >= total;

    return new Response(JSON.stringify({
      imported, skipped, errors, missingClient,
      errorDetails: errorDetails.slice(0, 30),
      samples: dryRun ? samples.slice(0, 10) : undefined,
      total, processed: nextOffset, nextOffset, done, dryRun,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('import-perfex-contracts error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
