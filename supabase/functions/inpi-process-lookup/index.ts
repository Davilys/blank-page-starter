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

const UPSTREAM_TIMEOUT_MS = 35_000;
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

  // ── vínculo automático do cliente (apenas certeza absoluta) ──
  const link = await autoLinkClient(admin, {
    entryId,
    processNumber,
    brandName: lookupRow.brand_name,
    holder: lookupRow.holder,
    holderDocument: str(proc.holder_document) ?? str(proc.holder_cpf_cnpj) ?? str(proc.holder_document_number),
    nclClasses: nclNumbers(lookupRow.ncl_class),
    depositDate: toIsoDate(lookupRow.filing_date),
    grantDate: toIsoDate(lookupRow.grant_date),
    expiryDate: toIsoDate(lookupRow.expiry_date),
  });

  return json(
    { ok: true, saved: true, from_cache: false, lookup: savedLookup, applied, divergences, link },
    200,
  );
});

// ─────────────────────────────────────────────────────────────────────
// Vínculo automático + organização da marca na ficha do cliente.
// Nunca vincula por semelhança: só por número de processo já cadastrado
// ou documento (CPF/CNPJ) exato e único. Não dispara notificações.
// ─────────────────────────────────────────────────────────────────────

type LinkCandidate = { client_id: string; name: string | null; reason: string };
type LinkResult = {
  status: 'linked' | 'already_linked' | 'candidates' | 'none' | 'skipped' | 'error';
  client_id: string | null;
  client_name: string | null;
  process_id: string | null;
  source: string | null;
  candidates: LinkCandidate[];
  merged: number;
  created_process: boolean;
};

const DISPATCH_TO_PUB_STATUS: Record<string, string> = {
  oposicao: 'oposicao',
  'oposição': 'oposicao',
  exigencia_merito: 'exigencia_merito',
  'exigência de mérito': 'exigencia_merito',
  'exigencia de merito': 'exigencia_merito',
  indeferimento: 'indeferimento',
  deferimento: 'deferimento',
  certificado: 'certificado',
  'concessão de registro': 'certificado',
  'concessao de registro': 'certificado',
  'renovação': 'renovacao',
  renovacao: 'renovacao',
  arquivado: 'arquivado',
  arquivamento: 'arquivado',
};

