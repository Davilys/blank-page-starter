import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MASTER_EMAIL = 'davillys@gmail.com';

interface CustomerRecord {
  source: string;
  perfex_id: number;
  email: string;
  full_name: string;
  phone?: string | null;
  company_name?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  cpf_cnpj?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  brand_name?: string | null;
  business_area?: string | null;
}

async function loadNdjsonFromStorage(supabase: ReturnType<typeof createClient>, fileName: string): Promise<string[]> {
  const path = `generated/${fileName}`;
  const { data: blob, error } = await supabase.storage.from('perfex-import').download(path);
  if (error || !blob) {
    throw new Error(`Arquivo gerado ausente: ${path}. Execute o parse do dump primeiro.`);
  }
  const buf = new Uint8Array(await blob.arrayBuffer());
  // validate gzip header (1f 8b)
  if (buf.length < 2 || buf[0] !== 0x1f || buf[1] !== 0x8b) {
    throw new Error(`Arquivo ${path} não é gzip válido (primeiros bytes: ${buf[0]?.toString(16)} ${buf[1]?.toString(16)}). Reexecute o parse.`);
  }
  const ds = new DecompressionStream('gzip');
  const stream = new Blob([buf]).stream().pipeThrough(ds);
  const text = await new Response(stream).text();
  return text.split('\n').filter(l => l.trim());
}

async function findExisting(supabase: ReturnType<typeof createClient>, c: CustomerRecord) {
  const { data: byEmail } = await supabase.from('profiles').select('id').eq('email', c.email).maybeSingle();
  if (byEmail) return byEmail;
  if (c.cpf) {
    const { data } = await supabase.from('profiles').select('id').eq('cpf', c.cpf).maybeSingle();
    if (data) return data;
  }
  if (c.cnpj) {
    const { data } = await supabase.from('profiles').select('id').eq('cnpj', c.cnpj).maybeSingle();
    if (data) return data;
  }
  if (c.cpf_cnpj) {
    const { data } = await supabase.from('profiles').select('id').eq('cpf_cnpj', c.cpf_cnpj).maybeSingle();
    if (data) return data;
  }
  return null;
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
    const limit = parseInt(url.searchParams.get('limit') || '30');
    const dryRun = url.searchParams.get('dryRun') === '1' || url.searchParams.get('dryRun') === 'true';

    const lines = await loadNdjsonFromStorage(supabase, 'customers.ndjson.gz');
    const total = lines.length;
    const slice = lines.slice(offset, offset + limit);

    let imported = 0, skipped = 0, errors = 0;
    const errorDetails: string[] = [];
    const samples: any[] = [];

    for (const line of slice) {
      let c: CustomerRecord;
      try { c = JSON.parse(line); } catch { errors++; continue; }
      const email = (c.email || '').toLowerCase().trim();
      if (!email) { skipped++; continue; }

      try {
        const existing = await findExisting(supabase, c);
        if (dryRun) {
          samples.push({ email, full_name: c.full_name, exists: !!existing });
          if (existing) skipped++; else imported++;
          continue;
        }
        if (existing) { skipped++; continue; }

        let userId: string;
        const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
          email,
          password: '123Mudar@',
          email_confirm: true,
          user_metadata: { full_name: c.full_name || email },
        });
        if (authErr) {
          if (authErr.message?.includes('already')) {
            const { data: foundId } = await supabase.rpc('get_auth_user_id_by_email', { lookup_email: email });
            if (!foundId) { errors++; errorDetails.push(`${email}: auth exists but ID not found`); continue; }
            userId = foundId as string;
          } else {
            errors++; errorDetails.push(`${email}: ${authErr.message}`); continue;
          }
        } else {
          userId = authData!.user!.id;
        }

        await supabase.from('profiles').upsert({
          id: userId,
          email,
          full_name: c.full_name || null,
          phone: c.phone || null,
          company_name: c.company_name || null,
          cpf: c.cpf || null,
          cnpj: c.cnpj || null,
          cpf_cnpj: c.cpf_cnpj || null,
          address: c.address || null,
          neighborhood: c.neighborhood || null,
          city: c.city || null,
          state: c.state || null,
          zip_code: c.zip_code || null,
          origin: 'import_perfex',
          client_funnel_type: 'juridico',
          created_by: user.id,
          assigned_to: user.id,
        });

        await supabase.from('user_roles').insert({ user_id: userId, role: 'user' }).then(() => {}).catch(() => {});

        const brandName = c.brand_name || c.company_name || c.full_name || email;
        await supabase.from('brand_processes').insert({
          user_id: userId,
          brand_name: brandName,
          business_area: c.business_area || null,
          status: 'em_andamento',
          pipeline_stage: 'protocolado',
        }).then(() => {}).catch(() => {});

        imported++;
      } catch (e) {
        errors++; errorDetails.push(`${email}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const nextOffset = offset + slice.length;
    const done = nextOffset >= total;

    return new Response(JSON.stringify({
      imported, skipped, errors,
      errorDetails: errorDetails.slice(0, 30),
      samples: dryRun ? samples.slice(0, 10) : undefined,
      total, processed: nextOffset, nextOffset, done, dryRun,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('import-perfex-customers error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
