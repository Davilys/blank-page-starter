import type { ActivityAnalysis } from '../../../supabase/functions/_shared/activityAnalysis';
/**
 * Tipos do buscador único de marcas (API WebMarcas/INPI).
 * Nenhum campo aqui contém segredo — tudo pode ser persistido em sessionStorage.
 */

export type UpstreamJobStatus = 'queued' | 'running' | 'completed' | 'inconclusive' | 'failed';

export type SearchConclusion =
  | 'requires_legal_review'
  | 'no_matches_in_searched_terms'
  | 'inconclusive'
  | (string & {});

export interface TrademarkRecord {
  process: string;
  priority: string | null;
  brand: string;
  status: string;
  holder: string | null;
  nice: string | null;
  source_url: string | null;
}

export interface TrademarkSearchMode {
  mode: 'exata' | 'radical' | (string & {});
  term: string;
  total: number;
  pages: number | null;
  source_timestamp: string | null;
  records: TrademarkRecord[];
}

export interface TrademarkSearchResultData {
  activity_analysis?: ActivityAnalysis | null;
  brand: string;
  activity: string;
  queried_at: string | null;
  source: string | null;
  searches: TrademarkSearchMode[];
  records: TrademarkRecord[];
  conclusion: SearchConclusion;
  scope: string | null;
}

/** Job normalizado devolvido pela Edge Function `webmarcas-inpi-search`. */
export interface TrademarkSearchJob {
  job_id: string;
  status: UpstreamJobStatus;
  delivery: string | null;
  result: TrademarkSearchResultData | null;
  pdf_url: string | null;
}

export type SearchErrorCode =
  | 'invalid_input'
  | 'rate_limited'
  | 'not_configured'
  | 'upstream_timeout'
  | 'upstream_unavailable'
  | 'upstream_error'
  | 'not_found'
  | 'network'
  | 'timeout'
  | 'inconclusive'
  | 'unknown';

export interface SearchApiError {
  code: SearchErrorCode;
  message: string;
}

export type SearchApiResponse =
  | { ok: true; job: TrademarkSearchJob }
  | { ok: false; error: SearchApiError };

/** Fases reais do fluxo — usadas pela animação de progresso. */
export type SearchPhase =
  | 'idle'
  | 'preparing'
  | 'sending'
  | 'queued'
  | 'running'
  | 'validating'
  | 'completed'
  | 'error';

export interface TrademarkSearchState {
  phase: SearchPhase;
  requestId: string | null;
  brandName: string;
  businessArea: string;
  jobId: string | null;
  startedAt: number | null;
  completedAt: number | null;
  job: TrademarkSearchJob | null;
  error: SearchApiError | null;
}

export const OFFICIAL_ERROR_MESSAGE =
  'Não foi possível concluir a consulta na base do INPI neste momento. Nenhum resultado foi gerado. Tente novamente mais tarde ou solicite uma análise à equipe WebMarcas.';

export const BRAND_MAX_LENGTH = 120;
export const ACTIVITY_MAX_LENGTH = 160;
export const POLL_INTERVAL_MS = 3000;
export const POLL_MAX_DURATION_MS = 5 * 60 * 1000;
/** Janela em que um "não encontrado" logo após criar o job é tratado como transitório. */
export const NOT_FOUND_GRACE_MS = 45 * 1000;
