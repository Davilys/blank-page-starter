import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EmailSidebar } from '@/components/admin/email/EmailSidebar';
import { EmailList } from '@/components/admin/email/EmailList';
import { EmailView } from '@/components/admin/email/EmailView';
import { EmailCompose } from '@/components/admin/email/EmailCompose';
import { EmailTemplates } from '@/components/admin/email/EmailTemplates';
import { EmailSettings } from '@/components/admin/email/EmailSettings';
import { EmailAutomations } from '@/components/admin/email/EmailAutomations';
import { EmailCampaigns } from '@/components/admin/email/EmailCampaigns';
import { EmailSequences } from '@/components/admin/email/EmailSequences';
import { EmailMetricsBar } from '@/components/admin/email/EmailMetricsBar';
import { EmailSyncBar } from '@/components/admin/email/EmailSyncBar';
import { useEmailSync } from '@/hooks/useEmailSync';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { motion, AnimatePresence } from 'framer-motion';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Mail, Zap, BarChart3, TrendingUp, Send, Inbox, Menu, PenSquare
} from 'lucide-react';

export type EmailFolder =
  | 'inbox' | 'sent' | 'drafts' | 'spam' | 'templates' | 'settings'
  | 'scheduled' | 'automated' | 'starred' | 'archived' | 'trash'
  | 'campaigns' | 'sequences' | 'automations'
  | 'filter-clients' | 'filter-leads' | 'filter-legal' | 'filter-financial' | 'filter-support';

export interface Email {
  id: string;
  from_email: string;
  from_name?: string;
  to_email: string;
  subject: string;
  body_text?: string;
  body_html?: string;
  is_read: boolean;
  is_starred: boolean;
  is_archived?: boolean;
  received_at?: string;
  sent_at?: string;
  folder?: string;
  snippet?: string;
  has_attachments?: boolean;
  attachments?: Array<{ filename: string; content_type: string; size: number }>;
  body_fetched_at?: string;
  message_id?: string;
}

export interface EmailAccount {
  id: string;
  email_address: string;
  display_name: string | null;
  assigned_to: string | null;
}

