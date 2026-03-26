import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, Brain, RefreshCw, Zap, Target, TrendingUp,
  Settings, CheckCircle, XCircle, Clock, Award, BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getEngineStats, recalculateWeights } from '@/lib/upsellEngine';
import { toast } from 'sonner';

function MiniRing({ pct, color, size = 56 }: { pct: number; color: string; size?: number }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(pct / 100, 1) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth={4} className="text-border opacity-30" />
      <motion.circle
        cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeLinecap="round" strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

function MetricCard({ title, icon: Icon, color, children, index }: {
  title: string; icon: React.ElementType; color: string; children: React.ReactNode; index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 + index * 0.06 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group relative rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl overflow-hidden"
    >
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-500" style={{ background: color }} />
      <div className="relative p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
            <Icon className="h-4 w-4" style={{ color }} />
          </div>
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{title}</span>
        </div>
        {children}
      </div>
    </motion.div>
  );
}

export function MonetizationEngineSection() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    setLoading(true);
    const data = await getEngineStats();
    setStats(data);
    setLoading(false);
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    const result = await recalculateWeights();
    if (result.success) {
      toast.success(result.message);
      await fetchStats();
    } else {
      toast.error(result.message);
    }
    setRecalculating(false);
  };

  const modeLabels: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    fixed: { label: 'Regras Fixas', color: '#6366f1', icon: Settings },
    hybrid: { label: 'Híbrido', color: '#f59e0b', icon: Zap },
    intelligent: { label: 'Inteligente', color: '#10b981', icon: Brain },
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-8 flex items-center justify-center gap-3">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        <span className="text-sm text-muted-foreground">Carregando motor de monetização...</span>
      </div>
    );
  }

  if (!stats) return null;

  const modeInfo = modeLabels[stats.engineMode] || modeLabels.fixed;
  const ModeIcon = modeInfo.icon;

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
            <DollarSign className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black text-foreground tracking-tight">Motor de Monetização</h2>
            <p className="text-xs text-muted-foreground">WebMarcas Intelligence PI™ · Sistema Autoevolutivo</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold"
            style={{ color: modeInfo.color, borderColor: `${modeInfo.color}40`, background: `${modeInfo.color}15` }}>
            <ModeIcon className="h-3.5 w-3.5" />
            {modeInfo.label}
          </div>

          {/* Recalculate button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRecalculate}
            disabled={recalculating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", recalculating && "animate-spin")} />
            {recalculating ? 'Recalculando...' : 'Recalcular Pesos'}
          </motion.button>
        </div>
      </motion.div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Sugestões */}
        <MetricCard title="Total Sugestões" icon={Target} color="#3b82f6" index={0}>
          <p className="text-2xl font-black text-foreground leading-none">{stats.totalSugestoes}</p>
          <div className="flex items-center gap-3 pt-2 border-t border-border/40 text-[10px]">
            <span className="flex items-center gap-1 text-emerald-500">
              <CheckCircle className="h-3 w-3" /> {stats.totalAceites} aceitos
            </span>
            <span className="flex items-center gap-1 text-rose-500">
              <XCircle className="h-3 w-3" /> {stats.totalRecusas} recusados
            </span>
          </div>
        </MetricCard>

        {/* Taxa de Aceite */}
        <MetricCard title="Taxa de Aceite" icon={TrendingUp} color="#10b981" index={1}>
          <div className="flex items-center gap-4">
            <div className="relative">
              <MiniRing pct={stats.taxaGlobalAceite} color="#10b981" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-black text-foreground">{stats.taxaGlobalAceite}%</span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-black text-foreground leading-none">{stats.taxaGlobalAceite}%</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">conversão global</p>
            </div>
          </div>
        </MetricCard>

        {/* Confiança Global */}
        <MetricCard title="Índice de Confiança" icon={Brain} color="#8b5cf6" index={2}>
          <div className="flex items-center gap-4">
            <div className="relative">
              <MiniRing pct={stats.globalConfidence} color="#8b5cf6" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-black text-foreground">{stats.globalConfidence}</span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-black text-foreground leading-none">{stats.globalConfidence}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {stats.globalConfidence < 40 ? 'Regras fixas' : stats.globalConfidence < 70 ? 'Modo híbrido' : 'IA priorizada'}
              </p>
            </div>
          </div>
        </MetricCard>

        {/* Recomendações Premium */}
        <MetricCard title="Classes Premium" icon={Award} color="#f59e0b" index={3}>
          <p className="text-2xl font-black text-foreground leading-none">{stats.premiumCount}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Classes com taxa &gt; 60%</p>
          {stats.lastRecalculation && (
            <div className="flex items-center gap-1 pt-2 border-t border-border/40 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              Último cálculo: {new Date(stats.lastRecalculation).toLocaleDateString('pt-BR')}
            </div>
          )}
        </MetricCard>
      </div>

      {/* Top Classes Table */}
      {stats.topClasses.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl overflow-hidden"
        >
          <div className="flex items-center gap-2 p-4 border-b border-border/40">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Ranking de Classes por Aceite</span>
          </div>
          <div className="p-4 space-y-2">
            {stats.topClasses.map((w: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-bold text-foreground w-20 truncate">{w.dimension_value}</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: w.is_premium ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : 'linear-gradient(90deg, #6366f1, #8b5cf6)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(w.taxa_aceite || 0, 100)}%` }}
                    transition={{ duration: 1, delay: 0.4 + i * 0.08 }}
                  />
                </div>
                <span className="text-[10px] font-bold text-foreground w-10 text-right">{Math.round(w.taxa_aceite || 0)}%</span>
                {w.is_premium && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30">
                    PREMIUM
                  </span>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Engine Status Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/15"
      >
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            className={cn("w-2 h-2 rounded-full", stats.engineEnabled ? "bg-emerald-500" : "bg-rose-500")}
          />
          <span className="text-[10px] text-muted-foreground font-mono">
            MOTOR {stats.engineEnabled ? 'ATIVO' : 'DESATIVADO'} · MODO {stats.engineMode?.toUpperCase()} · CONFIANÇA {stats.globalConfidence}%
          </span>
        </div>
      </motion.div>
    </div>
  );
}
