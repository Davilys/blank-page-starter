import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ClientLayout } from '@/components/cliente/ClientLayout';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { UpsellRecommendationCard } from '@/components/cliente/UpsellRecommendationCard';
import {
  FileText, Clock, CheckCircle, AlertCircle, Bell, CreditCard,
  ChevronRight, TrendingUp, Shield, Zap, Activity, ArrowUpRight,
  Info, AlertTriangle, Sparkles, Star, Lock, Globe, Award
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';

// ─── Types ─────────────────────────────────────────────
interface Stats {
  totalProcesses: number;
  inProgress: number;
  completed: number;
  pendingPayments: number;
}
interface BrandProcess {
  id: string;
  brand_name: string;
  status: string | null;
  process_number: string | null;
  updated_at: string | null;
  pipeline_stage: string | null;
}
interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  read: boolean;
  created_at: string;
}
interface Invoice {
  id: string;
  description: string;
  amount: number;
  status: string;
  due_date: string;
}

// ─── Status Config ──────────────────────────────────────
const statusConfig: Record<string, { label: string; color: string; glow: string; progress: number }> = {
  em_andamento:   { label: 'Em Andamento',   color: 'from-amber-500 to-orange-400',   glow: '251 191 36',  progress: 35 },
  publicado_rpi:  { label: 'Publicado RPI',  color: 'from-blue-500 to-cyan-400',      glow: '59 130 246',  progress: 55 },
  em_exame:       { label: 'Em Exame',       color: 'from-violet-500 to-purple-400',  glow: '139 92 246',  progress: 70 },
  deferido:       { label: 'Deferido',       color: 'from-emerald-500 to-green-400',  glow: '16 185 129',  progress: 90 },
  concedido:      { label: 'Concedido',      color: 'from-emerald-600 to-teal-400',   glow: '5 150 105',   progress: 100 },
  indeferido:     { label: 'Indeferido',     color: 'from-red-500 to-rose-400',       glow: '239 68 68',   progress: 100 },
  arquivado:      { label: 'Arquivado',      color: 'from-slate-500 to-gray-400',     glow: '100 116 139', progress: 100 },
};

const notifConfig = {
  info:    { icon: Info,          glow: '59 130 246',  label: 'Info' },
  warning: { icon: AlertTriangle, glow: '251 191 36',  label: 'Atenção' },
  success: { icon: CheckCircle,   glow: '16 185 129',  label: 'Sucesso' },
  error:   { icon: AlertTriangle, glow: '239 68 68',   label: 'Urgente' },
};

// ─── Animated Counter ───────────────────────────────────
function AnimatedCount({ target, prefix = '' }: { target: number; prefix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    let start = 0;
    const step = Math.ceil(target / 30);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(start);
    }, 30);
    return () => clearInterval(timer);
  }, [target]);
  return <>{prefix}{count}</>;
}

// ─── Particle Field ─────────────────────────────────────
// Fixed values to avoid re-render issues with Math.random()
const CLIENT_PARTICLES = Array.from({ length: 20 }).map((_, i) => ({
  w: 1 + (i % 3) * 1,
  h: 1 + (i % 3) * 1,
  left: (i * 37.3 + 5) % 100,
  top: (i * 53.7 + 11) % 100,
  dur: 3 + (i % 4),
  delay: (i * 0.47) % 5,
  color: i % 3 === 0
    ? 'hsl(210 100% 50% / 0.5)'
    : i % 3 === 1
    ? 'hsl(152 76% 45% / 0.4)'
    : 'hsl(220 100% 60% / 0.3)',
}));

function ParticleField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {CLIENT_PARTICLES.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{ width: p.w, height: p.h, left: `${p.left}%`, top: `${p.top}%`, background: p.color }}
          animate={{ y: [0, -30, 0], opacity: [0, 0.8, 0], scale: [0, 1.5, 0] }}
          transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ─── HUD Header ─────────────────────────────────────────
