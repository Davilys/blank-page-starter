import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { trademarkSearchService, validateSearchInput, normalizeTerm } from './trademarkSearchService';
import {
  ACTIVITY_MAX_LENGTH,
  BRAND_MAX_LENGTH,
  NOT_FOUND_GRACE_MS,
  OFFICIAL_ERROR_MESSAGE,
  POLL_INTERVAL_MS,
  POLL_MAX_DURATION_MS,
  type SearchApiError,
  type TrademarkSearchJob,
  type TrademarkSearchState,
} from './types';

const STORAGE_KEY = 'wm_trademark_search';
const STORAGE_VERSION = 1;

const INITIAL_STATE: TrademarkSearchState = {
  phase: 'idle',
  requestId: null,
  brandName: '',
  businessArea: '',
  jobId: null,
  startedAt: null,
  completedAt: null,
  job: null,
  error: null,
};

interface TrademarkSearchContextValue {
  state: TrademarkSearchState;
  isBusy: boolean;
  startSearch: (brand: string, activity: string) => Promise<void>;
  retry: () => Promise<void>;
  reset: () => void;
}

const TrademarkSearchContext = createContext<TrademarkSearchContextValue | null>(null);

// ─── Persistência (sem segredos) ─────────────────────────────────────────────

function loadState(): TrademarkSearchState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: number; state?: TrademarkSearchState };
    if (parsed.v !== STORAGE_VERSION || !parsed.state) return null;
    const s = parsed.state;
    if (typeof s.brandName !== 'string' || typeof s.businessArea !== 'string') return null;
    return { ...INITIAL_STATE, ...s };
  } catch {
    return null;
  }
}

function saveState(state: TrademarkSearchState) {
  try {
    if (state.phase === 'idle') {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ v: STORAGE_VERSION, state }));
  } catch {
    /* armazenamento indisponível — segue só em memória */
  }
}

function isFinalJob(job: TrademarkSearchJob): boolean {
  return job.status === 'completed' || job.status === 'inconclusive' || job.status === 'failed';
}

function summarizeStatus(job: TrademarkSearchJob | null, error: SearchApiError | null): string {
  if (job?.status === 'completed' && job.result) {
    if (job.result.conclusion === 'requires_legal_review') return 'requires_legal_review';
    if (job.result.conclusion === 'no_matches_in_searched_terms') return 'no_matches';
    return String(job.result.conclusion).slice(0, 60);
  }
  if (job?.status === 'inconclusive') return 'inconclusive';
  if (error) return `error:${error.code}`;
  return 'inconclusive';
}

/**
 * Registro na tabela existente `viability_searches` (prova social do site).
 * Estrutura e permissões atuais preservadas: grava só marca, ramo e status resumido.
 * Falhas (ex.: visitante anônimo sem permissão de insert) são ignoradas silenciosamente.
 */
