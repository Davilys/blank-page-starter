import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const onlyDigits = (v: string) => (v || '').replace(/\D/g, '');

const isValidCNPJ = (raw: string): boolean => {
  const c = onlyDigits(raw);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (len: number) => {
    let pos = len - 7;
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += Number(c[i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
};

const fetchWithTimeout = async (url: string, ms = 12000) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
  } finally {
    clearTimeout(t);
  }
};

const GENERIC_ERROR = 'Não foi possível consultar os dados agora. Tente novamente.';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Autenticação: somente usuários administradores do CRM
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ status: 'error', message: GENERIC_ERROR, sources: [] }, 401);

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) return json({ status: 'error', message: GENERIC_ERROR, sources: [] }, 403);

    const body = await req.json().catch(() => ({}));
    const type = String(body?.type ?? '');
    const value = String(body?.value ?? '');

    if (type === 'cep') {
      const cep = onlyDigits(value);
      if (cep.length !== 8) return json({ status: 'invalid', message: 'CEP inválido.', sources: [] });
      const res = await fetchWithTimeout(`https://viacep.com.br/ws/${cep}/json/`);
      if (res.status === 429) return json({ status: 'error', message: 'Muitas consultas em sequência. Aguarde alguns instantes.', sources: [] });
      if (!res.ok) return json({ status: 'error', message: GENERIC_ERROR, sources: [] });
      const d = await res.json();
      if (d?.erro) return json({ status: 'not_found', message: 'Nenhuma atualização cadastral encontrada.', sources: ['ViaCEP'] });
      return json({
        status: 'ok',
        sources: ['ViaCEP'],
        data: {
          zip_code: d.cep ?? null,
          address: d.logradouro || null,
          address_complement: d.complemento || null,
          neighborhood: d.bairro || null,
          city: d.localidade || null,
          state: d.uf || null,
        },
      });
    }

    if (type === 'cnpj') {
      const cnpj = onlyDigits(value);
      if (!isValidCNPJ(cnpj)) {
        return json({ status: 'invalid', message: 'O CNPJ informado não é válido.', sources: [] });
      }
      const res = await fetchWithTimeout(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (res.status === 404) {
        return json({ status: 'not_found', message: 'Nenhuma atualização cadastral encontrada.', sources: ['BrasilAPI'] });
      }
      if (res.status === 429) {
        return json({ status: 'error', message: 'Muitas consultas em sequência. Aguarde alguns instantes.', sources: [] });
      }
      if (!res.ok) return json({ status: 'error', message: GENERIC_ERROR, sources: [] });
      const d = await res.json();

      const phones = [d.ddd_telefone_1, d.ddd_telefone_2]
        .map((p: unknown) => String(p ?? '').trim())
        .filter((p: string) => onlyDigits(p).length >= 10);
      const emails = [d.email].map((e: unknown) => String(e ?? '').trim()).filter(Boolean);
      const cnae = d.cnae_fiscal
        ? `${d.cnae_fiscal}${d.cnae_fiscal_descricao ? ` - ${d.cnae_fiscal_descricao}` : ''}`
        : null;

      return json({
        status: 'ok',
        sources: ['BrasilAPI'],
        data: {
          company_name: d.razao_social || null,
          trade_name: d.nome_fantasia || null,
          registration_status: d.descricao_situacao_cadastral || null,
          cnae,
          opening_date: d.data_inicio_atividade || null,
          share_capital: typeof d.capital_social === 'number' ? d.capital_social : null,
          zip_code: d.cep ? String(d.cep) : null,
          address: [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(' ') || null,
          address_number: d.numero ? String(d.numero) : null,
          address_complement: d.complemento || null,
          neighborhood: d.bairro || null,
          city: d.municipio || null,
          state: d.uf || null,
          phones,
          emails,
        },
      });
    }

    if (type === 'cpf') {
      // Nenhum provedor oficial/comercial configurado.
      return json({ status: 'unavailable', message: 'Consulta de CPF não disponível no momento.', sources: [] });
    }

    return json({ status: 'error', message: GENERIC_ERROR, sources: [] }, 400);
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === 'AbortError';
    return json({
      status: 'error',
      message: aborted ? 'A consulta demorou demais. Tente novamente.' : GENERIC_ERROR,
      sources: [],
    });
  }
});
