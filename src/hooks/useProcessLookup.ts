import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProcessLookup {
  process_number: string;
  brand_name: string | null;
  holder: string | null;
  ncl_class: string | null;
  current_status: string | null;
  presentation: string | null;
  nature: string | null;
  class_status: string | null;
  specification: string | null;
  legal_representative: string | null;
  priority_date: string | null;
  filing_date: string | null;
  grant_date: string | null;
  expiry_date: string | null;
  source_url: string | null;
  source: string | null;
  detail_status: string | null;
  lookup_status: string | null;
  queried_at: string | null;
}

export interface LookupDivergence {
  field: string;
  current: unknown;
  official: unknown;
}

export interface LinkCandidate {
  client_id: string;
  name: string | null;
  reason: string;
}

export interface LinkResult {
  status: 'linked' | 'already_linked' | 'candidates' | 'none' | 'skipped' | 'error';
  client_id: string | null;
  client_name: string | null;
  process_id: string | null;
  source: string | null;
  candidates: LinkCandidate[];
  merged: number;
  created_process: boolean;
}

export interface LookupState {
  loading: boolean;
  lookup: ProcessLookup | null;
  applied: string[];
  divergences: LookupDivergence[];
  saved: boolean;
  fromCache: boolean;
  link: LinkResult | null;
  error: { code: string; message: string } | null;
}

const EMPTY: LookupState = {
  loading: false,
  lookup: null,
  applied: [],
  divergences: [],
  saved: false,
  fromCache: false,
  link: null,
  error: null,
};

const GENERIC_ERROR =
  'Não foi possível atualizar os dados deste processo no INPI agora. As informações existentes foram mantidas.';

export function isNineDigits(value: string | null | undefined): boolean {
  return typeof value === 'string' && /^[0-9]{9}$/.test(value.trim());
}

/**
 * Consulta sob demanda de um processo no INPI, por entrada da Revista INPI.
 * Deduplica requisições simultâneas pelo número do processo e associa sempre
 * a resposta ao processo correto (nunca escreve num cartão diferente).
 */
export function useProcessLookup() {
  const [states, setStates] = useState<Record<string, LookupState>>({});
  const inFlight = useRef<Map<string, Promise<LookupState>>>(new Map());
  const attempted = useRef<Set<string>>(new Set());
  const hydrated = useRef<Set<string>>(new Set());

  const get = useCallback(
    (processNumber: string): LookupState => states[processNumber] ?? EMPTY,
    [states],
  );

  /**
   * Carrega a última consulta gravada em rpi_process_lookups para o processo,
   * sem chamar o INPI. Garante que o resultado persista entre aberturas do card.
   */
  const hydrate = useCallback(async (processNumber: string) => {
    if (!isNineDigits(processNumber)) return;
    const key = processNumber.trim();
    if (hydrated.current.has(key)) return;
    if (inFlight.current.has(key)) return;
    hydrated.current.add(key);
    const { data, error } = await supabase
      .from('rpi_process_lookups')
      .select(
        'process_number, brand_name, holder, ncl_class, current_status, presentation, nature, class_status, specification, legal_representative, priority_date, filing_date, grant_date, expiry_date, source_url, source, detail_status, lookup_status, queried_at',
      )
      .eq('process_number', key)
      .maybeSingle();
    if (error || !data) return;
    setStates((s) => {
      const existing = s[key];
      // Não sobrescreve uma consulta mais recente já carregada em memória.
      if (existing && (existing.lookup || existing.loading)) return s;
      return {
        ...s,
        [key]: { ...EMPTY, lookup: data as ProcessLookup, saved: true, fromCache: true },
      };
    });
  }, []);

  const run = useCallback(
    async (processNumber: string, entryId: string, force = false): Promise<LookupState> => {
      const key = processNumber;
      const existing = inFlight.current.get(key);
      if (existing) return existing;

      if (!isNineDigits(processNumber)) {
        const invalid: LookupState = {
          ...EMPTY,
          error: { code: 'invalid_input', message: 'Número do processo inválido (são 9 dígitos).' },
        };
        setStates((s) => ({ ...s, [key]: invalid }));
        return invalid;
      }

      setStates((s) => ({ ...s, [key]: { ...(s[key] ?? EMPTY), loading: true, error: null } }));

      const promise = (async (): Promise<LookupState> => {
        try {
          const { data, error } = await supabase.functions.invoke('inpi-process-lookup', {
            body: { process_number: processNumber.trim(), entry_id: entryId, force },
          });

          if (error) {
            return { ...EMPTY, error: { code: 'upstream_error', message: GENERIC_ERROR } };
          }

          const res = data as {
            ok?: boolean;
            saved?: boolean;
            from_cache?: boolean;
            lookup?: ProcessLookup | null;
            applied?: string[];
            divergences?: LookupDivergence[];
            link?: LinkResult | null;
            error?: { code: string; message: string };
          };

          return {
            loading: false,
            lookup: res?.lookup ?? null,
            applied: res?.applied ?? [],
            divergences: res?.divergences ?? [],
            saved: res?.saved === true,
            fromCache: res?.from_cache === true,
            link: res?.link ?? null,
            error: res?.error ?? null,
          };
        } catch {
          return { ...EMPTY, error: { code: 'network', message: GENERIC_ERROR } };
        }
      })();

      inFlight.current.set(key, promise);
      const result = await promise;
      inFlight.current.delete(key);
      attempted.current.add(key);
      hydrated.current.add(key);
      setStates((s) => ({ ...s, [key]: result }));
      return result;
    },
    [],
  );

  /** Dispara a consulta automática apenas uma vez por processo nesta sessão de tela. */
  const ensure = useCallback(
    (processNumber: string, entryId: string) => {
      if (attempted.current.has(processNumber)) return;
      if (inFlight.current.has(processNumber)) return;
      attempted.current.add(processNumber);
      void run(processNumber, entryId, false);
    },
    [run],
  );

  const refetch = useCallback(
    (processNumber: string, entryId: string) => run(processNumber, entryId, true),
    [run],
  );

  return { get, ensure, refetch };
}
