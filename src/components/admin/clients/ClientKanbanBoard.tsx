import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Eye, MessageCircle, Mail, Phone, Building2, DollarSign, 
  ChevronDown, ChevronRight, GripVertical, Star, Calendar,
  MoreHorizontal, Trash2, UserPlus, UserCheck, CheckCircle, XCircle,
  ArrowRight, Sparkles, Clock, Hash
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { normalizePipelineStageId, sanitizePipelineStagesConfig } from '@/lib/pipelineStage';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ClientBrand {
  id: string;
  brand_name: string;
  pipeline_stage: string;
  process_number?: string;
}

export interface ClientWithProcess {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  company_name: string | null;
  priority: string | null;
  origin: string | null;
  contract_value: number | null;
  process_id: string | null;
  brand_name: string | null;
  business_area: string | null;
  pipeline_stage: string | null;
  process_status: string | null;
  created_at?: string;
  last_contact?: string;
  cpf_cnpj?: string;
  process_number?: string;
  client_funnel_type?: string;
  created_by?: string | null;
  assigned_to?: string | null;
  created_by_name?: string | null;
  assigned_to_name?: string | null;
  brands?: ClientBrand[];
  publicacao_id?: string | null;
}

export interface KanbanFilters {
  priority: string[];
  origin: string[];
}

export type FunnelType = 'comercial' | 'juridico';

interface ClientKanbanBoardProps {
  clients: ClientWithProcess[];
  onClientClick: (client: ClientWithProcess) => void;
  onRefresh: () => void;
  filters?: KanbanFilters;
  funnelType?: FunnelType;
  adminUsers?: { id: string; full_name: string | null; email: string }[];
  canAssign?: boolean;
  canViewFinancialValues?: boolean;
  onConfigOpen?: () => void;
  stagesVersion?: number;
}

