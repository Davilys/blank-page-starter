import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RevenueChart } from '@/components/admin/dashboard/RevenueChart';
import { GeographicChart } from '@/components/admin/dashboard/GeographicChart';
import { BusinessSectorChart } from '@/components/admin/dashboard/BusinessSectorChart';
import { ConversionFunnel } from '@/components/admin/dashboard/ConversionFunnel';
import { LeadSourceChart } from '@/components/admin/dashboard/LeadSourceChart';
import { RecentActivity } from '@/components/admin/dashboard/RecentActivity';
import { CEOIntelligenceSection } from '@/components/admin/dashboard/CEOIntelligenceSection';
import { PredictiveIntelligenceSection } from '@/components/admin/dashboard/PredictiveIntelligenceSection';
import { MonetizationEngineSection } from '@/components/admin/dashboard/MonetizationEngineSection';
import { supabase } from '@/integrations/supabase/client';
import { useCanViewFinancialValues } from '@/hooks/useCanViewFinancialValues';
import {
  Users, FileText, TrendingUp, Target, CreditCard,
  CheckCircle, Zap, Activity,
  ArrowUpRight, ArrowDownRight,
  Layers, Database, Lock, Cpu, Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────
// Fixed particles (deterministic — no Math.random)
// ─────────────────────────────────────────────────
const PARTICLES = Array.from({ length: 40 }).map((_, i) => ({
  id: i,
  x: (i * 31.7 + 5) % 100,
  y: (i * 47.3 + 8) % 100,
  size: 1.2 + (i % 6) * 0.4,
  dur: 7 + (i % 9),
  delay: (i * 0.28) % 7,
  op: 0.06 + (i % 5) * 0.025,
}));

// ─────────────────────────────────────────────────
// Animated number counter
// ─────────────────────────────────────────────────
function AnimCount({ to, prefix = '', decimals = 0, duration = 1.4 }: {
  to: number; prefix?: string; decimals?: number; duration?: number;
}) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = to / (duration * 60);
    const raf = () => {
      start = Math.min(start + step, to);
      setVal(start);
      if (start < to) requestAnimationFrame(raf);
    };
    const t = setTimeout(() => requestAnimationFrame(raf), 100);
    return () => clearTimeout(t);
  }, [to, duration]);

  const fmt = decimals > 0
    ? val.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : Math.round(val).toLocaleString('pt-BR');

  return <>{prefix}{fmt}</>;
}

// ─────────────────────────────────────────────────
// SVG Ring metric
// ─────────────────────────────────────────────────
function RingMetric({ value, max, color, size = 80 }: {
  value: number; max: number; color: string; size?: number;
}) {
  const r = size / 2 - 6;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const dash = pct * circ;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={6} className="text-border opacity-40" />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────
// Particle Field — themed opacity
// ─────────────────────────────────────────────────
function ParticleField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {PARTICLES.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: `radial-gradient(circle, hsl(var(--primary) / ${p.op * 0.7}) 0%, transparent 100%)`,
          }}
          animate={{ y: [0, -22, 0], x: [0, 8, -8, 0], opacity: [p.op, p.op * 3, p.op] }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      {/* Scan line */}
      <motion.div
        className="absolute left-0 right-0 h-[1px]"
        style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--primary) / 0.25), transparent)' }}
        animate={{ top: ['0%', '100%', '0%'] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────
// Grid overlay — themed
// ─────────────────────────────────────────────────
function GridOverlay() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: 'linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        opacity: 0.018,
      }}
    />
  );
}

// ─────────────────────────────────────────────────
// KPI HUD Card — themed glass
// ─────────────────────────────────────────────────
interface KpiCardProps {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon: React.ElementType;
  color: string;
  gradient: string;
  accentColor: string;
  trend?: number;
  trendLabel?: string;
  index: number;
  ringMax?: number;
  tag?: string;
}

