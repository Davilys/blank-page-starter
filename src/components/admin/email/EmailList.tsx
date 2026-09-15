import { useEffect, useMemo, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Mail, Star, Clock, AlertTriangle, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, isToday, isThisYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Email } from '@/pages/admin/Emails';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 50;

interface EmailListProps {
  folder: 'inbox' | 'sent' | 'drafts' | 'spam' | 'starred' | 'archived' | 'trash' | 'scheduled' | 'automated';
  onSelectEmail: (email: Email) => void;
  accountId?: string | null;
  accountEmail?: string;
  /** Search coming from the module top bar; when set the internal field is hidden. */
  externalSearch?: string;
  selectedEmailId?: string | null;
}

function mapRow(e: any): Email {
  return {
    id: e.id,
    from_email: e.from_email,
    from_name: e.from_name,
    to_email: e.to_email,
    subject: e.subject || '(Sem assunto)',
    body_text: e.body_text,
    body_html: e.body_html,
    is_read: e.is_read || false,
    is_starred: e.is_starred || false,
    is_archived: e.is_archived || false,
    received_at: e.received_at,
    folder: e.folder,
    snippet: e.snippet || undefined,
    has_attachments: e.has_attachments || false,
    attachments: e.attachments || [],
    body_fetched_at: e.body_fetched_at || undefined,
    message_id: e.message_id || undefined,
  };
}

function formatListDate(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  if (isToday(d)) return format(d, 'HH:mm', { locale: ptBR });
  if (isThisYear(d)) return format(d, 'dd MMM', { locale: ptBR });
  return format(d, 'dd/MM/yy', { locale: ptBR });
}

