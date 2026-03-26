import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ClientLayout } from '@/components/cliente/ClientLayout';
import { motion } from 'framer-motion';
import {
  BarChart3, Shield, Clock, TrendingUp, AlertTriangle,
  CheckCircle, Info, Activity, Target, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProcessScore {
  processId: string;
  brandName: string;
  processNumber: string | null;
  status: string | null;
  classe: string | null;
  score: number;
  classification: string;
  avgTimeDays: number;
  classSuccessRate: number;
  hasOpposition: boolean;
  hasExigency: boolean;
  hasAppeal: boolean;
  observation: string;
}

interface GlobalClassData {
  score: number;
  taxa_deferimento: number;
  taxa_recurso: number;
  tempo_medio_dias: number;
  total_julgados: number;
  total_deferidos: number;
}

function getScoreColor(score: number) {
  if (score >= 80) return { gradient: 'from-emerald-500 to-green-400', glow: '16 185 129', text: 'text-emerald-400', bg: 'bg-emerald-500/10' };
  if (score >= 60) return { gradient: 'from-blue-500 to-cyan-400', glow: '59 130 246', text: 'text-blue-400', bg: 'bg-blue-500/10' };
  if (score >= 40) return { gradient: 'from-amber-500 to-orange-400', glow: '245 158 11', text: 'text-amber-400', bg: 'bg-amber-500/10' };
  return { gradient: 'from-red-500 to-rose-400', glow: '239 68 68', text: 'text-red-400', bg: 'bg-red-500/10' };
}

function getRiskLabel(score: number) {
  if (score >= 80) return 'Baixo';
  if (score >= 60) return 'Moderado';
  if (score >= 40) return 'Elevado';
  return 'Alto';
}

function getRiskIcon(score: number) {
  if (score >= 80) return CheckCircle;
  if (score >= 60) return Shield;
  if (score >= 40) return AlertTriangle;
  return AlertTriangle;
}

function generateObservation(ps: ProcessScore): string {
  const parts: string[] = [];
  if (ps.classSuccessRate >= 80) parts.push(`Classe com alto índice de deferimento (${ps.classSuccessRate.toFixed(0)}%).`);
  else if (ps.classSuccessRate >= 60) parts.push(`Classe com taxa de deferimento estável (${ps.classSuccessRate.toFixed(0)}%).`);
  else if (ps.classSuccessRate > 0) parts.push(`Classe com taxa de deferimento abaixo da média (${ps.classSuccessRate.toFixed(0)}%).`);
  
  if (ps.hasOpposition) parts.push('Processo com oposição registrada.');
  if (ps.hasExigency) parts.push('Exigência técnica identificada.');
  if (ps.hasAppeal) parts.push('Recurso interposto neste processo.');
  if (ps.avgTimeDays > 0) parts.push(`Tempo médio histórico da classe: ${Math.round(ps.avgTimeDays)} dias.`);
  
  return parts.length > 0 ? parts.join(' ') : 'Dados insuficientes para análise detalhada neste momento.';
}

// Score gauge component
function ScoreGauge({ score, size = 120 }: { score: number; size?: number }) {
  const colors = getScoreColor(score);
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const RiskIcon = getRiskIcon(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={`url(#gauge-grad-${score})`}
          strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
        <defs>
          <linearGradient id={`gauge-grad-${score}`}>
            <stop offset="0%" stopColor={score >= 60 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444'} />
            <stop offset="100%" stopColor={score >= 60 ? '#06b6d4' : score >= 40 ? '#f97316' : '#f43f5e'} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-2xl font-black', colors.text)}>{Math.round(score)}</span>
        <RiskIcon className={cn('h-3.5 w-3.5 mt-0.5', colors.text)} />
      </div>
    </div>
  );
}

// Process score card
function ProcessScoreCard({ ps, index }: { ps: ProcessScore; index: number }) {
  const colors = getScoreColor(ps.score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="relative overflow-hidden rounded-2xl border backdrop-blur-sm"
      style={{
        background: `linear-gradient(135deg, hsl(var(--card)/0.9) 0%, rgb(${colors.glow} / 0.04) 100%)`,
        borderColor: `rgb(${colors.glow} / 0.2)`,
      }}
    >
      <div className={cn('absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r', colors.gradient)} />

      <div className="p-5">
        <div className="flex items-start gap-4">
          <ScoreGauge score={ps.score} size={90} />

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm truncate">{ps.brandName}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ps.processNumber || 'Sem protocolo'}
              {ps.classe && ` • ${ps.classe}`}
            </p>

            <div className="flex items-center gap-2 mt-2">
              <div
                className="px-2.5 py-1 rounded-full text-[10px] font-bold"
                style={{
                  background: `rgb(${colors.glow} / 0.15)`,
                  color: `rgb(${colors.glow})`,
                  border: `1px solid rgb(${colors.glow} / 0.3)`,
                }}
              >
                Risco {getRiskLabel(ps.score)}
              </div>
              {ps.hasOpposition && (
                <div className="px-2 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  Oposição
                </div>
              )}
              {ps.hasAppeal && (
                <div className="px-2 py-1 rounded-full text-[10px] font-bold bg-violet-500/10 text-violet-500 border border-violet-500/20">
                  Recurso
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/30">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
            </div>
            <p className="text-sm font-bold">{ps.classSuccessRate > 0 ? `${ps.classSuccessRate.toFixed(0)}%` : '—'}</p>
            <p className="text-[10px] text-muted-foreground">Sucesso na classe</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
            </div>
            <p className="text-sm font-bold">{ps.avgTimeDays > 0 ? `${Math.round(ps.avgTimeDays)}d` : '—'}</p>
            <p className="text-[10px] text-muted-foreground">Tempo médio</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Target className="h-3 w-3 text-muted-foreground" />
            </div>
            <p className="text-sm font-bold">{Math.round(ps.score)}/100</p>
            <p className="text-[10px] text-muted-foreground">Score</p>
          </div>
        </div>

        {/* Observation */}
        <div className="mt-3 p-3 rounded-xl bg-muted/30 border border-border/20">
          <div className="flex items-start gap-2">
            <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">{ps.observation}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function AnaliseInteligente() {
  const [processScores, setProcessScores] = useState<ProcessScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalScore, setGlobalScore] = useState<GlobalClassData | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Fetch user's processes
      const { data: processes } = await supabase
        .from('brand_processes')
        .select('id, brand_name, process_number, status, pipeline_stage, ncl_classes, business_area')
        .eq('user_id', session.user.id);

      if (!processes || processes.length === 0) {
        setProcessScores([]);
        setLoading(false);
        return;
      }

      // Fetch global predictive score (no class filter)
      const { data: globalData } = await supabase.rpc('calculate_predictive_score');
      if (globalData) {
        setGlobalScore(globalData as unknown as GlobalClassData);
      }

      // Calculate individual scores per process
      const scores: ProcessScore[] = [];

      for (const proc of processes) {
        // Skip finalized (archived/distrato)
        if (proc.status === 'arquivado' || proc.pipeline_stage === 'arquivado') continue;

        const classe = proc.ncl_classes && proc.ncl_classes.length > 0
          ? `NCL ${proc.ncl_classes[0]}`
          : proc.business_area || null;

        // Fetch class-specific score
        const { data: classScore } = await supabase.rpc('calculate_predictive_score', {
          p_classe: classe
        });

        const cs = classScore as unknown as {
          score: number;
          taxa_deferimento: number;
          taxa_recurso: number;
          tempo_medio_dias: number;
          impacto_oposicao: number;
          impacto_exigencia: number;
          total_julgados: number;
        } | null;

        // Check if process has opposition/exigency/appeal
        let hasOpposition = false;
        let hasExigency = false;
        let hasAppeal = false;

        if (proc.process_number) {
          const { data: resources } = await supabase
            .from('inpi_resources')
            .select('resource_type')
            .eq('process_number', proc.process_number);

          if (resources) {
            hasOpposition = resources.some(r => r.resource_type === 'oposicao');
            hasExigency = resources.some(r => r.resource_type?.includes('exigencia'));
            hasAppeal = resources.some(r => r.resource_type === 'recurso');
          }
        }

        // Adjust score based on individual factors
        let baseScore = cs?.score || 50;
        
        // Adjustments
        if (hasOpposition) baseScore -= 8;
        if (hasExigency) baseScore -= 5;
        if (hasAppeal) baseScore += 3; // Appeal shows proactive defense

        // Brand type factor (nominativa is baseline)
        // Since we don't store brand type in processes, use baseline

        baseScore = Math.max(0, Math.min(100, baseScore));

        const ps: ProcessScore = {
          processId: proc.id,
          brandName: proc.brand_name,
          processNumber: proc.process_number,
          status: proc.status,
          classe,
          score: baseScore,
          classification: baseScore >= 80 ? 'Alta previsibilidade' : baseScore >= 60 ? 'Estável' : baseScore >= 40 ? 'Risco moderado' : 'Alto risco',
          avgTimeDays: cs?.tempo_medio_dias || 0,
          classSuccessRate: cs?.taxa_deferimento || 0,
          hasOpposition,
          hasExigency,
          hasAppeal,
          observation: '',
        };
        ps.observation = generateObservation(ps);

        scores.push(ps);
      }

      // Sort by score ascending (worst first for attention)
      scores.sort((a, b) => a.score - b.score);
      setProcessScores(scores);
    } catch (err) {
      console.error('Error loading analysis:', err);
    } finally {
      setLoading(false);
    }
  }

  const avgScore = processScores.length > 0
    ? processScores.reduce((sum, p) => sum + p.score, 0) / processScores.length
    : 0;

  const avgColors = getScoreColor(avgScore);

  return (
    <ClientLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">📊 Análise Inteligente</h1>
              <p className="text-xs text-muted-foreground">
                Score individual dos seus processos baseado em dados históricos
              </p>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 rounded-2xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : processScores.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 rounded-2xl border border-border/30 bg-card/50"
          >
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">Nenhum processo ativo</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Quando você tiver processos em andamento, as análises aparecerão aqui.
            </p>
          </motion.div>
        ) : (
          <>
            {/* Portfolio Overview Card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="relative overflow-hidden rounded-2xl border backdrop-blur-sm p-6"
              style={{
                background: `linear-gradient(135deg, hsl(var(--card)/0.9) 0%, rgb(${avgColors.glow} / 0.06) 100%)`,
                borderColor: `rgb(${avgColors.glow} / 0.2)`,
              }}
            >
              <div className={cn('absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r', avgColors.gradient)} />

              <div className="flex items-center gap-6">
                <ScoreGauge score={avgScore} size={110} />
                <div className="flex-1">
                  <h2 className="font-bold text-lg">Visão Geral da Carteira</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Score médio: <span className={cn('font-bold', avgColors.text)}>{Math.round(avgScore)}/100</span>
                    {' • '}Risco {getRiskLabel(avgScore)}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    <div>
                      <p className="text-lg font-bold">{processScores.length}</p>
                      <p className="text-[10px] text-muted-foreground">Processos ativos</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-emerald-400">
                        {processScores.filter(p => p.score >= 60).length}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Favoráveis</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-amber-400">
                        {processScores.filter(p => p.score >= 40 && p.score < 60).length}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Atenção</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-red-400">
                        {processScores.filter(p => p.score < 40).length}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Risco alto</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Process Cards */}
            <div className="space-y-4">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Análise por Processo
              </h2>
              {processScores.map((ps, i) => (
                <ProcessScoreCard key={ps.processId} ps={ps} index={i} />
              ))}
            </div>

            {/* Legal Disclaimer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  <strong className="text-amber-500">Aviso Legal:</strong> Indicador baseado em dados históricos internos e públicos.
                  Não representa garantia de resultado. As estimativas são calculadas com base em padrões estatísticos
                  observados e podem variar conforme decisões do INPI.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </ClientLayout>
  );
}
