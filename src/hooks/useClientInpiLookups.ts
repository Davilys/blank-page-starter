import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ProcessLookup } from '@/hooks/useProcessLookup';

/**
 * Carrega de uma vez o cache oficial do INPI de TODOS os processos do cliente
 * (para lista e Kanban), via RPC com verificação de titularidade.
 * Leitura apenas; nunca chama o INPI.
 */
export function useClientInpiLookups(userId?: string) {
  const [byNumber, setByNumber] = useState<Record<string, ProcessLookup>>({});

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      // Função criada pela migration 20261101210000_client_process_lookups.sql;
      // os tipos gerados do Supabase ainda não a conhecem.
      // @ts-expect-error RPC nova, tipos gerados desatualizados
      const { data, error } = await supabase.rpc('get_client_process_lookups');
      if (cancelled || error || !data) return;
      const map: Record<string, ProcessLookup> = {};
      for (const row of data as unknown as ProcessLookup[]) {
        if (row?.process_number) map[row.process_number] = row;
      }
      setByNumber(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return byNumber;
}
