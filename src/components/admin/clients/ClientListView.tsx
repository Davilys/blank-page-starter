import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Mail, Phone, Users, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ClientWithProcess } from './ClientKanbanBoard';

const PIPELINE_STAGES: Record<string, { label: string; color: string; bg: string }> = {
  protocolado:    { label: 'Protocolado',    color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20' },
  '003':          { label: '003',            color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
  oposicao:       { label: 'Oposição',       color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/20' },
  indeferimento:  { label: 'Indeferimento',  color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
  notificacao:    { label: 'Notif. Extrajud.',color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
  deferimento:    { label: 'Deferimento',    color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  certificados:   { label: 'Certificados',   color: 'text-teal-400',    bg: 'bg-teal-500/10 border-teal-500/20' },
  renovacao:      { label: 'Renovação',      color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-500/20' },
  distrato:       { label: 'Distrato',       color: 'text-muted-foreground', bg: 'bg-muted/40 border-border' },
  // comercial stages
  assinou_contrato: { label: 'Assinou Contrato', color: 'text-primary',      bg: 'bg-primary/10 border-primary/20' },
  pagamento_pendente: { label: 'Pgto Pendente', color: 'text-amber-400',    bg: 'bg-amber-500/10 border-amber-500/20' },
  taxa_paga:        { label: 'Taxa Paga',        color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  high:   { label: 'Alta',  color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',    dot: 'bg-red-400' },
  medium: { label: 'Média', color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400 animate-pulse' },
  low:    { label: 'Baixa', color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/20',dot: 'bg-emerald-400' },
};

interface ClientListViewProps {
  clients: ClientWithProcess[];
  loading: boolean;
  onClientClick: (client: ClientWithProcess) => void;
}

export function ClientListView({ clients, loading, onClientClick }: ClientListViewProps) {
  const getStageBadge = (stage: string | null) => {
    const key = stage || 'protocolado';
    const cfg = PIPELINE_STAGES[key] || PIPELINE_STAGES.protocolado;
    return (
      <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border', cfg.bg, cfg.color)}>
        {cfg.label}
      </span>
    );
  };

  const getPriorityBadge = (priority: string | null) => {
    const key = priority || 'medium';
    const cfg = PRIORITY_CONFIG[key] || PRIORITY_CONFIG.medium;
    return (
      <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border', cfg.bg, cfg.color)}>
        <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', cfg.dot)} />
        {cfg.label}
      </span>
    );
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  };

  const avatarColors = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-amber-600',
    'from-pink-500 to-rose-600',
  ];

  const getAvatarColor = (name: string | null) => {
    const n = name || '';
    return avatarColors[n.charCodeAt(0) % avatarColors.length];
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 overflow-hidden bg-background/80">
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando clientes...</p>
        </div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 overflow-hidden bg-background/80">
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Users className="h-12 w-12 text-muted-foreground/20" />
          <p className="text-muted-foreground">Nenhum cliente encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 overflow-hidden bg-background/80 backdrop-blur-sm">
      <Table>
        <TableHeader>
          <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
            {['Cliente', 'Marca / Empresa', 'Etapa', 'Valor', 'Prioridade', 'Cadastro', ''].map((h) => (
              <TableHead key={h} className={cn(
                'text-xs uppercase tracking-wider text-muted-foreground font-semibold',
                h === '' ? 'w-12' : '',
                h === 'Valor' || h === 'Prioridade' ? 'hidden md:table-cell' : '',
                h === 'Cadastro' ? 'hidden lg:table-cell' : '',
              )}>
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          <AnimatePresence>
            {clients.map((client, idx) => (
              <motion.tr
                key={client.id + (client.process_id || '')}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.018, duration: 0.25 }}
                onClick={() => onClientClick(client)}
                className="border-border/40 hover:bg-muted/30 cursor-pointer group transition-colors"
              >
                {/* Cliente */}
                <TableCell className="py-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'h-9 w-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 bg-gradient-to-br shadow-sm',
                      getAvatarColor(client.full_name)
                    )}>
                      {getInitials(client.full_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate max-w-[160px]">
                        {client.full_name || 'Sem nome'}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Mail className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
                        <span className="text-xs text-muted-foreground truncate max-w-[140px]">{client.email}</span>
                      </div>
                      {client.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
                          <span className="text-xs text-muted-foreground">{client.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>

                {/* Marca / Empresa */}
                <TableCell className="py-3">
                  {client.brand_name ? (
                    <div>
                      <p className="font-medium text-sm">{client.brand_name}</p>
                      {client.company_name && (
                        <p className="text-xs text-muted-foreground truncate max-w-[130px]">{client.company_name}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground/50 text-sm">—</span>
                  )}
                </TableCell>

                {/* Etapa */}
                <TableCell className="py-3">
                  {getStageBadge(client.pipeline_stage)}
                </TableCell>

                {/* Valor */}
                <TableCell className="hidden md:table-cell py-3">
                  {client.contract_value ? (
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="font-semibold text-sm text-emerald-500">
                        R$ {Number(client.contract_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground/50 text-sm">—</span>
                  )}
                </TableCell>

                {/* Prioridade */}
                <TableCell className="hidden md:table-cell py-3">
                  {getPriorityBadge(client.priority)}
                </TableCell>

                {/* Cadastro */}
                <TableCell className="hidden lg:table-cell py-3">
                  {client.created_at ? (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(client.created_at), "dd/MM/yy", { locale: ptBR })}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50 text-sm">—</span>
                  )}
                </TableCell>

                {/* Ações */}
                <TableCell className="py-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); onClientClick(client); }}
                  >
                    <Eye className="h-4 w-4 text-primary" />
                  </Button>
                </TableCell>
              </motion.tr>
            ))}
          </AnimatePresence>
        </TableBody>
      </Table>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border/60 bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
        <span>{clients.length} cliente{clients.length !== 1 ? 's' : ''} exibido{clients.length !== 1 ? 's' : ''}</span>
        <span>Clique em uma linha para ver detalhes</span>
      </div>
    </div>
  );
}