// COMMERCIAL FUNNEL STAGES (for sales pipeline)
export const COMMERCIAL_PIPELINE_STAGES = [
  { id: 'assinou_contrato', label: 'ASSINOU CONTRATO', color: 'from-blue-500 to-blue-600', borderColor: 'border-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-950/30', textColor: 'text-blue-700 dark:text-blue-300', description: 'Cliente assinou o contrato. Aguardando confirmação de pagamento.' },
  { id: 'pagamento_ok', label: 'PAGAMENTO OKAY', color: 'from-emerald-500 to-emerald-600', borderColor: 'border-emerald-500', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30', textColor: 'text-emerald-700 dark:text-emerald-300', description: 'Pagamento do serviço confirmado. Pronto para pagar taxa INPI.' },
  { id: 'pagou_taxa', label: 'PAGOU TAXA', color: 'from-teal-500 to-teal-600', borderColor: 'border-teal-500', bgColor: 'bg-teal-50 dark:bg-teal-950/30', textColor: 'text-teal-700 dark:text-teal-300', description: 'Taxa INPI paga. Pronto para mover ao funil jurídico.' },
];

// LEGAL FUNNEL STAGES (INPI processes - existing)
export const PIPELINE_STAGES = [
  { id: 'protocolado', label: 'PROTOCOLADO', color: 'from-blue-500 to-blue-600', borderColor: 'border-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-950/30', textColor: 'text-blue-700 dark:text-blue-300', description: 'Pedido de registro enviado ao INPI. Aguardando análise inicial.' },
  { id: '003', label: '003', color: 'from-yellow-500 to-amber-500', borderColor: 'border-yellow-500', bgColor: 'bg-yellow-50 dark:bg-yellow-950/30', textColor: 'text-yellow-700 dark:text-yellow-300', description: 'Cumprimento de exigência formal. Documentos adicionais solicitados.' },
  { id: 'oposicao', label: 'Oposição', color: 'from-orange-500 to-orange-600', borderColor: 'border-orange-500', bgColor: 'bg-orange-50 dark:bg-orange-950/30', textColor: 'text-orange-700 dark:text-orange-300', description: 'Terceiro contestou o registro. Manifestação necessária.' },
  { id: 'exigencia_merito', label: 'EXIGENCIA DE MÉRITO', color: 'from-violet-500 to-violet-600', borderColor: 'border-violet-500', bgColor: 'bg-violet-50 dark:bg-violet-950/30', textColor: 'text-violet-700 dark:text-violet-300', description: 'Exigência de mérito emitida pelo INPI. Resposta técnica necessária.' },
  { id: 'indeferimento', label: 'Indeferimento', color: 'from-red-500 to-red-600', borderColor: 'border-red-500', bgColor: 'bg-red-50 dark:bg-red-950/30', textColor: 'text-red-700 dark:text-red-300', description: 'Pedido indeferido. Recurso pode ser interposto.' },
  { id: 'notificacao', label: 'Notificação Extrajudicial', color: 'from-purple-500 to-purple-600', borderColor: 'border-purple-500', bgColor: 'bg-purple-50 dark:bg-purple-950/30', textColor: 'text-purple-700 dark:text-purple-300', description: 'Notificação enviada a terceiros por uso indevido.' },
  { id: 'deferimento', label: 'Deferimento', color: 'from-emerald-500 to-emerald-600', borderColor: 'border-emerald-500', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30', textColor: 'text-emerald-700 dark:text-emerald-300', description: 'Pedido aprovado! Aguardando pagamento da taxa de concessão.' },
  { id: 'certificados', label: 'Certificados', color: 'from-teal-500 to-teal-600', borderColor: 'border-teal-500', bgColor: 'bg-teal-50 dark:bg-teal-950/30', textColor: 'text-teal-700 dark:text-teal-300', description: 'Marca registrada. Certificado emitido pelo INPI.' },
  { id: 'renovacao', label: 'Renovação', color: 'from-cyan-500 to-cyan-600', borderColor: 'border-cyan-500', bgColor: 'bg-cyan-50 dark:bg-cyan-950/30', textColor: 'text-cyan-700 dark:text-cyan-300', description: 'Próximo da renovação decenal. Ação necessária.' },
  { id: 'arquivado', label: 'Arquivado', color: 'from-zinc-500 to-zinc-600', borderColor: 'border-zinc-500', bgColor: 'bg-zinc-50 dark:bg-zinc-950/30', textColor: 'text-zinc-700 dark:text-zinc-300', description: 'Processo arquivado no INPI.' },
  { id: 'distrato', label: 'Distrato', color: 'from-gray-500 to-gray-600', borderColor: 'border-gray-500', bgColor: 'bg-gray-50 dark:bg-gray-950/30', textColor: 'text-gray-700 dark:text-gray-300', description: 'Cliente encerrou contrato ou serviço cancelado.' },
];

const ORIGIN_CONFIG: Record<string, { icon: typeof MessageCircle; color: string; bg: string; label: string }> = {
  'whatsapp': { icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'WA' },
  'site': { icon: Building2, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Site' },
  'instagram': { icon: Sparkles, color: 'text-pink-600', bg: 'bg-pink-100', label: 'IG' },
  'indicacao': { icon: UserPlus, color: 'text-purple-600', bg: 'bg-purple-100', label: 'Ind' },
};

export function ClientKanbanBoard({ clients, onClientClick, onRefresh, filters, funnelType = 'juridico', adminUsers = [], canAssign = false, canViewFinancialValues = true, onConfigOpen, stagesVersion = 0 }: ClientKanbanBoardProps) {
  const [draggedClient, setDraggedClient] = useState<ClientWithProcess | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set());
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [dynamicStages, setDynamicStages] = useState<typeof PIPELINE_STAGES | null>(null);
  const MAX_VISIBLE = 20;

  // Load dynamic stages from system_settings
  useEffect(() => {
    const settingsKey = funnelType === 'comercial' ? 'admin_kanban_comercial_stages' : 'admin_kanban_juridico_stages';
    supabaseClient
      .from('system_settings')
      .select('value')
      .eq('key', settingsKey)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value && typeof data.value === 'object' && 'stages' in (data.value as any)) {
          const normalizedStages = sanitizePipelineStagesConfig<typeof PIPELINE_STAGES[number]>((data.value as any).stages);
          setDynamicStages(normalizedStages.length > 0 ? normalizedStages : null);
        } else {
          setDynamicStages(null);
        }
      });
  }, [funnelType, stagesVersion]);

  // Select stages based on funnel type (dynamic > fallback)
  const fallbackStages = funnelType === 'comercial' ? COMMERCIAL_PIPELINE_STAGES : PIPELINE_STAGES;
  const activePipelineStages = dynamicStages || fallbackStages;
  const defaultStage = funnelType === 'comercial' ? 'assinou_contrato' : (activePipelineStages[0]?.id || 'protocolado');

  // Apply filters
  const filteredClients = useMemo(() => {
    if (!filters) return clients;
    
    return clients.filter(client => {
      const priorityMatch = filters.priority.length === 0 || 
        filters.priority.includes(client.priority || 'medium');
      const originMatch = filters.origin.length === 0 || 
        filters.origin.includes(client.origin || 'site');
      return priorityMatch && originMatch;
    });
  }, [clients, filters]);

  const handleDragStart = (e: React.DragEvent, client: ClientWithProcess) => {
    setDraggedClient(client);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedClient(null);
    setDragOverStage(null);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageId);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = async (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStage(null);

    if (!draggedClient) {
      setDraggedClient(null);
      return;
    }

    const normalizedStageId = normalizePipelineStageId(stageId) || defaultStage;

    if (draggedClient.pipeline_stage === normalizedStageId) {
      setDraggedClient(null);
      return;
    }

    try {
      if (draggedClient.process_id) {
        // Cliente já tem processo - apenas atualiza o estágio
        const { error } = await supabase
          .from('brand_processes')
          .update({ pipeline_stage: normalizedStageId })
          .eq('id', draggedClient.process_id);

        if (error) throw error;
      } else {
        // Cliente sem processo - cria um novo processo com o estágio selecionado
        const { error } = await supabase
          .from('brand_processes')
          .insert({
            user_id: draggedClient.id,
            brand_name: draggedClient.company_name || draggedClient.full_name || 'Sem nome',
            pipeline_stage: normalizedStageId,
            status: 'em_andamento'
          });

        if (error) throw error;
      }
      
      const stageName = activePipelineStages.find(s => s.id === normalizedStageId)?.label || 
                        PIPELINE_STAGES.find(s => s.id === normalizedStageId)?.label;
      toast.success(`✅ Cliente movido para ${stageName}`);
      onRefresh();
    } catch (error) {
      console.error('Error moving client:', error);
      toast.error('Erro ao mover cliente');
    }
    setDraggedClient(null);
  };

  const activeStageIds = useMemo(() => new Set(activePipelineStages.map(s => s.id)), [activePipelineStages]);

  const getClientsForStage = (stageId: string) => {
    const directMatch = filteredClients.filter(c => (c.pipeline_stage || defaultStage) === stageId);
    
    // If this is the first column, also include orphan clients whose pipeline_stage
    // doesn't match any column in the active funnel
    if (stageId === activePipelineStages[0]?.id) {
      const orphans = filteredClients.filter(c => {
        const stage = c.pipeline_stage || defaultStage;
        return stage !== stageId && !activeStageIds.has(stage);
      });
      return [...directMatch, ...orphans];
    }
    
    return directMatch;
  };

  const getStageValue = (stageId: string) => {
    return getClientsForStage(stageId).reduce((sum, c) => sum + (c.contract_value || 0), 0);
  };

  const toggleStageCollapse = (stageId: string) => {
    setCollapsedStages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stageId)) {
        newSet.delete(stageId);
      } else {
        newSet.add(stageId);
      }
      return newSet;
    });
  };

  const getPriorityConfig = (priority: string | null) => {
    switch (priority) {
      case 'high': return { label: 'HIGH', color: 'bg-red-500 text-white', ring: 'ring-red-400' };
      case 'low': return { label: 'LOW', color: 'bg-green-500 text-white', ring: 'ring-green-400' };
      default: return { label: 'MEDIUM', color: 'bg-yellow-500 text-white', ring: 'ring-yellow-400' };
    }
  };

  const openWhatsApp = (phone: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!phone) {
      toast.error('Cliente sem telefone cadastrado');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${cleanPhone}`, '_blank');
  };

  const totalValue = filteredClients.reduce((sum, c) => sum + (c.contract_value || 0), 0);
  const activeClients = filteredClients.filter(c => c.pipeline_stage !== 'distrato').length;

  return (
    <div className="space-y-4">
      {/* Summary Stats - Animated */}
      <motion.div 
        className="flex flex-wrap gap-3 justify-end"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div 
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-xl shadow-sm border"
          whileHover={{ scale: 1.02 }}
        >
          <Building2 className="h-4 w-4 text-slate-600" />
          <span className="text-sm text-muted-foreground">Total:</span>
          <span className="font-bold">{filteredClients.length}</span>
        </motion.div>
        {canViewFinancialValues && (
          <motion.div 
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-950/30 rounded-xl shadow-sm border border-emerald-200 dark:border-emerald-800"
            whileHover={{ scale: 1.02 }}
          >
            <DollarSign className="h-4 w-4 text-emerald-600" />
            <span className="text-sm text-emerald-700 dark:text-emerald-300">Valor:</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-300">R$ {totalValue.toLocaleString('pt-BR')}</span>
          </motion.div>
        )}
        <motion.div 
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-950/30 rounded-xl shadow-sm border border-blue-200 dark:border-blue-800"
          whileHover={{ scale: 1.02 }}
        >
          <CheckCircle className="h-4 w-4 text-blue-600" />
          <span className="text-sm text-blue-700 dark:text-blue-300">Ativos:</span>
          <span className="font-bold text-blue-700 dark:text-blue-300">{activeClients}</span>
        </motion.div>
      </motion.div>

      {/* Kanban Board */}
      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin">
        {activePipelineStages.map((stage, stageIndex) => {
          const stageClients = getClientsForStage(stage.id);
          const stageValue = getStageValue(stage.id);
          const isCollapsed = collapsedStages.has(stage.id);
          const isDragOver = dragOverStage === stage.id;

          return (
            <div
              key={stage.id}
              className={cn(
                "flex-shrink-0 transition-all duration-200",
                isCollapsed ? "w-14" : "w-80"
              )}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              <div 
                className={cn(
                  "rounded-2xl min-h-[600px] transition-all duration-300 border-t-4",
                  stage.borderColor,
                  isDragOver 
                    ? `${stage.bgColor} ring-2 ring-primary ring-offset-2 shadow-lg` 
                    : "bg-muted/30 hover:bg-muted/50",
                  isCollapsed ? "p-2" : "p-3"
                )}
              >
                {/* Column Header */}
                <div 
                  className={cn(
                    "flex items-center gap-2 mb-3 cursor-pointer group",
                    isCollapsed && "flex-col"
                  )}
                  onClick={() => toggleStageCollapse(stage.id)}
                >
                  <motion.div
                    whileHover={{ rotate: isCollapsed ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-60 group-hover:opacity-100">
                      {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </motion.div>
                  
                  {isCollapsed ? (
                    <div className="flex flex-col items-center gap-2">
                      <span 
                        className={cn("font-bold text-xs whitespace-nowrap", stage.textColor)}
                        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                      >
                        {stage.label}
                      </span>
                      <Badge className={cn("text-xs", `bg-gradient-to-r ${stage.color} text-white border-0`)}>
                        {stageClients.length}
                      </Badge>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1">
                        <h3 className={cn("font-bold text-sm", stage.textColor)}>{stage.label}</h3>
                        <p className="text-[10px] text-muted-foreground">Pipeline</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className="text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />
                              IA
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>Automação IA ativa</TooltipContent>
                        </Tooltip>
                        <Badge className={cn("text-xs font-bold", `bg-gradient-to-r ${stage.color} text-white border-0`)}>
                          {stageClients.length}
                        </Badge>
                      </div>
                    </>
                  )}
                </div>

                {/* Stage Value - Only show when expanded */}
                {!isCollapsed && stageValue > 0 && canViewFinancialValues && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-3 px-3 py-2 bg-white/70 dark:bg-black/20 rounded-xl text-center border"
                  >
                    <span className="text-xs text-muted-foreground">Total: </span>
                    <span className="font-bold text-emerald-600">
                      R$ {stageValue.toLocaleString('pt-BR')}
                    </span>
                  </motion.div>
                )}

                {/* Cards */}
                {!isCollapsed && (
                  <div className="space-y-3">
                      {stageClients.length === 0 ? (
                        <div
                          className={cn(
                            "text-center py-10 rounded-xl border-2 border-dashed transition-all",
                            isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/20"
                          )}
                        >
                          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                            <Building2 className="h-7 w-7 opacity-40" />
                          </div>
                          <p className="text-sm text-muted-foreground">Nenhum cliente</p>
                          <p className="text-xs text-muted-foreground/70">Arraste clientes aqui</p>
                        </div>
                      ) : (
                        <>
                        {(() => {
                          const isExpanded = expandedStages.has(stage.id);
                          const visibleClients = isExpanded ? stageClients : stageClients.slice(0, MAX_VISIBLE);
                          const hiddenCount = stageClients.length - MAX_VISIBLE;
                          return <>
                        {visibleClients.map((client) => {
                          const priorityConfig = getPriorityConfig(client.priority);
                          const originConfig = ORIGIN_CONFIG[client.origin || 'site'] || ORIGIN_CONFIG.site;
                          const OriginIcon = originConfig.icon;
                          const isHovered = hoveredCard === client.id;
                          const isDragging = draggedClient?.id === client.id;

                          return (
                            <div
                              key={client.id + (client.process_id || '')}
                              onMouseEnter={() => setHoveredCard(client.id)}
                              onMouseLeave={() => setHoveredCard(null)}
                            >
                              <Card
                                draggable
                                onDragStart={(e) => handleDragStart(e, client)}
                                onDragEnd={handleDragEnd}
                                className={cn(
                                  "p-0 cursor-grab active:cursor-grabbing transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl bg-white dark:bg-slate-900",
                                  isDragging && "ring-2 ring-primary shadow-2xl"
                                )}
                              >
                                {/* Color Strip Top */}
                                <div className={cn("h-1 w-full bg-gradient-to-r", stage.color)} />
                                
                                <div className="p-3">
                                  {/* Top Row - Number, Origin, Actions */}
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-1.5">
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                                        <Hash className="h-2.5 w-2.5 mr-0.5" />
                                        {client.id.slice(0, 4)}
                                      </Badge>
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <div className={cn("p-1 rounded-md", originConfig.bg)}>
                                            <OriginIcon className={cn("h-3 w-3", originConfig.color)} />
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent>{originConfig.label}</TooltipContent>
                                      </Tooltip>
                                    </div>
                                    
                                    <motion.div 
                                      className="flex items-center gap-1"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: isHovered ? 1 : 0.5 }}
                                    >
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-6 w-6 hover:bg-green-100 hover:text-green-600"
                                            onClick={(e) => openWhatsApp(client.phone, e)}
                                          >
                                            <MessageCircle className="h-3.5 w-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>WhatsApp</TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-6 w-6 hover:bg-blue-100 hover:text-blue-600"
                                            onClick={(e) => { e.stopPropagation(); onClientClick(client); }}
                                          >
                                            <Eye className="h-3.5 w-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Ver detalhes</TooltipContent>
                                      </Tooltip>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-6 w-6"
                                      >
                                        <MoreHorizontal className="h-3.5 w-3.5" />
                                      </Button>
                                    </motion.div>
                                  </div>

                                  {/* Client Name & Brand */}
                                  <div 
                                    className="cursor-pointer mb-3"
                                    onClick={() => onClientClick(client)}
                                  >
                                    <p className="font-bold text-sm mb-0.5 line-clamp-1">
                                      {client.full_name || 'Sem nome'}
                                    </p>
                                    {client.brand_name ? (
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="font-bold text-sm text-primary line-clamp-1">
                                          {client.brand_name}
                                        </p>
                                        {client.brands && client.brands.length > 1 && (
                                          <Tooltip>
                                            <TooltipTrigger>
                                              <Badge className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                                                +{client.brands.length - 1} marca{client.brands.length > 2 ? 's' : ''}
                                              </Badge>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="max-w-[250px]">
                                              <p className="font-semibold text-xs mb-1">Marcas registradas:</p>
                                              <ul className="text-xs space-y-0.5">
                                                {client.brands.map(b => (
                                                  <li key={b.id} className="flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                                                    {b.brand_name}
                                                    {b.process_number && <span className="text-muted-foreground font-mono">#{b.process_number}</span>}
                                                  </li>
                                                ))}
                                              </ul>
                                            </TooltipContent>
                                          </Tooltip>
                                        )}
                                      </div>
                                    ) : client.brands && client.brands.length > 0 ? (
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="font-bold text-sm text-primary line-clamp-1">
                                          {client.brand_name}
                                        </p>
                                        {client.process_number && (
                                          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-4">
                                            <Hash className="h-2.5 w-2.5 mr-0.5" />
                                            {client.process_number}
                                          </Badge>
                                        )}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-muted-foreground line-clamp-1">
                                        {client.company_name || 'Empresa não informada'}
                                      </p>
                                    )}
                                  </div>

                                  {/* Info Grid */}
                                  <div className="grid grid-cols-2 gap-2 mb-3">
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Phone className="h-3 w-3" />
                                      <span className="truncate">{client.phone || 'N/A'}</span>
                                    </div>
                                    {client.contract_value && client.contract_value > 0 ? (
                                      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                                        <DollarSign className="h-3 w-3" />
                                        <span>R$ {client.contract_value.toLocaleString('pt-BR')}</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <DollarSign className="h-3 w-3" />
                                        <span>R$ 0</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Badges Row */}
                                  <div className="flex items-center gap-1.5 flex-wrap mb-2">
                                    <Badge className={cn("text-[10px] px-1.5 py-0", priorityConfig.color)}>
                                      {priorityConfig.label}
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                      {client.origin === 'whatsapp' ? 'what...' : client.origin || 'site'}
                                    </Badge>
                                  </div>

                                  {/* Responsible Admin - Highlighted */}
                                  <div className="pt-2 border-t space-y-1.5">
                                    {/* Assigned Admin (main responsible) - clickable if canAssign */}
                                    {canAssign ? (
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <button 
                                            className="flex items-center gap-1.5 w-full hover:bg-primary/5 rounded-md p-0.5 -m-0.5 transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                              <UserCheck className="h-3 w-3 text-primary" />
                                            </div>
                                            <span className="text-[11px] font-semibold text-primary truncate">
                                              {client.assigned_to_name || client.created_by_name || (client.origin === 'site' ? '🌐 Site' : 'Não atribuído')}
                                            </span>
                                          </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-56" align="start" onClick={(e) => e.stopPropagation()}>
                                          <div className="space-y-2">
                                            <p className="text-xs font-semibold">Atribuir a:</p>
                                            <Select
                                              value={client.assigned_to || ''}
                                              onValueChange={async (value) => {
                                                const newVal = value === 'none' ? null : value;
                                                try {
                                                  await supabase.from('profiles').update({ assigned_to: newVal }).eq('id', client.id);
                                                  toast.success('Cliente atribuído!');
                                                  onRefresh();
                                                } catch {
                                                  toast.error('Erro ao atribuir');
                                                }
                                              }}
                                            >
                                              <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="Selecionar..." />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="none">Nenhum</SelectItem>
                                                {adminUsers.map((a) => (
                                                  <SelectItem key={a.id} value={a.id}>
                                                    {a.full_name || a.email}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                    ) : (
                                      <div className="flex items-center gap-1.5">
                                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                          <UserCheck className="h-3 w-3 text-primary" />
                                        </div>
                                        <span className="text-[11px] font-semibold text-primary truncate">
                                          {client.assigned_to_name || client.created_by_name || (client.origin === 'site' ? '🌐 Site' : 'Não atribuído')}
                                        </span>
                                      </div>
                                    )}
                                    {/* Creator info + time */}
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <div className="flex items-center gap-1">
                                            <UserPlus className="h-2.5 w-2.5" />
                                            <span className="truncate max-w-[80px]">
                                              {client.created_by_name || (client.origin === 'site' ? 'Site' : '—')}
                                            </span>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <div className="text-xs space-y-1">
                                            <p><strong>Criado por:</strong> {client.created_by_name || (client.origin === 'site' ? 'Site (cadastro online)' : 'Não informado')}</p>
                                            {client.assigned_to_name && <p><strong>Responsável:</strong> {client.assigned_to_name}</p>}
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                      <div className="flex items-center gap-1">
                                        <Calendar className="h-2.5 w-2.5" />
                                        <span>
                                          {client.created_at 
                                            ? formatDistanceToNow(new Date(client.created_at), { locale: ptBR, addSuffix: false })
                                            : '—'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Quick Action on Hover */}
                                  {isHovered && (
                                    <div className="mt-2 pt-2 border-t">
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="w-full h-7 text-xs"
                                          onClick={() => onClientClick(client)}
                                        >
                                          <Eye className="h-3 w-3 mr-1" />
                                          Visualizar
                                        </Button>
                                    </div>
                                  )}
                                </div>
                              </Card>
                            </div>
                          );
                        })}
                        {hiddenCount > 0 && !isExpanded && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs h-8"
                            onClick={() => setExpandedStages(prev => {
                              const next = new Set(prev);
                              next.add(stage.id);
                              return next;
                            })}
                          >
                            Ver mais {hiddenCount} clientes
                          </Button>
                        )}
                        {isExpanded && hiddenCount > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs h-8"
                            onClick={() => setExpandedStages(prev => {
                              const next = new Set(prev);
                              next.delete(stage.id);
                              return next;
                            })}
                          >
                            Recolher
                          </Button>
                        )}
                        </>;
                        })()}
                        </>
                      )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
