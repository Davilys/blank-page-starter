import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Search, Mail, Paperclip, ArrowDownUp, RefreshCw, Inbox, AlertTriangle, Clock, CheckCircle2,
} from 'lucide-react';
import { ClientEmailViewer, type ClientEmailLog } from './ClientEmailViewer';

const PAGE_SIZE = 25;

interface Props {
  clientId: string;
  clientName?: string;
  /** incrementa para forçar recarga (ex.: após enviar um novo e-mail) */
  refreshToken?: number;
}

const STATUS_META: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  sent: { label: 'Enviado', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', icon: CheckCircle2 },
  delivered: { label: 'Entregue', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', icon: CheckCircle2 },
  failed: { label: 'Falhou', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', icon: AlertTriangle },
  error: { label: 'Erro no envio', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', icon: AlertTriangle },
  bounced: { label: 'Rejeitado', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300', icon: AlertTriangle },
  pending: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', icon: Clock },
};

export function statusMeta(status?: string | null) {
  return STATUS_META[(status || 'pending').toLowerCase()] || {
    label: status || 'Desconhecido',
    cls: 'bg-muted text-muted-foreground',
    icon: Clock,
  };
}

export function formatDateTime(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

const SELECT_COLS =
  'id, from_email, to_email, cc_emails, bcc_emails, subject, body, html_body, status, error_message, sent_at, sent_by, attachments, provider_message_id, trigger_type, client_id';

export function ClientEmailHistory({ clientId, clientName, refreshToken = 0 }: Props) {
  const [rows, setRows] = useState<ClientEmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [desc, setDesc] = useState(true);
  const [selected, setSelected] = useState<ClientEmailLog | null>(null);

  const fetchPage = useCallback(
    async (from: number) => {
      // Vínculo SEMPRE pelo ID interno do cliente — nunca pelo endereço de e-mail.
      let q = supabase
        .from('email_logs')
        .select(SELECT_COLS, { count: 'exact' })
        .eq('client_id', clientId)
        .order('sent_at', { ascending: !desc })
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (appliedSearch.trim()) {
        q = q.ilike('subject', `%${appliedSearch.trim().replace(/[%,]/g, '')}%`);
      }
      const { data, error, count } = await q;
      if (error) throw error;
      return { data: (data || []) as unknown as ClientEmailLog[], count: count ?? null };
    },
    [clientId, appliedSearch, desc],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, count } = await fetchPage(0);
      setRows(data);
      setTotal(count);
      setHasMore(count !== null ? data.length < count : data.length === PAGE_SIZE);
    } catch (e) {
      console.error('[ClientEmailHistory] load', e);
      setRows([]);
      setTotal(0);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    setSelected(null);
    load();
  }, [load, refreshToken]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const { data, count } = await fetchPage(rows.length);
      const merged = [...rows, ...data.filter((d) => !rows.some((r) => r.id === d.id))];
      setRows(merged);
      if (count !== null) setTotal(count);
      setHasMore(count !== null ? merged.length < count : data.length === PAGE_SIZE);
    } catch (e) {
      console.error('[ClientEmailHistory] loadMore', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const countLabel = useMemo(() => {
    if (total === null) return `${rows.length} e-mail(s)`;
    return `${rows.length} de ${total} e-mail(s)`;
  }, [rows.length, total]);

  if (selected) {
    return <ClientEmailViewer email={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border flex-shrink-0">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setAppliedSearch(search); }}
            placeholder="Pesquisar por assunto..."
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Button variant="secondary" size="sm" className="h-8" onClick={() => setAppliedSearch(search)}>
          Pesquisar
        </Button>
        {appliedSearch && (
          <Button variant="ghost" size="sm" className="h-8" onClick={() => { setSearch(''); setAppliedSearch(''); }}>
            Limpar
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setDesc((v) => !v)}>
          <ArrowDownUp className="h-3.5 w-3.5" />
          {desc ? 'Mais recentes' : 'Mais antigos'}
        </Button>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </Button>
      </div>

      <div className="px-4 py-1.5 text-[11px] text-muted-foreground border-b border-border/60 flex-shrink-0">
        {countLabel}{clientName ? ` — ${clientName}` : ''}
      </div>

      <ScrollArea className="flex-1">
        <div className="divide-y divide-border">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Inbox className="h-8 w-8 opacity-40" />
              {appliedSearch
                ? 'Nenhum e-mail encontrado para essa pesquisa.'
                : 'Nenhum e-mail foi enviado para este cliente pelo CRM ainda.'}
            </div>
          ) : (
            rows.map((row) => {
              const meta = statusMeta(row.status);
              const StatusIcon = meta.icon;
              const anexos = Array.isArray(row.attachments) ? row.attachments.length : 0;
              return (
                <button
                  key={row.id}
                  onClick={() => setSelected(row)}
                  className="w-full text-left p-3.5 hover:bg-muted/60 transition-colors focus:outline-none focus:bg-muted/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium text-sm truncate">{row.subject || '(sem assunto)'}</span>
                        {anexos > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground flex-shrink-0">
                            <Paperclip className="h-3 w-3" />{anexos}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        Para: {row.to_email} · De: {row.from_email}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Enviado em: {formatDateTime(row.sent_at)}
                      </p>
                    </div>
                    <Badge variant="secondary" className={cn('gap-1 flex-shrink-0 text-[10px]', meta.cls)}>
                      <StatusIcon className="h-3 w-3" />
                      {meta.label}
                    </Badge>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {hasMore && !loading && (
          <div className="p-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Carregando...' : 'Carregar mais'}
            </Button>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