function logSearch(brand: string, activity: string, summary: string) {
  supabase
    .from('viability_searches')
    .insert({ brand_name: brand, business_area: activity, result_level: summary })
    .then(() => undefined, () => undefined);
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function TrademarkSearchProvider({ children }: { children: ReactNode }) {
  const [state, setStateRaw] = useState<TrademarkSearchState>(() => loadState() ?? INITIAL_STATE);
  const stateRef = useRef(state);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runToken = useRef(0); // invalida polls antigos quando começa nova busca
  const inFlight = useRef(false);

  const setState = useCallback((updater: (prev: TrademarkSearchState) => TrademarkSearchState) => {
    setStateRaw((prev) => {
      const next = updater(prev);
      stateRef.current = next;
      saveState(next);
      return next;
    });
  }, []);

  const clearTimer = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const finishWithError = useCallback((error: SearchApiError, logIt = true) => {
    clearTimer();
    const s = stateRef.current;
    if (logIt && s.brandName) logSearch(s.brandName, s.businessArea, summarizeStatus(null, error));
    setState((prev) => ({ ...prev, phase: 'error', error, completedAt: Date.now() }));
  }, [clearTimer, setState]);

  const applyJob = useCallback((job: TrademarkSearchJob, token: number, options?: { silentRefresh?: boolean }) => {
    if (token !== runToken.current) return;

    if (job.status === 'completed') {
      if (!job.result || job.result.conclusion === 'inconclusive') {
        finishWithError({ code: 'inconclusive', message: OFFICIAL_ERROR_MESSAGE });
        return;
      }
      clearTimer();
      if (options?.silentRefresh) {
        setState((prev) => ({ ...prev, job, jobId: job.job_id }));
        return;
      }
      // "Validando resultados" é real: a normalização acabou de rodar no cliente.
      setState((prev) => ({ ...prev, phase: 'validating', job, jobId: job.job_id }));
      const s = stateRef.current;
      logSearch(s.brandName, s.businessArea, summarizeStatus(job, null));
      pollTimer.current = setTimeout(() => {
        if (token !== runToken.current) return;
        setState((prev) => ({ ...prev, phase: 'completed', completedAt: Date.now() }));
      }, 900);
      return;
    }

    if (job.status === 'inconclusive' || job.status === 'failed') {
      finishWithError({ code: 'inconclusive', message: OFFICIAL_ERROR_MESSAGE });
      return;
    }

    // queued / running
    const phase = job.status === 'running' ? 'running' : 'queued';
    setState((prev) => ({ ...prev, phase, jobId: job.job_id, job }));
  }, [clearTimer, finishWithError, setState]);

  // Ref evita auto-referência no useCallback (que quebra a inferência de tipos do TS).
  const schedulePollRef = useRef<(jobId: string, token: number) => void>(() => undefined);
  const schedulePoll = useCallback((jobId: string, token: number) => schedulePollRef.current(jobId, token), []);

  schedulePollRef.current = (jobId: string, token: number) => {
    clearTimer();
    pollTimer.current = setTimeout(async () => {
      if (token !== runToken.current) return;
      const s = stateRef.current;
      if (s.startedAt && Date.now() - s.startedAt > POLL_MAX_DURATION_MS) {
        finishWithError({ code: 'timeout', message: OFFICIAL_ERROR_MESSAGE });
        return;
      }
      if (inFlight.current) {
        schedulePoll(jobId, token);
        return;
      }
      inFlight.current = true;
      const res = await trademarkSearchService.status(jobId);
      inFlight.current = false;
      if (token !== runToken.current) return;

      if (res.ok === false) {
        // Falhas transitórias de rede continuam tentando dentro do limite de 5 min.
        if (res.error.code === 'network' || res.error.code === 'timeout' || res.error.code === 'upstream_timeout' || res.error.code === 'upstream_unavailable') {
          schedulePoll(jobId, token);
          return;
        }
        // A API pode levar alguns segundos para expor um job recém-criado (404 transitório).
        // Só tratamos "não encontrado" como definitivo depois de uma janela de tolerância.
        if (res.error.code === 'not_found' && s.startedAt && Date.now() - s.startedAt < NOT_FOUND_GRACE_MS) {
          schedulePoll(jobId, token);
          return;
        }
        finishWithError({ code: res.error.code, message: OFFICIAL_ERROR_MESSAGE });
        return;
      }

      applyJob(res.job, token);
      if (!isFinalJob(res.job)) schedulePoll(jobId, token);
    }, POLL_INTERVAL_MS);
  };

  const runStart = useCallback(async (brand: string, activity: string, requestId: string) => {
    const token = ++runToken.current;
    clearTimer();
    inFlight.current = false;

    setState(() => ({
      ...INITIAL_STATE,
      phase: 'preparing',
      requestId,
      brandName: brand,
      businessArea: activity,
      startedAt: Date.now(),
    }));

    // "Preparando" -> "Enviando" acompanham a chamada real.
    await new Promise((r) => setTimeout(r, 350));
    if (token !== runToken.current) return;
    setState((prev) => ({ ...prev, phase: 'sending' }));

    const res = await trademarkSearchService.start(brand, activity, requestId);
    if (token !== runToken.current) return;

    if (res.ok === false) {
      finishWithError({
        code: res.error.code,
        message: res.error.code === 'rate_limited' || res.error.code === 'invalid_input'
          ? res.error.message
          : OFFICIAL_ERROR_MESSAGE,
      });
      return;
    }

    applyJob(res.job, token);
    if (!isFinalJob(res.job)) schedulePoll(res.job.job_id, token);
  }, [applyJob, clearTimer, finishWithError, schedulePoll, setState]);

  const startSearch = useCallback(async (brandInput: string, activityInput: string) => {
    const brand = normalizeTerm(brandInput, BRAND_MAX_LENGTH);
    const activity = normalizeTerm(activityInput, ACTIVITY_MAX_LENGTH);
    const invalid = validateSearchInput(brand, activity);
    if (invalid) {
      setState((prev) => ({ ...prev, phase: 'error', error: invalid, brandName: brand, businessArea: activity, job: null, jobId: null }));
      return;
    }
    const s = stateRef.current;
    const busy = s.phase === 'preparing' || s.phase === 'sending' || s.phase === 'queued' || s.phase === 'running' || s.phase === 'validating';
    // Duplo clique / mesma consulta em andamento: não cria novo job.
    if (busy && s.brandName.toLowerCase() === brand.toLowerCase() && s.businessArea.toLowerCase() === activity.toLowerCase()) return;

    await runStart(brand, activity, crypto.randomUUID());
  }, [runStart, setState]);

  const retry = useCallback(async () => {
    const s = stateRef.current;
    if (!s.brandName || !s.businessArea) return;
    // Sem job criado (falha de rede ao iniciar): reaproveita o request_id -> chave idempotente estável.
    // Job já finalizado como inconclusivo/erro: nova tentativa legítima -> novo request_id.
    const requestId = !s.jobId && s.requestId ? s.requestId : crypto.randomUUID();
    await runStart(s.brandName, s.businessArea, requestId);
  }, [runStart]);

  const reset = useCallback(() => {
    runToken.current += 1;
    clearTimer();
    inFlight.current = false;
    setState(() => INITIAL_STATE);
  }, [clearTimer, setState]);

  // Retomada após navegação/refresh.
  useEffect(() => {
    const s = stateRef.current;
    const token = ++runToken.current;

    if ((s.phase === 'queued' || s.phase === 'running') && s.jobId) {
      schedulePoll(s.jobId, token);
    } else if (s.phase === 'preparing' || s.phase === 'sending' || s.phase === 'validating') {
      // Estado intermediário perdido no refresh: sem job confirmado, não há como retomar com segurança.
      if (s.jobId) schedulePoll(s.jobId, token);
      else setState((prev) => ({ ...prev, phase: 'error', error: { code: 'network', message: OFFICIAL_ERROR_MESSAGE } }));
    } else if (s.phase === 'completed' && s.jobId) {
      // Link do PDF é assinado e expira: renova consultando o status de novo.
      trademarkSearchService.status(s.jobId).then((res) => {
        if (token !== runToken.current || res.ok === false) return;
        if (res.job.status === 'completed' && res.job.result) applyJob(res.job, token, { silentRefresh: true });
      });
    }

    return () => {
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isBusy = state.phase === 'preparing' || state.phase === 'sending' || state.phase === 'queued' || state.phase === 'running' || state.phase === 'validating';

  const value = useMemo<TrademarkSearchContextValue>(() => ({ state, isBusy, startSearch, retry, reset }), [state, isBusy, startSearch, retry, reset]);

  return <TrademarkSearchContext.Provider value={value}>{children}</TrademarkSearchContext.Provider>;
}

export function useTrademarkSearchContext(): TrademarkSearchContextValue {
  const ctx = useContext(TrademarkSearchContext);
  if (!ctx) throw new Error('useTrademarkSearch deve ser usado dentro de <TrademarkSearchProvider>.');
  return ctx;
}
