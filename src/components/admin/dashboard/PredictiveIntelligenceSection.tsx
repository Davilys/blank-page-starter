import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, BarChart3, Trophy, TrendingUp, Clock, Shield,
  AlertTriangle, CheckCircle2, Activity, Loader2, RefreshCw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell, PieChart, Pie,
} from 'recharts';

// ─── Types ───
interface PredictiveScore {
  score: number;
  classificacao: string;
  taxa_deferimento: number;
  taxa_recurso: number;
  impacto_oposicao: number;
  impacto_exigencia: number;
  fator_tempo: number;
  tempo_medio_dias: number;
  total_julgados: number;
  total_deferidos: number;
  total_com_recurso: number;
  total_com_oposicao: number;
  total_com_exigencia: number;
}

interface ClassRanking {
  classe: string;
  total: number;
  deferidos: number;
  indeferidos: number;
  arquivados: number;
  tempo_medio: number | null;
  score: number;
}

interface AnnualEvolution {
  ano: number;
  total: number;
  deferidos: number;
  taxa_sucesso: number;
  tempo_medio: number | null;
}

// ─── Animated Counter ───
function CountUp({ to, suffix = '', decimals = 0 }: { to: number; suffix?: string; decimals?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = to / 80;
    const raf = () => {
      start = Math.min(start + step, to);
      setVal(start);
      if (start < to) requestAnimationFrame(raf);
    };
    const t = setTimeout(() => requestAnimationFrame(raf), 200);
    return () => clearTimeout(t);
  }, [to]);
  const fmt = decimals > 0
    ? val.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : Math.round(val).toLocaleString('pt-BR');
  return <>{fmt}{suffix}</>;
}

// ─── Score Gauge ───
function ScoreGauge({ score, classificacao }: { score: number; classificacao: string }) {
  const r = 58;
  const circ = Math.PI * r; // semicircle
  const pct = Math.min(score / 100, 1);
  const dash = pct * circ;

  const getColor = () => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#3b82f6';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const color = getColor();

  return (
    <div className="flex flex-col items-center">
      <svg width={140} height={80} viewBox="0 0 140 80">
        <path
          d="M 12 70 A 58 58 0 0 1 128 70"
          fill="none" stroke="currentColor" strokeWidth={8}
          className="text-border opacity-30"
          strokeLinecap="round"
        />
        <motion.path
          d="M 12 70 A 58 58 0 0 1 128 70"
          fill="none" stroke={color} strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
        />
        <text x="70" y="62" textAnchor="middle" className="fill-foreground text-2xl font-black">
          {Math.round(score)}
        </text>
        <text x="70" y="76" textAnchor="middle" fill={color} className="text-[9px] font-bold">
          {classificacao}
        </text>
      </svg>
    </div>
  );
}

// ─── Metric Mini Card ───
function MiniMetric({ label, value, suffix, icon: Icon, color }: {
  label: string; value: number; suffix?: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground font-medium truncate">{label}</p>
        <p className="text-sm font-black text-foreground"><CountUp to={value} suffix={suffix} decimals={suffix === '%' ? 1 : 0} /></p>
      </div>
    </div>
  );
}

// ─── Risk Badge ───
function RiskBadge({ score }: { score: number }) {
  const config = score >= 80
    ? { label: 'Alta Previsibilidade', color: '#10b981', icon: CheckCircle2 }
    : score >= 60
    ? { label: 'Estável', color: '#3b82f6', icon: Shield }
    : score >= 40
    ? { label: 'Risco Moderado', color: '#f59e0b', icon: AlertTriangle }
    : { label: 'Alto Risco', color: '#ef4444', icon: AlertTriangle };

  const Icon = config.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border"
      style={{ color: config.color, borderColor: `${config.color}40`, background: `${config.color}12` }}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}

