import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RefreshCw, History, PenSquare, Search, AlertTriangle, CheckCircle2, Clock, KeyRound, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { SYNC_STATUS_LABEL, type AccountSyncInfo, type SyncRun } from '@/hooks/useEmailSync';

interface EmailSyncBarProps {
  accountEmail?: string;
  info?: AccountSyncInfo;
  runs: SyncRun[];
  onSyncNow: () => void;
  onCompose: () => void;
  search: string;
  onSearchChange: (v: string) => void;
}

const STATUS_STYLE: Record<string, { icon: typeof CheckCircle2; className: string }> = {
  syncing: { icon: Loader2, className: 'text-primary border-primary/40 bg-primary/10' },
  ok: { icon: CheckCircle2, className: 'text-emerald-600 border-emerald-500/40 bg-emerald-500/10 dark:text-emerald-400' },
  delayed: { icon: Clock, className: 'text-amber-600 border-amber-500/40 bg-amber-500/10 dark:text-amber-400' },
  error: { icon: AlertTriangle, className: 'text-destructive border-destructive/40 bg-destructive/10' },
  auth_required: { icon: KeyRound, className: 'text-destructive border-destructive/40 bg-destructive/10' },
  unknown: { icon: Clock, className: 'text-muted-foreground border-border bg-muted/40' },
};

export function EmailSyncBar({
  accountEmail, info, runs, onSyncNow, onCompose, search, onSearchChange,
}: EmailSyncBarProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const status = info?.status || 'unknown';
  const style = STATUS_STYLE[status] || STATUS_STYLE.unknown;
  const Icon = style.icon;
  const lastSuccess = info?.lastSuccessAt ? new Date(info.lastSuccessAt) : null;

  const statusText = status === 'ok' && lastSuccess
    ? `Atualizado às ${format(lastSuccess, "HH:mm 'de' dd/MM", { locale: ptBR })}`
    : SYNC_STATUS_LABEL[status];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card/60 px-3 py-2">
      <div className="relative min-w-[180px] flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por remetente, assunto ou conteúdo"
          className="h-9 pl-8"
          aria-label="Buscar mensagens"
        />
      </div>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={cn('h-8 gap-1.5 rounded-lg px-2.5 text-xs font-medium', style.className)}
            >
              <Icon className={cn('h-3.5 w-3.5', status === 'syncing' && 'animate-spin')} aria-hidden />
              <span>{statusText}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-[260px] text-xs">
              {accountEmail}
              {info?.lastError ? ` — ${info.lastError}` : ''}
              {status === 'auth_required' ? ' — atualize a senha desta conta em Configurações.' : ''}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-1.5"
        onClick={onSyncNow}
        disabled={status === 'syncing'}
      >
        <RefreshCw className={cn('h-4 w-4', status === 'syncing' && 'animate-spin')} />
        Sincronizar agora
      </Button>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-9 gap-1.5">
            <History className="h-4 w-4" />
            Histórico
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de sincronização — {accountEmail}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-3">
            {runs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma execução registrada para esta conta ainda.
              </p>
            ) : (
              <ul className="space-y-2">
                {runs.map((run) => (
                  <li key={run.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[11px]',
                          run.result === 'success' && 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
                          run.result === 'partial' && 'border-amber-500/40 text-amber-600 dark:text-amber-400',
                          run.result === 'error' && 'border-destructive/40 text-destructive',
                        )}
                      >
                        {run.result === 'success' ? 'Concluída' : run.result === 'partial' ? 'Concluída com falhas' : run.result === 'error' ? 'Falhou' : 'Em execução'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(run.started_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                        {run.finished_at ? ` → ${format(new Date(run.finished_at), 'HH:mm:ss')}` : ''}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        origem: {run.trigger_source === 'manual' ? 'manual' : 'automática'}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
                      <span>Novas: <strong>{run.new_count}</strong></span>
                      <span>Atualizadas: <strong>{run.updated_count}</strong></span>
                      <span className={run.failed_count > 0 ? 'text-destructive' : undefined}>
                        Com falha: <strong>{run.failed_count}</strong>
                      </span>
                    </div>
                    {run.error_summary && (
                      <p className="mt-1.5 text-xs text-destructive">{run.error_summary}</p>
                    )}
                    {run.recommended_action && (
                      <p className="mt-1 text-xs text-muted-foreground">{run.recommended_action}</p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground">ID: {run.id}</p>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Button size="sm" className="h-9 gap-1.5" onClick={onCompose}>
        <PenSquare className="h-4 w-4" />
        Novo email
      </Button>
    </div>
  );
}
