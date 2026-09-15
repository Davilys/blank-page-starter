/**
 * inpi-process-lookup
 *
 * Consulta sob demanda de um processo do INPI para a aba Revista INPI.
 *   Frontend (admin autenticado) -> esta função -> {WEBMARCAS_API_BASE_URL}/v1/processes/lookup
 *
 * - A chave (WEBMARCAS_API_KEY) só existe aqui; nunca é devolvida nem registrada em log.
 * - Exige sessão válida + papel de administrador (has_role), igual ao restante do painel.
 * - Rota síncrona: sem job_id, sem polling, sem Idempotency-Key.
 * - Cache de 24 h e intervalo mínimo de 5 min após falha, persistidos em rpi_process_lookups
 *   (funciona entre instâncias, não depende da memória do isolate).
 * - Preenche apenas campos vazios/placeholder de rpi_entries, de forma condicional e auditada.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const UPSTREAM_TIMEOUT_MS = 45_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000;
const MAX_CONCURRENT_UPSTREAM = 4;

let inFlight = 0;

const PLACEHOLDERS = new Set([
  '',
  '-',
  '—',
  '--',
  'n/a',
  'marca não identificada',
  'marca nao identificada',
  'aguardando identificação da marca',
  'aguardando identificacao da marca',
  'não informado',
  'nao informado',
  'titular não informado',
  'titular nao informado',
]);

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

function isEmptyish(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v !== 'string') return false;
  return PLACEHOLDERS.has(v.trim().toLowerCase());
}

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

/** "06/07/2023" -> "2023-07-06"; ISO passa direto; qualquer outra coisa -> null */
function toIsoDate(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

/** "NCL(12) 35" -> "35" (apenas quando há um número de classe identificável) */
function nclNumbers(official: string | null): string[] | null {
  if (!official) return null;
  const tail = official.replace(/NCL\s*\(\s*\d+\s*\)/gi, ' ');
  const nums = Array.from(tail.matchAll(/\b(\d{1,2})\b/g)).map((m) => m[1]);
  return nums.length ? Array.from(new Set(nums)) : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('invalid_input', 'Método não permitido.', 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  // ── autenticação: sessão válida ──
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

  // ── permissão: mesmo critério do painel administrativo ──
  const { data: isAdmin, error: roleErr } = await admin.rpc('has_role', {
    _user_id: user.id,
    _role: 'admin',
  });
  if (roleErr || !isAdmin) {
    return fail('forbidden', 'Você não tem permissão para consultar este registro.', 403);
  }

  // ── entrada ──
  let body: Json;
  try {
    body = (await req.json()) as Json;
  } catch {
    return fail('invalid_input', 'Corpo da requisição inválido.', 400);
  }

  const processNumber = typeof body.process_number === 'string' ? body.process_number.trim() : '';
  const entryId = typeof body.entry_id === 'string' ? body.entry_id : null;
  const force = body.force === true;

  if (!/^[0-9]{9}$/.test(processNumber)) {
    return fail('invalid_input', 'Número do processo inválido. Informe exatamente 9 dígitos.', 400);
  }

  // ── registro da revista (valida o acesso ao processo pedido) ──
  let entry: Json | null = null;
  if (entryId) {
    const { data } = await admin
      .from('rpi_entries')
      .select('*')
      .eq('id', entryId)
      .maybeSingle();
    if (!data) return fail('not_found', 'Registro da revista não encontrado.', 404);
    if (String(data.process_number) !== processNumber) {
      return fail('invalid_input', 'Número do processo não corresponde ao registro.', 400);
    }
    entry = data as Json;
  }

  // ── cache / cooldown ──
  const { data: cached } = await admin
    .from('rpi_process_lookups')
    .select('*')
    .eq('process_number', processNumber)
    .maybeSingle();

  const now = Date.now();
  if (cached && !force) {
    const queriedAt = cached.queried_at ? Date.parse(cached.queried_at as string) : 0;
    if (cached.lookup_status === 'completed' && queriedAt && now - queriedAt < CACHE_TTL_MS) {
      return json({ ok: true, from_cache: true, lookup: cached, applied: [] }, 200);
    }
    const lastErrorAt = cached.last_error_at ? Date.parse(cached.last_error_at as string) : 0;
    if (lastErrorAt && now - lastErrorAt < FAILURE_COOLDOWN_MS) {
      return json(
        {
          ok: false,
          from_cache: true,
          lookup: cached,
          error: {
            code: cached.last_error_code ?? 'upstream_error',
            message:
              'Não foi possível atualizar os dados deste processo no INPI agora. As informações existentes foram mantidas.',
          },
        },
        200,
      );
    }
  }

  // ── segredos ──
  const baseUrlRaw = Deno.env.get('WEBMARCAS_API_BASE_URL') ?? '';
  const apiKey = Deno.env.get('WEBMARCAS_API_KEY') ?? '';
  const baseUrl = baseUrlRaw.trim().replace(/\/+$/, '').replace(/\/v1(\/.*)?$/i, '');
  if (!baseUrl || !apiKey || !/^https:\/\//i.test(baseUrl)) {
    console.error('[inpi-process-lookup] secrets WEBMARCAS_API_BASE_URL/WEBMARCAS_API_KEY ausentes');
    return fail('not_configured', 'Integração de consulta ainda não configurada.', 503);
  }

  if (inFlight >= MAX_CONCURRENT_UPSTREAM) {
    return fail('rate_limited', 'Muitas consultas em andamento. Tente novamente em instantes.', 429);
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
    console.error('[inpi-process-lookup] falha de rede', aborted ? 'timeout' : 'network');
    await recordFailure(aborted ? 'upstream_timeout' : 'upstream_unavailable');
    return json(
      {
        ok: false,
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
    console.error('[inpi-process-lookup] autenticação da integração recusada');
    await recordFailure('integration_auth');
    return json(
      {
        ok: false,
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
    console.error('[inpi-process-lookup] resposta inesperada', upstreamStatus, upstreamState);
    await recordFailure(code);
    return json(
      {
        ok: false,
        error: {
          code,
          message:
            'Não foi possível atualizar os dados deste processo no INPI agora. As informações existentes foram mantidas.',
        },
      },
      200,
    );
  }

  const detailStatus = str(proc.detail_status);
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
    detail_status: detailStatus,
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
    console.error('[inpi-process-lookup] falha ao gravar cache', lookupErr.message);
    return json(
      {
        ok: false,
        error: {
          code: 'persist_failed',
          message: 'A consulta funcionou, mas não foi possível salvar o resultado. Tente novamente.',
        },
        lookup: lookupRow,
      },
      200,
    );
  }

  // ── preenchimento condicional do registro da revista ──
  const applied: string[] = [];
  const divergences: Array<{ field: string; current: unknown; official: unknown }> = [];

  if (entry) {
    // relê o registro imediatamente antes de gravar (edição manual simultânea)
    const { data: fresh } = await admin
      .from('rpi_entries')
      .select('*')
      .eq('id', entry.id as string)
      .maybeSingle();
    const cur = (fresh ?? entry) as Json;

    const updates: Json = {};
    const logs: Json[] = [];
    const conditions: Array<{ column: string; previous: unknown }> = [];

    const considerText = (column: string, value: string | null) => {
      if (!value) return;
      if (isEmptyish(cur[column])) {
        updates[column] = value;
        conditions.push({ column, previous: cur[column] ?? null });
        logs.push({
          rpi_entry_id: cur.id,
          process_number: processNumber,
          field_name: column,
          previous_value: cur[column] == null ? null : String(cur[column]),
          new_value: value,
          applied_by: user.id,
        });
        applied.push(column);
      } else if (String(cur[column]).trim().toLowerCase() !== value.trim().toLowerCase()) {
        divergences.push({ field: column, current: cur[column], official: value });
      }
    };

    considerText('brand_name', lookupRow.brand_name);
    considerText('holder_name', lookupRow.holder);
    considerText('situacao_atual', lookupRow.current_status);
    considerText('apresentacao', lookupRow.presentation);
    considerText('natureza', lookupRow.nature);
    considerText('attorney_name', lookupRow.legal_representative);

    // classe NCL: preserva o valor oficial completo no cache; no registro guarda os números.
    const classes = nclNumbers(lookupRow.ncl_class);
    const curClasses = Array.isArray(cur.ncl_classes) ? (cur.ncl_classes as string[]) : [];
    if (classes && curClasses.length === 0) {
      updates.ncl_classes = classes;
      conditions.push({ column: 'ncl_classes', previous: null });
      logs.push({
        rpi_entry_id: cur.id,
        process_number: processNumber,
        field_name: 'ncl_classes',
        previous_value: null,
        new_value: classes.join(', '),
        applied_by: user.id,
      });
      applied.push('ncl_classes');
    } else if (classes && curClasses.join(',') !== classes.join(',')) {
      divergences.push({ field: 'ncl_classes', current: curClasses, official: lookupRow.ncl_class });
    }

    // datas: priority_date NUNCA vira data de depósito
    const dateMap: Array<[string, string | null]> = [
      ['deposit_date', toIsoDate(lookupRow.filing_date)],
      ['concession_date', toIsoDate(lookupRow.grant_date)],
      ['validity_date', toIsoDate(lookupRow.expiry_date)],
    ];
    for (const [column, value] of dateMap) {
      if (!value) continue;
      if (cur[column] == null) {
        updates[column] = value;
        conditions.push({ column, previous: null });
        logs.push({
          rpi_entry_id: cur.id,
          process_number: processNumber,
          field_name: column,
          previous_value: null,
          new_value: value,
          applied_by: user.id,
        });
        applied.push(column);
      } else if (String(cur[column]) !== value) {
        divergences.push({ field: column, current: cur[column], official: value });
      }
    }

    if (Object.keys(updates).length > 0) {
      // atualização condicional: cada campo tocado precisa continuar com o valor lido acima
      let q = admin.from('rpi_entries').update(updates).eq('id', cur.id as string);
      for (const c of conditions) {
        q = c.previous === null ? q.is(c.column, null) : q.eq(c.column, c.previous as string);
      }
      const { data: updated, error: updErr } = await q.select('id');
      if (updErr || !updated || updated.length === 0) {
        console.error('[inpi-process-lookup] gravação não aplicada', updErr?.message ?? 'edição concorrente');
        return json(
          {
            ok: true,
            saved: false,
            lookup: savedLookup,
            applied: [],
            divergences,
            error: {
              code: 'persist_conflict',
              message:
                'A consulta funcionou, mas os dados não foram salvos (o registro foi alterado durante a consulta). Verifique e tente novamente.',
            },
          },
          200,
        );
      }
      if (logs.length) await admin.from('rpi_enrichment_field_log').insert(logs);
    }
  }

  return json({ ok: true, saved: true, from_cache: false, lookup: savedLookup, applied, divergences }, 200);
});
