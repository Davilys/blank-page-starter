/**
 * client-process-lookup
 *
 * Consulta sob demanda de um processo do INPI pela ÁREA DO CLIENTE.
 *   Frontend (cliente autenticado) -> esta função -> {WEBMARCAS_API_BASE_URL}/v1/processes/lookup
 *
 * Irmã da inpi-process-lookup (painel admin), com escopo reduzido e seguro:
 * - Exige sessão válida; NÃO exige papel de administrador.
 * - TITULARIDADE: o process_number pedido precisa pertencer a um
 *   brand_processes do próprio usuário (user_id = auth.uid()).
 * - Efeitos colaterais: APENAS o cache compartilhado rpi_process_lookups.
 *   Não escreve em brand_processes, não toca rpi_entries, não vincula clientes,
 *   não dispara notificações — nada de workflow comercial/operacional.
 * - Cache de 24 h, cooldown de 5 min após falha e intervalo mínimo de 15 min
 *   entre chamadas reais ao INPI por processo (mesmo com force), para que o
 *   botão do cliente não pressione a fonte oficial.
 * - Falha preserva e devolve a consulta anterior, com aviso honesto.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const UPSTREAM_TIMEOUT_MS = 35_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000;
const MIN_UPSTREAM_INTERVAL_MS = 15 * 60 * 1000;
const MAX_CONCURRENT_UPSTREAM = 4;

let inFlight = 0;

type Json = Record<string, unknown>;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function fail(code: string, message: string, status: number) {
  return json({ ok: false, error: { code, message } }, status);
}

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('invalid_input', 'Método não permitido.', 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  // ── autenticação: sessão válida do cliente ──
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return fail('unauthorized', 'Sessão não encontrada. Faça login novamente.', 401);
  }
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await authClient.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) {
    return fail('unauthorized', 'Sessão inválida ou expirada.', 401);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // ── entrada ──
  let body: Json;
  try {
    body = (await req.json()) as Json;
  } catch {
    return fail('invalid_input', 'Corpo da requisição inválido.', 400);
  }

  const processNumber = typeof body.process_number === 'string' ? body.process_number.trim() : '';
  const force = body.force === true;

  if (!/^[0-9]{9}$/.test(processNumber)) {
    return fail('invalid_input', 'Número do processo inválido. Informe exatamente 9 dígitos.', 400);
  }

  // ── titularidade: o processo precisa ser do próprio cliente ──
  const { data: owned } = await admin
    .from('brand_processes')
    .select('id')
    .eq('user_id', user.id)
    .eq('process_number', processNumber)
    .limit(1);
  if (!owned || owned.length === 0) {
    return fail('forbidden', 'Este processo não está vinculado à sua conta.', 403);
  }

  // ── cache / cooldown ──
  const { data: cached } = await admin
    .from('rpi_process_lookups')
    .select('*')
    .eq('process_number', processNumber)
    .maybeSingle();

  const now = Date.now();
  // Em QUALQUER erro depois deste ponto, devolve a última consulta boa junto:
  // falha preserva o estado anterior também na resposta, não só na tela.
  const preserved =
    cached && cached.lookup_status === 'completed' ? { from_cache: true, lookup: cached } : {};
  if (cached) {
    const queriedAt = cached.queried_at ? Date.parse(cached.queried_at as string) : 0;
    if (!force && cached.lookup_status === 'completed' && queriedAt && now - queriedAt < CACHE_TTL_MS) {
      return json({ ok: true, from_cache: true, lookup: cached }, 200);
    }
    const lastErrorAt = cached.last_error_at ? Date.parse(cached.last_error_at as string) : 0;
    if (lastErrorAt && now - lastErrorAt < FAILURE_COOLDOWN_MS) {
      return json(
        {
          ok: false,
          from_cache: true,
          lookup: cached.lookup_status === 'completed' ? cached : null,
          error: {
            code: cached.last_error_code ?? 'upstream_error',
            message:
              'Não foi possível atualizar os dados deste processo no INPI agora. As informações existentes foram mantidas.',
          },
        },
        200,
      );
    }
    // Intervalo mínimo entre chamadas reais ao INPI, mesmo com force.
    if (queriedAt && now - queriedAt < MIN_UPSTREAM_INTERVAL_MS) {
      return json({ ok: true, from_cache: true, lookup: cached }, 200);
    }
  }

  // ── segredos ──
  const baseUrlRaw = Deno.env.get('WEBMARCAS_API_BASE_URL') ?? '';
  const apiKey = Deno.env.get('WEBMARCAS_API_KEY') ?? '';
  const baseUrl = baseUrlRaw.trim().replace(/\/+$/, '').replace(/\/v1(\/.*)?$/i, '');
  if (!baseUrl || !apiKey || !/^https:\/\//i.test(baseUrl)) {
    console.error('[client-process-lookup] secrets WEBMARCAS_API_BASE_URL/WEBMARCAS_API_KEY ausentes');
    return json({ ok: false, ...preserved, error: { code: 'not_configured', message: 'Integração de consulta ainda não configurada.' } }, 503);
  }

  if (inFlight >= MAX_CONCURRENT_UPSTREAM) {
    // 200 (não 429): com status não-2xx o supabase-js devolve data=null e a UI
    // perderia a mensagem real e a consulta preservada que seguem no corpo.
    return json({ ok: false, ...preserved, error: { code: 'rate_limited', message: 'Muitas consultas em andamento. Tente novamente em instantes.' } }, 200);
  }

  // ── consulta upstream ──
  const recordFailure = async (code: string) => {
    await admin.from('rpi_process_lookups').upsert(
      {
        process_number: processNumber,
        lookup_status: 'failed',
        last_error_code: code,
        last_error_at: new Date().toISOString(),
      },
      { onConflict: 'process_number' },
    );
  };

  let upstreamJson: Json | null = null;
  let upstreamStatus = 0;
  inFlight++;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const res = await fetch(`${baseUrl}/v1/processes/lookup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ process_number: processNumber }),
        signal: ctrl.signal,
      });
      upstreamStatus = res.status;
      const text = await res.text();
      try {
        upstreamJson = JSON.parse(text) as Json;
      } catch {
        upstreamJson = null;
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    const aborted = (e as Error)?.name === 'AbortError';
    console.error('[client-process-lookup] falha de rede', aborted ? 'timeout' : 'network');
    await recordFailure(aborted ? 'upstream_timeout' : 'upstream_unavailable');
    return json(
      {
        ok: false,
        ...preserved,
        error: {
          code: aborted ? 'upstream_timeout' : 'upstream_unavailable',
          message:
            'Não foi possível atualizar os dados deste processo no INPI agora. As informações existentes foram mantidas.',
        },
      },
      200,
    );
  } finally {
    inFlight--;
  }

  const upstreamState = typeof upstreamJson?.status === 'string' ? (upstreamJson.status as string) : '';

  if (upstreamStatus === 401 || upstreamStatus === 403) {
    console.error('[client-process-lookup] autenticação da integração recusada');
    await recordFailure('integration_auth');
    return json(
      {
        ok: false,
        ...preserved,
        error: {
          code: 'integration_auth',
          message: 'A integração de consulta ao INPI recusou a autenticação. Verifique a configuração da chave.',
        },
      },
      200,
    );
  }

  if (upstreamStatus === 404 && upstreamState === 'not_found') {
    await admin.from('rpi_process_lookups').upsert(
      {
        process_number: processNumber,
        lookup_status: 'not_found',
        last_error_code: 'not_found',
        last_error_at: new Date().toISOString(),
      },
      { onConflict: 'process_number' },
    );
    return json(
      {
        ok: false,
        ...preserved,
        error: {
          code: 'not_found',
          message: 'Processo não localizado nesta consulta. Confira o número e tente novamente.',
        },
      },
      200,
    );
  }

  const proc = (upstreamJson?.process ?? null) as Json | null;
  const validShape =
    upstreamStatus >= 200 &&
    upstreamStatus < 300 &&
    upstreamState === 'completed' &&
    proc !== null &&
    typeof proc === 'object' &&
    String(proc.process_number ?? '') === processNumber;

  if (!validShape) {
    const code =
      upstreamState === 'inconclusive' || upstreamStatus === 503 ? 'inconclusive' : 'upstream_error';
    console.error('[client-process-lookup] resposta inesperada', upstreamStatus, upstreamState);
    await recordFailure(code);
    return json(
      {
        ok: false,
        ...preserved,
        error: {
          code,
          message:
            'Não foi possível atualizar os dados deste processo no INPI agora. As informações existentes foram mantidas.',
        },
      },
      200,
    );
  }

  const lookupRow = {
    process_number: processNumber,
    brand_name: str(proc.brand_name),
    holder: str(proc.holder),
    ncl_class: str(proc.ncl_class),
    current_status: str(proc.current_status),
    presentation: str(proc.presentation),
    nature: str(proc.nature),
    class_status: str(proc.class_status),
    specification: str(proc.specification),
    legal_representative: str(proc.legal_representative),
    priority_date: str(proc.priority_date),
    filing_date: str(proc.filing_date),
    grant_date: str(proc.grant_date),
    expiry_date: str(proc.expiry_date),
    source_url: str(proc.source_url),
    source: str(proc.source),
    detail_status: str(proc.detail_status),
    lookup_status: 'completed',
    queried_at: str(proc.queried_at) ?? new Date().toISOString(),
    last_error_code: null,
    last_error_at: null,
  };

  const { data: savedLookup, error: lookupErr } = await admin
    .from('rpi_process_lookups')
    .upsert(lookupRow, { onConflict: 'process_number' })
    .select()
    .maybeSingle();

  if (lookupErr) {
    console.error('[client-process-lookup] falha ao gravar cache', lookupErr.message);
    return json(
      {
        ok: false,
        ...preserved,
        error: {
          code: 'cache_write_failed',
          message:
            'Não foi possível atualizar os dados deste processo no INPI agora. As informações existentes foram mantidas.',
        },
      },
      200,
    );
  }

  return json({ ok: true, saved: true, from_cache: false, lookup: savedLookup }, 200);
});
