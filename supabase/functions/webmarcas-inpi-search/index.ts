/**
 * webmarcas-inpi-search
 *
 * Intermediário seguro entre o site (público e área do cliente) e a base de marcas do INPI.
 *
 *   start  -> novo portal público do INPI (servicos.busca.inpi.gov.br),
 *             busca rápida APENAS EXATA (filtro mark_name.keyword), resposta síncrona.
 *   status -> mantido no upstream legado ({WEBMARCAS_API_BASE_URL}/v1/searches/<id>)
 *             para não quebrar consultas criadas antes da troca de fonte
 *             (retomada de tela e renovação de PDF desses jobs antigos).
 *
 * Por que a troca: o sistema legado BuscaWeb/pePI (busca.inpi.gov.br/pePI) ficou
 * indisponível em 2026-10-29; o titular pediu explicitamente a nova fonte somente
 * no site, sem alterar o BotConversa (que fala direto com a API da VPS).
 *
 * Limites conhecidos desta fonte (não esconder do visitante):
 * - A base do novo portal é uma fotografia: o próprio portal informa
 *   "Dados atualizados em 07/07/2026" e a data de protocolo mais recente
 *   observada na base é 15/06/2026. Pedidos posteriores NÃO aparecem.
 * - Só correspondência exata do nome (ignora maiúsculas/minúsculas; não dobra
 *   acentos nem singular/plural).
 * - Sem PDF de laudo e sem análise por ramo nesta consulta (a UI já trata
 *   pdf_url/activity_analysis nulos).
 *
 * - CORS restrito a origens exatas + subdomínios Lovable validados. Nunca "*" nem reflexo de origem.
 * - Limite de abuso: 10 novas buscas / 15 min por IP e por sessão anônima.
 * - Não envia nenhum dado pessoal do visitante para a API.
 */
import { normalizeActivityAnalysis } from '../_shared/activityAnalysis.ts';
import { triage } from './activityFilterPort.ts';
import { primaryClassFor } from './orientationPort.ts';
import { z } from 'npm:zod@3.25.76';
import { buildLaudoPdf } from './laudoPdf.ts';

// ─── CORS ────────────────────────────────────────────────────────────────────

const EXACT_ORIGINS = new Set<string>([
  'https://webmarcas.net',
  'https://www.webmarcas.net',
  'https://page-creation-pro.lovable.app',
  'https://id-preview--6c60bdcc-40b1-49c5-b46b-40ac18ae182b.lovable.app',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
]);

// Subdomínios Lovable: apenas um rótulo [a-z0-9-] antes do domínio raiz, sempre https.
const LOVABLE_ORIGIN_PATTERNS = [
  /^https:\/\/[a-z0-9-]{1,120}\.lovableproject\.com$/,
  /^https:\/\/[a-z0-9-]{1,120}\.lovable\.app$/,
];

function resolveAllowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  const o = origin.trim();
  if (o.length > 200) return null;
  if (EXACT_ORIGINS.has(o)) return o;
  if (LOVABLE_ORIGIN_PATTERNS.some((re) => re.test(o))) return o;
  return null;
}

function corsHeadersFor(origin: string | null): Record<string, string> {
  const allowed = resolveAllowedOrigin(origin);
  const headers: Record<string, string> = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-wm-session, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Max-Age': '600',
    'Cache-Control': 'no-store',
  };
  if (allowed) headers['Access-Control-Allow-Origin'] = allowed;
  return headers;
}

// ─── Utilidades ──────────────────────────────────────────────────────────────

type ErrorCode =
  | 'invalid_input'
  | 'rate_limited'
  | 'not_configured'
  | 'upstream_timeout'
  | 'upstream_unavailable'
  | 'upstream_error'
  | 'not_found';