// ─── Custom Tooltip ───
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs font-bold text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-[11px] text-muted-foreground">
          <span style={{ color: p.color }} className="font-semibold">{p.name}: </span>
          {typeof p.value === 'number' ? p.value.toLocaleString('pt-BR') : p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Main Component ───
export function PredictiveIntelligenceSection() {
  const [globalScore, setGlobalScore] = useState<PredictiveScore | null>(null);
  const [classRanking, setClassRanking] = useState<ClassRanking[]>([]);
  const [annualEvolution, setAnnualEvolution] = useState<AnnualEvolution[]>([]);
  const [processCount, setProcessCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [scoreRes, rankingRes, evolutionRes, countRes] = await Promise.all([
        supabase.rpc('calculate_predictive_score'),
        supabase.rpc('get_class_ranking'),
        supabase.rpc('get_annual_evolution'),
        supabase.from('intelligence_process_history').select('id', { count: 'exact', head: true }),
      ]);

      if (scoreRes.data) setGlobalScore(scoreRes.data as unknown as PredictiveScore);
      if (rankingRes.data) {
        const parsed = (Array.isArray(rankingRes.data) ? rankingRes.data : []) as unknown as ClassRanking[];
        // Top 10 by total
        setClassRanking(parsed.sort((a, b) => b.total - a.total).slice(0, 10));
      }
      if (evolutionRes.data) setAnnualEvolution((Array.isArray(evolutionRes.data) ? evolutionRes.data : []) as unknown as AnnualEvolution[]);
      setProcessCount(countRes.count || 0);
    } catch (err) {
      console.error('PredictiveIntelligence fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const syncHistory = async () => {
    setSyncing(true);
    try {
      await supabase.rpc('sync_intelligence_history');
      await fetchData();
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derived data
  const totalAtivos = processCount;
  const hasData = globalScore && globalScore.total_julgados > 0;

  // Chart colors
  const BAR_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#ef4444', '#84cc16', '#f97316', '#6366f1'];

  // Prepare class chart data
  const classChartData = classRanking.map(c => ({
    name: c.classe?.length > 15 ? c.classe.substring(0, 15) + '...' : c.classe,
    fullName: c.classe,
    total: c.total,
    deferidos: c.deferidos,
    indeferidos: c.indeferidos,
    taxa: c.score,
  }));

  // Pie data for portfolio
  const pieData = [
    { name: 'Em andamento', value: totalAtivos - (globalScore?.total_julgados || 0), color: '#3b82f6' },
    { name: 'Deferidos', value: globalScore?.total_deferidos || 0, color: '#10b981' },
    { name: 'Indeferidos', value: (globalScore?.total_julgados || 0) - (globalScore?.total_deferidos || 0), color: '#ef4444' },
  ].filter(d => d.value > 0);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-8 flex items-center justify-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Calculando inteligência preditiva...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black text-foreground tracking-tight">Inteligência Preditiva — Fase 1</h2>
            <p className="text-xs text-muted-foreground">
              Motor interno de previsão · {totalAtivos.toLocaleString('pt-BR')} processos analisados
            </p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={syncHistory}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors disabled:opacity-50"
        >
          {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Sincronizar
        </motion.button>
      </motion.div>

      {/* Score + Metrics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Score Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1 rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-5 flex flex-col items-center justify-center gap-3"
        >
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Score Global</p>
          <ScoreGauge score={globalScore?.score || 0} classificacao={globalScore?.classificacao || 'Sem dados'} />
          <RiskBadge score={globalScore?.score || 0} />
          {!hasData && (
            <p className="text-[10px] text-muted-foreground text-center mt-2 leading-tight">
              Motor em aprendizado. Score aumentará conforme processos forem finalizados.
            </p>
          )}
        </motion.div>

        {/* Metrics Grid */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-3"
        >
          <MiniMetric label="Taxa de Deferimento" value={globalScore?.taxa_deferimento || 0} suffix="%" icon={TrendingUp} color="#10b981" />
          <MiniMetric label="Taxa Sucesso Recurso" value={globalScore?.taxa_recurso || 0} suffix="%" icon={Trophy} color="#8b5cf6" />
          <MiniMetric label="Impacto Oposição" value={globalScore?.impacto_oposicao || 0} suffix="%" icon={Shield} color="#f59e0b" />
          <MiniMetric label="Impacto Exigência" value={globalScore?.impacto_exigencia || 0} suffix="%" icon={AlertTriangle} color="#ef4444" />
          <MiniMetric label="Tempo Médio (dias)" value={globalScore?.tempo_medio_dias || 0} icon={Clock} color="#06b6d4" />
          <MiniMetric label="Processos Julgados" value={globalScore?.total_julgados || 0} icon={BarChart3} color="#3b82f6" />
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Deferimento por Classe */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Processos por Área de Atuação</span>
          </div>
          {classChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={classChartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" name="Total" radius={[4, 4, 0, 0]}>
                  {classChartData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">
              <Activity className="h-5 w-5 mr-2" />
              Dados serão exibidos conforme processos forem classificados
            </div>
          )}
        </motion.div>

        {/* Portfolio Indicator */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Carteira Ativa</span>
          </div>
          {pieData.length > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                    <span className="text-[10px] text-muted-foreground">{d.name}: <strong className="text-foreground">{d.value.toLocaleString('pt-BR')}</strong></span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
              Sem dados para exibir
            </div>
          )}
        </motion.div>
      </div>

      {/* Ranking de Classes + Evolução Anual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ranking */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-4 w-4 text-primary" />
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Ranking por Área — Risco</span>
          </div>
          {classRanking.length > 0 ? (
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {classRanking.map((c, i) => {
                const riskColor = c.score >= 80 ? '#10b981' : c.score >= 60 ? '#3b82f6' : c.score >= 40 ? '#f59e0b' : '#ef4444';
                return (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/20 border border-border/30 hover:bg-muted/40 transition-colors">
                    <span className="text-xs font-black text-muted-foreground w-5 text-center">{i + 1}º</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{c.classe || 'Não classificado'}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {c.total} proc · {c.deferidos} def · {c.indeferidos} ind
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${c.score}%`, background: riskColor }} />
                      </div>
                      <span className="text-[10px] font-bold w-8 text-right" style={{ color: riskColor }}>{c.score}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
              Ranking será gerado com dados de processos finalizados
            </div>
          )}
        </motion.div>

        {/* Evolução Anual */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Evolução Anual da Taxa de Sucesso</span>
          </div>
          {annualEvolution.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={annualEvolution} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="ano" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="taxa_sucesso" name="Taxa Sucesso %" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground flex-col gap-2">
              <Activity className="h-5 w-5" />
              <span>Dados anuais serão gerados conforme processos forem finalizados</span>
            </div>
          )}
        </motion.div>
      </div>

      {/* Footer Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-center justify-between px-4 py-2 rounded-xl bg-primary/5 border border-primary/15"
      >
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-primary/60" />
          <span className="text-[10px] text-muted-foreground">
            Score = (Deferimento×0.4) + (Recurso×0.2) + (Oposição×0.2) + (Exigência×0.1) + (Tempo×0.1)
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">
          Motor v1.0 · Aprendizado contínuo
        </span>
      </motion.div>
    </div>
  );
}
