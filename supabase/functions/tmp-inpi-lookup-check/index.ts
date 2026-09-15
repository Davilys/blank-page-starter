// TEMPORÁRIO — apenas para homologar a rota /v1/processes/lookup. Remover após o teste.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const base = (Deno.env.get('WEBMARCAS_API_BASE_URL') ?? '').trim().replace(/\/+$/, '').replace(/\/v1(\/.*)?$/i, '');
  const key = Deno.env.get('WEBMARCAS_API_KEY') ?? '';
  const { process_number = '931053021' } = await req.json().catch(() => ({}));
  const res = await fetch(`${base}/v1/processes/lookup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ process_number }),
  });
  const text = await res.text();
  return new Response(JSON.stringify({ base_ok: !!base, status: res.status, body: text.slice(0, 2000) }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
