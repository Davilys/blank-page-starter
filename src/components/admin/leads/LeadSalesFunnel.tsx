import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TrendingDown, ArrowRight } from 'lucide-react';

interface Lead {
  id: string;
  status: string;
  estimated_value: number | null;
}

interface LeadSalesFunnelProps {
  leads: Lead[];
}

const FUNNEL_STAGES = [
  { key: 'novo', label: 'Novos', color: 'from-blue-500 to-cyan-400', bg: 'bg-blue-500/10' },
  { key: 'contato', label: 'Em Contato', color: 'from-yellow-500 to-amber-400', bg: 'bg-yellow-500/10' },
  { key: 'qualificado', label: 'Qualificados', color: 'from-violet-500 to-purple-400', bg: 'bg-violet-500/10' },
  { key: 'proposta', label: 'Proposta', color: 'from-indigo-500 to-blue-400', bg: 'bg-indigo-500/10' },
  { key: 'negociacao', label: 'Negociação', color: 'from-orange-500 to-amber-400', bg: 'bg-orange-500/10' },
  { key: 'convertido', label: 'Convertidos', color: 'from-emerald-500 to-green-400', bg: 'bg-emerald-500/10' },
];

export function LeadSalesFunnel({ leads }: LeadSalesFunnelProps) {
  const stageCounts = FUNNEL_STAGES.map(s => ({
    ...s,
    count: leads.filter(l => l.status === s.key).length,
    value: leads.filter(l => l.status === s.key).reduce((sum, l) => sum + (l.estimated_value || 0), 0),
  }));

  const maxCount = Math.max(...stageCounts.map(s => s.count), 1);
  const totalLeads = leads.length || 1;

  return (
    <div className="space-y-6">
      {/* Funnel Visual */}
      <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <TrendingDown className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-black text-foreground">Funil de Vendas</h3>
        </div>

        <div className="space-y-3">
          {stageCounts.map((stage, i) => {
            const widthPct = Math.max((stage.count / maxCount) * 100, 8);
            const conversionFromPrev = i > 0 && stageCounts[i - 1].count > 0
              ? Math.round((stage.count / stageCounts[i - 1].count) * 100)
              : null;

            return (
              <motion.div
                key={stage.key}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
              >
                {/* Conversion rate between stages */}
                {conversionFromPrev !== null && (
                  <div className="flex items-center gap-2 ml-4 mb-1">
                    <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                    <span className="text-[10px] font-bold text-muted-foreground/60">
                      {conversionFromPrev}% conversão
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  {/* Label */}
                  <div className="w-28 flex-shrink-0 text-right">
                    <p className="text-xs font-bold text-foreground">{stage.label}</p>
                    <p className="text-[10px] text-muted-foreground">{stage.count} leads</p>
                  </div>

                  {/* Bar */}
                  <div className="flex-1 relative">
                    <div className="h-10 rounded-xl bg-muted/20 overflow-hidden">
                      <motion.div
                        className={cn('h-full rounded-xl bg-gradient-to-r flex items-center justify-end pr-3', stage.color)}
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPct}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <span className="text-[11px] font-black text-white/90 whitespace-nowrap">
                          {Math.round((stage.count / totalLeads) * 100)}%
                        </span>
                      </motion.div>
                    </div>
                  </div>

                  {/* Value */}
                  <div className="w-24 flex-shrink-0">
                    {stage.value > 0 && (
                      <span className="text-[11px] font-bold text-emerald-500">
                        R$ {stage.value.toLocaleString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-6 pt-4 border-t border-border/30 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-black text-foreground">{leads.length}</p>
            <p className="text-[11px] text-muted-foreground">Total de Leads</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-emerald-500">
              {leads.length > 0 ? Math.round((leads.filter(l => l.status === 'convertido').length / leads.length) * 100) : 0}%
            </p>
            <p className="text-[11px] text-muted-foreground">Taxa Geral</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-foreground">
              R$ {Math.round(leads.reduce((s, l) => s + (l.estimated_value || 0), 0)).toLocaleString('pt-BR')}
            </p>
            <p className="text-[11px] text-muted-foreground">Pipeline Total</p>
          </div>
        </div>
      </div>
    </div>
  );
}
