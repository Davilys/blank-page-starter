import { useMemo, useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { differenceInDays, parseISO, addDays, addYears, format } from 'date-fns';
import { Clock, AlertTriangle, User, Flame, GripVertical, Calendar } from 'lucide-react';
import { PIPELINE_STAGES } from '@/components/admin/clients/ClientKanbanBoard';
import { useJuridicoStages } from '@/hooks/useJuridicoStages';

// Tipo do status: agora aceita qualquer slug (etapas customizadas do Kanban Jurídico).
type PubStatus = string;

// Ícones (emoji) padrão por slug conhecido — etapas customizadas usam o ícone genérico.
const PUB_STAGE_ICONS: Record<string, string> = {
  protocolado: '📥',
  '003': '📋',
  oposicao: '⚔️',
  exigencia_merito: '📝',
  indeferimento: '❌',
  notificacao: '🔔',
  deferimento: '✅',
  certificado: '🎓',
  certificados: '🎓',
  renovacao: '🔄',
  arquivado: '📦',
  distrato: '🚪',
};
const DEFAULT_ICON = '🏷️';

interface Publicacao {
  id: string;
  process_id: string | null;
  client_id: string | null;
  admin_id: string | null;
  status: PubStatus;
  proximo_prazo_critico: string | null;
  data_publicacao_rpi: string | null;
  brand_name_rpi?: string | null;
  process_number_rpi?: string | null;
  ncl_class?: string | null;
}

interface Props {
  publicacoes: Publicacao[];
  processMap: Map<string, any>;
  clientMap: Map<string, any>;
  adminMap: Map<string, any>;
  onSelect: (id: string) => void;
  selectedId: string | null;
  onStatusChange: (id: string, newStatus: PubStatus, pub: Publicacao) => void;
  resolveRpiNumber?: (pub: Publicacao) => string | null;
}

export function PublicacaoKanban({ publicacoes, processMap, clientMap, adminMap, onSelect, selectedId, onStatusChange, resolveRpiNumber }: Props) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const { stages: juridicoStages } = useJuridicoStages();

  // Configuração derivada do Kanban Jurídico (fonte de verdade dinâmica via system_settings).
  // Inclui automaticamente novas etapas criadas em "Configurar Etapas — Jurídico".
  const STATUS_CONFIG = useMemo(() => {
    const map: Record<string, { label: string; accent: string; icon: string }> = {};
    for (const stage of juridicoStages) {
      // 'certificados' (plural, slug do Kanban) também responde por 'certificado' (status da publicação)
      const fallback = PIPELINE_STAGES.find((s) => s.id === stage.id || (stage.id === 'certificado' && s.id === 'certificados'));
      map[stage.id] = {
        label: stage.label,
        accent: (stage as any).color || fallback?.color || 'from-zinc-500 to-zinc-600',
        icon: PUB_STAGE_ICONS[stage.id] || DEFAULT_ICON,
      };
    }
    // Garante 'certificado' (singular, status legado das publicações) caso o slug seja 'certificados'
    if (!map['certificado'] && map['certificados']) {
      map['certificado'] = map['certificados'];
    }
    return map;
  }, [juridicoStages]);

  // Build a secondary lookup: process_number -> process for fallback resolution
  const processNumberMap = useMemo(() => {
    const map = new Map<string, any>();
    processMap.forEach((proc) => {
      if (proc.process_number) map.set(proc.process_number, proc);
    });
    return map;
  }, [processMap]);
  const [dragOverStatus, setDragOverStatus] = useState<PubStatus | null>(null);

  const columns = useMemo(() => {
    const cols: Record<string, Publicacao[]> = {};
    Object.keys(STATUS_CONFIG).forEach(k => { cols[k] = []; });
    publicacoes.forEach(p => {
      const key = p.status as string;
      if (!cols[key]) cols[key] = [];
      cols[key].push(p);
    });
    return cols;
  }, [publicacoes, STATUS_CONFIG]);

  const allColumns = useMemo(() => {
    return Object.entries(STATUS_CONFIG) as [PubStatus, typeof STATUS_CONFIG[PubStatus]][];
  }, [STATUS_CONFIG]);

  const handleDragStart = useCallback((e: React.DragEvent, pub: Publicacao) => {
    setDraggedId(pub.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', pub.id);
    // Make drag image semi-transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedId(null);
    setDragOverStatus(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: PubStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverStatus(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetStatus: PubStatus) => {
    e.preventDefault();
    setDragOverStatus(null);
    const pubId = e.dataTransfer.getData('text/plain');
    if (!pubId) return;
    
    const pub = publicacoes.find(p => p.id === pubId);
    if (!pub || pub.status === targetStatus) return;
    
    onStatusChange(pubId, targetStatus, pub);
  }, [publicacoes, onStatusChange]);

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-2 px-1 h-[calc(100vh-350px)]">
      {allColumns.map(([status, cfg]) => {
        const items = columns[status];
        const overdueCount = items.filter(p => {
          let dl = p.proximo_prazo_critico;
          if (!dl && p.data_publicacao_rpi) {
            dl = (p.status === 'certificado' ? addYears(parseISO(p.data_publicacao_rpi), 9) : addDays(parseISO(p.data_publicacao_rpi), 60)).toISOString();
          }
          if (!dl) return false;
          return differenceInDays(parseISO(dl), new Date()) < 0;
        }).length;
        const isDragTarget = dragOverStatus === status;

        return (
          <div 
            key={status} 
            className="min-w-[180px] flex-1 flex-shrink-0 flex flex-col"
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status)}
          >
            {/* Column header */}
            <div className={cn('rounded-xl px-3 py-2.5 bg-gradient-to-r text-white shadow-md transition-all', cfg.accent, isDragTarget && 'ring-2 ring-white/60 scale-[1.02]')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{cfg.icon}</span>
                  <span className="text-xs font-bold uppercase tracking-wider">{cfg.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {overdueCount > 0 && (
                    <Badge className="bg-white/25 text-white border-0 text-[10px] h-5 px-1.5 backdrop-blur-sm">
                      <Flame className="w-3 h-3 mr-0.5" />{overdueCount}
                    </Badge>
                  )}
                  <Badge className="bg-white/30 text-white border-0 text-[10px] h-5 min-w-[20px] justify-center backdrop-blur-sm">
                    {items.length}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Cards */}
            <ScrollArea className={cn('flex-1 mt-2 rounded-lg transition-all', isDragTarget && 'bg-primary/5 ring-2 ring-primary/20 ring-dashed')}>
              <div className="space-y-1.5 pr-1 min-h-[60px]">
                {items.length === 0 && !isDragTarget && (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                    <div className="w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/20 flex items-center justify-center mb-2">
                      <span className="text-xs">{cfg.icon}</span>
                    </div>
                    <p className="text-[10px]">Nenhuma publicação</p>
                  </div>
                )}
                {isDragTarget && items.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-primary/60">
                    <p className="text-[10px] font-medium">Solte aqui para mover</p>
                  </div>
                )}
                {items.map(pub => {
                  const proc = pub.process_id ? processMap.get(pub.process_id) : null;
                  // Fallback: try finding process by process_number_rpi
                  const resolvedProc = proc || (pub.process_number_rpi ? processNumberMap.get(pub.process_number_rpi) : null);
                  const client = pub.client_id ? clientMap.get(pub.client_id) : null;
                  // If no client from pub.client_id, try from the resolved process
                  const resolvedClient = client || (resolvedProc?.user_id ? clientMap.get(resolvedProc.user_id) : null);
                  const admin = pub.admin_id ? adminMap.get(pub.admin_id) : null;
                  let deadlineDate = pub.proximo_prazo_critico;
                  if (!deadlineDate && pub.data_publicacao_rpi) {
                    if (pub.status === 'certificado') {
                      deadlineDate = addYears(parseISO(pub.data_publicacao_rpi), 9).toISOString();
                    } else {
                      deadlineDate = addDays(parseISO(pub.data_publicacao_rpi), 60).toISOString();
                    }
                  }
                  const days = deadlineDate ? differenceInDays(parseISO(deadlineDate), new Date()) : null;
                  const processNumber = resolvedProc?.process_number || pub.process_number_rpi || null;
                  const brandName = resolvedProc?.brand_name || pub.brand_name_rpi || (processNumber ? `Processo ${processNumber}` : '—');
                  const rpiNumber = resolveRpiNumber ? resolveRpiNumber(pub) : null;
                  const isOverdue = days !== null && days < 0;
                  const isUrgent = days !== null && days >= 0 && days <= 7;
                  const isDragging = draggedId === pub.id;

                  return (
                    <div
                      key={pub.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, pub)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        'group relative rounded-lg p-2.5 cursor-grab active:cursor-grabbing transition-all duration-200',
                        'bg-card border border-border/60 hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5',
                        selectedId === pub.id && 'ring-2 ring-primary border-primary shadow-lg',
                        isOverdue && 'border-l-[3px] border-l-destructive',
                        isUrgent && !isOverdue && 'border-l-[3px] border-l-amber-500',
                        isDragging && 'opacity-50 scale-95'
                      )}
                      onClick={() => onSelect(pub.id)}
                    >
                      <div className="flex items-start gap-1">
                        <GripVertical className="w-3 h-3 text-muted-foreground/40 mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-extrabold text-foreground leading-tight line-clamp-2">{brandName}</p>
                          <p className="text-[11px] truncate mt-0.5 leading-tight font-semibold text-primary">
                            {resolvedClient?.full_name || '—'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {processNumber && (
                              <span className="text-[9px] text-muted-foreground/70 font-mono bg-muted/50 px-1 rounded">{processNumber}</span>
                            )}
                            {(pub.ncl_class || resolvedProc?.ncl_classes) && (
                              <span className="text-[9px] text-violet-700 dark:text-violet-400 font-medium bg-violet-100 dark:bg-violet-900/40 px-1 rounded">
                                NCL {pub.ncl_class || (resolvedProc?.ncl_classes ? resolvedProc.ncl_classes.join(', ') : '')}
                              </span>
                            )}
                            {rpiNumber && (
                              <span className="text-[9px] text-cyan-700 dark:text-cyan-400 font-medium bg-cyan-100 dark:bg-cyan-900/40 px-1 rounded">RPI {rpiNumber}</span>
                            )}
                          </div>
                          {pub.data_publicacao_rpi && (
                            <div className="flex items-center gap-1 mt-1 text-[9px] text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              <span>Pub: {format(parseISO(pub.data_publicacao_rpi), 'dd/MM/yyyy')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/40">
                        {days !== null ? (
                          <div className={cn('flex items-center gap-1 text-[10px] font-semibold',
                            isOverdue ? 'text-destructive animate-pulse' : isUrgent ? 'text-amber-600 dark:text-amber-400' : days <= 15 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                          )}>
                            {isOverdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {isOverdue ? `${Math.abs(days)}d atrasado` : `${days}d restantes`}
                          </div>
                        ) : <span />}
                        {admin && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <User className="w-3 h-3" />
                            <span className="truncate max-w-[50px]">{admin.full_name?.split(' ')[0]}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        );
      })}

      {allColumns.length === 0 && (
        <div className="flex-1 flex items-center justify-center py-20 text-muted-foreground text-sm">
          Nenhuma publicação encontrada
        </div>
      )}
    </div>
  );
}
