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

type DocumentType = 'cnpj' | 'cpf' | 'cep';
type Source = 'BrasilAPI' | 'ViaCEP' | 'CPF Provider' | null;

const result = (
  success: boolean,
  status: string,
  documentType: DocumentType,
  source: Source,
  data?: Record<string, unknown>,
  message?: string,
) => ({ success, status, source, documentType, ...(data ? { data } : {}), ...(message ? { message } : {}) });

const countFields = (data: Record<string, unknown>) =>
  Object.values(data).reduce((total, value) => {
    if (Array.isArray(value)) return total + value.filter(Boolean).length;
    return total + (value === null || value === undefined || value === '' ? 0 : 1);
  }, 0);

const logDiagnostic = (payload: Record<string, unknown>) => {
  console.log(JSON.stringify({ event: 'data_enrichment', ...payload }));
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(result(false, 'provider_error', 'cnpj', null, undefined, GENERIC_ERROR), 405);

  const startedAt = Date.now();
  let documentType: DocumentType = 'cnpj';
  let provider: Source = null;
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
    if (!user) {
      logDiagnostic({ documentType, provider, result: 'unauthorized', durationMs: Date.now() - startedAt });
      return json(result(false, 'unauthorized', documentType, provider, undefined, GENERIC_ERROR), 401);
    }

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) {
      logDiagnostic({ documentType, provider, result: 'unauthorized', durationMs: Date.now() - startedAt });
      return json(result(false, 'unauthorized', documentType, provider, undefined, GENERIC_ERROR), 403);
    }

    const body = await req.json().catch(() => ({}));
    const type = String(body?.type ?? '');
    const value = String(body?.value ?? '');
    if (!['cnpj', 'cpf', 'cep'].includes(type)) {
      return json(result(false, 'invalid_document', 'cnpj', null, undefined, GENERIC_ERROR), 400);
    }
    documentType = type as DocumentType;

    if (type === 'cep') {
      provider = 'ViaCEP';
      const cep = onlyDigits(value);
      if (cep.length !== 8) return json(result(false, 'invalid_document', 'cep', provider, undefined, 'CEP inválido.'));
      logDiagnostic({ provider, documentType, phase: 'start' });
      const res = await fetchWithTimeout(`https://viacep.com.br/ws/${cep}/json/`);
      if (res.status === 429) {
        logDiagnostic({ provider, documentType, httpStatus: 429, result: 'rate_limited', durationMs: Date.now() - startedAt });
        return json(result(false, 'rate_limited', 'cep', provider, undefined, 'Muitas consultas em sequência. Aguarde alguns instantes.'));
      }
      if (!res.ok) {
        logDiagnostic({ provider, documentType, httpStatus: res.status, result: 'provider_error', durationMs: Date.now() - startedAt });
        return json(result(false, 'provider_error', 'cep', provider, undefined, GENERIC_ERROR));
      }
      const d = await res.json();
      if (d?.erro) return json(result(false, 'not_found', 'cep', provider, undefined, 'Nenhuma atualização cadastral encontrada.'));
      const data = {
          zip_code: d.cep ?? null,
          address: d.logradouro || null,
          address_complement: d.complemento || null,
          neighborhood: d.bairro || null,
          city: d.localidade || null,
          state: d.uf || null,
      };
      logDiagnostic({ provider, documentType, httpStatus: res.status, result: 'success', fieldCount: countFields(data), durationMs: Date.now() - startedAt });
      return json(result(true, 'success', 'cep', provider, data));
    }

    if (type === 'cnpj') {
      provider = 'BrasilAPI';
      const cnpj = onlyDigits(value);
      if (!isValidCNPJ(cnpj)) {
        return json(result(false, 'invalid_document', 'cnpj', provider, undefined, 'O CNPJ informado não é válido.'));
      }
      logDiagnostic({ provider, documentType, phase: 'start' });
      const res = await fetchWithTimeout(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (res.status === 404) {
        logDiagnostic({ provider, documentType, httpStatus: 404, result: 'not_found', durationMs: Date.now() - startedAt });
        return json(result(false, 'not_found', 'cnpj', provider, undefined, 'Nenhuma atualização cadastral encontrada.'));
      }
      if (res.status === 429) {
        logDiagnostic({ provider, documentType, httpStatus: 429, result: 'rate_limited', durationMs: Date.now() - startedAt });
        return json(result(false, 'rate_limited', 'cnpj', provider, undefined, 'Muitas consultas em sequência. Aguarde alguns instantes.'));
      }
      if (!res.ok) {
        logDiagnostic({ provider, documentType, httpStatus: res.status, result: 'provider_error', durationMs: Date.now() - startedAt });
        return json(result(false, 'provider_error', 'cnpj', provider, undefined, GENERIC_ERROR));
      }
      const d = await res.json();

      const phones = [d.ddd_telefone_1, d.ddd_telefone_2]
        .map((p: unknown) => String(p ?? '').trim())
        .filter((p: string) => onlyDigits(p).length >= 10);
      const emails = [d.email].map((e: unknown) => String(e ?? '').trim()).filter(Boolean);
      const cnae = d.cnae_fiscal
        ? `${d.cnae_fiscal}${d.cnae_fiscal_descricao ? ` - ${d.cnae_fiscal_descricao}` : ''}`
        : null;

      const data = {
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
      };
      logDiagnostic({ provider, documentType, httpStatus: res.status, result: 'success', fieldCount: countFields(data), durationMs: Date.now() - startedAt });
      return json(result(true, 'success', 'cnpj', provider, data));
    }

    if (type === 'cpf') {
      provider = 'CPF Provider';
      logDiagnostic({ provider, documentType, result: 'provider_unavailable', durationMs: Date.now() - startedAt });
      return json(result(false, 'provider_unavailable', 'cpf', provider, undefined,
        'Para este cadastro, a consulta automática de CPF ainda não está configurada.\nVocê pode continuar usando a atualização automática para empresas com CNPJ.'));
    }

    return json(result(false, 'invalid_document', documentType, provider, undefined, GENERIC_ERROR), 400);
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === 'AbortError';
    logDiagnostic({ provider, documentType, result: aborted ? 'timeout' : 'provider_error', durationMs: Date.now() - startedAt });
    return json(result(false, aborted ? 'timeout' : 'provider_error', documentType, provider, undefined,
      aborted ? 'A consulta demorou demais. Tente novamente.' : GENERIC_ERROR));
  }
});