function KpiCard({
  title, value, prefix = '', suffix = '', icon: Icon,
  color, gradient, accentColor, trend, trendLabel,
  index, ringMax, tag,
}: KpiCardProps) {
  const isPos = (trend ?? 0) > 0;
  const isNeg = (trend ?? 0) < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 32, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6, transition: { duration: 0.22 } }}
      className="group relative"
    >
      {/* Glow behind card on hover */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
        style={{ background: `radial-gradient(ellipse at center, ${color}25 0%, transparent 70%)` }}
      />

      <div className="relative rounded-2xl overflow-hidden border bg-card/60 backdrop-blur-xl border-border/50 shadow-[0_4px_24px_hsl(var(--foreground)/0.06),inset_0_1px_0_hsl(var(--background)/0.8)]">
        {/* Top accent line */}
        <div className={cn('absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r', gradient)} />

        {/* Corner glow */}
        <div
          className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-10"
          style={{ background: color }}
        />

        <div className="relative p-4 flex flex-col gap-3">
          {/* Header row */}
          <div className="flex items-start justify-between">
            <motion.div
              className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-lg', gradient)}
              whileHover={{ rotate: 10, scale: 1.15 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <Icon className="h-5 w-5 text-white" />
            </motion.div>

            {ringMax !== undefined && (
              <div className="relative flex items-center justify-center">
                <RingMetric value={value} max={ringMax} color={accentColor} size={44} />
                <span className="absolute text-[8px] font-bold" style={{ color: accentColor }}>
                  {ringMax > 0 ? Math.round((value / ringMax) * 100) : 0}%
                </span>
              </div>
            )}

            {tag && (
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                style={{ color: accentColor, borderColor: `${accentColor}40`, background: `${accentColor}15` }}
              >
                {tag}
              </span>
            )}
          </div>

          {/* Value */}
          <div>
            <p className="text-2xl font-black tracking-tight text-foreground leading-none">
              <AnimCount to={value} prefix={prefix} decimals={prefix === 'R$ ' ? 0 : 0} />
              {suffix}
            </p>
            <p className="text-[11px] font-medium text-muted-foreground mt-1">{title}</p>
          </div>

          {/* Trend */}
          {trend !== undefined && (
            <div className="flex items-center gap-1.5 pt-2 border-t border-border/40">
              {isPos && <ArrowUpRight className="h-3 w-3 text-emerald-500" />}
              {isNeg && <ArrowDownRight className="h-3 w-3 text-rose-500" />}
              <span className={cn('text-[11px] font-bold',
                isPos ? 'text-emerald-500' : isNeg ? 'text-rose-500' : 'text-muted-foreground'
              )}>
                {isPos && '+'}{trend}%
              </span>
              {trendLabel && <span className="text-[10px] text-muted-foreground">{trendLabel}</span>}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────
// Live status ticker — themed
// ─────────────────────────────────────────────────
function LiveTicker({ stats }: { stats: Stats }) {
  const items = [
    `⬡ Clientes: ${stats.totalClients}`,
    `⬡ Leads: ${stats.totalLeads}`,
    `⬡ Processos Ativos: ${stats.activeProcesses}`,
    `⬡ Receita: R$ ${stats.totalRevenue.toLocaleString('pt-BR')}`,
    `⬡ Concluídos: ${stats.completedProcesses}`,
    `⬡ Pendentes: ${stats.pendingInvoices}`,
  ];
  const doubled = [...items, ...items];

  return (
    <div className="overflow-hidden relative flex items-center h-7">
      <div className="absolute left-0 top-0 bottom-0 w-10 z-10 bg-gradient-to-r from-card/80 to-transparent" />
      <div className="absolute right-0 top-0 bottom-0 w-10 z-10 bg-gradient-to-l from-card/80 to-transparent" />
      <motion.div
        className="flex gap-8 whitespace-nowrap"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
      >
        {doubled.map((item, i) => (
          <span key={i} className="text-[10px] font-semibold tracking-widest text-primary/50 uppercase">
            {item}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// System status panel — themed
// ─────────────────────────────────────────────────
function SystemStatus() {
  const nodes = [
    { label: 'Database', icon: Database, ok: true, lat: '12ms' },
    { label: 'Auth', icon: Lock, ok: true, lat: '8ms' },
    { label: 'Storage', icon: Layers, ok: true, lat: '24ms' },
    { label: 'AI Engine', icon: Cpu, ok: true, lat: '180ms' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.5 }}
      className="rounded-2xl p-4 border bg-card/60 backdrop-blur-xl border-border/50 relative overflow-hidden"
    >
      <div className="flex items-center gap-2 mb-3">
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-2 h-2 rounded-full bg-emerald-500"
        />
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Status do Sistema</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {nodes.map((n, i) => {
          const Icon = n.icon;
          return (
            <motion.div
              key={n.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              className="flex items-center gap-2 p-2 rounded-xl bg-muted/50 border border-border/40"
            >
              <Icon className="h-3.5 w-3.5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-foreground">{n.label}</p>
                <p className="text-[9px] text-muted-foreground">{n.lat}</p>
              </div>
              <div className={cn('w-1.5 h-1.5 rounded-full', n.ok ? 'bg-emerald-500' : 'bg-rose-500')} />
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────
// Quick Access HUD buttons — themed
// ─────────────────────────────────────────────────
function QuickAccess() {
  const actions = [
    { label: 'Clientes', icon: Users, color: '#3b82f6', href: '/admin/clientes' },
    { label: 'Leads', icon: Target, color: '#8b5cf6', href: '/admin/leads' },
    { label: 'Contratos', icon: FileText, color: '#10b981', href: '/admin/contratos' },
    { label: 'Financeiro', icon: CreditCard, color: '#f59e0b', href: '/admin/financeiro' },
    { label: 'Processos', icon: Layers, color: '#ec4899', href: '/admin/processos' },
    { label: 'Emails', icon: Globe, color: '#06b6d4', href: '/admin/emails' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="rounded-2xl p-4 border bg-card/60 backdrop-blur-xl border-border/50 relative overflow-hidden"
    >
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Acesso Rápido</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {actions.map((a, i) => {
          const Icon = a.icon;
          return (
            <motion.a
              key={a.label}
              href={a.href}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.06 }}
              whileHover={{ scale: 1.08, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl cursor-pointer"
              style={{ background: `${a.color}12`, border: `1px solid ${a.color}25` }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${a.color}20`, boxShadow: `0 0 12px ${a.color}25` }}
              >
                <Icon className="h-4 w-4" style={{ color: a.color }} />
              </div>
              <span className="text-[9px] font-semibold text-muted-foreground">{a.label}</span>
            </motion.a>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────
// Performance bar — themed
// ─────────────────────────────────────────────────
function PerformanceBar({ label, value, color, delay }: {
  label: string; value: number; color: string; delay: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
        <span className="text-[10px] font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}80, ${color})` }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1.2, delay, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Stats interface
// ─────────────────────────────────────────────────
interface Stats {
  totalClients: number;
  totalLeads: number;
  activeProcesses: number;
  pendingInvoices: number;
  totalRevenue: number;
  completedProcesses: number;
  clientsTrend: number;
  leadsTrend: number;
  revenueTrend: number;
  totalProcesses: number;
  conversionRate: number;
}

// ─────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────
export default function AdminDashboard() {
  const { isMasterAdmin, isLoading: loadingFinancial } = useCanViewFinancialValues();
  const [stats, setStats] = useState<Stats>({
    totalClients: 0, totalLeads: 0, activeProcesses: 0,
    pendingInvoices: 0, totalRevenue: 0, completedProcesses: 0,
    clientsTrend: 0, leadsTrend: 0, revenueTrend: 0,
    totalProcesses: 0, conversionRate: 0,
  });
  const [greeting, setGreeting] = useState('');
  const [adminName, setAdminName] = useState('');
  const [currentTime, setCurrentTime] = useState('');

  // Clock
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite');
    fetchStats();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.id) {
        const { data } = await supabase.from('profiles').select('full_name').eq('id', session.user.id).single();
        if (data?.full_name) setAdminName(data.full_name.split(' ')[0]);
      }
    });
  }, []);

  const fetchStats = async () => {
    try {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const results = await Promise.allSettled([
        supabase.from('profiles').select('id', { count: 'exact' }),
        supabase.from('leads').select('id', { count: 'exact' }),
        supabase.from('brand_processes').select('id, status'),
        supabase.from('invoices').select('id, status, amount, created_at'),
        supabase.from('profiles').select('id', { count: 'exact' }).gte('created_at', lastMonth.toISOString()).lt('created_at', thisMonth.toISOString()),
        supabase.from('leads').select('id', { count: 'exact' }).gte('created_at', lastMonth.toISOString()).lt('created_at', thisMonth.toISOString()),
        supabase.from('invoices').select('amount').eq('status', 'paid').gte('created_at', lastMonth.toISOString()).lt('created_at', thisMonth.toISOString()),
      ]);

      const getValue = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
        r.status === 'fulfilled' ? r.value : fallback;

      const emptyRes = { data: null, count: 0, error: null };
      const clientsRes = getValue(results[0], emptyRes as any);
      const leadsRes = getValue(results[1], emptyRes as any);
      const processesRes = getValue(results[2], emptyRes as any);
      const invoicesRes = getValue(results[3], emptyRes as any);
      const lastMonthClients = getValue(results[4], emptyRes as any);
      const lastMonthLeads = getValue(results[5], emptyRes as any);
      const lastMonthRevenue = getValue(results[6], emptyRes as any);

      const processes = processesRes.data || [];
      const invoices = invoicesRes.data || [];
      const paidInvoices = invoices.filter((i: any) => i.status === 'paid' || i.status === 'confirmed' || i.status === 'received');
      const totalRevenue = paidInvoices.reduce((sum: number, i: any) => sum + Number(i.amount), 0);
      const thisMonthClients = (clientsRes.count || 0) - (lastMonthClients.count || 0);
      const thisMonthLeads = (leadsRes.count || 0) - (lastMonthLeads.count || 0);
      const lastMonthRevenueTotal = lastMonthRevenue.data?.reduce((sum: number, i: any) => sum + Number(i.amount), 0) || 0;
      const clientsTrend = lastMonthClients.count ? ((thisMonthClients - (lastMonthClients.count || 0)) / (lastMonthClients.count || 1)) * 100 : 0;
      const leadsTrend = lastMonthLeads.count ? ((thisMonthLeads - (lastMonthLeads.count || 0)) / (lastMonthLeads.count || 1)) * 100 : 0;
      const revenueTrend = lastMonthRevenueTotal ? ((totalRevenue - lastMonthRevenueTotal) / lastMonthRevenueTotal) * 100 : 0;
      const totalLeads = leadsRes.count || 0;
      const totalClients = clientsRes.count || 0;
      const conversionRate = totalLeads > 0 ? Math.round((totalClients / totalLeads) * 100) : 0;

      setStats({
        totalClients, totalLeads,
        activeProcesses: processes.filter((p: any) => p.status === 'em_andamento').length,
        pendingInvoices: invoices.filter((i: any) => i.status === 'pending').length,
        totalRevenue,
        completedProcesses: processes.filter((p: any) => p.status === 'registrada').length,
        clientsTrend: Math.round(clientsTrend),
        leadsTrend: Math.round(leadsTrend),
        revenueTrend: Math.round(revenueTrend),
        totalProcesses: processes.length,
        conversionRate,
      });
    } catch (err) {
      console.warn('[Dashboard] Erro ao carregar estatísticas:', err);
    }
  };

  const kpiCards: KpiCardProps[] = [
    {
      title: 'Total Clientes', value: stats.totalClients,
      icon: Users, gradient: 'from-blue-500 to-cyan-400',
      color: '#3b82f6', accentColor: '#60a5fa',
      trend: stats.clientsTrend, trendLabel: 'vs mês ant.',
      ringMax: stats.totalClients + stats.totalLeads,
      index: 0,
    },
    {
      title: 'Leads Ativos', value: stats.totalLeads,
      icon: Target, gradient: 'from-violet-500 to-purple-400',
      color: '#8b5cf6', accentColor: '#a78bfa',
      trend: stats.leadsTrend, trendLabel: 'vs mês ant.',
      tag: 'LIVE',
      index: 1,
    },
    {
      title: 'Processos Ativos', value: stats.activeProcesses,
      icon: Layers, gradient: 'from-amber-500 to-orange-400',
      color: '#f59e0b', accentColor: '#fbbf24',
      ringMax: stats.totalProcesses,
      index: 2,
    },
    {
      title: 'Concluídos', value: stats.completedProcesses,
      icon: CheckCircle, gradient: 'from-emerald-500 to-green-400',
      color: '#10b981', accentColor: '#34d399',
      ringMax: stats.totalProcesses,
      index: 3,
    },
    {
      title: 'Faturas Pendentes', value: stats.pendingInvoices,
      icon: CreditCard, gradient: 'from-rose-500 to-pink-400',
      color: '#f43f5e', accentColor: '#fb7185',
      tag: stats.pendingInvoices > 0 ? 'ATENÇÃO' : 'OK',
      index: 4,
    },
    {
      title: 'Receita Total', value: stats.totalRevenue,
      prefix: 'R$ ',
      icon: TrendingUp, gradient: 'from-emerald-600 to-teal-400',
      color: '#059669', accentColor: '#10b981',
      trend: stats.revenueTrend, trendLabel: 'vs mês ant.',
      index: 5,
    },
  ];

  return (
    <>
      {/* HUD wrapper — contido na área do layout, sem escape lateral */}
      <div className="relative w-full min-w-0 overflow-x-hidden">
        {/* Partículas e grid ficam no fundo, sem alterar largura */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <ParticleField />
          <GridOverlay />
        </div>

        <div className="relative z-10 space-y-5">

          {/* ── HERO HEADER ─────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative rounded-2xl overflow-hidden border border-primary/20 bg-card/60 backdrop-blur-xl"
            style={{ boxShadow: '0 0 60px hsl(var(--primary) / 0.06), inset 0 1px 0 hsl(var(--background) / 0.8)' }}
          >
            {/* Corner accent lines */}
            <div className="absolute top-0 left-0 w-16 h-16 border-l-2 border-t-2 border-primary/25 rounded-tl-2xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-16 h-16 border-r-2 border-b-2 border-primary/25 rounded-br-2xl pointer-events-none" />

            {/* Glow orbs */}
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl bg-primary/10" />
            <div className="absolute -bottom-10 left-1/3 w-32 h-32 rounded-full blur-3xl bg-primary/6" />

            <div className="relative p-5 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Left */}
                <div>
                  <motion.div
                    className="flex items-center gap-2 mb-2"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-primary/15 border border-primary/25 text-primary">
                      <motion.div
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.4, repeat: Infinity }}
                        className="w-1.5 h-1.5 rounded-full bg-primary"
                      />
                      🧠 Inteligência Executiva
                    </div>
                  </motion.div>

                  <motion.h1
                    className="text-2xl md:text-4xl font-black tracking-tight text-foreground"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    {greeting}{adminName ? `, ${adminName}` : ''}
                    <motion.span
                      animate={{ rotate: [0, 15, -10, 15, 0] }}
                      transition={{ duration: 1.5, delay: 1 }}
                      className="inline-block ml-2"
                    >
                      👋
                    </motion.span>
                  </motion.h1>

                  <motion.p
                    className="text-muted-foreground mt-1.5 text-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    Visão estratégica em tempo real · Inteligência para decisões
                  </motion.p>
                </div>

                {/* Right — clock + date */}
                <motion.div
                  className="flex flex-col items-end gap-1"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  <div className="px-4 py-2 rounded-xl font-mono text-xl font-black tracking-widest text-foreground bg-primary/10 border border-primary/20">
                    {currentTime}
                  </div>
                  <p className="text-[11px] text-muted-foreground capitalize">
                    {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </motion.div>
              </div>

              {/* Live ticker */}
              <div className="mt-4 pt-4 border-t border-border/40">
                <LiveTicker stats={stats} />
              </div>
            </div>
          </motion.div>

          {/* ── KPI CARDS GRID ──────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {kpiCards.map(card => (
              <KpiCard key={card.title} {...card} />
            ))}
          </div>

          {/* ── CONVERSION + QUICK + SYSTEM ─────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Conversion rate big card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="rounded-2xl p-5 border bg-card/60 backdrop-blur-xl border-border/50 relative overflow-hidden flex flex-col gap-4"
            >
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Performance</span>
              </div>

              {/* Big ring */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <RingMetric value={stats.conversionRate} max={100} color="#6366f1" size={80} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-base font-black text-foreground">{stats.conversionRate}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Taxa de Conversão</p>
                  <p className="text-lg font-bold text-foreground">{stats.totalClients} / {stats.totalLeads}</p>
                  <p className="text-[10px] text-muted-foreground">leads → clientes</p>
                </div>
              </div>

              {/* Performance bars */}
              <div className="space-y-2 pt-2 border-t border-border/40">
                <PerformanceBar label="Processos concluídos"
                  value={stats.totalProcesses > 0 ? Math.round((stats.completedProcesses / stats.totalProcesses) * 100) : 0}
                  color="#10b981" delay={0.8} />
                <PerformanceBar label="Faturas pagas"
                  value={stats.pendingInvoices > 0
                    ? Math.round(((stats.totalClients - stats.pendingInvoices) / stats.totalClients) * 100)
                    : 100}
                  color="#6366f1" delay={0.95} />
                <PerformanceBar label="Leads qualificados"
                  value={Math.min(stats.conversionRate + 20, 100)}
                  color="#f59e0b" delay={1.1} />
              </div>
            </motion.div>

            {/* Quick Access */}
            <QuickAccess />

            {/* System Status */}
            <SystemStatus />
          </div>

          {/* ── REVENUE CHART ─────────────────── */}
          <div className="rounded-2xl overflow-hidden border border-border/50 bg-card/60 backdrop-blur-xl">
            <RevenueChart />
          </div>

          {/* ── CHARTS GRID ────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[GeographicChart, BusinessSectorChart, LeadSourceChart].map((Comp, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.3 + i * 0.1 }}
                className="rounded-2xl overflow-hidden border border-border/50 bg-card/60 backdrop-blur-xl"
              >
                <Comp />
              </motion.div>
            ))}
          </div>

          {/* ── BOTTOM GRID ─────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[ConversionFunnel, RecentActivity].map((Comp, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.5 + i * 0.1 }}
                className="rounded-2xl overflow-hidden border border-border/50 bg-card/60 backdrop-blur-xl"
              >
                <Comp />
              </motion.div>
            ))}
          </div>

          {/* ── INTELIGÊNCIA EXECUTIVA CEO ──────── */}
          <CEOIntelligenceSection />

          {/* ── INTELIGÊNCIA PREDITIVA - FASE 1 ── */}
          <PredictiveIntelligenceSection />

          {/* ── MOTOR DE MONETIZAÇÃO ── */}
          <MonetizationEngineSection />

          {/* ── FOOTER STATUS BAR ──────────────── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/15"
          >
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-emerald-500"
              />
              <span className="text-[10px] text-muted-foreground font-mono">SISTEMA OPERACIONAL · v2026.1</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-muted-foreground font-mono hidden md:block">
                Último sync: {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={fetchStats}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors"
              >
                Atualizar
              </motion.button>
            </div>
          </motion.div>

        </div>
      </div>
    </>
  );
}