function HUDHeader({ user, stats }: { user: User | null; stats: Stats }) {
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Cliente';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl border border-primary/20"
      style={{
        background: 'linear-gradient(135deg, hsl(var(--card)/0.9) 0%, hsl(210 100% 40% / 0.06) 50%, hsl(152 76% 45% / 0.04) 100%)',
        boxShadow: '0 0 80px hsl(210 100% 40% / 0.08), inset 0 1px 0 hsl(0 0% 100% / 0.1)',
      }}
    >
      <ParticleField />

      {/* Animated grid */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      {/* Scan line */}
      <motion.div
        className="absolute left-0 right-0 h-[1px] pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, hsl(210 100% 50% / 0.4), transparent)' }}
        animate={{ top: ['0%', '100%', '0%'] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
      />

      <div className="relative z-10 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left */}
          <div>
            <motion.div
              className="flex items-center gap-2 mb-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <motion.div
                className="w-2 h-2 rounded-full bg-emerald-400"
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                Sistema Online
              </span>
            </motion.div>

            <h1 className="text-2xl md:text-4xl font-bold tracking-tight">
              {greeting},{' '}
              <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                {displayName}
              </span>{' '}
              👋
            </h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Acompanhe seus processos e documentos em tempo real.
            </p>
          </div>

          {/* Right — quick stats chips */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Processos', value: stats.totalProcesses, icon: FileText, color: 'hsl(210 100% 50%)' },
              { label: 'Concluídos', value: stats.completed, icon: CheckCircle, color: 'hsl(152 76% 45%)' },
              { label: 'Pendentes', value: stats.pendingPayments, icon: AlertCircle, color: 'hsl(0 72% 51%)' },
            ].map((chip, i) => (
              <motion.div
                key={chip.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border backdrop-blur-sm"
                style={{
                  borderColor: `${chip.color.replace('hsl(', 'hsl(').replace(')', ' / 0.25)')}`,
                  background: `${chip.color.replace('hsl(', 'hsl(').replace(')', ' / 0.08)')}`,
                }}
              >
                <chip.icon className="h-3.5 w-3.5" style={{ color: chip.color }} />
                <span className="text-xs font-bold" style={{ color: chip.color }}>
                  {chip.value}
                </span>
                <span className="text-[10px] text-muted-foreground">{chip.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Stats Cards ────────────────────────────────────────
const statsDef = [
  { key: 'totalProcesses', title: 'Total de Processos', icon: FileText,     gradient: 'from-blue-500 to-cyan-400',    glow: '59 130 246' },
  { key: 'inProgress',     title: 'Em Andamento',       icon: Clock,         gradient: 'from-amber-500 to-orange-400', glow: '245 158 11' },
  { key: 'completed',      title: 'Concluídos',          icon: CheckCircle,   gradient: 'from-emerald-500 to-green-400',glow: '16 185 129' },
  { key: 'pendingPayments',title: 'Pagamentos Pendentes',icon: AlertCircle,   gradient: 'from-rose-500 to-pink-400',   glow: '244 63 94'  },
];

function StatsGrid({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {statsDef.map((def, i) => {
        const value = stats[def.key as keyof Stats];
        const isAlert = def.key === 'pendingPayments' && value > 0;
        return (
          <motion.div
            key={def.key}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.97 }}
            className="group cursor-pointer relative overflow-hidden rounded-2xl border backdrop-blur-sm"
            style={{
              background: `linear-gradient(135deg, hsl(var(--card)/0.9) 0%, rgb(${def.glow} / 0.05) 100%)`,
              borderColor: `rgb(${def.glow} / 0.2)`,
              boxShadow: isAlert ? `0 0 24px -6px rgb(${def.glow} / 0.4)` : 'none',
            }}
          >
            {/* Top accent */}
            <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${def.gradient}`} />

            {/* Glow orb */}
            <div
              className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-20 pointer-events-none"
              style={{ background: `rgb(${def.glow})` }}
            />

            {isAlert && (
              <motion.div
                className="absolute top-2 right-2 w-2 h-2 rounded-full"
                style={{ background: `rgb(${def.glow})` }}
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}

            <div className="relative z-10 p-4 md:p-5">
              <div className="flex items-start justify-between mb-3">
                <motion.div
                  className={`flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br shadow-lg ${def.gradient}`}
                  whileHover={{ rotate: 8, scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 400 }}
                >
                  <def.icon className="h-5 w-5 text-white" />
                </motion.div>
              </div>

              <p className="text-2xl md:text-3xl font-bold tracking-tight mb-0.5">
                <AnimatedCount target={value} />
              </p>
              <p className="text-xs font-medium text-muted-foreground">{def.title}</p>

              {/* Progress bar */}
              <div className="mt-3 h-1 w-full rounded-full bg-muted overflow-hidden">
                <motion.div
                  className={`h-full rounded-full bg-gradient-to-r ${def.gradient}`}
                  initial={{ width: 0 }}
                  animate={{ width: value > 0 ? '100%' : '0%' }}
                  transition={{ duration: 1, delay: 0.5 + i * 0.1, ease: 'easeOut' }}
                />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Process Pipeline Card ──────────────────────────────
function ProcessCard({ process, index }: { process: BrandProcess; index: number }) {
  const s = statusConfig[process.status || 'em_andamento'] || statusConfig.em_andamento;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07 }}
      whileHover={{ x: 4, transition: { duration: 0.15 } }}
    >
      <Link
        to={`/cliente/processos/${process.id}`}
        className="block group"
      >
        <div
          className="relative overflow-hidden rounded-2xl border backdrop-blur-sm p-4 transition-all duration-300"
          style={{
            background: `linear-gradient(135deg, hsl(var(--card)/0.8) 0%, rgb(${s.glow} / 0.04) 100%)`,
            borderColor: `rgb(${s.glow} / 0.15)`,
          }}
        >
          {/* Left accent bar */}
          <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl bg-gradient-to-b ${s.color}`} />

          <div className="flex items-center justify-between">
            <div className="ml-2 flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                  {process.brand_name}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {process.process_number || 'Aguardando protocolo'}
              </p>

              {/* Progress */}
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full bg-gradient-to-r ${s.color}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${s.progress}%` }}
                    transition={{ duration: 0.8, delay: 0.2 + index * 0.05, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium">{s.progress}%</span>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-3 shrink-0">
              <div
                className="px-2.5 py-1 rounded-full text-[10px] font-bold"
                style={{
                  background: `rgb(${s.glow} / 0.15)`,
                  color: `rgb(${s.glow})`,
                  border: `1px solid rgb(${s.glow} / 0.3)`,
                }}
              >
                {s.label}
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Processes Panel ────────────────────────────────────
function ProcessesPanel({ userId }: { userId?: string }) {
  const [processes, setProcesses] = useState<BrandProcess[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    supabase.from('brand_processes')
      .select('id, brand_name, status, process_number, updated_at, pipeline_stage')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(5)
      .then(({ data }) => { setProcesses(data || []); setLoading(false); });
  }, [userId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="relative overflow-hidden rounded-3xl border backdrop-blur-sm"
      style={{
        background: 'hsl(var(--card)/0.85)',
        borderColor: 'hsl(var(--border)/0.6)',
        boxShadow: '0 8px 32px hsl(var(--foreground)/0.04)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-sm">Meus Processos</h2>
            <p className="text-[10px] text-muted-foreground">Pipeline de marcas</p>
          </div>
        </div>
        <Link
          to="/cliente/processos"
          className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Ver todos <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Body */}
      <div className="p-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-2xl bg-muted/50 relative overflow-hidden">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-muted-foreground/5 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                />
              </div>
            ))}
          </div>
        ) : processes.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
              <FileText className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">Nenhum processo ainda</p>
            <Link
              to="/cliente/registrar-marca"
              className="text-xs font-semibold text-primary underline underline-offset-2"
            >
              Registrar minha primeira marca
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {processes.map((p, i) => <ProcessCard key={p.id} process={p} index={i} />)}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Notification Item ──────────────────────────────────
function NotifItem({ n, index }: { n: Notification; index: number }) {
  const cfg = notifConfig[n.type] || notifConfig.info;
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      whileHover={{ x: 2 }}
      className="relative overflow-hidden rounded-xl border cursor-pointer group transition-all duration-200"
      style={{
        background: `linear-gradient(135deg, hsl(var(--card)/0.7) 0%, rgb(${cfg.glow} / 0.04) 100%)`,
        borderColor: `rgb(${cfg.glow} / ${n.read ? '0.1' : '0.25'})`,
        boxShadow: n.read ? 'none' : `0 0 16px -6px rgb(${cfg.glow} / 0.3)`,
      }}
    >
      {/* Accent */}
      <div className="absolute left-0 top-0 bottom-0 w-[2.5px] rounded-l-xl"
        style={{ background: `rgb(${cfg.glow})` }} />

      <div className="flex items-start gap-2.5 p-3 pl-4">
        <div
          className="p-1.5 rounded-lg shrink-0 mt-0.5"
          style={{ background: `rgb(${cfg.glow} / 0.12)` }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: `rgb(${cfg.glow})` }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{n.title}</p>
          <p className="text-[11px] text-muted-foreground truncate">{n.message}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
          </p>
        </div>
        {!n.read && (
          <motion.div
            className="w-2 h-2 rounded-full shrink-0 mt-1"
            style={{ background: `rgb(${cfg.glow})` }}
            animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </div>
    </motion.div>
  );
}

// ─── Notifications Panel ────────────────────────────────
function NotificationsPanel({ userId }: { userId?: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    supabase.from('notifications' as any)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(4)
      .then(({ data }) => { setNotifications((data as unknown as Notification[]) || []); setLoading(false); });
  }, [userId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="relative overflow-hidden rounded-3xl border backdrop-blur-sm"
      style={{
        background: 'hsl(var(--card)/0.85)',
        borderColor: 'hsl(var(--border)/0.6)',
      }}
    >
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-400 shadow-lg">
            <Bell className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-sm">Notificações</h2>
            <p className="text-[10px] text-muted-foreground">Atualizações recentes</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 rounded-xl bg-muted/50 relative overflow-hidden">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-muted-foreground/5 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear', delay: i * 0.15 }}
                />
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-2">
            <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center">
              <Bell className="h-5 w-5 text-muted-foreground/40" />
            </div>
            <p className="text-xs text-muted-foreground">Nenhuma notificação</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n, i) => <NotifItem key={n.id} n={n} index={i} />)}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Financial Panel ────────────────────────────────────
function FinancialPanel({ userId }: { userId?: string }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    supabase.from('invoices')
      .select('id, description, amount, status, due_date')
      .eq('user_id', userId)
      .in('status', ['pending', 'overdue'])
      .order('due_date', { ascending: true })
      .limit(3)
      .then(({ data }) => { setInvoices((data as Invoice[]) || []); setLoading(false); });
  }, [userId]);

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="relative overflow-hidden rounded-3xl border backdrop-blur-sm"
      style={{
        background: 'hsl(var(--card)/0.85)',
        borderColor: 'hsl(var(--border)/0.6)',
      }}
    >
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 shadow-lg">
            <CreditCard className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-sm">Financeiro</h2>
            <p className="text-[10px] text-muted-foreground">Faturas pendentes</p>
          </div>
        </div>
        <Link
          to="/cliente/financeiro"
          className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Ver todos <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="space-y-2.5">
            {[1, 2].map(i => (
              <div key={i} className="h-14 rounded-xl bg-muted/50 relative overflow-hidden">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-muted-foreground/5 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                />
              </div>
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center py-8 gap-2"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="text-xs font-medium text-emerald-500">Tudo em dia! 🎉</p>
            <p className="text-[11px] text-muted-foreground">Nenhuma fatura pendente</p>
          </motion.div>
        ) : (
          <div className="space-y-2.5">
            {invoices.map((inv, i) => {
              const isOverdue = inv.status === 'overdue';
              const glow = isOverdue ? '239 68 68' : '245 158 11';
              return (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="relative overflow-hidden rounded-xl border p-3 flex items-center justify-between"
                  style={{
                    background: `linear-gradient(135deg, hsl(var(--card)/0.8) 0%, rgb(${glow} / 0.04) 100%)`,
                    borderColor: `rgb(${glow} / 0.25)`,
                    boxShadow: isOverdue ? `0 0 16px -6px rgb(${glow} / 0.35)` : 'none',
                  }}
                >
                  {isOverdue && (
                    <motion.div
                      className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
                      style={{ background: `rgb(${glow})` }}
                      animate={{ scale: [1, 1.5, 1], opacity: [1, 0.4, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                    />
                  )}
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg" style={{ background: `rgb(${glow} / 0.1)` }}>
                      <AlertCircle className="h-4 w-4" style={{ color: `rgb(${glow})` }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold truncate max-w-[140px]">{inv.description}</p>
                      <p className="text-[10px] text-muted-foreground">Vence {fmtDate(inv.due_date)}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold" style={{ color: `rgb(${glow})` }}>{fmt(inv.amount)}</p>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: `rgb(${glow} / 0.12)`, color: `rgb(${glow})` }}
                    >
                      {isOverdue ? 'Vencida' : 'Pendente'}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Quick Actions ──────────────────────────────────────
function QuickActions() {
  const actions = [
    { label: 'Registrar Marca', icon: Star,   to: '/cliente/registrar-marca', gradient: 'from-primary to-blue-400',    glow: '59 130 246' },
    { label: 'Meus Processos',  icon: FileText,to: '/cliente/processos',        gradient: 'from-violet-500 to-purple-400',glow: '139 92 246' },
    { label: 'Documentos',      icon: Shield,  to: '/cliente/documentos',       gradient: 'from-emerald-500 to-teal-400', glow: '16 185 129' },
    { label: 'Financeiro',      icon: TrendingUp,to: '/cliente/financeiro',     gradient: 'from-amber-500 to-orange-400', glow: '245 158 11' },
    { label: 'Suporte',         icon: Zap,     to: '/cliente/suporte',           gradient: 'from-rose-500 to-pink-400',    glow: '244 63 94'  },
    { label: 'Chat',            icon: Activity,to: '/cliente/chat-suporte',     gradient: 'from-cyan-500 to-blue-400',    glow: '6 182 212'  },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="relative overflow-hidden rounded-3xl border backdrop-blur-sm"
      style={{
        background: 'hsl(var(--card)/0.85)',
        borderColor: 'hsl(var(--border)/0.6)',
      }}
    >
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-3 border-b border-border/40">
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-pink-400 shadow-lg">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-sm">Acesso Rápido</h2>
          <p className="text-[10px] text-muted-foreground">Ações frequentes</p>
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-2.5">
        {actions.map((action, i) => (
          <motion.div
            key={action.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + i * 0.06 }}
            whileHover={{ y: -3, transition: { duration: 0.15 } }}
            whileTap={{ scale: 0.95 }}
          >
            <Link
              to={action.to}
              className="flex flex-col items-center gap-2 p-3.5 rounded-2xl border group transition-all duration-200 text-center"
              style={{
                background: `rgb(${action.glow} / 0.04)`,
                borderColor: `rgb(${action.glow} / 0.15)`,
              }}
            >
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br shadow-lg ${action.gradient} group-hover:scale-110 transition-transform duration-200`}
              >
                <action.icon className="h-4.5 w-4.5 text-white" />
              </div>
              <span className="text-[11px] font-semibold text-foreground/80 group-hover:text-foreground transition-colors">
                {action.label}
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Trust Bar ──────────────────────────────────────────
function TrustBar() {
  const items = [
    { icon: Shield, label: 'Dados Protegidos',    sub: 'Criptografia SSL 256-bit' },
    { icon: Globe,  label: 'INPI Certificado',    sub: 'Processo oficial' },
    { icon: Lock,   label: 'Acesso Seguro',       sub: 'Autenticação verificada' },
    { icon: Award,  label: 'Marca Registrada',    sub: 'Proteção garantida' },
  ];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.7 }}
      className="grid grid-cols-2 md:grid-cols-4 gap-3"
    >
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 + i * 0.08 }}
          className="flex items-center gap-3 p-3.5 rounded-2xl border backdrop-blur-sm"
          style={{
            background: 'hsl(var(--card)/0.6)',
            borderColor: 'hsl(var(--border)/0.5)',
          }}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary/10 shrink-0">
            <item.icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-[11px] font-bold">{item.label}</p>
            <p className="text-[10px] text-muted-foreground">{item.sub}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ─── Page ───────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ totalProcesses: 0, inProgress: 0, completed: 0, pendingPayments: 0 });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) navigate('/cliente/login');
      else { setUser(session.user); setLoading(false); }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate('/cliente/login');
      else { setUser(session.user); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      supabase.from('brand_processes').select('status').eq('user_id', user.id),
      supabase.from('invoices').select('status').eq('user_id', user.id).in('status', ['pending', 'overdue']),
    ]).then(([{ data: processes }, { data: invoices }]) => {
      if (processes) {
        setStats({
          totalProcesses: processes.length,
          inProgress: processes.filter(p => ['em_andamento', 'publicado_rpi', 'em_exame'].includes(p.status || '')).length,
          completed: processes.filter(p => ['deferido', 'concedido'].includes(p.status || '')).length,
          pendingPayments: invoices?.length || 0,
        });
      }
    });
  }, [user?.id]);

  if (loading) {
    return (
      <ClientLayout>
        <div className="space-y-6">
          <div className="h-36 rounded-3xl bg-muted/50 animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-28 rounded-2xl bg-muted/50 animate-pulse" />)}
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 h-80 rounded-3xl bg-muted/50 animate-pulse" />
            <div className="h-80 rounded-3xl bg-muted/50 animate-pulse" />
          </div>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="space-y-4 md:space-y-6 pb-6">
        {/* HUD Header */}
        <HUDHeader user={user} stats={stats} />

        {/* KPI Grid */}
        <StatsGrid stats={stats} />

        {/* Trust Bar */}
        <TrustBar />

        {/* Main content */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Processes — wider */}
          <div className="lg:col-span-2 space-y-4">
            <ProcessesPanel userId={user?.id} />
            {/* Upsell Recommendation - Light Version */}
            <UpsellRecommendationCard
              context={{
                userId: user?.id,
                classeAtual: undefined, // Will use general recommendations
                segmento: undefined,
                scoreComercial: 70,
              }}
            />
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <NotificationsPanel userId={user?.id} />
            <FinancialPanel userId={user?.id} />
          </div>
        </div>

        {/* Quick Actions */}
        <QuickActions />
      </div>
    </ClientLayout>
  );
}
