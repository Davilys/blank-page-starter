import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isNineDigits, type ProcessLookup } from '@/hooks/useProcessLookup';

export interface ClientLookupState {
  loading: boolean;
  lookup: ProcessLookup | null;
  fromCache: boolean;
  error: { code: string; message: string } | null;
}

const EMPTY: ClientLookupState = { loading: false, lookup: null, fromCache: false, error: null };

const GENERIC_ERROR =
  'Não foi possível atualizar os dados deste processo no INPI agora. As informações existentes foram mantidas.';

/**
 * Consulta ao INPI pela ÁREA DO CLIENTE.
 *
 * Diferente do hook do painel admin (useProcessLookup), este caminho:
 * - lê o cache oficial pela RPC get_client_process_lookup, que só retorna a
 *   linha se o processo pertencer ao usuário autenticado;
 * - dispara atualizações pela edge function client-process-lookup, que valida
 *   titularidade e NÃO escreve em brand_processes, rpi_entries nem vincula
 *   clientes (sem efeitos colaterais administrativos);
 * - em qualquer falha, preserva a última informação conhecida e avisa.
 */
export function useClientProcessLookup() {
  const [states, setStates] = useState<Record<string, ClientLookupState>>({});
  const inFlight = useRef<Map<string, Promise<ClientLookupState>>>(new Map());
  const hydrated = useRef<Set<string>>(new Set());

  const get = useCallback(
    (processNumber: string): ClientLookupState => states[processNumber] ?? EMPTY,
    [states],
  );

  /** Carrega a última consulta gravada no cache oficial, sem chamar o INPI. */
  const hydrate = useCallback(async (processNumber: string) => {
    if (!isNineDigits(processNumber)) return;
    const key = processNumber.trim();
    if (hydrated.current.has(key)) return;
    if (inFlight.current.has(key)) return;
    hydrated.current.add(key);
    // Função criada pela migration 20261101210000_client_process_lookups.sql;
    // os tipos gerados do Supabase ainda não a conhecem.
    // @ts-expect-error RPC nova, tipos gerados desatualizados
    const { data, error } = await supabase.rpc('get_client_process_lookup', {
      p_process_number: key,
    });
    if (error) {
      hydrated.current.delete(key); // permite tentar de novo numa próxima abertura
      return;
    }
    const rows = (data ?? []) as unknown as ProcessLookup[];
    const row = rows[0];
    if (!row) return;
    setStates((s) => {
      const existing = s[key];
      if (existing && (existing.lookup || existing.loading)) return s;
      return { ...s, [key]: { ...EMPTY, lookup: row, fromCache: true } };
    });
  }, []);

  /** Botão "Sincronizar com INPI": atualiza o cache oficial via edge function do cliente. */
  const sync = useCallback(
    async (processNumber: string, force = true): Promise<ClientLookupState> => {
      const key = processNumber.trim();
      const existing = inFlight.current.get(key);
      if (existing) return existing;

      if (!isNineDigits(key)) {
        const invalid: ClientLookupState = {
          ...EMPTY,
          error: { code: 'invalid_input', message: 'Número do processo inválido (são 9 dígitos).' },
        };
        setStates((s) => ({ ...s, [key]: invalid }));
        return invalid;
      }

      setStates((s) => ({ ...s, [key]: { ...(s[key] ?? EMPTY), loading: true, error: null } }));

      const promise = (async (): Promise<ClientLookupState> => {
        try {
          const { data, error } = await supabase.functions.invoke('client-process-lookup', {
            body: { process_number: key, force },
          });
          if (error) {
            return { ...EMPTY, error: { code: 'upstream_error', message: GENERIC_ERROR } };
          }
          const res = data as {
            ok?: boolean;
            from_cache?: boolean;
            lookup?: ProcessLookup | null;
            error?: { code: string; message: string };
          };
          return {
            loading: false,
            lookup: res?.lookup ?? null,
            fromCache: res?.from_cache === true,
            error: res?.error ?? null,
          };
        } catch {
          return { ...EMPTY, error: { code: 'network', message: GENERIC_ERROR } };
        }
      })();

      inFlight.current.set(key, promise);
      const result = await promise;
      inFlight.current.delete(key);
      hydrated.current.add(key);
      setStates((s) => {
        const prev = s[key];
        // Falha sem dados novos: preserva a última informação conhecida.
        const merged =
          !result.lookup && result.error && prev?.lookup
            ? { ...result, lookup: prev.lookup, fromCache: true }
            : result;
        return { ...s, [key]: merged };
      });
      return result;
    },
    [],
  );

  return { get, hydrate, sync };
}
