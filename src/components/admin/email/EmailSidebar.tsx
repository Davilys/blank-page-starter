import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Inbox, Send, FileText, Layout, Settings, PenSquare, Clock,
  Star, Archive, Trash2, Zap, BarChart3, Users, Briefcase,
  Scale, DollarSign, HeadphonesIcon, ChevronDown, ChevronRight,
  Mail, Filter, Layers, AtSign
} from 'lucide-react';
import { useState } from 'react';
import type { EmailFolder, EmailAccount } from '@/pages/admin/Emails';

interface EmailSidebarProps {
  currentFolder: EmailFolder;
  onFolderChange: (folder: EmailFolder) => void;
  onCompose: () => void;
  isMasterAdmin?: boolean;
  stats?: {
    inbox: number;
    unread: number;
    sent: number;
    drafts: number;
    scheduled: number;
    automated: number;
  };
  emailAccounts?: EmailAccount[];
  selectedAccountId?: string | null;
  onAccountChange?: (accountId: string) => void;
}

const mainFolders: { id: EmailFolder; label: string; icon: React.ComponentType<{ className?: string }>; badge?: keyof EmailSidebarProps['stats'] }[] = [
  { id: 'inbox', label: 'Caixa de Entrada', icon: Inbox, badge: 'unread' },
  { id: 'sent', label: 'Enviados', icon: Send, badge: 'sent' },
  { id: 'drafts', label: 'Rascunhos', icon: FileText, badge: 'drafts' },
  { id: 'scheduled', label: 'Programados', icon: Clock, badge: 'scheduled' },
  { id: 'automated', label: 'Automáticos', icon: Zap, badge: 'automated' },
  { id: 'starred', label: 'Favoritos', icon: Star },
  { id: 'archived', label: 'Arquivados', icon: Archive },
  { id: 'trash', label: 'Lixeira', icon: Trash2 },
];

const toolFolders: { id: EmailFolder; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'templates', label: 'Templates', icon: Layout },
  { id: 'campaigns', label: 'Campanhas', icon: BarChart3 },
  { id: 'sequences', label: 'Sequências', icon: Layers },
  { id: 'automations', label: 'Automações', icon: Zap },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

const quickFilters: { id: EmailFolder; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { id: 'filter-clients', label: 'Clientes', icon: Users, color: 'text-blue-500' },
  { id: 'filter-leads', label: 'Leads', icon: Briefcase, color: 'text-emerald-500' },
  { id: 'filter-legal', label: 'Jurídico', icon: Scale, color: 'text-purple-500' },
  { id: 'filter-financial', label: 'Financeiro', icon: DollarSign, color: 'text-amber-500' },
  { id: 'filter-support', label: 'Suporte', icon: HeadphonesIcon, color: 'text-rose-500' },
];

export function EmailSidebar({ currentFolder, onFolderChange, onCompose, stats, isMasterAdmin = false, emailAccounts, selectedAccountId, onAccountChange }: EmailSidebarProps) {
  const [showFilters, setShowFilters] = useState(true);
  const [showTools, setShowTools] = useState(true);
  const [showAccounts, setShowAccounts] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-60 flex-shrink-0 flex flex-col gap-3 h-full"
    >
      {/* Compose Button */}
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Button
          onClick={onCompose}
          className="w-full gap-2 h-11 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20 font-semibold"
          size="lg"
        >
          <PenSquare className="h-5 w-5" />
          Novo Email
        </Button>
      </motion.div>

      {/* Email Accounts Section */}
      {emailAccounts && emailAccounts.length > 0 && (
        <div className="space-y-0.5">
          <button
            onClick={() => setShowAccounts(!showAccounts)}
            className="w-full flex items-center gap-1 px-3 pb-1 group"
          >
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex-1 text-left">
              <AtSign className="inline h-2.5 w-2.5 mr-1" />
              Contas de Email
            </p>
            {showAccounts ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </button>
          {showAccounts && emailAccounts.map((account, i) => {
            const isActive = selectedAccountId === account.id;
            return (
              <motion.button
                key={account.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                type="button"
                onClick={() => onAccountChange?.(account.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer group',
                  isActive
                    ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <div className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}>
                  {(account.display_name || account.email_address).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 text-left min-w-0">
                  {account.display_name && (
                    <p className={cn('text-xs font-medium truncate', isActive && 'text-primary')}>
                      {account.display_name}
                    </p>
                  )}
                  <p className={cn('text-[10px] truncate', account.display_name ? 'text-muted-foreground' : 'text-xs font-medium')}>
                    {account.email_address}
                  </p>
                </div>
                {isActive && (
                  <div className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Quick Stats Pills */}
      {stats && (
        <div className="grid grid-cols-2 gap-1.5">
          <div className="bg-primary/10 rounded-lg p-2 text-center">
            <p className="text-xs font-bold text-primary">{stats.unread || 0}</p>
            <p className="text-[10px] text-muted-foreground">Não lidos</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <p className="text-xs font-bold text-foreground">{stats.sent || 0}</p>
            <p className="text-[10px] text-muted-foreground">Enviados</p>
          </div>
        </div>
      )}

      {/* Main Folders */}
      <nav className="space-y-0.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 pb-1">Pastas</p>
        {mainFolders.map((folder, i) => {
          const Icon = folder.icon;
          const isActive = currentFolder === folder.id;
          const badgeCount = folder.badge && stats ? stats[folder.badge] : 0;
          return (
            <motion.button
              key={folder.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              type="button"
              onClick={() => onFolderChange(folder.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer select-none group',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground')} />
              <span className="flex-1 text-left truncate">{folder.label}</span>
              {badgeCount > 0 && (
                <Badge
                  variant={isActive ? 'secondary' : 'default'}
                  className={cn('text-[10px] h-4 min-w-4 px-1 py-0', isActive && 'bg-primary-foreground/20 text-primary-foreground')}
                >
                  {badgeCount}
                </Badge>
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Quick Filters */}
      <div className="space-y-0.5">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center gap-1 px-3 pb-1 group"
        >
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex-1 text-left">
            <Filter className="inline h-2.5 w-2.5 mr-1" />
            Filtros
          </p>
          {showFilters ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </button>
        {showFilters && quickFilters.map((filter, i) => {
          const Icon = filter.icon;
          const isActive = currentFolder === filter.id;
          return (
            <motion.button
              key={filter.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04 }}
              type="button"
              onClick={() => onFolderChange(filter.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-all cursor-pointer',
                isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', filter.color)} />
              <span className="text-xs">{filter.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Tools - Only visible for master admin */}
      {isMasterAdmin && (
        <div className="space-y-0.5 flex-1">
          <button
            onClick={() => setShowTools(!showTools)}
            className="w-full flex items-center gap-1 px-3 pb-1 group"
          >
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex-1 text-left">Ferramentas</p>
            {showTools ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </button>
          {showTools && toolFolders.map((folder, i) => {
            const Icon = folder.icon;
            const isActive = currentFolder === folder.id;
            return (
              <motion.button
                key={folder.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                type="button"
                onClick={() => onFolderChange(folder.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 text-left">{folder.label}</span>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Footer hint */}
      <div className="px-3 py-2 rounded-lg bg-muted/40 border border-border/50">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <p className="text-[10px] text-muted-foreground">Sistema de email ativo</p>
        </div>
      </div>
    </motion.div>
  );
}
