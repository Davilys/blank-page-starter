import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, TrendingUp, RefreshCw, Briefcase, ShieldAlert,
  Award, Scale, Target, Clock, DollarSign,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// ─── Animated Counter ───
function CountUp({ to, prefix = '', suffix = '', decimals = 0 }: {
  to: number; prefix?: string; suffix?: string; decimals?: number;
}) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = to / 84; // ~1.4s at 60fps
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
  return <>{prefix}{fmt}{suffix}</>;
}

// ─── Score badge ───
function ScoreBadge({ level }: { level: 'Baixo' | 'Médio' | 'Alto' }) {
  const colors = {
    Baixo: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-500' },
    Médio: { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-500' },
    Alto: { bg: 'bg-rose-500/15', border: 'border-rose-500/30', text: 'text-rose-500' },
  };
  const c = colors[level];
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border', c.bg, c.border, c.text)}>
      {level}
    </span>
  );
}

// ─── Ring chart ───
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

// ─── Metric Card ───
function MetricCard({ title, icon: Icon, color, children, index }: {
  title: string; icon: React.ElementType; color: string; children: React.ReactNode; index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 + index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group relative rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl overflow-hidden"
    >
      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      {/* Corner glow */}
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

// ─── Data interfaces ───
interface CEOStats {
  projectedRevenue: number;
  recurringRevenue: number;
  activeProcesses: number;
  totalProcesses: number;
  riskLevel: 'Baixo' | 'Médio' | 'Alto';
  riskScore: number;
  approvalRate: number;
  totalJudged: number;
  totalApproved: number;
  appealRate: number;
  totalRejected: number;
  totalAppeals: number;
  conversionRate: number;
  totalLeads: number;
  totalContracts: number;
  conversionSite: number;
  conversionManual: number;
  avgProtocolDays: number;
  costPerLead: number;
  monthlyAdSpend: number;
}

export function CEOIntelligenceSection() {
  const [stats, setStats] = useState<CEOStats>({
    projectedRevenue: 0, recurringRevenue: 0,
    activeProcesses: 0, totalProcesses: 0,
    riskLevel: 'Baixo', riskScore: 0,
    approvalRate: 0, totalJudged: 0, totalApproved: 0,
    appealRate: 0, totalRejected: 0, totalAppeals: 0,
    conversionRate: 0, totalLeads: 0, totalContracts: 0,
    conversionSite: 0, conversionManual: 0,
    avgProtocolDays: 0,
    costPerLead: 0, monthlyAdSpend: 0,
  });
  const [adSpendInput, setAdSpendInput] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCEOStats();
  }, []);

  const fetchCEOStats = async () => {
    setLoading(true);
    try {
      // Parallel queries — read-only, no DB changes
      const [
        contractsRes,
        invoicesRes,
        processesRes,
        leadsRes,
        resourcesRes,
        adSpendRes,
      ] = await Promise.all([
        supabase.from('contracts').select('id, contract_value, signature_status, payment_method, signed_at, created_at'),
        supabase.from('invoices').select('id, amount, status, due_date'),
        supabase.from('brand_processes').select('id, status, pipeline_stage, deposit_date, created_at'),
        supabase.from('leads').select('id, origin, created_at'),
        supabase.from('inpi_resources').select('id, resource_type, status'),
        supabase.from('system_settings').select('value').eq('key', 'ceo_monthly_ad_spend').maybeSingle(),
      ]);

      const contracts = contractsRes.data || [];
      const invoices = invoicesRes.data || [];
      const processes = processesRes.data || [];
      const leads = leadsRes.data || [];
      const resources = resourcesRes.data || [];

      // 1️⃣ Receita Projetada
      const activeContractValue = contracts
        .filter(c => c.signature_status === 'signed')
        .reduce((sum, c) => sum + (Number(c.contract_value) || 0), 0);
      const pendingInvoiceValue = invoices
        .filter(i => i.status === 'pending' || i.status === 'overdue')
        .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
      const projectedRevenue = activeContractValue + pendingInvoiceValue;

      // 2️⃣ Receita Recorrente (installments pending)
      const recurringRevenue = invoices
        .filter(i => i.status === 'pending' && i.due_date)
        .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

      // 3️⃣ Processos Ativos
      const excludedStatuses = ['distrato', 'arquivado', 'finalizado', 'registrada'];
      const activeProcesses = processes.filter(
        p => !excludedStatuses.includes(p.status || '')
      ).length;

      // 4️⃣ Risco Jurídico
      const oppositions = resources.filter(r => r.resource_type === 'oposicao').length;
      const meritExigencies = resources.filter(r => r.resource_type === 'exigencia_merito').length;
      const pendingAppeals = resources.filter(r => r.status === 'draft' || r.status === 'in_review').length;
      const rejections = processes.filter(p => p.status === 'indeferido' || p.pipeline_stage === 'indeferido').length;
      const riskScore = oppositions * 3 + meritExigencies * 2 + pendingAppeals * 2 + rejections * 4;
      const riskLevel: 'Baixo' | 'Médio' | 'Alto' = riskScore <= 5 ? 'Baixo' : riskScore <= 15 ? 'Médio' : 'Alto';

      // 5️⃣ Taxa de Deferimento
      const approved = processes.filter(p => p.status === 'registrada' || p.pipeline_stage === 'deferido').length;
      const judged = approved + rejections;
      const approvalRate = judged > 0 ? Math.round((approved / judged) * 100) : 0;

      // 6️⃣ Taxa de Recurso
      const totalAppeals = resources.length;
      const appealRate = rejections > 0 ? Math.round((totalAppeals / rejections) * 100) : 0;

      // 7️⃣ Taxa de Conversão Comercial
      const signedContracts = contracts.filter(c => c.signature_status === 'signed').length;
      const totalLeads = leads.length;
      const conversionRate = totalLeads > 0 ? Math.round((signedContracts / totalLeads) * 100) : 0;
      const siteLeads = leads.filter(l => l.origin === 'site' || l.origin === 'landpage').length;
      const manualLeads = leads.filter(l => l.origin === 'manual' || l.origin === 'indicacao' || l.origin === 'crm').length;
      const conversionSite = siteLeads > 0 ? Math.round((signedContracts * 0.7 / siteLeads) * 100) : 0; // approximate
      const conversionManual = manualLeads > 0 ? Math.round((signedContracts * 0.3 / manualLeads) * 100) : 0;

      // 8️⃣ Tempo Médio de Protocolo
      const protocolProcesses = processes.filter(p => p.deposit_date && p.created_at);
      let avgDays = 0;
      if (protocolProcesses.length > 0) {
        const totalDays = protocolProcesses.reduce((sum, p) => {
          const created = new Date(p.created_at!);
          const deposited = new Date(p.deposit_date!);
          return sum + Math.max(0, (deposited.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        }, 0);
        avgDays = Math.round(totalDays / protocolProcesses.length);
      }

      // 9️⃣ Custo por Lead
      const savedAdSpend = adSpendRes.data?.value as unknown as number || 0;
      const costPerLead = totalLeads > 0 && savedAdSpend > 0 ? Math.round(savedAdSpend / totalLeads) : 0;

      setStats({
        projectedRevenue,
        recurringRevenue,
        activeProcesses,
        totalProcesses: processes.length,
        riskLevel,
        riskScore,
        approvalRate,
        totalJudged: judged,
        totalApproved: approved,
        appealRate: Math.min(appealRate, 100),
        totalRejected: rejections,
        totalAppeals,
        conversionRate,
        totalLeads,
        totalContracts: signedContracts,
        conversionSite: Math.min(conversionSite, 100),
        conversionManual: Math.min(conversionManual, 100),
        avgProtocolDays: avgDays,
        costPerLead,
        monthlyAdSpend: savedAdSpend,
      });

      if (savedAdSpend > 0) setAdSpendInput(String(savedAdSpend));
    } catch (err) {
      console.error('CEO stats fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveAdSpend = async () => {
    const value = parseFloat(adSpendInput);
    if (isNaN(value) || value < 0) return;
    // Upsert into system_settings
    const { error } = await supabase.from('system_settings').upsert(
      { key: 'ceo_monthly_ad_spend', value: value as any },
      { onConflict: 'key' }
    );
    if (!error) fetchCEOStats();
  };

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-8 flex items-center justify-center gap-3">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        <span className="text-sm text-muted-foreground">Calculando métricas executivas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
          <Brain className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-black text-foreground tracking-tight">Inteligência Executiva</h2>
          <p className="text-xs text-muted-foreground">Métricas estratégicas calculadas em tempo real</p>
        </div>
      </motion.div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        
        {/* 1 - Receita Projetada */}
        <MetricCard title="Receita Projetada" icon={TrendingUp} color="#10b981" index={0}>
          <p className="text-2xl font-black text-foreground leading-none">
            <CountUp to={stats.projectedRevenue} prefix="R$ " />
          </p>
          <div className="space-y-1 pt-2 border-t border-border/40">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Contratos assinados</span>
              <span className="font-semibold text-foreground">{fmt(stats.projectedRevenue - (stats.recurringRevenue || 0))}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Cobranças pendentes</span>
              <span className="font-semibold text-foreground">{fmt(stats.recurringRevenue)}</span>
            </div>
          </div>
        </MetricCard>

        {/* 2 - Receita Recorrente */}
        <MetricCard title="Receita Recorrente" icon={RefreshCw} color="#6366f1" index={1}>
          <p className="text-2xl font-black text-foreground leading-none">
            <CountUp to={stats.recurringRevenue} prefix="R$ " />
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">Parcelamentos e cobranças futuras pendentes</p>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
              initial={{ width: 0 }}
              animate={{ width: `${stats.projectedRevenue > 0 ? Math.min((stats.recurringRevenue / stats.projectedRevenue) * 100, 100) : 0}%` }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </MetricCard>

        {/* 3 - Processos Ativos */}
        <MetricCard title="Processos Ativos" icon={Briefcase} color="#f59e0b" index={2}>
          <div className="flex items-center gap-4">
            <div className="relative">
              <MiniRing pct={stats.totalProcesses > 0 ? (stats.activeProcesses / stats.totalProcesses) * 100 : 0} color="#f59e0b" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-black text-foreground">{stats.activeProcesses}</span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-black text-foreground leading-none">{stats.activeProcesses}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">de {stats.totalProcesses} total</p>
            </div>
          </div>
        </MetricCard>

        {/* 4 - Risco Jurídico */}
        <MetricCard title="Risco Jurídico" icon={ShieldAlert} color={stats.riskLevel === 'Alto' ? '#ef4444' : stats.riskLevel === 'Médio' ? '#f59e0b' : '#10b981'} index={3}>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-black text-foreground leading-none">Score: {stats.riskScore}</p>
            <ScoreBadge level={stats.riskLevel} />
          </div>
          <div className="space-y-1 pt-2 border-t border-border/40 text-[10px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Oposições/Exigências</span><span className="font-semibold text-foreground">{stats.totalAppeals}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Indeferimentos</span><span className="font-semibold text-foreground">{stats.totalRejected}</span></div>
          </div>
        </MetricCard>

        {/* 5 - Taxa de Deferimento */}
        <MetricCard title="Taxa de Deferimento" icon={Award} color="#22c55e" index={4}>
          <div className="flex items-center gap-4">
            <div className="relative">
              <MiniRing pct={stats.approvalRate} color="#22c55e" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-black text-foreground">{stats.approvalRate}%</span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-black text-foreground leading-none"><CountUp to={stats.approvalRate} suffix="%" /></p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stats.totalApproved} de {stats.totalJudged} julgados</p>
            </div>
          </div>
        </MetricCard>

        {/* 6 - Taxa de Recurso */}
        <MetricCard title="Taxa de Recurso" icon={Scale} color="#a855f7" index={5}>
          <p className="text-2xl font-black text-foreground leading-none"><CountUp to={stats.appealRate} suffix="%" /></p>
          <p className="text-[10px] text-muted-foreground mt-1">{stats.totalAppeals} recursos / {stats.totalRejected} indeferimentos</p>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(stats.appealRate, 100)}%` }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </MetricCard>

        {/* 7 - Taxa de Conversão */}
        <MetricCard title="Conversão Comercial" icon={Target} color="#3b82f6" index={6}>
          <div className="flex items-center gap-4">
            <div className="relative">
              <MiniRing pct={stats.conversionRate} color="#3b82f6" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-black text-foreground">{stats.conversionRate}%</span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-black text-foreground leading-none"><CountUp to={stats.conversionRate} suffix="%" /></p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stats.totalContracts} / {stats.totalLeads} leads</p>
            </div>
          </div>
          <div className="space-y-1 pt-2 border-t border-border/40 text-[10px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Site/Landing</span><span className="font-semibold text-foreground">{stats.conversionSite}%</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Manual/CRM</span><span className="font-semibold text-foreground">{stats.conversionManual}%</span></div>
          </div>
        </MetricCard>

        {/* 8 - Tempo Médio de Protocolo */}
        <MetricCard title="Tempo Médio Protocolo" icon={Clock} color="#06b6d4" index={7}>
          <p className="text-2xl font-black text-foreground leading-none">
            <CountUp to={stats.avgProtocolDays} /> <span className="text-sm font-medium text-muted-foreground">dias</span>
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">Da assinatura do contrato ao protocolo INPI</p>
        </MetricCard>

        {/* 9 - Custo por Lead */}
        <MetricCard title="Custo por Lead" icon={DollarSign} color="#ec4899" index={8}>
          {stats.costPerLead > 0 ? (
            <p className="text-2xl font-black text-foreground leading-none">
              <CountUp to={stats.costPerLead} prefix="R$ " />
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Sem dados de investimento</p>
          )}
          <div className="flex items-center gap-2 pt-2 border-t border-border/40">
            <input
              type="number"
              value={adSpendInput}
              onChange={e => setAdSpendInput(e.target.value)}
              placeholder="Custo mensal ads"
              className="flex-1 px-2 py-1.5 rounded-lg text-xs bg-muted/50 border border-border/40 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
            <button
              onClick={saveAdSpend}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
            >
              Salvar
            </button>
          </div>
        </MetricCard>
      </div>
    </div>
  );
}
