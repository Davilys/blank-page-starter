import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Sparkles, Phone, Star, Target, Activity, AlertCircle, CheckCircle2,
  Building2, Mail, Flame, GripVertical, DollarSign
} from 'lucide-react';

interface Lead {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  status: string;
  origin: string | null;
  estimated_value: number | null;
  lead_temperature?: string | null;
  lead_score?: number | null;
  tags?: string[] | null;
}

interface LeadKanbanBoardProps {
  leads: Lead[];
  onRefresh: () => void;
  onLeadClick: (lead: Lead) => void;
}

const COLUMNS = [
  { key: 'novo', label: 'Novo', icon: Sparkles, gradient: 'from-blue-500 to-cyan-400', glow: '#3b82f6' },
  { key: 'contato', label: 'Em Contato', icon: Phone, gradient: 'from-yellow-500 to-amber-400', glow: '#eab308' },
  { key: 'qualificado', label: 'Qualificado', icon: Star, gradient: 'from-violet-500 to-purple-400', glow: '#8b5cf6' },
  { key: 'proposta', label: 'Proposta', icon: Target, gradient: 'from-indigo-500 to-blue-400', glow: '#6366f1' },
  { key: 'negociacao', label: 'Negociação', icon: Activity, gradient: 'from-orange-500 to-amber-400', glow: '#f97316' },
  { key: 'convertido', label: 'Convertido', icon: CheckCircle2, gradient: 'from-emerald-500 to-green-400', glow: '#10b981' },
  { key: 'perdido', label: 'Perdido', icon: AlertCircle, gradient: 'from-rose-500 to-red-400', glow: '#f43f5e' },
];

const TEMP_CONFIG: Record<string, { label: string }> = {
  quente: { label: '🔥' },
  morno: { label: '🌡️' },
  frio: { label: '❄️' },
};

function KanbanCard({ lead, onDragStart, onClick }: {
  lead: Lead;
  onDragStart: (e: React.DragEvent, leadId: string) => void;
  onClick: () => void;
}) {
  const temp = TEMP_CONFIG[lead.lead_temperature || 'frio'] || TEMP_CONFIG.frio;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onClick={onClick}
      className="group relative p-3 rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm cursor-grab active:cursor-grabbing hover:border-primary/30 hover:shadow-lg transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          <p className="text-sm font-semibold text-foreground truncate">{lead.full_name}</p>
        </div>
        <span className="text-base flex-shrink-0" title={lead.lead_temperature || 'frio'}>
          {temp.label}
        </span>
      </div>

      {lead.company_name && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <Building2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className="text-[11px] text-muted-foreground truncate">{lead.company_name}</span>
        </div>
      )}

      {lead.email && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className="text-[11px] text-muted-foreground truncate">{lead.email}</span>
        </div>
      )}

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
        {lead.estimated_value ? (
          <span className="text-[11px] font-bold text-emerald-500 flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            R$ {lead.estimated_value.toLocaleString('pt-BR')}
          </span>
        ) : <span />}

        {lead.lead_score != null && lead.lead_score > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
            {lead.lead_score}pts
          </span>
        )}
      </div>

      {lead.tags && lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {lead.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/30">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function LeadKanbanBoard({ leads, onRefresh, onLeadClick }: LeadKanbanBoardProps) {
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('text/plain', leadId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOverCol(null);
    const leadId = e.dataTransfer.getData('text/plain');
    if (!leadId) return;

    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.status === newStatus) return;

    try {
      const { error } = await supabase.from('leads').update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      }).eq('id', leadId);
      if (error) throw error;
      toast.success(`Lead movido para ${COLUMNS.find(c => c.key === newStatus)?.label}`);
      onRefresh();
    } catch {
      toast.error('Erro ao mover lead');
    }
  }, [leads, onRefresh]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[500px]">
      {COLUMNS.map(col => {
        const colLeads = leads.filter(l => l.status === col.key);
        const totalValue = colLeads.reduce((s, l) => s + (l.estimated_value || 0), 0);
        const Icon = col.icon;

        return (
          <div
            key={col.key}
            className={cn(
              'flex-shrink-0 w-[260px] rounded-2xl border bg-card/40 backdrop-blur-sm transition-all duration-200',
              dragOverCol === col.key
                ? 'border-primary/50 bg-primary/5 shadow-lg'
                : 'border-border/40'
            )}
            onDragOver={e => { e.preventDefault(); setDragOverCol(col.key); }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={e => handleDrop(e, col.key)}
          >
            <div className="p-3 border-b border-border/30">
              <div className="flex items-center gap-2 mb-1">
                <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center bg-gradient-to-br', col.gradient)}>
                  <Icon className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-xs font-bold text-foreground">{col.label}</span>
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
                  {colLeads.length}
                </span>
              </div>
              {totalValue > 0 && (
                <span className="text-[10px] text-emerald-500 font-semibold">
                  R$ {totalValue.toLocaleString('pt-BR')}
                </span>
              )}
            </div>

            <div className="p-2 space-y-2 max-h-[600px] overflow-y-auto">
              {colLeads.map(lead => (
                <KanbanCard
                  key={lead.id}
                  lead={lead}
                  onDragStart={handleDragStart}
                  onClick={() => onLeadClick(lead)}
                />
              ))}
              {colLeads.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-[11px] text-muted-foreground/50">Arraste leads aqui</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
