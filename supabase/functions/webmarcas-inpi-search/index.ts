/**
 * webmarcas-inpi-search
 *
 * Intermediário seguro entre o site e a API WebMarcas/INPI.
 *   Frontend -> esta função -> {WEBMARCAS_API_BASE_URL}/v1/searches
 *
 * - A chave (WEBMARCAS_API_KEY) só existe aqui; nunca é devolvida nem registrada em log.
 * - Aceita apenas { action: "start", brand, activity, request_id } e { action: "status", job_id }.
 * - Idempotency-Key estável derivada do request_id gerado no navegador (retentativa não duplica consulta).
 * - Limite de abuso: 10 novas buscas / 15 min por IP e por sessão anônima (polling não conta).
 * - CORS restrito a origens exatas + subdomínios Lovable validados. Nunca "*" nem reflexo de origem.
 * - Não envia nenhum dado pessoal do visitante para a API.
 */
import { z } from 'npm:zod@3.25.76';

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
  job_id: z.string().min(6).max(128).regex(/^[A-Za-z0-9_-]+$/),
});

const BodySchema = z.discriminatedUnion('action', [StartSchema, StatusSchema]);

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

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

// ─── Normalização da resposta upstream (apenas campos seguros) ───────────────

const s = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

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
        total: n(m.total) ?? records.length,
        pages: n(m.pages),
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
  };
}

const KNOWN_STATUS = new Set(['queued', 'running', 'completed', 'inconclusive', 'failed']);

function normJob(v: unknown) {
  if (!v || typeof v !== 'object') return null;
  const j = v as Record<string, unknown>;
  const job_id = s(j.job_id) ?? s(j.id);
  if (!job_id) return null;
  const rawStatus = (s(j.status) ?? '').toLowerCase();
  const status = KNOWN_STATUS.has(rawStatus) ? rawStatus : (rawStatus === 'error' || rawStatus === 'cancelled' ? 'failed' : 'failed');
  return {
    job_id,
    status,
    delivery: s(j.delivery),
    result: status === 'completed' ? normResult(j.result) : null,
    pdf_url: cleanUrl(j.pdf_url),
  };
}

// ─── Chamada upstream ────────────────────────────────────────────────────────

type Upstream =
  | { kind: 'ok'; data: unknown }
  | { kind: 'timeout' }
  | { kind: 'unavailable'; status: number }
  | { kind: 'not_found' }
  | { kind: 'error'; status: number };

async function callUpstream(baseUrl: string, apiKey: string, path: string, init: { method: 'GET' | 'POST'; body?: unknown; idempotencyKey?: string }): Promise<Upstream> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    };
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    if (init.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey;

    const res = await fetch(`${baseUrl}${path}`, {
      method: init.method,
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });

    if (res.status === 404) {
      await res.text().catch(() => '');
      return { kind: 'not_found' };
    }
    if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) {
      await res.text().catch(() => '');
      return { kind: 'unavailable', status: res.status };
    }
    if (!res.ok) {
      await res.text().catch(() => '');
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

function mapUpstreamFailure(u: Exclude<Upstream, { kind: 'ok' }>, cors: Record<string, string>, ctx: string) {
  // Logs sem chave, sem corpo e sem dados do visitante.
  console.warn(`[webmarcas-inpi-search] upstream ${ctx}: ${u.kind}${'status' in u ? ` (${u.status})` : ''}`);
  switch (u.kind) {
    case 'timeout':
      return fail('upstream_timeout', 'A base do INPI demorou para responder.', 504, cors);
    case 'not_found':
      return fail('not_found', 'Consulta não encontrada.', 404, cors);
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

  const baseUrlRaw = Deno.env.get('WEBMARCAS_API_BASE_URL') ?? '';
  const apiKey = Deno.env.get('WEBMARCAS_API_KEY') ?? '';
  const baseUrl = baseUrlRaw.trim().replace(/\/+$/, '');
  if (!baseUrl || !apiKey || !/^https:\/\//i.test(baseUrl)) {
    console.error('[webmarcas-inpi-search] secrets WEBMARCAS_API_BASE_URL/WEBMARCAS_API_KEY ausentes ou inválidos');
    return fail('not_configured', 'Serviço de consulta ainda não configurado.', 503, cors);
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

  // ── status: polling de job existente (não conta para o limite) ──
  if (body.action === 'status') {
    const u = await callUpstream(baseUrl, apiKey, `/v1/searches/${encodeURIComponent(body.job_id)}`, { method: 'GET' });
    if (u.kind !== 'ok') return mapUpstreamFailure(u, cors, 'status');
    const job = normJob(u.data);
    if (!job) return fail('upstream_error', 'Resposta inesperada do serviço de consulta.', 502, cors);
    return jsonResponse({ ok: true, job }, 200, cors);
  }

  // ── start: nova consulta ──
  const sessionHeader = req.headers.get('x-wm-session') || '';
  const session = UUID_RE.test(sessionHeader) ? sessionHeader.toLowerCase() : null;
  const ip = clientIp(req);
  const rateKeys = [`ip:${ip}`];
  if (session) rateKeys.push(`sess:${session}`);
  if (isRateLimited(rateKeys)) {
    return fail('rate_limited', 'Limite de consultas atingido. Aguarde alguns minutos e tente novamente.', 429, cors);
  }

  // Chave idempotente estável: mesmo request_id + mesmos termos => mesma chave (retentativa não duplica).
  const idem = 'wm-' + (await sha256Hex(`${body.request_id}|${body.brand.toLowerCase()}|${body.activity.toLowerCase()}`));

  const u = await callUpstream(baseUrl, apiKey, '/v1/searches', {
    method: 'POST',
    body: { brand: body.brand, activity: body.activity },
    idempotencyKey: idem,
  });
  if (u.kind !== 'ok') return mapUpstreamFailure(u, cors, 'start');

  const job = normJob(u.data);
  if (!job) return fail('upstream_error', 'Resposta inesperada do serviço de consulta.', 502, cors);

  console.log(`[webmarcas-inpi-search] job iniciado: ${job.job_id} (${job.status})`);
  return jsonResponse({ ok: true, job }, 200, cors);
});
