import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Wrench, Undo2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface RepairAccount {
  id: string;
  email_address: string;
  imap_host: string | null;
}

interface RepairResult {
  id?: string;
  status: string;
  before?: { subject: string | null; from: string | null; from_name: string | null; snippet: string | null; has_body: boolean };
  after?: { subject: string | null; from: string | null; from_name: string | null; snippet: string | null; has_body: boolean };
  error?: string;
}

interface RepairRun {
  id: string;
  account_id: string | null;
  mode: string;
  status: string;
  examined: number;
  repaired: number;
  unchanged: number;
  not_found: number;
  failed: number;
  processed: number;
  limit_count: number;
  results: RepairResult[] | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  preview: 'Seria reparada',
  applied: 'Reparada',
  unchanged: 'Sem alteração',
  source_unavailable: 'Não localizada no servidor',
  folder_not_found: 'Pasta não localizada',
  error: 'Falha',
};

export function EmailRepairPanel({ accounts, isAdmin }: { accounts: RepairAccount[]; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState<string>('');
  const [busy, setBusy] = useState<string | null>(null);

  const eligible = accounts.filter((a) => !!a.imap_host);

  useEffect(() => {
    if (!accountId && eligible.length) setAccountId(eligible[0].id);
  }, [eligible, accountId]);

  const { data: run, refetch } = useQuery({
    queryKey: ['email-repair-run'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_repair_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as RepairRun) || null;
    },
    refetchInterval: (query) => ((query.state.data as RepairRun | null)?.status === 'running' ? 3000 : false),
  });

  if (!isAdmin) return null;

  const isRunning = run?.status === 'running' || !!busy;

  const call = async (mode: 'preview' | 'apply' | 'revert') => {
    if (isRunning) {
      toast.error('Já existe um reparo em andamento');
      return;
    }
    setBusy(mode);
    try {
      const { data, error } = await supabase.functions.invoke('email-repair-messages', {
        body: mode === 'revert'
          ? { mode, run_id: run?.id }
          : { mode, account_id: accountId, limit: 30 },
      });
      if (error) throw error;
      if ((data as any)?.error === 'already_running') {
        toast.error('Já existe um reparo em andamento');
      } else if (mode === 'revert') {
        toast.success(`Reversão concluída: ${(data as any)?.reverted ?? 0} mensagem(ns)`);
      } else {
        toast.success(mode === 'preview' ? 'Teste concluído' : 'Reparo aplicado na amostra');
      }
    } catch (e) {
      toast.error('Não foi possível concluir. Veja o resultado da execução.');
    } finally {
      setBusy(null);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    }
  };

  const results = (run?.results || []).filter((r) => r.before || r.after || r.status === 'error');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wrench className="h-4 w-4" />
          Reparo de mensagens antigas (amostra de 30)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Processa no máximo 30 mensagens com problema de leitura de uma conta, guardando cópia dos
          campos alterados. Não envia emails, respostas automáticas, notificações, campanhas ou sequências,
          e não altera leitura, categorias, anexos válidos nem vínculos.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={accountId} onValueChange={setAccountId} disabled={isRunning}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Conta piloto" />
            </SelectTrigger>
            <SelectContent>
              {eligible.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.email_address}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={() => call('preview')} disabled={isRunning || !accountId} variant="outline" size="sm">
            {busy === 'preview' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Testar reparo de 30 mensagens
          </Button>

          <Button onClick={() => call('apply')} disabled={isRunning || !accountId} size="sm">
            {busy === 'apply' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wrench className="h-4 w-4 mr-1" />}
            Aplicar na amostra
          </Button>

          <Button
            onClick={() => call('revert')}
            disabled={isRunning || !run || run.mode !== 'apply' || run.status !== 'completed'}
            variant="outline"
            size="sm"
          >
            {busy === 'revert' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Undo2 className="h-4 w-4 mr-1" />}
            Reverter esta amostra
          </Button>
        </div>

        {run && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant={run.status === 'running' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'}>
                {run.status === 'running'
                  ? `Em andamento — ${run.processed}/${run.limit_count}`
                  : run.status === 'failed'
                  ? 'Falhou'
                  : run.status === 'reverted'
                  ? 'Revertida'
                  : run.mode === 'apply' ? 'Aplicada' : 'Teste concluído'}
              </Badge>
              <span className="text-muted-foreground">Examinadas: {run.examined}</span>
              <span className="text-muted-foreground">Reparadas: {run.repaired}</span>
              <span className="text-muted-foreground">Sem alteração: {run.unchanged}</span>
              <span className="text-muted-foreground">Não localizadas: {run.not_found}</span>
              <span className="text-muted-foreground">Com falha: {run.failed}</span>
            </div>
            {run.error && <p className="text-xs text-destructive">{run.error}</p>}

            {results.length > 0 && (
              <ScrollArea className="h-[320px] rounded-md border">
                <div className="divide-y">
                  {results.map((r, i) => (
                    <div key={r.id || i} className="p-3 text-xs space-y-1">
                      <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[r.status] || r.status}</Badge>
                      {r.error && <p className="text-destructive">{r.error}</p>}
                      {r.before && (
                        <p className="text-muted-foreground break-words">
                          <span className="font-medium">Antes:</span> {r.before.subject || '(sem assunto)'} — {r.before.from || '—'}
                          {!r.before.has_body && ' — sem corpo'}
                        </p>
                      )}
                      {r.after && (
                        <p className="break-words">
                          <span className="font-medium">Depois:</span> {r.after.subject || '(sem assunto)'} — {r.after.from || '—'}
                          {!r.after.has_body && ' — sem corpo'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