function jsonResponse(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function fail(code: ErrorCode, message: string, status: number, cors: Record<string, string>) {
  return jsonResponse({ ok: false, error: { code, message } }, status, cors);
}

const UPSTREAM_TIMEOUT_MS = 20_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const normalizeTerm = (v: string, max: number) => v.replace(/\s+/g, ' ').trim().slice(0, max);

const StartSchema = z.object({
  action: z.literal('start'),
  brand: z.string().transform((v) => normalizeTerm(v, 121)).pipe(z.string().min(2).max(120)),
  activity: z.string().transform((v) => normalizeTerm(v, 161)).pipe(z.string().min(1).max(160)),
  request_id: z.string().regex(UUID_RE),
});

const StatusSchema = z.object({
  action: z.literal('status'),
  job_id: z.string().min(6).max(512).regex(/^[A-Za-z0-9_-]+$/),
  // Obrigatórios apenas para jobs site-*: o job_id é um hash dos termos e a
  // reexecução precisa deles de volta (o front envia o que já tem em tela).
  brand: z.string().transform((v) => normalizeTerm(v, 121)).pipe(z.string().max(120)).optional(),
  activity: z.string().transform((v) => normalizeTerm(v, 161)).pipe(z.string().max(160)).optional(),
});

const BodySchema = z.discriminatedUnion('action', [StartSchema, StatusSchema]);

// ─── Limite de abuso (memória do isolate; melhor esforço, sem tocar no banco) ─

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_STARTS = 10;
const buckets = new Map<string, number[]>();

function isRateLimited(keys: string[]): boolean {
  const now = Date.now();
  let limited = false;
  for (const key of keys) {
    const arr = (buckets.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
    if (arr.length >= RATE_MAX_STARTS) limited = true;
    buckets.set(key, arr);
  }
  if (limited) return true;
  for (const key of keys) buckets.get(key)!.push(now);
  // limpeza leve para não crescer indefinidamente
  if (buckets.size > 5000) {
    for (const [k, arr] of buckets) if (arr.every((t) => now - t >= RATE_WINDOW_MS)) buckets.delete(k);
  }
  return false;
}

function clientIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for') || '';
  const first = xf.split(',')[0]?.trim();
  return first || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown';
}

// ─── Nova fonte: portal público de busca do INPI (servicos.busca.inpi.gov.br) ─

const INPI_SEARCH_API = 'https://api-servicos.busca.inpi.gov.br/api/trademarks/search';
const INPI_SOURCE_PAGE = 'https://servicos.busca.inpi.gov.br/marcas';
// Data de atualização que o próprio portal exibe ("Dados atualizados em: 07/07/2026").
// A data mais recente de protocolo observada na base é 15/06/2026 (verificado em 29/10/2026).
const INPI_BASE_UPDATED_AT = '07/07/2026';
const MAX_RECORDS = 100;

const s = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

type InpiRecord = Record<string, { raw?: unknown } | undefined>;

function mapInpiRecord(r: InpiRecord) {
  const raw = (f: string) => r[f]?.raw;
  const process = s(raw('process_number'));
  const brand = s(raw('mark_name'));
  if (!process && !brand) return null;
  const holders = raw('holders');
  const holder = Array.isArray(holders)
    ? holders.map((h) => s((h as Record<string, unknown>)?.name)).filter(Boolean).join('; ') || null
    : null;
  const specs = raw('specifications');
  const nice = Array.isArray(specs)
    ? [...new Set(specs.map((sp) => s((sp as Record<string, unknown>)?.nice_class_code)).filter(Boolean))].sort().join(', ') || null
    : null;
  return {
    process: process ?? '',
    priority: s(raw('priority_datetime')) ?? s(raw('filing_date')),
    brand: brand ?? '',
    status: s(raw('status')) ?? '',
    holder,
    nice,
    source_url: process ? `${INPI_SOURCE_PAGE}/${encodeURIComponent(process)}` : null,
  };
}

type Upstream =
  | { kind: 'ok'; data: unknown }
  | { kind: 'timeout' }
  | { kind: 'unavailable'; status: number }
  | { kind: 'error'; status: number };

/** Busca exata (mark_name.keyword) no novo portal. Sem autenticação. */
async function searchInpiPortalPage(brand: string, page: number): Promise<Upstream> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const body = {
      state: {
        searchTerm: '',
        current: page,
        resultsPerPage: MAX_RECORDS,
        filters: [{ field: 'mark_name.keyword', values: [brand], type: 'any' }],
      },
      queryConfig: {
        search_fields: { mark_name: { weight: 3 } },
        result_fields: {
          mark_name: { raw: {} },
          process_number: { raw: {} },
          status: { raw: {} },
          holders: { raw: {} },
          specifications: { raw: {} },
          priority_datetime: { raw: {} },
          filing_date: { raw: {} },
        },
      },
    };
    const res = await fetch(INPI_SEARCH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const snippet = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);
      console.warn(`[webmarcas-inpi-search] portal INPI -> ${res.status} ${snippet}`);
      if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) {
        return { kind: 'unavailable', status: res.status };
      }
      return { kind: 'error', status: res.status };
    }
    const data = await res.json().catch(() => null);
    if (data === null) return { kind: 'error', status: 502 };
    return { kind: 'ok', data };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return { kind: 'timeout' };
    return { kind: 'unavailable', status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

// Busca paginada: tenta cobrir TODOS os registros exatos. Proteção de limite:
// acima de 10 páginas x 100, ou se alguma página falhar no meio, o resultado é
// marcado como INCOMPLETO (scope 'exata_parcial') e nunca pode virar conclusão
// de ausência/favorável — ver buildCompletedJob.
const MAX_PAGES = 10;

type PortalAll =
  | { kind: 'ok'; data: unknown; incomplete: boolean }
  | { kind: 'timeout' }
  | { kind: 'unavailable'; status: number }
  | { kind: 'error'; status: number };

async function searchInpiPortalAll(brand: string): Promise<PortalAll> {
  const first = await searchInpiPortalPage(brand, 1);
  if (first.kind !== 'ok') return first;
  const d = (first.data ?? {}) as Record<string, unknown>;
  const totalPages = typeof d.totalPages === 'number' && Number.isFinite(d.totalPages) ? d.totalPages : 1;
  if (totalPages <= 1) return { kind: 'ok', data: first.data, incomplete: false };
  const allResults = Array.isArray(d.results) ? [...d.results] : [];
  let incomplete = totalPages > MAX_PAGES;
  for (let page = 2; page <= Math.min(totalPages, MAX_PAGES); page++) {
    const next = await searchInpiPortalPage(brand, page);
    if (next.kind !== 'ok') {
      // Página intermediária falhou: se nada foi coletado, propaga a falha para
      // o visitante tentar de novo; se já há registros, segue marcado incompleto.
      if (allResults.length === 0) return next;
      incomplete = true;
      break;
    }
    const nd = (next.data ?? {}) as Record<string, unknown>;
    if (Array.isArray(nd.results)) allResults.push(...nd.results);
  }
  return { kind: 'ok', data: { ...d, results: allResults }, incomplete };
}

function buildCompletedJob(jobId: string, brand: string, activity: string, data: unknown, incomplete: boolean) {
  const d = (data ?? {}) as Record<string, unknown>;
  const rawResults = Array.isArray(d.results) ? (d.results as InpiRecord[]) : [];
  const records = rawResults.map(mapInpiRecord).filter((x): x is NonNullable<typeof x> => x !== null);
  const total = typeof d.totalResults === 'number' && Number.isFinite(d.totalResults) ? d.totalResults : records.length;
  const pages = typeof d.totalPages === 'number' && Number.isFinite(d.totalPages) ? d.totalPages : null;
  // Resultado incompleto NUNCA pode declarar ausência: se há registros parciais,
  // a conclusão é de ocorrências encontradas; se não há nada, a falha já teria
  // sido propagada antes daqui.
  const conclusion = records.length > 0 ? 'requires_legal_review' : 'no_matches_in_searched_terms';
  // Triagem por atividade (port das regras da VPS): dados estruturados do
  // portal, primária derivada pelo orientation recuperado, alto renome por
  // snapshot oficial datado + texto. Tudo local; falhas NÃO viram ausência.
  let activityAnalysis: ReturnType<typeof triage> | null = null;
  if (activity.trim() && records.length > 0) {
    try {
      const details = new Map<string, { process: string; specifications: { nice: string; text: string }[] }>();
      for (const r of rawResults) {
        const proc = s(r?.process_number?.raw);
        if (!proc) continue;
        const specsRaw = r?.specifications?.raw;
        const specs = Array.isArray(specsRaw)
          ? specsRaw
              .map((sp) => ({ nice: s((sp as Record<string, unknown>)?.nice_class_code) ?? '', text: s((sp as Record<string, unknown>)?.text) ?? '' }))
              .filter((sp) => sp.nice || sp.text)
          : [];
        details.set(proc, { process: proc, specifications: specs });
      }
      const primary = primaryClassFor(activity);
      activityAnalysis = triage(records, activity, details, brand, primary ? [primary] : []);
    } catch (err) {
      console.warn('[webmarcas-inpi-search] triagem por atividade falhou; seguindo sem analysis', err);
      activityAnalysis = null;
    }
  }
  return {
    job_id: jobId,
    status: 'completed',
    delivery: null,
    result: {
      brand,
      activity,
      queried_at: new Date().toISOString(),
      source: INPI_SOURCE_PAGE,
      searches: [
        {
          mode: 'exata',
          term: brand,
          total,
          pages,
          source_timestamp: INPI_BASE_UPDATED_AT,
          records,
        },
      ],
      records,
      conclusion,
      scope: incomplete ? 'exata_parcial' : 'exata',
      activity_analysis: activityAnalysis,
    },
    pdf_url: null,
    pdf_base64: null as string | null,
    pdf_failed: false,
  };
}

// ─── Laudo em PDF (gerado aqui; NADA é persistido — o arquivo vai no corpo da
// resposta e quem guarda é o dispositivo do cliente, como na regra original:
// "busca tem que apagar, não guarde"). ───

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/**
 * job_id = hash SHA-256 dos termos normalizados: determinístico (mesma consulta,
 * mesmo job) e NÃO decodificável — marca e ramo não aparecem em logs nem URLs.
 * Como o id não carrega mais os termos, a reexecução (status) exige brand+activity
 * no corpo e confere o hash antes de consultar a fonte.
 */
async function siteJobId(brand: string, activity: string): Promise<string> {
  const key = `${brand.toLowerCase().normalize('NFC')}|${activity.toLowerCase().normalize('NFC')}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `site-${hex.slice(0, 40)}`;
}


/**
 * Gera o laudo em memória e devolve base64. Falha aqui marca pdf_failed=true
 * (a UI oferece "tentar novamente") — nunca derruba a consulta.
 */
async function attachLaudoPdf(job: ReturnType<typeof buildCompletedJob>): Promise<void> {
  try {
    const result = job.result!;
    const pdf = await buildLaudoPdf({
      jobId: job.job_id,
      brand: result.brand,
      activity: result.activity,
      queriedAt: result.queried_at ?? new Date().toISOString(),
      baseUpdatedAt: result.searches[0]?.source_timestamp ?? '',
      conclusion: result.conclusion,
      total: result.searches[0]?.total ?? result.records.length,
      records: result.records,
      activityAnalysis: result.activity_analysis ?? null,
    });
    job.pdf_base64 = bytesToBase64(pdf);
    job.pdf_failed = false;
  } catch (err) {
    console.warn(`[webmarcas-inpi-search] laudo falhou: ${err instanceof Error ? err.message : String(err)}`);
    job.pdf_base64 = null;
    job.pdf_failed = true;
  }
}

// ─── Upstream legado (somente para status de jobs criados antes da troca) ────

const KNOWN_STATUS = new Set(['queued', 'running', 'completed', 'inconclusive', 'failed']);

function cleanUrl(v: unknown): string | null {
  const raw = s(v);
  if (!raw) return null;
  const md = raw.match(/^\[(.+?)\]\((.+?)\)$/);
  const candidate = md ? md[2] : raw;
  try {
    const u = new URL(candidate);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

function normRecord(r: unknown) {
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  const process = s(o.process);
  const brand = s(o.brand);
  if (!process && !brand) return null;
  return {
    process: process ?? '',
    priority: s(o.priority),
    brand: brand ?? '',
    status: s(o.status) ?? '',
    holder: s(o.holder),
    nice: s(o.nice),
    source_url: cleanUrl(o.source_url),
  };
}

function normRecords(v: unknown) {
  return Array.isArray(v) ? v.map(normRecord).filter(Boolean) : [];
}

function normResult(v: unknown) {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const searches = Array.isArray(r.searches)
    ? r.searches.filter((x) => x && typeof x === 'object').map((x) => {
      const m = x as Record<string, unknown>;
      const records = normRecords(m.records);
      return {
        mode: s(m.mode) ?? 'desconhecido',
        term: s(m.term) ?? '',
        total: (typeof m.total === 'number' && Number.isFinite(m.total) ? m.total : records.length),
        pages: typeof m.pages === 'number' && Number.isFinite(m.pages) ? m.pages : null,
        source_timestamp: s(m.source_timestamp),
        records,
      };
    })
    : [];
  return {
    brand: s(r.brand) ?? '',
    activity: s(r.activity) ?? '',
    queried_at: s(r.queried_at),
    source: cleanUrl(r.source) ?? s(r.source),
    searches,
    records: normRecords(r.records),
    conclusion: s(r.conclusion) ?? 'inconclusive',
    scope: s(r.scope),
    activity_analysis: normalizeActivityAnalysis(r.activity_analysis, normRecords(r.records).map((rec) => rec!.process)),
  };
}

function normJob(v: unknown) {
  if (!v || typeof v !== 'object') return null;
  const j = v as Record<string, unknown>;
  const job_id = s(j.job_id) ?? s(j.id);
  if (!job_id) return null;
  const rawStatus = (s(j.status) ?? '').toLowerCase();
  const status = KNOWN_STATUS.has(rawStatus) ? rawStatus : 'failed';
  return {
    job_id,
    status,
    delivery: s(j.delivery),
    result: status === 'completed' ? normResult(j.result) : null,
    pdf_url: cleanUrl(j.pdf_url),
    pdf_base64: null,
    pdf_failed: false,
  };
}

type LegacyUpstream =
  | { kind: 'ok'; data: unknown }
  | { kind: 'timeout' }
  | { kind: 'unavailable'; status: number }
  | { kind: 'not_found' }
  | { kind: 'error'; status: number };

async function callLegacyStatus(baseUrl: string, apiKey: string, jobId: string): Promise<LegacyUpstream> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/v1/searches/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      const snippet = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);
      console.warn(`[webmarcas-inpi-search] legado status -> ${res.status} ${snippet}`);
      if (res.status === 404) return { kind: 'not_found' };
      if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) return { kind: 'unavailable', status: res.status };
      return { kind: 'error', status: res.status };
    }
    const data = await res.json().catch(() => null);
    if (data === null) return { kind: 'error', status: 502 };
    return { kind: 'ok', data };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return { kind: 'timeout' };
    return { kind: 'unavailable', status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

function mapUpstreamFailure(u: { kind: string; status?: number }, cors: Record<string, string>, ctx: string) {
  // Logs sem chave, sem corpo e sem dados do visitante.
  console.warn(`[webmarcas-inpi-search] upstream ${ctx}: ${u.kind}${u.status !== undefined ? ` (${u.status})` : ''}`);
  switch (u.kind) {
    case 'timeout':
      return fail('upstream_timeout', 'A base do INPI demorou para responder.', 504, cors);
    case 'not_found':
      // Consulta expirada/inexistente é um estado esperado do fluxo (sessão antiga
      // retomada), não uma falha do serviço: responde 200 com o código no corpo
      // para o cliente tratar sem gerar erro de aplicação.
      return fail('not_found', 'Consulta não encontrada.', 200, cors);
    case 'unavailable':
      return fail('upstream_unavailable', 'Serviço de consulta temporariamente indisponível.', 503, cors);
    default:
      return fail('upstream_error', 'Falha ao consultar a base do INPI.', 502, cors);
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = corsHeadersFor(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== 'POST') {
    return fail('invalid_input', 'Método não permitido.', 405, cors);
  }
  // Navegadores só chegam aqui com origem autorizada; sem origem (ex.: testes server-side) segue normalmente.
  if (origin && !resolveAllowedOrigin(origin)) {
    return fail('invalid_input', 'Origem não autorizada.', 403, cors);
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return fail('invalid_input', 'Corpo da requisição inválido.', 400, cors);
  }

  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return fail('invalid_input', 'Informe o nome da marca e o ramo de atividade.', 400, cors);
  }
  const body = parsed.data;

  // ── status: jobs novos site-* disparam uma NOVA consulta à base atual
  // (a data da base não garante conteúdo estático — contagem e registros podem
  // mudar; queried_at do job devolvido é sempre o momento real desta execução).
  // Jobs legados continuam no upstream antigo. ──
  if (body.action === 'status') {
    if (body.job_id.startsWith('site-')) {
      // O job_id é hash dos termos: sem brand+activity conferindo o hash, não há
      // como reexecutar — responde como consulta inexistente.
      if (!body.brand || !body.activity) return fail('not_found', 'Consulta não encontrada.', 200, cors);
      const expectedId = await siteJobId(body.brand, body.activity);
      if (expectedId !== body.job_id) return fail('not_found', 'Consulta não encontrada.', 200, cors);
      // Reexecutar consome a fonte: conta no mesmo limite de abuso de novas buscas.
      const sessionHeaderS = req.headers.get('x-wm-session') || '';
      const sessionS = UUID_RE.test(sessionHeaderS) ? sessionHeaderS.toLowerCase() : null;
      const ipS = clientIp(req);
      const rateKeysS = [`ip:${ipS}`];
      if (sessionS) rateKeysS.push(`sess:${sessionS}`);
      if (isRateLimited(rateKeysS)) {
        return fail('rate_limited', 'Limite de consultas atingido. Aguarde alguns minutos e tente novamente.', 429, cors);
      }
      const u = await searchInpiPortalAll(body.brand);
      if (u.kind !== 'ok') return mapUpstreamFailure(u, cors, 'status');
      const job = buildCompletedJob(body.job_id, body.brand, body.activity, u.data, u.incomplete);
      await attachLaudoPdf(job);
      return jsonResponse({ ok: true, job }, 200, cors);
    }
    const baseUrlRaw = Deno.env.get('WEBMARCAS_API_BASE_URL') ?? '';
    const apiKey = Deno.env.get('WEBMARCAS_API_KEY') ?? '';
    const baseUrl = baseUrlRaw
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/v1\/searches$/i, '')
      .replace(/\/v1$/i, '');
    if (!baseUrl || !apiKey || !/^https:\/\//i.test(baseUrl)) {
      console.error('[webmarcas-inpi-search] secrets WEBMARCAS_API_BASE_URL/WEBMARCAS_API_KEY ausentes ou inválidos');
      return fail('not_found', 'Consulta não encontrada.', 200, cors);
    }
    const u = await callLegacyStatus(baseUrl, apiKey, body.job_id);
    if (u.kind !== 'ok') return mapUpstreamFailure(u, cors, 'status');
    const job = normJob(u.data);
    if (!job) return fail('upstream_error', 'Resposta inesperada do serviço de consulta.', 502, cors);
    return jsonResponse({ ok: true, job }, 200, cors);
  }

  // ── start: nova consulta exata no portal público do INPI ──
  const sessionHeader = req.headers.get('x-wm-session') || '';
  const session = UUID_RE.test(sessionHeader) ? sessionHeader.toLowerCase() : null;
  const ip = clientIp(req);
  const rateKeys = [`ip:${ip}`];
  if (session) rateKeys.push(`sess:${session}`);
  if (isRateLimited(rateKeys)) {
    return fail('rate_limited', 'Limite de consultas atingido. Aguarde alguns minutos e tente novamente.', 429, cors);
  }

  const u = await searchInpiPortalAll(body.brand);
  if (u.kind !== 'ok') return mapUpstreamFailure(u, cors, 'start');

  const job = buildCompletedJob(await siteJobId(body.brand, body.activity), body.brand, body.activity, u.data, u.incomplete);
  await attachLaudoPdf(job);
  console.log(`[webmarcas-inpi-search] consulta exata concluída: ${job.job_id.slice(0, 24)}… (${job.result.searches[0].total} registros, laudo ${job.pdf_base64 ? 'gerado' : 'falhou'})`);
  return jsonResponse({ ok: true, job }, 200, cors);
});