export default function Emails() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentFolder, setCurrentFolder] = useState<EmailFolder>('inbox');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [replyTo, setReplyTo] = useState<Email | null>(null);
  const [initialTo, setInitialTo] = useState('');
  const [initialName, setInitialName] = useState('');
  const [aiDraftBody, setAiDraftBody] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const isMobile = useIsMobile();
  const { isMasterAdmin, userId, hasPermission } = useAdminPermissions();
  const canSeeAllEmails = isMasterAdmin || hasPermission('emails', 'can_view');

  // Fetch email accounts for current user
  const { data: emailAccounts = [] } = useQuery({
    queryKey: ['email-accounts-list', userId, canSeeAllEmails],
    queryFn: async () => {
      if (!userId) return [];
      let query = supabase.from('email_accounts').select('id, email_address, display_name, assigned_to');
      // Master admin OR admins with 'emails' permission see all accounts.
      // Others see only accounts assigned to them.
      if (!canSeeAllEmails) {
        query = query.eq('assigned_to', userId);
      }
      const { data, error } = await query.order('email_address');
      if (error) throw error;
      return (data || []) as EmailAccount[];
    },
    enabled: !!userId,
  });

  // Auto-select first account when accounts load
  useEffect(() => {
    if (emailAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(emailAccounts[0].id);
    }
  }, [emailAccounts, selectedAccountId]);

  // Get selected account email for filtering sent emails
  const selectedAccount = emailAccounts.find(a => a.id === selectedAccountId);

  // Real, per-account sync state + run history
  const { byAccount: syncByAccount, runs: syncRuns, syncNow } = useEmailSync(
    emailAccounts.map(a => a.id),
    selectedAccountId,
  );

  // Read URL params to auto-open compose with client data
  useEffect(() => {
    const compose = searchParams.get('compose');
    const to = searchParams.get('to');
    const name = searchParams.get('name');
    if (compose === 'true') {
      setIsComposing(true);
      setSelectedEmail(null);
      setReplyTo(null);
      if (to) setInitialTo(decodeURIComponent(to));
      if (name) setInitialName(decodeURIComponent(name));
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Stats query filtered by selected account
  const { data: stats } = useQuery({
    queryKey: ['email-stats', selectedAccountId, selectedAccount?.email_address],
    queryFn: async () => {
      if (!selectedAccountId) {
        return { inbox: 0, sent: 0, unread: 0, drafts: 0, scheduled: 0, automated: 0 };
      }
      const [inboxRes, sentRes, unreadRes] = await Promise.all([
        supabase.from('email_inbox').select('id', { count: 'exact', head: true })
          .eq('is_archived', false).eq('account_id', selectedAccountId),
        supabase.from('email_logs').select('id', { count: 'exact', head: true })
          .eq('status', 'sent').eq('from_email', selectedAccount?.email_address || ''),
        supabase.from('email_inbox').select('id', { count: 'exact', head: true })
          .eq('is_read', false).eq('is_archived', false).eq('account_id', selectedAccountId),
      ]);
      return {
        inbox: inboxRes.count || 0,
        sent: sentRes.count || 0,
        unread: unreadRes.count || 0,
        drafts: 0,
        scheduled: 0,
        automated: 0,
      };
    },
    enabled: !!selectedAccountId,
    refetchInterval: 30000,
  });

  // Unread count per account (for sidebar badges)
  const { data: unreadByAccount } = useQuery({
    queryKey: ['email-unread-by-account', emailAccounts.map(a => a.id).join(',')],
    queryFn: async () => {
      const map: Record<string, number> = {};
      await Promise.all(emailAccounts.map(async (a) => {
        const { count } = await supabase
          .from('email_inbox')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', a.id)
          .eq('is_read', false)
          .eq('is_archived', false)
          .eq('folder', 'inbox');
        map[a.id] = count || 0;
      }));
      return map;
    },
    enabled: emailAccounts.length > 0,
    refetchInterval: 30000,
  });

  const handleFolderChange = (folder: EmailFolder) => {
    setSelectedEmail(null);
    setIsComposing(false);
    setReplyTo(null);
    setCurrentFolder(folder);
    setSidebarOpen(false);
  };

  const handleAccountChange = (accountId: string) => {
    setSelectedAccountId(accountId);
    setSelectedEmail(null);
    setIsComposing(false);
    setReplyTo(null);
    // Conta noreply só envia (não recebe) — abrir direto a pasta Enviados
    const acc = emailAccounts.find(a => a.id === accountId);
    if (acc?.email_address?.toLowerCase().startsWith('noreply@')) {
      setCurrentFolder('sent');
    }
  };

  const handleCompose = () => {
    setIsComposing(true);
    setSelectedEmail(null);
    setReplyTo(null);
    setSidebarOpen(false);
  };

  const handleReply = (email: Email) => {
    setReplyTo(email);
    setIsComposing(true);
  };

  const handleCloseCompose = () => {
    setIsComposing(false);
    setReplyTo(null);
    setAiDraftBody('');
  };

  const handleSelectEmail = (email: Email) => {
    setSelectedEmail(email);
    setIsComposing(false);
  };

  const handleBack = () => {
    setSelectedEmail(null);
  };

  const handleAiDraft = (text: string, email: Email) => {
    setAiDraftBody(text);
    setReplyTo(email);
    setInitialTo(email.from_email);
    setInitialName(email.from_name || '');
    setIsComposing(true);
    setSelectedEmail(null);
  };

  const isToolScreen = ['templates', 'settings', 'automations', 'campaigns', 'sequences'].includes(currentFolder);

  const renderToolScreen = () => {
    if (currentFolder === 'templates') return <EmailTemplates />;
    if (currentFolder === 'settings') return <EmailSettings />;
    if (currentFolder === 'automations') return <EmailAutomations />;
    if (currentFolder === 'campaigns') return <EmailCampaigns onCompose={handleCompose} />;
    if (currentFolder === 'sequences') return <EmailSequences />;
    return null;
  };

  const listFolder = currentFolder.startsWith('filter-') ? 'inbox' : currentFolder;
  const validListFolders = ['inbox', 'sent', 'drafts', 'spam', 'starred', 'archived', 'trash', 'scheduled', 'automated'] as const;
  type ValidFolder = typeof validListFolders[number];
  const folderToShow: ValidFolder = validListFolders.includes(listFolder as ValidFolder) ? listFolder as ValidFolder : 'inbox';

  const listPane = (
    <EmailList
      folder={folderToShow}
      onSelectEmail={handleSelectEmail}
      accountId={selectedAccountId}
      accountEmail={selectedAccount?.email_address}
      externalSearch={search}
      selectedEmailId={selectedEmail?.id || null}
    />
  );

  const composePane = (
    <EmailCompose
      onClose={handleCloseCompose}
      replyTo={replyTo}
      initialTo={initialTo}
      initialName={initialName}
      initialBody={aiDraftBody || undefined}
      accountId={selectedAccountId}
      accountEmail={selectedAccount?.email_address}
    />
  );

  const handleForwardEmail = (email: Email) => {
    setIsComposing(true);
    setSelectedEmail(null);
    setReplyTo(null);
    setInitialTo('');
    setInitialName('');
    setAiDraftBody(`\n\n--- Encaminhado ---\nDe: ${email.from_name || email.from_email}\nAssunto: ${email.subject}\n\n${email.body_text || ''}`);
  };

  const readingPane = (docked: boolean) => selectedEmail ? (
    <EmailView
      email={selectedEmail}
      onBack={handleBack}
      onReply={() => handleReply(selectedEmail)}
      onForward={handleForwardEmail}
      onUseDraftFromAI={(text) => handleAiDraft(text, selectedEmail)}
      aiDocked={docked}
      aiOpen={aiOpen}
      onToggleAI={() => setAiOpen((v) => !v)}
      hideBack={docked}
    />
  ) : (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <Inbox className="h-10 w-10 opacity-40" aria-hidden />
      <p className="text-sm font-medium text-foreground">Nenhuma mensagem aberta</p>
      <p className="text-xs">Selecione uma mensagem na lista ao lado para ler aqui.</p>
    </div>
  );

  const showSyncBar = !isToolScreen;

  const getFolderLabel = () => {
    const map: Record<string, string> = {
      inbox: 'Caixa de Entrada', sent: 'Enviados', drafts: 'Rascunhos', spam: 'Spam',
      templates: 'Templates', settings: 'Configurações', scheduled: 'Programados',
      automated: 'Automáticos', starred: 'Favoritos', archived: 'Arquivados',
      trash: 'Lixeira', campaigns: 'Campanhas', sequences: 'Sequências',
      automations: 'Automações', 'filter-clients': 'Clientes', 'filter-leads': 'Leads',
      'filter-legal': 'Jurídico', 'filter-financial': 'Financeiro', 'filter-support': 'Suporte',
    };
    return map[currentFolder] || 'Email';
  };

  const sidebarContent = (
    <EmailSidebar
      currentFolder={currentFolder}
      onFolderChange={handleFolderChange}
      onCompose={handleCompose}
      isMasterAdmin={isMasterAdmin}
      stats={stats}
      emailAccounts={emailAccounts}
      selectedAccountId={selectedAccountId}
      onAccountChange={handleAccountChange}
      unreadByAccount={unreadByAccount}
      syncByAccount={syncByAccount}
    />
  );

  const mainArea = () => {
    if (isToolScreen) {
      return <div className="h-full overflow-hidden p-2 md:p-4">{renderToolScreen()}</div>;
    }
    if (isComposing) {
      return <div className="h-full overflow-hidden p-2 md:p-4">{composePane}</div>;
    }
    // Mobile: one pane at a time.
    if (isMobile) {
      return (
        <div className="h-full overflow-hidden p-2">
          {selectedEmail ? readingPane(false) : listPane}
        </div>
      );
    }
    // Desktop: list + reading pane (+ docked AI column).
    return (
      <div className="flex h-full min-w-0 overflow-hidden">
        <div className="w-[320px] xl:w-[360px] flex-shrink-0 border-r border-border/50 bg-card overflow-hidden">
          {listPane}
        </div>
        <div className="flex-1 min-w-0 overflow-hidden bg-card">
          {readingPane(true)}
        </div>
        {selectedEmail && aiOpen && (
          <div className="hidden xl:block w-[320px] flex-shrink-0 border-l border-border/50 bg-card overflow-hidden">
            <AIEmailAssistant
              email={selectedEmail}
              onUseDraft={(text) => handleAiDraft(text, selectedEmail)}
              onClose={() => setAiOpen(false)}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-col h-[calc(100vh-4rem)] gap-0 -mx-4 -mt-4">
        {/* Compact top bar */}
        <div className="flex-shrink-0 border-b border-border/50 bg-card px-3 md:px-4 py-2">
          <div className="flex items-center gap-2">
            {isMobile && (
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0 md:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-4 pt-8">
                  {sidebarContent}
                </SheetContent>
              </Sheet>
            )}
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <Mail className="h-4 w-4 text-primary-foreground" aria-hidden />
              </div>
              <div className="min-w-0 hidden sm:block">
                <h1 className="text-sm font-semibold leading-tight truncate">Central de Email</h1>
                <p className="text-[11px] text-muted-foreground truncate">
                  {selectedAccount ? selectedAccount.email_address : getFolderLabel()}
                </p>
              </div>
            </div>

            {showSyncBar ? (
              <div className="flex-1 min-w-0">
                <EmailSyncBar
                  accountEmail={selectedAccount?.email_address}
                  info={selectedAccountId ? syncByAccount[selectedAccountId] : undefined}
                  runs={syncRuns}
                  onSyncNow={() => selectedAccountId && syncNow(selectedAccountId)}
                  onCompose={handleCompose}
                  search={search}
                  onSearchChange={setSearch}
                />
              </div>
            ) : (
              <div className="flex-1" />
            )}

            {isMobile && (
              <Button onClick={handleCompose} size="icon" className="h-9 w-9 flex-shrink-0 md:hidden">
                <PenSquare className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Main Layout */}
        <div className="flex flex-1 overflow-hidden">
          {!isMobile && (
            <div className="w-56 xl:w-60 flex-shrink-0 border-r border-border/50 bg-background/50 overflow-y-auto p-3">
              {sidebarContent}
            </div>
          )}
          <div className="flex-1 min-w-0 overflow-hidden bg-muted/20">
            {mainArea()}
          </div>
        </div>
      </div>
    </>
  );
}