// deno-lint-ignore no-explicit-any
async function autoLinkClient(
  admin: any,
  input: {
    entryId: string | null;
    processNumber: string;
    brandName: string | null;
    holder: string | null;
    holderDocument: string | null;
    nclClasses: string[] | null;
    depositDate: string | null;
    grantDate: string | null;
    expiryDate: string | null;
  },
): Promise<LinkResult> {
  const base: LinkResult = {
    status: 'skipped',
    client_id: null,
    client_name: null,
    process_id: null,
    source: null,
    candidates: [],
    merged: 0,
    created_process: false,
  };
  if (!input.entryId) return base;

  try {
    const { data: entry } = await admin
      .from('rpi_entries')
      .select('*')
      .eq('id', input.entryId)
      .maybeSingle();
    if (!entry) return base;

    const nclNumeric = (input.nclClasses ?? [])
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n > 0 && n <= 45);

    // ── 1) processo já cadastrado no CRM ──
    const { data: byProcess } = await admin
      .from('brand_processes')
      .select('id, user_id, brand_name, ncl_classes, deposit_date, grant_date, expiry_date, created_at, status')
      .eq('process_number', input.processNumber)
      .order('created_at', { ascending: true });

    const owners = Array.from(
      new Set(((byProcess ?? []) as Json[]).map((r) => r.user_id).filter(Boolean)),
    ) as string[];

    let clientId: string | null = entry.matched_client_id ?? null;
    let source: string | null = clientId ? 'existente' : null;

    if (!clientId && owners.length === 1) {
      clientId = owners[0];
      source = 'numero_do_processo';
    }

    // ── 2) documento exato do titular (quando a API retornar) ──
    if (!clientId && input.holderDocument) {
      const digits = input.holderDocument.replace(/\D/g, '');
      if (digits.length === 11 || digits.length === 14) {
        const { data: docMatches } = await admin.rpc('profiles_by_doc_digits', { p_doc: digits });
        const ids = Array.from(new Set(((docMatches ?? []) as Json[]).map((r) => r.id))) as string[];
        if (ids.length === 1) {
          clientId = ids[0];
          source = 'documento';
        }
      }
    }

    // ── sem certeza: devolve candidatos para confirmação humana ──
    if (!clientId) {
      const candidates: LinkCandidate[] = [];
      const seen = new Set<string>();
      const push = (id: string | null, name: string | null, reason: string) => {
        if (!id || seen.has(id)) return;
        seen.add(id);
        candidates.push({ client_id: id, name, reason });
      };

      if (input.holder && input.holder.length >= 4) {
        const term = input.holder.replace(/[%,]/g, ' ').trim();
        const { data: byName } = await admin
          .from('profiles')
          .select('id, full_name, company_name')
          .or(`full_name.ilike.%${term}%,company_name.ilike.%${term}%`)
          .limit(5);
        for (const p of (byName ?? []) as Json[]) {
          push(p.id as string, (p.full_name as string) ?? (p.company_name as string) ?? null, 'titular');
        }
      }

      const brand = input.brandName ?? (typeof entry.brand_name === 'string' ? entry.brand_name : null);
      if (brand && brand.length >= 3) {
        const term = brand.replace(/[%,]/g, ' ').trim();
        const { data: byBrand } = await admin
          .from('brand_processes')
          .select('user_id, brand_name')
          .ilike('brand_name', `%${term}%`)
          .not('user_id', 'is', null)
          .limit(5);
        const ids = Array.from(new Set(((byBrand ?? []) as Json[]).map((r) => r.user_id))) as string[];
        if (ids.length) {
          const { data: profs } = await admin
            .from('profiles')
            .select('id, full_name, company_name')
            .in('id', ids);
          for (const p of (profs ?? []) as Json[]) {
            push(p.id as string, (p.full_name as string) ?? (p.company_name as string) ?? null, 'marca');
          }
        }
      }

      if (candidates.length) {
        await admin
          .from('rpi_entries')
          .update({ match_candidates: candidates, needs_human_review: true })
          .eq('id', input.entryId)
          .is('matched_client_id', null);
      }
      return { ...base, status: candidates.length ? 'candidates' : 'none', candidates };
    }

    // ── organiza as marcas do cliente para este processo ──
    const { data: clientProcesses } = await admin
      .from('brand_processes')
      .select('id, brand_name, ncl_classes, deposit_date, grant_date, expiry_date, created_at, status')
      .eq('user_id', clientId)
      .eq('process_number', input.processNumber)
      .order('created_at', { ascending: true });

    const rows = (clientProcesses ?? []) as Json[];
    let keep = rows[0] ?? null;
    let merged = 0;
    let createdProcess = false;

    if (rows.length > 1) {
      const score = (r: Json) =>
        [r.brand_name, r.ncl_classes, r.deposit_date, r.grant_date, r.expiry_date].filter(
          (v) => v != null && (!Array.isArray(v) || v.length > 0),
        ).length;
      keep = rows.reduce((a, b) => (score(b) > score(a) ? b : a), rows[0]);
      for (const dup of rows) {
        if (dup.id === keep!.id) continue;
        await admin.from('publicacoes_marcas').update({ process_id: keep!.id }).eq('process_id', dup.id);
        await admin.from('rpi_entries').update({ matched_process_id: keep!.id }).eq('matched_process_id', dup.id);
        await admin
          .from('brand_processes')
          .update({
            status: 'duplicado_unificado',
            notes: `Unificado no registro ${keep!.id} pela consulta ao INPI em ${new Date().toISOString()}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', dup.id);
        merged++;
      }
    }

    if (!keep) {
      const { data: created } = await admin
        .from('brand_processes')
        .insert({
          user_id: clientId,
          brand_name: input.brandName ?? (entry.brand_name as string) ?? 'Marca sem nome',
          process_number: input.processNumber,
          ncl_classes: nclNumeric.length ? nclNumeric : null,
          deposit_date: input.depositDate,
          grant_date: input.grantDate,
          expiry_date: input.expiryDate,
        })
        .select('id, brand_name, ncl_classes, deposit_date, grant_date, expiry_date')
        .maybeSingle();
      keep = (created ?? null) as Json | null;
      createdProcess = !!keep;
    } else {
      // completa apenas o que estiver vazio — nunca sobrescreve edição manual
      const patch: Json = {};
      if (isEmptyish(keep.brand_name) && input.brandName) patch.brand_name = input.brandName;
      if ((!Array.isArray(keep.ncl_classes) || keep.ncl_classes.length === 0) && nclNumeric.length) {
        patch.ncl_classes = nclNumeric;
      }
      if (keep.deposit_date == null && input.depositDate) patch.deposit_date = input.depositDate;
      if (keep.grant_date == null && input.grantDate) patch.grant_date = input.grantDate;
      if (keep.expiry_date == null && input.expiryDate) patch.expiry_date = input.expiryDate;
      if (Object.keys(patch).length) {
        patch.updated_at = new Date().toISOString();
        await admin.from('brand_processes').update(patch).eq('id', keep.id as string);
      }
    }

    const processId = (keep?.id as string) ?? null;
    const alreadyLinked = !!entry.matched_client_id;

    if (!alreadyLinked) {
      await admin
        .from('rpi_entries')
        .update({
          matched_client_id: clientId,
          matched_process_id: processId,
          linked_at: new Date().toISOString(),
          auto_linked_at: new Date().toISOString(),
          auto_link_source: source,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.entryId)
        .is('matched_client_id', null);
    } else if (processId && !entry.matched_process_id) {
      await admin.from('rpi_entries').update({ matched_process_id: processId }).eq('id', input.entryId);
    }

    // ── cartão da aba Publicação (sem duplicar, sem notificar) ──
    const dispatch = typeof entry.dispatch_type === 'string' ? entry.dispatch_type.toLowerCase() : '';
    const pubStatus = DISPATCH_TO_PUB_STATUS[dispatch] ?? '003';
    const nclText = nclNumeric.length
      ? nclNumeric.join(', ')
      : Array.isArray(entry.ncl_classes)
      ? (entry.ncl_classes as string[]).join(', ')
      : null;

    const { data: pubByEntry } = await admin
      .from('publicacoes_marcas')
      .select('id, client_id, process_id, brand_name_rpi, ncl_class')
      .eq('rpi_entry_id', input.entryId)
      .maybeSingle();
    let pub = pubByEntry as Json | null;
    if (!pub) {
      const { data: pubByPn } = await admin
        .from('publicacoes_marcas')
        .select('id, client_id, process_id, brand_name_rpi, ncl_class')
        .eq('process_number_rpi', input.processNumber)
        .maybeSingle();
      pub = (pubByPn ?? null) as Json | null;
    }

    if (pub) {
      const patch: Json = { updated_at: new Date().toISOString(), rpi_entry_id: input.entryId };
      if (!pub.client_id) patch.client_id = clientId;
      if (!pub.process_id && processId) patch.process_id = processId;
      if (isEmptyish(pub.brand_name_rpi) && (input.brandName ?? entry.brand_name)) {
        patch.brand_name_rpi = input.brandName ?? entry.brand_name;
      }
      if (isEmptyish(pub.ncl_class) && nclText) patch.ncl_class = nclText;
      await admin.from('publicacoes_marcas').update(patch).eq('id', pub.id as string);
    } else {
      await admin.from('publicacoes_marcas').insert({
        status: pubStatus,
        tipo_publicacao: 'publicacao_rpi',
        rpi_entry_id: input.entryId,
        process_id: processId,
        client_id: clientId,
        brand_name_rpi: input.brandName ?? entry.brand_name ?? null,
        process_number_rpi: input.processNumber,
        ncl_class: nclText,
        data_publicacao_rpi: entry.publication_date ?? null,
      });
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, company_name')
      .eq('id', clientId)
      .maybeSingle();

    return {
      status: alreadyLinked ? 'already_linked' : 'linked',
      client_id: clientId,
      client_name: (profile?.full_name as string) ?? (profile?.company_name as string) ?? null,
      process_id: processId,
      source,
      candidates: [],
      merged,
      created_process: createdProcess,
    };
  } catch (e) {
    console.error('[inpi-process-lookup] vínculo automático falhou', (e as Error)?.message);
    return { ...base, status: 'error' };
  }
}
