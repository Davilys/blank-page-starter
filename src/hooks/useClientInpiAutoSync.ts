import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isNineDigits } from '@/hooks/useProcessLookup';

const SESSION_KEY = 'wm_inpi_autosync_done';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PER_LOGIN = 10;

/**
 * Sincronização automática ao entrar na área do cliente (login/sessão):
 * para cada processo com número válido cuja consulta oficial está ausente ou
 * mais velha que 24 h, dispara uma atualização em segundo plano pela edge
 * function client-process-lookup (sem force: o cache fresco é reaproveitado).
 *
 * - Roda no máximo 1 vez por aba/sessão (sessionStorage).
 * - Sequencial e limitada (MAX_PER_LOGIN por login) para não pressionar o INPI.
 * - Falhas NÃO são silenciosas: marcam sessionStorage (wm_inpi_syncfail_<n>)
 *   e a tela do processo mostra aviso com a última consulta preservada.
 */
export function useClientInpiAutoSync(userId?: string | null) {
  useEffect(() => {
    if (!userId) return;
    if (typeof sessionStorage === 'undefined') return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, '1');

    let cancelled = false;
    (async () => {
      try {
        const { data: procs } = await supabase
          .from('brand_processes')
          .select('process_number')
          .eq('user_id', userId);
        if (cancelled || !procs) return;

        const numbers = Array.from(
          new Set(
            procs
              .map((p) => (p.process_number ?? '').trim())
              .filter((n) => isNineDigits(n)),
          ),
        );
        if (numbers.length === 0) return;

        // @ts-expect-error RPC nova, tipos gerados desatualizados
        const { data: rows } = await supabase.rpc('get_client_process_lookups');
        const cutoff = Date.now() - CACHE_TTL_MS;
        const fresh = new Set<string>();
        for (const r of (rows ?? []) as {
          process_number: string;
          lookup_status: string | null;
          queried_at: string | null;
        }[]) {
          if (
            r.lookup_status === 'completed' &&
            r.queried_at &&
            Date.parse(r.queried_at) > cutoff
          ) {
            fresh.add(r.process_number);
          }
        }

        let done = 0;
        for (const n of numbers) {
          if (cancelled || done >= MAX_PER_LOGIN) break;
          if (fresh.has(n)) continue;
          done++;
          try {
            const { data, error } = await supabase.functions.invoke('client-process-lookup', {
              body: { process_number: n, force: false },
            });
            const res = data as { ok?: boolean; lookup?: unknown } | null;
            if (error || res?.ok === false) {
              // Falha NÃO é silenciosa para a UI: a tela do processo mostra aviso
              // com a data da última consulta preservada.
              sessionStorage.setItem(`wm_inpi_syncfail_${n}`, new Date().toISOString());
            } else if (res?.lookup) {
              sessionStorage.removeItem(`wm_inpi_syncfail_${n}`);
              // Telas abertas (detalhe do processo) refletem a consulta nova sem refresh.
              window.dispatchEvent(
                new CustomEvent('wm-inpi-synced', { detail: { process_number: n, lookup: res.lookup } }),
              );
            }
          } catch {
            sessionStorage.setItem(`wm_inpi_syncfail_${n}`, new Date().toISOString());
          }
        }
      } catch {
        /* sincronização de fundo: nunca derruba a navegação do cliente */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);
}