export function EmailList({
  folder, onSelectEmail, accountId, accountEmail, externalSearch, selectedEmailId,
}: EmailListProps) {
  const [internalSearch, setInternalSearch] = useState('');
  const search = (externalSearch ?? internalSearch).trim();
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState<'all' | 'unread' | 'attachments'>('all');
  const queryClient = useQueryClient();

  useEffect(() => { setPage(0); }, [folder, accountId, search, tab]);

  const buildQuery = (countOnly: boolean) => {
    let q = supabase
      .from('email_inbox')
      .select(countOnly ? 'id' : '*', countOnly ? { count: 'exact', head: true } : undefined)
      .eq('account_id', accountId!);

    if (folder === 'starred') q = q.eq('is_starred', true).eq('is_archived', false);
    else if (folder === 'archived') q = q.eq('is_archived', true);
    else q = q.eq('folder', folder).eq('is_archived', false);

    if (tab === 'unread') q = q.eq('is_read', false);
    if (tab === 'attachments') q = q.eq('has_attachments', true);

    if (search) {
      const term = `%${search.replace(/[%_]/g, '')}%`;
      q = q.or(`subject.ilike.${term},from_email.ilike.${term},from_name.ilike.${term},to_email.ilike.${term},snippet.ilike.${term}`);
    }
    return q;
  };

  const { data: emails, isLoading, isError, isFetching } = useQuery({
    queryKey: ['emails', folder, accountId, accountEmail, search, page, tab],
    queryFn: async () => {
      if (!accountId) return [] as Email[];
      if (folder === 'scheduled' || folder === 'automated') return [] as Email[];

      const from = page * PAGE_SIZE;
      const { data, error } = await buildQuery(false)
        .order('received_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const mapped = (data || []).map(mapRow);

      // Sent folder also merges app-sent messages from email_logs (first page only).
      if (folder === 'sent' && accountEmail && page === 0) {
        const { data: logEmails } = await supabase
          .from('email_logs')
          .select('*')
          .eq('status', 'sent')
          .eq('from_email', accountEmail)
          .order('sent_at', { ascending: false })
          .limit(PAGE_SIZE);
        const ids = new Set(mapped.map((e) => e.id));
        const mappedLogs = (logEmails || []).filter((e) => !ids.has(e.id)).map((e: any) => ({
          id: e.id,
          from_email: e.from_email,
          to_email: e.to_email,
          subject: e.subject || '(Sem assunto)',
          body_text: e.body,
          body_html: e.html_body,
          is_read: true,
          is_starred: false,
          sent_at: e.sent_at,
          received_at: e.sent_at,
        })) as Email[];
        return [...mapped, ...mappedLogs].sort((a, b) =>
          new Date(b.received_at || b.sent_at || 0).getTime() - new Date(a.received_at || a.sent_at || 0).getTime());
      }
      return mapped;
    },
    enabled: !!accountId,
    refetchInterval: 30000,
    placeholderData: (prev) => prev,
  });

  // Counters come from the database, never from the loaded page.
  const { data: counts } = useQuery({
    queryKey: ['email-counts', folder, accountId, search, tab],
    queryFn: async () => {
      if (!accountId) return { folder: 0, filtered: 0, unread: 0 };
      const [{ count: filtered }, { count: total }, { count: unread }] = await Promise.all([
        buildQuery(true),
        supabase.from('email_inbox').select('id', { count: 'exact', head: true })
          .eq('account_id', accountId)
          .eq(folder === 'archived' ? 'is_archived' : 'folder', folder === 'archived' ? true : folder === 'starred' ? 'inbox' : folder),
        supabase.from('email_inbox').select('id', { count: 'exact', head: true })
          .eq('account_id', accountId).eq('is_read', false).eq('is_archived', false)
          .eq('folder', folder === 'starred' || folder === 'archived' ? 'inbox' : folder),
      ]);
      return { folder: total || 0, filtered: filtered || 0, unread: unread || 0 };
    },
    enabled: !!accountId,
    refetchInterval: 30000,
  });

  // Realtime: keep list and counters fresh without a full page reload.
  useEffect(() => {
    if (!accountId) return;
    const channel = supabase
      .channel(`email-inbox-${accountId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'email_inbox', filter: `account_id=eq.${accountId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['emails'] });
          queryClient.invalidateQueries({ queryKey: ['email-counts'] });
          queryClient.invalidateQueries({ queryKey: ['email-stats'] });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [accountId, queryClient]);

  const list = useMemo(() => (emails || []).slice(), [emails]);

  const folderLabels: Record<string, string> = {
    inbox: 'Caixa de Entrada', sent: 'Enviados', drafts: 'Rascunhos', spam: 'Spam',
    starred: 'Favoritos', archived: 'Arquivados', trash: 'Lixeira',
    scheduled: 'Programados', automated: 'Automáticos',
  };
  const title = folderLabels[folder] || 'Emails';

  if (!accountId) {
    return (
      <Card className="h-full flex flex-col border-0 md:border shadow-none md:shadow-sm">
        <CardContent className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <Mail className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">Selecione uma conta</p>
          <p className="text-sm">Escolha uma conta de email no painel lateral</p>
        </CardContent>
      </Card>
    );
  }

  const tabs: { id: typeof tab; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'unread', label: 'Não lidos' },
    { id: 'attachments', label: 'Com anexo' },
  ];

  return (
    <Card className="h-full flex flex-col border-0 md:border shadow-none md:shadow-sm">
      <CardHeader className="pb-2 flex-shrink-0 px-3 md:px-4 pt-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm md:text-base">
            <Mail className="h-4 w-4" aria-hidden />
            {title}
          </CardTitle>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {search ? (
              <Badge variant="secondary" className="text-[10px]">{counts?.filtered ?? 0} no filtro</Badge>
            ) : (
              <>
                <Badge variant="secondary" className="text-[10px]">{counts?.folder ?? 0}</Badge>
                {(counts?.unread ?? 0) > 0 && (
                  <Badge className="text-[10px]">{counts?.unread} não lidos</Badge>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-1 rounded-lg bg-muted/60 p-0.5" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                tab === t.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {externalSearch === undefined && (
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              placeholder="Buscar emails..."
              value={internalSearch}
              onChange={(e) => setInternalSearch(e.target.value)}
              className="pl-9 h-9"
              aria-label="Buscar emails"
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground px-6 text-center">
              <AlertTriangle className="h-10 w-10 mb-3 text-destructive/70" aria-hidden />
              <p className="text-base font-medium text-foreground">Não foi possível carregar as mensagens</p>
              <p className="text-sm">Verifique sua conexão e tente novamente.</p>
              <Button variant="outline" size="sm" className="mt-3"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['emails'] })}>
                Tentar novamente
              </Button>
            </div>
          ) : list.length > 0 ? (
            <>
              <div className="divide-y divide-border/60">
                {list.map((email) => {
                  const who = folder === 'sent' ? email.to_email : (email.from_name || email.from_email);
                  const initial = (who || '?').trim().charAt(0).toUpperCase();
                  const isSelected = selectedEmailId === email.id;
                  return (
                    <button
                      key={email.id}
                      onClick={() => onSelectEmail(email)}
                      aria-current={isSelected ? 'true' : undefined}
                      className={cn(
                        'relative w-full text-left px-3 py-3 transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                        isSelected && 'bg-primary/10',
                      )}
                    >
                      {!email.is_read && (
                        <span className="absolute left-0 top-0 h-full w-[3px] bg-primary" aria-hidden />
                      )}
                      <div className="flex items-start gap-2.5">
                        <div className={cn(
                          'mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                          email.is_read ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary',
                        )} aria-hidden>
                          {initial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={cn('truncate text-sm', !email.is_read && 'font-semibold')}>{who}</p>
                            <span className="flex-shrink-0 text-[11px] text-muted-foreground">
                              {formatListDate(email.received_at || email.sent_at)}
                            </span>
                          </div>
                          <p className={cn('truncate text-sm', !email.is_read ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                            {email.subject}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                            {email.is_starred && <Star className="h-3 w-3 flex-shrink-0 fill-accent text-accent" aria-label="Favorito" />}
                            {email.has_attachments && <Paperclip className="h-3 w-3 flex-shrink-0" aria-label="Com anexo" />}
                            {email.snippet?.slice(0, 120)
                              || email.body_text?.slice(0, 120)
                              || (email.body_fetched_at ? '(Mensagem sem texto)' : 'Conteúdo ainda não carregado')}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {(counts?.filtered ?? 0) > (page + 1) * PAGE_SIZE && (
                <div className="p-3 flex justify-center">
                  <Button variant="outline" size="sm" disabled={isFetching} onClick={() => setPage((p) => p + 1)}>
                    {isFetching ? 'Carregando…' : 'Carregar mais'}
                  </Button>
                </div>
              )}
              {page > 0 && (
                <div className="pb-3 text-center text-[11px] text-muted-foreground">
                  Página {page + 1} · {(counts?.filtered ?? 0)} mensagens no total
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground px-6 text-center">
              <Inbox className="h-12 w-12 mb-4 opacity-50" aria-hidden />
              <p className="text-lg font-medium">
                {search ? 'Nenhum resultado para esta busca' : 'Nenhum email nesta pasta'}
              </p>
              <p className="text-sm">
                {search
                  ? 'Ajuste os termos da busca ou limpe o filtro.'
                  : folder === 'inbox' ? 'Sua caixa de entrada está vazia.'
                  : folder === 'sent' ? 'Você ainda não enviou nenhum email.'
                  : folder === 'starred' ? 'Nenhum email favorito.'
                  : folder === 'archived' ? 'Nenhum email arquivado.'
                  : folder === 'trash' ? 'A lixeira está vazia.'
                  : folder === 'scheduled' ? 'Nenhum email programado.'
                  : folder === 'automated' ? 'Nenhum email automático.'
                  : 'Nenhum rascunho salvo.'}
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
