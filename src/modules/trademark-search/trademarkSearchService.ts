import { normalizeActivityAnalysis } from '../../../supabase/functions/_shared/activityAnalysis';
import type {
  SearchApiError,
  SearchApiResponse,
  TrademarkSearchJob,
  TrademarkRecord,
  TrademarkSearchMode,
  TrademarkSearchResultData,
} from './types';
import { ACTIVITY_MAX_LENGTH, BRAND_MAX_LENGTH } from './types';

const FUNCTION_NAME = 'webmarcas-inpi-search';
const SESSION_KEY = 'wm_search_session';
const CLIENT_TIMEOUT_MS = 30_000;

/** Identificador anônimo de sessão (só para limite de abuso; não identifica pessoa). */
export function getSearchSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function normalizeTerm(value: string, max: number): string {
  return (value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function validateSearchInput(brand: string, activity: string): SearchApiError | null {
  const b = normalizeTerm(brand, BRAND_MAX_LENGTH + 1);
  const a = normalizeTerm(activity, ACTIVITY_MAX_LENGTH + 1);
  if (!b || !a) {
    return { code: 'invalid_input', message: 'Por favor, preencha o nome da marca e o ramo de atividade.' };
  }
  if (b.length < 2) {
    return { code: 'invalid_input', message: 'O nome da marca precisa ter pelo menos 2 caracteres.' };
  }
  if (b.length > BRAND_MAX_LENGTH) {
    return { code: 'invalid_input', message: `O nome da marca deve ter no máximo ${BRAND_MAX_LENGTH} caracteres.` };
  }
  if (a.length > ACTIVITY_MAX_LENGTH) {
    return { code: 'invalid_input', message: `O ramo de atividade deve ter no máximo ${ACTIVITY_MAX_LENGTH} caracteres.` };
  }
  return null;
}

// ─── Normalização defensiva da resposta (nunca inventa dados) ───────────────

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function safeUrl(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const md = s.match(/^\[(.+?)\]\((.+?)\)$/);
  const candidate = md ? md[2] : s;
  try {
    const u = new URL(candidate);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

function normalizeRecord(raw: unknown): TrademarkRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const process = str(r.process) ?? str(r.processo);
  const brand = str(r.brand) ?? str(r.marca);
  if (!process && !brand) return null;
  return {
    process: process ?? '',
    priority: str(r.priority) ?? str(r.prioridade),
    brand: brand ?? '',
    status: str(r.status) ?? str(r.situacao) ?? '',
    holder: str(r.holder) ?? str(r.titular),
    nice: str(r.nice) ?? str(r.classe),
    source_url: safeUrl(r.source_url),
  };
}

function normalizeRecords(raw: unknown): TrademarkRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeRecord).filter((x): x is TrademarkRecord => x !== null);
}

function normalizeSearches(raw: unknown): TrademarkSearchMode[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s) => s && typeof s === 'object')
    .map((s) => {
      const m = s as Record<string, unknown>;
      const records = normalizeRecords(m.records);
      return {
        mode: str(m.mode) ?? 'desconhecido',
        term: str(m.term) ?? '',
        total: num(m.total) ?? records.length,
        pages: num(m.pages),
        source_timestamp: str(m.source_timestamp),
        records,
      };
    });
}

export function normalizeResult(raw: unknown): TrademarkSearchResultData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const searches = normalizeSearches(r.searches);
  const records = normalizeRecords(r.records);
  return {
    brand: str(r.brand) ?? '',
    activity: str(r.activity) ?? '',
    queried_at: str(r.queried_at),
    source: safeUrl(r.source) ?? str(r.source),
    searches,
    records: records.length > 0 ? records : dedupeRecords(searches.flatMap((s) => s.records)),
    conclusion: str(r.conclusion) ?? 'inconclusive',
    scope: str(r.scope),
    activity_analysis: normalizeActivityAnalysis(r.activity_analysis, (records.length ? records : dedupeRecords(searches.flatMap(s => s.records))).map(r => r.process)),
  };
}

export function dedupeRecords(records: TrademarkRecord[]): TrademarkRecord[] {
  const seen = new Set<string>();
  return records.filter((r) => {
    const key = r.process || `${r.brand}|${r.holder}|${r.status}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const VALID_STATUS = new Set(['queued', 'running', 'completed', 'inconclusive', 'failed']);

export function normalizeJob(raw: unknown): TrademarkSearchJob | null {
  if (!raw || typeof raw !== 'object') return null;
  const j = raw as Record<string, unknown>;
  const job_id = str(j.job_id);
  const statusRaw = (str(j.status) ?? '').toLowerCase();
  if (!job_id) return null;
  const status = (VALID_STATUS.has(statusRaw) ? statusRaw : 'failed') as TrademarkSearchJob['status'];
  const result = status === 'completed' ? normalizeResult(j.result) : null;
  return {
    job_id,
    status,
    delivery: str(j.delivery),
    result,
    pdf_url: safeUrl(j.pdf_url),
  };
}

// ─── Chamadas à Edge Function (única porta de saída do navegador) ───────────

function functionUrl(): string {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  return `${base.replace(/\/$/, '')}/functions/v1/${FUNCTION_NAME}`;
}

async function callFunction(body: Record<string, unknown>): Promise<SearchApiResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  try {
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
    const res = await fetch(functionUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'x-wm-session': getSearchSessionId(),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }

    if (!res.ok) {
      const p = (payload ?? {}) as { error?: Partial<SearchApiError> };
      const code = (p.error?.code as SearchApiError['code']) ||
        (res.status === 429 ? 'rate_limited' : res.status >= 500 ? 'upstream_unavailable' : 'unknown');
      return {
        ok: false,
        error: {
          code,
          message: p.error?.message || 'Não foi possível concluir a consulta agora.',
        },
      };
    }

    const p = (payload ?? {}) as { ok?: boolean; job?: unknown; error?: SearchApiError };
    if (p.ok === false && p.error) return { ok: false, error: p.error };
    const job = normalizeJob(p.job);
    if (!job) {
      return { ok: false, error: { code: 'upstream_error', message: 'Resposta inválida do serviço de consulta.' } };
    }
    return { ok: true, job };
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    return {
      ok: false,
      error: {
        code: aborted ? 'timeout' : 'network',
        message: aborted
          ? 'A consulta demorou mais do que o esperado para responder.'
          : 'Falha de conexão ao iniciar a consulta.',
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

export const trademarkSearchService = {
  start(brand: string, activity: string, requestId: string): Promise<SearchApiResponse> {
    return callFunction({
      action: 'start',
      brand: normalizeTerm(brand, BRAND_MAX_LENGTH),
      activity: normalizeTerm(activity, ACTIVITY_MAX_LENGTH),
      request_id: requestId,
    });
  },
  status(jobId: string): Promise<SearchApiResponse> {
    return callFunction({ action: 'status', job_id: jobId });
  },
};
