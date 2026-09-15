import { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type AccountSyncStatus =
  | 'syncing'
  | 'ok'
  | 'delayed'
  | 'error'
  | 'auth_required'
  | 'unknown';

export interface AccountSyncInfo {
  accountId: string;
  status: AccountSyncStatus;
  lastSuccessAt: string | null;
  lastSyncedAt: string | null;
  consecutiveErrors: number;
  lastError: string | null;
}

export interface SyncRun {
  id: string;
  account_id: string;
  started_at: string;
  finished_at: string | null;
  result: string;
  trigger_source: string;
  new_count: number;
  updated_count: number;
  failed_count: number;
  error_code: string | null;
  error_summary: string | null;
  recommended_action: string | null;
}

/** A successful run older than this means the account is behind. */
const DELAY_THRESHOLD_MS = 30 * 60 * 1000;

export const SYNC_STATUS_LABEL: Record<AccountSyncStatus, string> = {
  syncing: 'Sincronizando',
  ok: 'Atualizado',
  delayed: 'Sincronização atrasada',
  error: 'Falha temporária',
  auth_required: 'Autenticação necessária',
  unknown: 'Sem dados de sincronização',
};

export function useEmailSync(accountIds: string[], selectedAccountId?: string | null) {
  const queryClient = useQueryClient();
  const [syncingAccount, setSyncingAccount] = useState<string | null>(null);
  const inFlight = useRef<Set<string>>(new Set());

  const idsKey = accountIds.slice().sort().join(',');

  const { data: states = [] } = useQuery({
    queryKey: ['email-sync-state', idsKey],
    queryFn: async () => {
      if (!accountIds.length) return [];
      const { data, error } = await supabase
        .from('email_sync_state')
        .select('account_id, folder, status, last_synced_at, last_success_at, last_error, consecutive_errors')
        .in('account_id', accountIds);
      if (error) throw error;
      return data || [];
    },
    enabled: accountIds.length > 0,
    refetchInterval: 20000,
  });

  const byAccount = useMemo(() => {
    const map: Record<string, AccountSyncInfo> = {};
    for (const id of accountIds) {
      const rows = (states as any[]).filter((s) => s.account_id === id);
      const accountRow = rows.find((r) => r.folder === '_account');
      const lastSuccess = rows
        .map((r) => r.last_success_at || (r.folder !== '_account' ? r.last_synced_at : null))
        .filter(Boolean)
        .sort()
        .pop() || null;
      const lastSynced = rows.map((r) => r.last_synced_at).filter(Boolean).sort().pop() || null;

      let status: AccountSyncStatus = 'unknown';
      if (syncingAccount === id) status = 'syncing';
      else if (accountRow?.status === 'running') status = 'syncing';
      else if (accountRow?.status === 'auth_required') status = 'auth_required';
      else if ((accountRow?.consecutive_errors || 0) > 0) status = 'error';
      else if (lastSuccess && Date.now() - new Date(lastSuccess).getTime() > DELAY_THRESHOLD_MS) status = 'delayed';
      else if (lastSuccess) status = 'ok';

      map[id] = {
        accountId: id,
        status,
        lastSuccessAt: lastSuccess,
        lastSyncedAt: lastSynced,
        consecutiveErrors: accountRow?.consecutive_errors || 0,
        lastError: accountRow?.last_error || null,
      };
    }
    return map;
  }, [states, accountIds, syncingAccount]);

  const { data: runs = [] } = useQuery({
    queryKey: ['email-sync-runs', selectedAccountId],
    queryFn: async () => {
      if (!selectedAccountId) return [];
      const { data, error } = await supabase
        .from('email_sync_runs')
        .select('*')
        .eq('account_id', selectedAccountId)
        .order('started_at', { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data || []) as SyncRun[];
    },
    enabled: !!selectedAccountId,
    refetchInterval: 60000,
  });

  const syncNow = useCallback(async (accountId: string) => {
    if (!accountId || inFlight.current.has(accountId)) return;
    inFlight.current.add(accountId);
    setSyncingAccount(accountId);
    try {
      const { error } = await supabase.functions.invoke('sync-imap-inbox', {
        body: { account_id: accountId, trigger_source: 'manual' },
      });
      if (error) throw error;
      toast.success('Sincronização concluída');
    } catch (e: any) {
      toast.error('Não foi possível sincronizar agora', { description: e?.message });
    } finally {
      inFlight.current.delete(accountId);
      setSyncingAccount(null);
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['email-counts'] });
      queryClient.invalidateQueries({ queryKey: ['email-sync-state'] });
      queryClient.invalidateQueries({ queryKey: ['email-sync-runs'] });
    }
  }, [queryClient]);

  return { byAccount, runs, syncNow, isSyncing: !!syncingAccount, syncingAccount };
}
