import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RevenueChart } from '@/components/admin/dashboard/RevenueChart';
import { DataQualityPanel, type QualitySummary } from '@/components/admin/dashboard/DataQualityPanel';
import { ExecutiveAlerts } from '@/components/admin/dashboard/ExecutiveAlerts';
import {
  PERIOD_OPTIONS, getRange, type PeriodKey, type DateRange,
} from '@/components/admin/dashboard/lib/period';
import {
  variation, variationLabel, variationTone, rate, formatRate, formatBRL, formatInt,
  buildAlerts, type Variation,
} from '@/components/admin/dashboard/lib/metrics';
import { InfoTip } from '@/components/admin/dashboard/DashboardStates';
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
  trend?: Variation;
  trendLabel?: string;
  index: number;
  ringMax?: number;
  tag?: string;
  sub?: string;
  tooltip?: string;
}

function KpiCard({
  title, value, prefix = '', suffix = '', icon: Icon,
  color, gradient, accentColor, trend, trendLabel,
  index, ringMax, tag, sub, tooltip,
}: KpiCardProps) {
  const tone = trend ? variationTone(trend) : 'flat';
  const isPos = tone === 'up';
  const isNeg = tone === 'down';


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
            {tooltip ? (
              <InfoTip text={tooltip}>
                <p className="text-[11px] font-medium text-muted-foreground mt-1 underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
                  {title}
                </p>
              </InfoTip>
            ) : (
              <p className="text-[11px] font-medium text-muted-foreground mt-1">{title}</p>
            )}
            {sub && <p className="text-[9px] text-muted-foreground/70 mt-0.5 truncate">{sub}</p>}
          </div>


          {/* Trend */}
          {trend !== undefined && (
            <div className="flex items-center gap-1.5 pt-2 border-t border-border/40">
              {isPos && <ArrowUpRight className="h-3 w-3 text-emerald-500" aria-hidden="true" />}
              {isNeg && <ArrowDownRight className="h-3 w-3 text-rose-500" aria-hidden="true" />}
              <span className={cn('text-[11px] font-bold',
                isPos ? 'text-emerald-500' : isNeg ? 'text-rose-500' : 'text-muted-foreground'
              )}>
                {variationLabel(trend)}
              </span>
              {trendLabel && trend.kind === 'pct' && (
                <span className="text-[10px] text-muted-foreground">{trendLabel}</span>
              )}
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
function LiveTicker({ stats, periodLabel }: { stats: Stats; periodLabel: string }) {
  const items = [
    `⬡ ${periodLabel} · Novos clientes: ${stats.newClients}`,
    `⬡ Leads recebidos: ${stats.newLeads}`,
    `⬡ Novos processos: ${stats.newProcesses}`,
    `⬡ Receita: R$ ${stats.revenue.toLocaleString('pt-BR')}`,
    `⬡ Concluídos: ${stats.completedProcesses}`,
    `⬡ Pendentes agora: ${stats.pendingInvoices}`,
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
// Stats — fluxo (período) x posição (acumulado)
// ─────────────────────────────────────────────────
interface Stats {
  // Fluxo (período selecionado)
  newClients: number;
  newLeads: number;
  newProcesses: number;
  completedProcesses: number;
  revenue: number;
  paidInvoicesCount: number;
  ticket: number | null;
  // Variações vs período anterior
  clientsTrend: Variation;
  leadsTrend: Variation;
  revenueTrend: Variation;
  processesTrend: Variation;
  completedTrend: Variation;
  paidTrend: Variation;
  // Posição atual (estoque)
  totalClients: number;
  totalLeads: number;
  openLeads: number;
  activeProcesses: number;
  totalProcesses: number;
  pendingInvoices: number;
  overdueInvoices: number;
  totalRevenue: number;
  // Conversão do período (null = sem leads no período)
  conversionRate: number | null;
  conversionPrev: number | null;
  revenuePrev: number;
}

const NONE: Variation = { kind: 'none' };

const EMPTY_STATS: Stats = {
  newClients: 0, newLeads: 0, newProcesses: 0, completedProcesses: 0,
  revenue: 0, paidInvoicesCount: 0, ticket: null,
  clientsTrend: NONE, leadsTrend: NONE, revenueTrend: NONE,
  processesTrend: NONE, completedTrend: NONE, paidTrend: NONE,
  totalClients: 0, totalLeads: 0, openLeads: 0, activeProcesses: 0,
  totalProcesses: 0, pendingInvoices: 0, overdueInvoices: 0, totalRevenue: 0,
  conversionRate: null, conversionPrev: null, revenuePrev: 0,
};

const PAID_STATUSES = ['paid', 'received', 'confirmed'];
const DONE_STATUSES = ['registrada', 'certificado', 'certificados', 'deferimento'];

// ─────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────
export default function AdminDashboard() {
  useCanViewFinancialValues();
  const [period, setPeriod] = useState<PeriodKey>('mes');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [loadingStats, setLoadingStats] = useState(true);
  const [greeting, setGreeting] = useState('');
  const [adminName, setAdminName] = useState('');
  const [currentTime, setCurrentTime] = useState('');
  const [dataQuality, setDataQuality] = useState<QualitySummary>({
    missingOriginPct: null, missingSectorPct: null, missingStatePct: null,
  });

  const parseInput = (value: string): Date | null => {
    if (!value) return null;
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  };

  const range: DateRange = useMemo(
    () => getRange(period, { from: parseInput(customFrom), to: parseInput(customTo) }),
    [period, customFrom, customTo],
  );
  const isTotal = range.start === null && range.end === null;

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
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.id) {
        const { data } = await supabase.from('profiles').select('full_name').eq('id', session.user.id).maybeSingle();
        if (data?.full_name) setAdminName(data.full_name.split(' ')[0]);
      }
    });
  }, []);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const r = range;

      const inWindow = (table: 'profiles' | 'leads' | 'brand_processes', col: string, from: Date | null, to: Date | null) => {
        let q = supabase.from(table).select('id', { count: 'exact', head: true });
        if (from) q = q.gte(col, from.toISOString());
        if (to) q = q.lt(col, to.toISOString());
        return q;
      };

      const doneWindow = (from: Date | null, to: Date | null) => {
        let q = supabase.from('brand_processes').select('id', { count: 'exact', head: true }).in('status', DONE_STATUSES);
        if (from) q = q.gte('updated_at', from.toISOString());
        if (to) q = q.lt('updated_at', to.toISOString());
        return q;
      };

      const results = await Promise.allSettled([
        // Fluxo — período
        inWindow('profiles', 'created_at', r.start, r.end),
        inWindow('leads', 'created_at', r.start, r.end),
        inWindow('brand_processes', 'created_at', r.start, r.end),
        doneWindow(r.start, r.end),
        // Fluxo — período anterior
        inWindow('profiles', 'created_at', r.prevStart, r.prevEnd),
        inWindow('leads', 'created_at', r.prevStart, r.prevEnd),
        inWindow('brand_processes', 'created_at', r.prevStart, r.prevEnd),
        doneWindow(r.prevStart, r.prevEnd),
        // Posição atual
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('leads').select('id', { count: 'exact', head: true }),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'novo'),
        supabase.from('brand_processes').select('id', { count: 'exact', head: true }),
        supabase.from('brand_processes').select('id', { count: 'exact', head: true }).eq('status', 'em_andamento'),
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'overdue'),
        // Faturas pagas (receita por período)
        supabase.from('invoices').select('amount, payment_date, created_at').in('status', PAID_STATUSES).range(0, 4999),
      ]);

      const count = (i: number) =>
        results[i].status === 'fulfilled' ? ((results[i] as PromiseFulfilledResult<{ count: number | null }>).value?.count || 0) : 0;

      type InvoiceRow = { amount: number | string | null; payment_date: string | null; created_at: string };
      const invoices: InvoiceRow[] =
        results[15].status === 'fulfilled'
          ? ((results[15] as PromiseFulfilledResult<{ data: InvoiceRow[] | null }>).value?.data || [])
          : [];

      const paidIn = (from: Date | null, to: Date | null) => {
        const rows = invoices.filter((i) => {
          if (!from && !to) return true;
          const ref = new Date(i.payment_date || i.created_at);
          if (Number.isNaN(ref.getTime())) return false;
          if (from && ref < from) return false;
          if (to && ref >= to) return false;
          return true;
        });
        return {
          total: rows.reduce((s, i) => s + Number(i.amount || 0), 0),
          qtd: rows.length,
        };
      };

      const paidNow = paidIn(r.start, r.end);
      const paidPrev = paidIn(r.prevStart, r.prevEnd);
      const totalRevenue = paidIn(null, null).total;

      const newClients = count(0);
      const newLeads = count(1);
      const prevClients = count(4);
      const prevLeads = count(5);

      setStats({
        newClients,
        newLeads,
        newProcesses: count(2),
        completedProcesses: count(3),
        revenue: paidNow.total,
        paidInvoicesCount: paidNow.qtd,
        ticket: paidNow.qtd > 0 ? paidNow.total / paidNow.qtd : null,
        clientsTrend: variation(newClients, prevClients),
        leadsTrend: variation(newLeads, prevLeads),
        processesTrend: variation(count(2), count(6)),
        completedTrend: variation(count(3), count(7)),
        revenueTrend: variation(paidNow.total, paidPrev.total),
        paidTrend: variation(paidNow.qtd, paidPrev.qtd),
        totalClients: count(8),
        totalLeads: count(9),
        openLeads: count(10),
        totalProcesses: count(11),
        activeProcesses: count(12),
        pendingInvoices: count(13),
        overdueInvoices: count(14),
        totalRevenue,
        conversionRate: rate(newClients, newLeads),
        conversionPrev: rate(prevClients, prevLeads),
        revenuePrev: paidPrev.total,
      });
    } catch (err) {
      console.warn('[Dashboard] Erro ao carregar estatísticas:', err);
    } finally {
      setLoadingStats(false);
    }
  }, [range]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const alerts = useMemo(() => buildAlerts({
    pendingInvoices: stats.pendingInvoices,
    overdueInvoices: stats.overdueInvoices,
    paidInvoices: stats.paidInvoicesCount,
    conversion: stats.conversionRate,
    conversionPrev: stats.conversionPrev,
    revenue: stats.revenue,
    revenuePrev: stats.revenuePrev,
    leadsPeriod: stats.newLeads,
    missingOriginPct: dataQuality.missingOriginPct,
    missingSectorPct: dataQuality.missingSectorPct,
    missingStatePct: dataQuality.missingStatePct,
  }), [stats, dataQuality]);

  const trendLabel = 'vs período anterior';

  const kpiCards: KpiCardProps[] = [
    {
      title: isTotal ? 'Clientes (acumulado)' : 'Novos Clientes',
      value: isTotal ? stats.totalClients : stats.newClients,
      icon: Users, gradient: 'from-blue-500 to-cyan-400',
      color: '#3b82f6', accentColor: '#60a5fa',
      trend: isTotal ? undefined : stats.clientsTrend, trendLabel,
      sub: `Base total: ${formatInt(stats.totalClients)}`,
      tooltip: 'Clientes cadastrados dentro do período selecionado. A base total é a soma histórica.',
      index: 0,
    },
    {
      title: isTotal ? 'Leads (acumulado)' : 'Leads Recebidos',
      value: isTotal ? stats.totalLeads : stats.newLeads,
      icon: Target, gradient: 'from-violet-500 to-purple-400',
      color: '#8b5cf6', accentColor: '#a78bfa',
      trend: isTotal ? undefined : stats.leadsTrend, trendLabel,
      sub: `Em aberto agora: ${formatInt(stats.openLeads)}`,
      tooltip: 'Leads que entraram no período. "Em aberto" é a posição atual, independente do período.',
      index: 1,
    },
    {
      title: isTotal ? 'Processos (acumulado)' : 'Novos Processos',
      value: isTotal ? stats.totalProcesses : stats.newProcesses,
      icon: Layers, gradient: 'from-amber-500 to-orange-400',
      color: '#f59e0b', accentColor: '#fbbf24',
      trend: isTotal ? undefined : stats.processesTrend, trendLabel,
      sub: `Ativos agora: ${formatInt(stats.activeProcesses)}`,
      tooltip: 'Processos abertos no período. "Ativos" mostra quantos estão em andamento hoje.',
      index: 2,
    },
    {
      title: 'Processos Concluídos',
      value: stats.completedProcesses,
      icon: CheckCircle, gradient: 'from-emerald-500 to-green-400',
      color: '#10b981', accentColor: '#34d399',
      trend: isTotal ? undefined : stats.completedTrend, trendLabel,
      tooltip: 'Processos com registro concedido ou certificado, pela data da última atualização.',
      index: 3,
    },
    {
      title: 'Faturas Pagas',
      value: stats.paidInvoicesCount,
      icon: CreditCard, gradient: 'from-indigo-500 to-blue-400',
      color: '#6366f1', accentColor: '#818cf8',
      trend: isTotal ? undefined : stats.paidTrend, trendLabel,
      sub: `Pendentes: ${formatInt(stats.pendingInvoices)} · Vencidas: ${formatInt(stats.overdueInvoices)}`,
      tooltip: 'Faturas efetivamente pagas no período, pela data de pagamento.',
      index: 4,
    },
    {
      title: isTotal ? 'Receita Acumulada' : 'Receita do Período',
      value: isTotal ? stats.totalRevenue : stats.revenue,
      prefix: 'R$ ',
      icon: TrendingUp, gradient: 'from-emerald-600 to-teal-400',
      color: '#059669', accentColor: '#10b981',
      trend: isTotal ? undefined : stats.revenueTrend, trendLabel,
      sub: stats.ticket === null
        ? 'Ticket médio: sem faturas pagas'
        : `Ticket médio: ${formatBRL(stats.ticket)}`,
      tooltip: 'Somente valores recebidos no período. Cobranças em aberto não entram aqui.',
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
                    className="text-muted-foreground mt-1.5 text-sm capitalize"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    {range.label} · Inteligência para decisões
                  </motion.p>

                  {/* Seletor de período */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-1">Período:</span>
                    {PERIOD_OPTIONS.map(p => (
                      <button
                        key={p.key}
                        type="button"
                        aria-pressed={period === p.key}
                        onClick={() => setPeriod(p.key)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors',
                          period === p.key
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted',
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {period === 'custom' && (
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <label className="text-[10px] font-semibold text-muted-foreground" htmlFor="dash-from">De</label>
                      <input
                        id="dash-from" type="date" value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        className="rounded-lg border border-border/60 bg-background px-2 py-1 text-[11px]"
                      />
                      <label className="text-[10px] font-semibold text-muted-foreground" htmlFor="dash-to">até</label>
                      <input
                        id="dash-to" type="date" value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="rounded-lg border border-border/60 bg-background px-2 py-1 text-[11px]"
                      />
                    </div>
                  )}
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
                <LiveTicker stats={stats} periodLabel={range.label} />
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
                  <RingMetric value={stats.conversionRate ?? 0} max={100} color="#6366f1" size={80} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-base font-black text-foreground">{formatRate(stats.conversionRate)}</span>
                  </div>
                </div>
                <div>
                  <InfoTip text="Clientes cadastrados no período dividido pelos leads recebidos no mesmo período.">
                    <p className="text-xs text-muted-foreground mb-0.5 underline decoration-dotted underline-offset-2">Taxa de Conversão</p>
                  </InfoTip>
                  <p className="text-lg font-bold text-foreground">{formatInt(stats.newClients)} / {formatInt(stats.newLeads)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {stats.newLeads === 0 ? 'Sem leads neste período' : 'leads → clientes no período'}
                  </p>
                </div>
              </div>

              {/* Performance bars */}
              <div className="space-y-2 pt-2 border-t border-border/40">
                <PerformanceBar label="Faturas pagas no período"
                  value={rate(stats.paidInvoicesCount, stats.paidInvoicesCount + stats.pendingInvoices + stats.overdueInvoices) ?? 0}
                  color="#6366f1" delay={0.8} />
                <PerformanceBar label="Leads em aberto sobre a base"
                  value={rate(stats.openLeads, stats.totalLeads) ?? 0}
                  color="#f59e0b" delay={0.95} />
                <PerformanceBar label="Processos ativos sobre a base"
                  value={rate(stats.activeProcesses, stats.totalProcesses) ?? 0}
                  color="#10b981" delay={1.1} />
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
                <Comp range={range} />
              </motion.div>
            ))}
          </div>

          {/* ── BOTTOM GRID ─────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.5 }}
              className="rounded-2xl overflow-hidden border border-border/50 bg-card/60 backdrop-blur-xl"
            >
              <ConversionFunnel range={range} />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.6 }}
              className="rounded-2xl overflow-hidden border border-border/50 bg-card/60 backdrop-blur-xl"
            >
              <RecentActivity />
            </motion.div>
          </div>

          {/* ── QUALIDADE DOS DADOS + ATENÇÃO EXECUTIVA ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DataQualityPanel onSummary={setDataQuality} />
            <ExecutiveAlerts alerts={alerts} loading={loadingStats} />
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
