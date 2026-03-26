import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ClientLayout } from '@/components/cliente/ClientLayout';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  CreditCard, CheckCircle, AlertCircle, Clock, ExternalLink,
  Copy, QrCode, FileText, DollarSign, TrendingUp, AlertTriangle,
  ChevronDown, ChevronUp, RefreshCw, Wallet, Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import type { User } from '@supabase/supabase-js';
import { QRCodeSVG } from 'qrcode.react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Invoice {
  id: string;
  description: string;
  amount: number;
  status: string;
  due_date: string;
  payment_date: string | null;
  invoice_url: string | null;
  boleto_code: string | null;
  pix_code: string | null;
  pix_qr_code: string | null;
  payment_method: string | null;
  created_at: string | null;
}

const PAID_STATUSES = ['paid', 'confirmed', 'received', 'RECEIVED', 'CONFIRMED'];

const normalizeStatus = (s: string | null): 'paid' | 'pending' | 'overdue' | 'cancelled' => {
  if (!s) return 'pending';
  if (PAID_STATUSES.includes(s)) return 'paid';
  if (s === 'overdue' || s === 'OVERDUE') return 'overdue';
  if (s === 'cancelled' || s === 'CANCELLED' || s === 'canceled') return 'cancelled';
  return 'pending';
};

const STATUS_CFG = {
  paid:      { label: 'Pago',      icon: CheckCircle,   color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/25', rgb: '16,185,129', glow: '0 0 20px rgba(16,185,129,0.3)' },
  pending:   { label: 'Pendente',  icon: Clock,         color: 'text-amber-500',   bg: 'bg-amber-500/10 border-amber-500/25',    rgb: '245,158,11', glow: '0 0 20px rgba(245,158,11,0.25)' },
  overdue:   { label: 'Vencido',   icon: AlertCircle,   color: 'text-red-500',     bg: 'bg-red-500/10 border-red-500/25',        rgb: '239,68,68',  glow: '0 0 20px rgba(239,68,68,0.3)' },
  cancelled: { label: 'Cancelado', icon: AlertTriangle, color: 'text-muted-foreground', bg: 'bg-muted/40 border-border',         rgb: '100,116,139',glow: 'none' },
};

const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

// Fixed particles - no Math.random()
const PARTICLES = Array.from({ length: 18 }).map((_, i) => ({
  x: (i * 43.7 + 7) % 100, y: (i * 61.3 + 11) % 100,
  s: 1.5 + (i % 3) * 0.7,
  dur: 7 + (i % 5),
  delay: (i * 0.44) % 6,
  op: 0.04 + (i % 4) * 0.018,
}));

function InvoiceCard({ invoice, index }: { invoice: Invoice; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const norm = normalizeStatus(invoice.status);
  const cfg = STATUS_CFG[norm];
  const Icon = cfg.icon;
  const hasPix = !!invoice.pix_code;
  const hasBoleto = !!invoice.boleto_code;
  const isActionable = norm === 'pending' || norm === 'overdue';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, type: 'spring', stiffness: 280, damping: 24 }}
      className="relative rounded-2xl border overflow-hidden backdrop-blur-sm"
      style={{
        background: `linear-gradient(135deg, hsl(var(--card)/0.9) 0%, rgba(${cfg.rgb},0.04) 100%)`,
        borderColor: `rgba(${cfg.rgb},0.2)`,
        boxShadow: norm !== 'cancelled' ? `0 0 24px -8px rgba(${cfg.rgb},0.3)` : 'none',
      }}
    >
      {/* Left accent */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl"
        style={{ background: `linear-gradient(180deg, transparent, rgba(${cfg.rgb},0.8), transparent)` }} />

      {/* Main row */}
      <div className="flex items-start gap-4 p-4 pl-5">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border"
          style={{ background: `rgba(${cfg.rgb},0.12)`, borderColor: `rgba(${cfg.rgb},0.25)` }}>
          <Icon className={cn('h-5 w-5', cfg.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <p className="font-semibold text-sm text-foreground leading-tight">{invoice.description}</p>
            <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap flex-shrink-0', cfg.bg, cfg.color)}>
              <Icon className="h-2.5 w-2.5" />
              {cfg.label}
            </span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              <span className="font-bold" style={{ color: `rgb(${cfg.rgb})` }}>R$ {fmt(invoice.amount)}</span>
            </span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Vence: {format(new Date(invoice.due_date), "dd/MM/yyyy")}
            </span>
            {invoice.payment_date && (
              <span className="text-[11px] text-emerald-500 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Pago: {format(new Date(invoice.payment_date), "dd/MM/yyyy")}
              </span>
            )}
          </div>

          {/* Actions */}
          {isActionable && (
            <div className="flex flex-wrap gap-2">
              {hasPix && (
                <button
                  onClick={() => setExpanded(p => !p)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors"
                >
                  <QrCode className="h-3 w-3" />
                  PIX {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              )}
              {hasBoleto && invoice.invoice_url && (
                <a
                  href={invoice.invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-500 hover:bg-blue-500/20 transition-colors"
                >
                  <FileText className="h-3 w-3" />
                  Boleto
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
              {invoice.invoice_url && !hasBoleto && (
                <a
                  href={invoice.invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-violet-500/10 border border-violet-500/20 text-violet-500 hover:bg-violet-500/20 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Ver Fatura
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* PIX expanded */}
      <AnimatePresence>
        {expanded && hasPix && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-5 pb-4 overflow-hidden"
          >
            <div className="pt-3 border-t border-border/40 flex flex-col sm:flex-row gap-4 items-start">
              {/* QR */}
              <div className="flex-shrink-0 bg-white p-3 rounded-xl border border-border/40">
                <QRCodeSVG value={invoice.pix_code!} size={100} />
              </div>
              {/* Code */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Código PIX Copia e Cola</p>
                <div className="flex gap-2 items-start">
                  <p className="text-[10px] font-mono text-foreground/80 break-all flex-1 leading-relaxed bg-muted/40 rounded-lg p-2">
                    {invoice.pix_code!.slice(0, 80)}...
                  </p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(invoice.pix_code!); toast.success('Código PIX copiado!'); }}
                    className="flex-shrink-0 p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Financeiro() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) navigate('/cliente/login');
      else { setUser(session.user); fetchInvoices(session.user.id); }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate('/cliente/login');
      else { setUser(session.user); fetchInvoices(session.user.id); }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchInvoices = async (uid: string) => {
    setLoading(true);
    const { data } = await supabase.from('invoices').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    setInvoices(data || []);
    setLoading(false);
  };

  const stats = {
    total: invoices.reduce((s, i) => s + Number(i.amount), 0),
    paid: invoices.filter(i => normalizeStatus(i.status) === 'paid').reduce((s, i) => s + Number(i.amount), 0),
    pending: invoices.filter(i => normalizeStatus(i.status) === 'pending').reduce((s, i) => s + Number(i.amount), 0),
    overdue: invoices.filter(i => normalizeStatus(i.status) === 'overdue').reduce((s, i) => s + Number(i.amount), 0),
    pendingCount: invoices.filter(i => normalizeStatus(i.status) === 'pending').length,
    overdueCount: invoices.filter(i => normalizeStatus(i.status) === 'overdue').length,
  };

  const filtered = invoices.filter(i => filter === 'all' || normalizeStatus(i.status) === filter);

  return (
    <ClientLayout>
      <div className="relative space-y-5">
        {/* Ambient background particles */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
          {PARTICLES.map((p, i) => (
            <motion.div key={i} className="absolute rounded-full"
              style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, background: 'hsl(var(--primary))', opacity: p.op }}
              animate={{ y: [-8, 8, -8], opacity: [p.op, p.op * 2.5, p.op] }}
              transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}
        </div>

        <div className="relative z-10 space-y-5">
          {/* ── Header ─────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card/60 backdrop-blur-xl p-5"
            style={{ boxShadow: '0 0 40px hsl(var(--primary)/0.06)' }}
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl bg-primary/8 pointer-events-none" />

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <motion.div
                  className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center shadow-lg shadow-primary/20"
                  animate={{ boxShadow: ['0 0 16px hsl(var(--primary)/0.3)', '0 0 32px hsl(var(--primary)/0.5)', '0 0 16px hsl(var(--primary)/0.3)'] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <Wallet className="h-5 w-5 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-xl font-black tracking-tight">Financeiro</h1>
                  <p className="text-xs text-muted-foreground">{invoices.length} cobranças · {stats.pendingCount} pendentes</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => user && fetchInvoices(user.id)} className="gap-2">
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                Atualizar
              </Button>
            </div>
          </motion.div>

          {/* ── KPI Cards ─────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Cobrado', value: stats.total, rgb: '59,130,246', icon: DollarSign },
              { label: 'Total Pago', value: stats.paid, rgb: '16,185,129', icon: CheckCircle },
              { label: 'A Pagar', value: stats.pending, rgb: '245,158,11', icon: Clock },
              { label: 'Vencidos', value: stats.overdue, rgb: '239,68,68', icon: AlertCircle },
            ].map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.07, type: 'spring', stiffness: 280 }}
                className="relative rounded-2xl border p-4 overflow-hidden"
                style={{
                  background: `linear-gradient(135deg,rgba(${kpi.rgb},0.08) 0%,rgba(${kpi.rgb},0.02) 100%)`,
                  borderColor: `rgba(${kpi.rgb},0.22)`,
                  boxShadow: `0 0 20px -8px rgba(${kpi.rgb},0.25)`,
                }}
              >
                <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full pointer-events-none"
                  style={{ background: `radial-gradient(circle,rgba(${kpi.rgb},0.15) 0%,transparent 70%)` }} />
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: `rgba(${kpi.rgb},0.15)`, border: `1px solid rgba(${kpi.rgb},0.3)` }}>
                  <kpi.icon className="h-4 w-4" style={{ color: `rgb(${kpi.rgb})` }} />
                </div>
                <p className="text-xl font-black tabular-nums" style={{ color: `rgb(${kpi.rgb})` }}>
                  R$ {fmt(kpi.value)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
              </motion.div>
            ))}
          </div>

          {/* ── Alert Overdue ──────────────────────── */}
          <AnimatePresence>
            {stats.overdueCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="relative flex items-center gap-3 p-4 rounded-2xl border border-red-500/30 bg-red-500/8 overflow-hidden"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.6, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"
                />
                <div>
                  <p className="text-sm font-bold text-red-500">
                    {stats.overdueCount} fatura{stats.overdueCount > 1 ? 's' : ''} vencida{stats.overdueCount > 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">Entre em contato para regularizar sua situação</p>
                </div>
                <a
                  href="https://wa.me/5511911120225"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  Regularizar <ExternalLink className="h-3 w-3" />
                </a>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Filter Tabs ───────────────────────── */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'pending', 'paid', 'overdue'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border',
                  filter === f
                    ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                    : 'bg-card/60 text-muted-foreground border-border/50 hover:border-primary/30'
                )}
              >
                {f === 'all' ? `Todas (${invoices.length})`
                  : f === 'pending' ? `Pendentes (${invoices.filter(i => normalizeStatus(i.status) === 'pending').length})`
                  : f === 'paid' ? `Pagas (${invoices.filter(i => normalizeStatus(i.status) === 'paid').length})`
                  : `Vencidas (${stats.overdueCount})`}
              </button>
            ))}
          </div>

          {/* ── Invoices List ──────────────────────── */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 rounded-2xl bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 gap-3 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                <CreditCard className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="font-semibold text-muted-foreground">Nenhuma fatura encontrada</p>
              <p className="text-xs text-muted-foreground/60">
                {filter !== 'all' ? 'Tente outro filtro' : 'Suas faturas aparecerão aqui'}
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {filtered.map((inv, i) => (
                <InvoiceCard key={inv.id} invoice={inv} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </ClientLayout>
  );
}
