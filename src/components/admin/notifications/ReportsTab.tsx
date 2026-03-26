import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
} from 'recharts';
import {
  Bell, Smartphone, MessageSquare, Mail, CheckCircle2, XCircle,
  Activity, TrendingUp, AlertCircle, RefreshCw, Package, Clock,
  ChevronDown, ChevronUp, BarChart3, Zap, Filter,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/* ─────────────────────────────────────────────────────── */
/* Types                                                    */
/* ─────────────────────────────────────────────────────── */
interface DispatchLog {
  id: string;
  event_type: string;
  channel: string;
  status: string;
  recipient_phone: string | null;
  recipient_email: string | null;
  recipient_user_id: string | null;
  error_message: string | null;
  response_body: string | null;
  attempts: number;
  created_at: string;
}

interface Props {
  dispatchLogs: DispatchLog[];
  logsLoading: boolean;
  onRefresh: () => void;
}

/* ─────────────────────────────────────────────────────── */
/* Constants                                               */
/* ─────────────────────────────────────────────────────── */
const CHANNEL_DEFS = [
  { key: 'crm',      label: 'CRM',      Icon: Bell,          color: '#a855f7', colorRgb: '168,85,247' },
  { key: 'sms',      label: 'SMS',       Icon: Smartphone,    color: '#6366f1', colorRgb: '99,102,241' },
  { key: 'whatsapp', label: 'WhatsApp',  Icon: MessageSquare, color: '#22c55e', colorRgb: '34,197,94' },
  { key: 'email',    label: 'E-mail',    Icon: Mail,          color: '#3b82f6', colorRgb: '59,130,246' },
];

const EVENT_LABELS: Record<string, string> = {
  formulario_preenchido:  'Formulário',
  link_assinatura_gerado: 'Link Assinatura',
  contrato_assinado:      'Contrato Assinado',
  cobranca_gerada:        'Cobrança Gerada',
  fatura_vencida:         'Fatura Vencida',
  pagamento_confirmado:   'Pagamento Confirmado',
  manual:                 'Manual',
};

const EVENT_COLORS: Record<string, string> = {
  formulario_preenchido:  '#38bdf8',
  link_assinatura_gerado: '#a78bfa',
  contrato_assinado:      '#34d399',
  cobranca_gerada:        '#fbbf24',
  fatura_vencida:         '#f87171',
  pagamento_confirmado:   '#4ade80',
  manual:                 '#94a3b8',
};

/* ─────────────────────────────────────────────────────── */
/* Sub-components                                           */
/* ─────────────────────────────────────────────────────── */

/** Channel KPI card */
function ChannelCard({ ch, logs, delay }: { ch: typeof CHANNEL_DEFS[0]; logs: DispatchLog[]; delay: number }) {
  const total  = logs.filter(l => l.channel === ch.key).length;
  const sent   = logs.filter(l => l.channel === ch.key && l.status === 'sent').length;
  const failed = logs.filter(l => l.channel === ch.key && l.status === 'failed').length;
  const rate   = total > 0 ? Math.round((sent / total) * 100) : 0;
  const { Icon } = ch;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 280, damping: 24 }}
      className="relative rounded-2xl border p-5 overflow-hidden"
      style={{
        background: `linear-gradient(135deg, rgba(${ch.colorRgb},0.06) 0%, rgba(${ch.colorRgb},0.02) 100%)`,
        borderColor: `rgba(${ch.colorRgb},0.25)`,
        boxShadow: total > 0 ? `0 0 28px -10px rgba(${ch.colorRgb},0.4)` : 'none',
      }}
    >
      {/* Ambient glow corner */}
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, rgba(${ch.colorRgb},0.15) 0%, transparent 70%)` }} />

      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center border"
          style={{ background: `rgba(${ch.colorRgb},0.12)`, borderColor: `rgba(${ch.colorRgb},0.3)` }}>
          <Icon className="h-5 w-5" style={{ color: ch.color }} />
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold" style={{ color: ch.color }}>{ch.label}</p>
          <p className="text-[10px] text-muted-foreground">canal</p>
        </div>
      </div>

      {/* Big number */}
      <motion.p
        className="text-3xl font-extrabold mb-1 tabular-nums"
        style={{ color: ch.color }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: delay + 0.15, type: 'spring' }}
      >
        {total}
      </motion.p>
      <p className="text-xs text-muted-foreground mb-3">disparos totais</p>

      {/* Success / failure chips */}
      <div className="flex gap-2 mb-3">
        <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="h-2.5 w-2.5" />{sent} ok
        </span>
        {failed > 0 && (
          <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle className="h-2.5 w-2.5" />{failed} falha
          </span>
        )}
        {total > 0 && (
          <span className="ml-auto text-[11px] font-bold" style={{ color: ch.color }}>{rate}%</span>
        )}
      </div>

      {/* Progress track */}
      {total > 0 && (
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: `rgba(${ch.colorRgb},0.12)` }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, rgba(${ch.colorRgb},0.8), ${ch.color})` }}
            initial={{ width: 0 }}
            animate={{ width: `${rate}%` }}
            transition={{ delay: delay + 0.3, duration: 0.7, ease: 'easeOut' }}
          />
        </div>
      )}
    </motion.div>
  );
}

/** Recharts custom tooltip */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border px-3 py-2 text-xs shadow-xl"
      style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border)/0.6)' }}>
      <p className="font-semibold mb-1 text-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

/** Bar chart of sent/failed per event */
function EventBarChart({ logs }: { logs: DispatchLog[] }) {
  const data = useMemo(() => {
    const events = [...new Set(logs.map(l => l.event_type))];
    return events.map(ev => ({
      name: EVENT_LABELS[ev] || ev,
      sent:   logs.filter(l => l.event_type === ev && l.status === 'sent').length,
      failed: logs.filter(l => l.event_type === ev && l.status === 'failed').length,
      color: EVENT_COLORS[ev] || '#94a3b8',
    })).sort((a, b) => (b.sent + b.failed) - (a.sent + a.failed));
  }, [logs]);

  if (data.length === 0) return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
      <BarChart3 className="h-8 w-8 opacity-30" />
      <p className="text-xs">Nenhum dado disponível</p>
    </div>
  );

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.3)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="sent" name="Enviados" radius={[4, 4, 0, 0]} fill="#22c55e" opacity={0.85} />
        <Bar dataKey="failed" name="Falhas" radius={[4, 4, 0, 0]} fill="#ef4444" opacity={0.75} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Pie chart of channel distribution */
function ChannelPieChart({ logs }: { logs: DispatchLog[] }) {
  const data = useMemo(() => CHANNEL_DEFS.map(ch => ({
    name: ch.label,
    value: logs.filter(l => l.channel === ch.key).length,
    color: ch.color,
  })).filter(d => d.value > 0), [logs]);

  if (data.length === 0) return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
      <Activity className="h-8 w-8 opacity-30" />
      <p className="text-xs">Nenhum dado disponível</p>
    </div>
  );

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} opacity={0.85} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** 24h activity heatmap as a bar chart */
function HourHeatmap({ logs }: { logs: DispatchLog[] }) {
  const data = useMemo(() => Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, '0')}h`,
    count: logs.filter(l => l.created_at && new Date(l.created_at).getHours() === h).length,
  })), [logs]);

  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <ResponsiveContainer width="100%" height={100}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
        <XAxis dataKey="hour" tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false}
          interval={2} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="count" name="Disparos" radius={[2, 2, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i}
              fill={`rgba(168,85,247,${0.15 + (d.count / maxCount) * 0.75})`}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Expandable error row */
function LogRow({ log, index }: { log: DispatchLog; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const ch = CHANNEL_DEFS.find(c => c.key === log.channel) || CHANNEL_DEFS[0];
  const { Icon } = ch;
  const isSent = log.status === 'sent';
  const recipient = log.recipient_email || log.recipient_phone || '—';

  return (
    <>
      <motion.tr
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: Math.min(index * 0.018, 0.4) }}
        onClick={() => !isSent && log.error_message && setExpanded(p => !p)}
        className={cn(
          'border-b transition-colors',
          !isSent && log.error_message ? 'cursor-pointer' : '',
          isSent ? 'hover:bg-emerald-500/3' : 'hover:bg-red-500/4',
        )}
        style={{ borderColor: 'hsl(var(--border)/0.2)' }}
      >
        {/* Canal */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `rgba(${ch.colorRgb},0.14)` }}>
              <Icon className="h-3.5 w-3.5" style={{ color: ch.color }} />
            </div>
            <span className="text-xs font-semibold capitalize" style={{ color: ch.color }}>{ch.label}</span>
          </div>
        </td>
        {/* Evento */}
        <td className="px-3 py-3">
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium"
            style={{
              background: `${EVENT_COLORS[log.event_type] || '#94a3b8'}12`,
              borderColor: `${EVENT_COLORS[log.event_type] || '#94a3b8'}30`,
              color: EVENT_COLORS[log.event_type] || '#94a3b8',
            }}>
            {EVENT_LABELS[log.event_type] || log.event_type}
          </span>
        </td>
        {/* Destinatário */}
        <td className="px-3 py-3 text-xs text-muted-foreground max-w-[150px]">
          <span className="truncate block">{recipient}</span>
        </td>
        {/* Status */}
        <td className="px-3 py-3">
          {isSent ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-2.5 w-2.5" /> Enviado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
              <XCircle className="h-2.5 w-2.5" /> Falha
              {log.error_message && (
                expanded
                  ? <ChevronUp className="h-2.5 w-2.5 ml-1" />
                  : <ChevronDown className="h-2.5 w-2.5 ml-1" />
              )}
            </span>
          )}
        </td>
        {/* Tentativas */}
        <td className="px-3 py-3 text-center">
          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded',
            log.attempts > 2 ? 'text-red-400 bg-red-500/10' :
            log.attempts > 1 ? 'text-amber-400 bg-amber-500/10' : 'text-muted-foreground')}>
            {log.attempts}×
          </span>
        </td>
        {/* Data */}
        <td className="px-3 py-3 text-muted-foreground whitespace-nowrap text-[10px]">
          <div className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5 flex-shrink-0" />
            {log.created_at
              ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })
              : '—'}
          </div>
          <div className="text-[9px] text-muted-foreground/50 mt-0.5">
            {log.created_at ? format(new Date(log.created_at), 'dd/MM HH:mm') : ''}
          </div>
        </td>
      </motion.tr>
      {/* Expandable error detail */}
      <AnimatePresence>
        {expanded && log.error_message && (
          <tr>
            <td colSpan={6} className="px-4 pb-3 pt-0">
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-xl p-3 text-[10px] font-mono leading-relaxed overflow-hidden"
                style={{ background: 'rgba(239,68,68,0.06)', borderLeft: '2px solid rgba(239,68,68,0.4)', color: '#f87171' }}
              >
                <p className="font-bold text-red-400 mb-1 text-[9px] uppercase tracking-wider">Detalhe do Erro</p>
                {log.error_message}
                {log.response_body && (
                  <>
                    <p className="font-bold text-amber-400 mb-1 mt-2 text-[9px] uppercase tracking-wider">Resposta do Servidor</p>
                    <span className="text-amber-400/80">{log.response_body.slice(0, 400)}</span>
                  </>
                )}
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─────────────────────────────────────────────────────── */
/* Main component                                           */
/* ─────────────────────────────────────────────────────── */
export function ReportsTab({ dispatchLogs, logsLoading, onRefresh }: Props) {
  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [eventFilter, setEventFilter]     = useState('all');
  const [chartMode, setChartMode]         = useState<'bar' | 'pie'>('bar');

  const totalSent   = dispatchLogs.filter(l => l.status === 'sent').length;
  const totalFailed = dispatchLogs.filter(l => l.status === 'failed').length;
  const totalRate   = dispatchLogs.length > 0
    ? Math.round((totalSent / dispatchLogs.length) * 100)
    : 0;

  const uniqueEvents = useMemo(() => [...new Set(dispatchLogs.map(l => l.event_type))], [dispatchLogs]);

  const filteredLogs = useMemo(() => dispatchLogs.filter(l => {
    const ch = channelFilter === 'all' || l.channel === channelFilter;
    const st = statusFilter === 'all' || l.status === statusFilter;
    const ev = eventFilter === 'all' || l.event_type === eventFilter;
    return ch && st && ev;
  }), [dispatchLogs, channelFilter, statusFilter, eventFilter]);

  return (
    <motion.div
      key="relatorios"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      {/* ── KPI Cards per channel ──────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {CHANNEL_DEFS.map((ch, i) => (
          <ChannelCard key={ch.key} ch={ch} logs={dispatchLogs} delay={i * 0.07} />
        ))}
      </div>

      {/* ── Global Summary Row ──────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total disparos',      value: dispatchLogs.length, Icon: Activity,      color: '#a855f7' },
          { label: 'Taxa geral entrega',  value: dispatchLogs.length > 0 ? `${totalRate}%` : '—', Icon: TrendingUp, color: '#10b981' },
          { label: 'Falhas acumuladas',   value: totalFailed,          Icon: AlertCircle,   color: '#ef4444' },
        ].map(({ label, value, Icon, color }, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.28 + i * 0.06, type: 'spring' }}
            className="rounded-2xl border p-4 text-center relative overflow-hidden"
            style={{ background: 'hsl(var(--card)/0.5)', borderColor: `rgba(${color === '#a855f7' ? '168,85,247' : color === '#10b981' ? '16,185,129' : '239,68,68'},0.2)` }}
          >
            <div className="absolute -top-5 -right-5 w-16 h-16 rounded-full pointer-events-none"
              style={{ background: `${color}10` }} />
            <Icon className="h-5 w-5 mx-auto mb-2" style={{ color }} />
            <motion.p
              className="text-2xl font-extrabold tabular-nums"
              style={{ color }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + i * 0.06 }}
            >
              {value}
            </motion.p>
            <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Charts Row ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Event performance chart */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl border p-5 overflow-hidden"
          style={{ background: 'hsl(var(--card)/0.5)', borderColor: 'hsl(var(--border)/0.5)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Desempenho por Evento</h3>
              <p className="text-[10px] text-muted-foreground">Enviados vs. falhas por tipo</p>
            </div>
            <div className="flex gap-1">
              {(['bar', 'pie'] as const).map(m => (
                <button key={m} onClick={() => setChartMode(m)}
                  className={cn('px-2 py-1 rounded-lg text-[10px] font-medium border transition-all',
                    chartMode === m
                      ? 'bg-violet-500/15 border-violet-500/30 text-violet-400'
                      : 'bg-card/60 border-border/40 text-muted-foreground hover:text-foreground')}>
                  {m === 'bar' ? 'Barras' : 'Pizza'}
                </button>
              ))}
            </div>
          </div>
          <AnimatePresence mode="wait">
            {chartMode === 'bar'
              ? <motion.div key="bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><EventBarChart logs={dispatchLogs} /></motion.div>
              : <motion.div key="pie" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><ChannelPieChart logs={dispatchLogs} /></motion.div>
            }
          </AnimatePresence>
        </motion.div>

        {/* 24h heatmap + quick stats */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.45 }}
          className="rounded-2xl border p-5 space-y-4 overflow-hidden"
          style={{ background: 'hsl(var(--card)/0.5)', borderColor: 'hsl(var(--border)/0.5)' }}
        >
          <div>
            <h3 className="text-sm font-semibold text-foreground">Atividade por Hora (24h)</h3>
            <p className="text-[10px] text-muted-foreground">Distribuição de disparos ao longo do dia</p>
          </div>
          <HourHeatmap logs={dispatchLogs} />

          {/* Top event */}
          {(() => {
            const eventCounts = uniqueEvents.map(ev => ({
              ev,
              count: dispatchLogs.filter(l => l.event_type === ev).length,
            })).sort((a, b) => b.count - a.count);
            const top = eventCounts[0];
            if (!top) return null;
            return (
              <div className="flex items-center gap-3 p-3 rounded-xl border"
                style={{ background: `${EVENT_COLORS[top.ev] || '#94a3b8'}08`, borderColor: `${EVENT_COLORS[top.ev] || '#94a3b8'}25` }}>
                <Zap className="h-4 w-4 flex-shrink-0" style={{ color: EVENT_COLORS[top.ev] || '#94a3b8' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground">Evento mais disparado</p>
                  <p className="text-xs font-semibold text-foreground truncate">{EVENT_LABELS[top.ev] || top.ev}</p>
                </div>
                <span className="text-sm font-extrabold tabular-nums" style={{ color: EVENT_COLORS[top.ev] || '#94a3b8' }}>
                  {top.count}
                </span>
              </div>
            );
          })()}
        </motion.div>
      </div>

      {/* ── Dispatch Log Table ─────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="rounded-2xl border overflow-hidden"
        style={{ background: 'hsl(var(--card)/0.5)', borderColor: 'hsl(var(--border)/0.5)' }}
      >
        {/* Table header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b"
          style={{ borderColor: 'hsl(var(--border)/0.4)' }}>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-semibold">Histórico de Disparos</span>
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {filteredLogs.length} / {dispatchLogs.length}
            </span>
            {filteredLogs.some(l => l.status === 'failed') && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                {filteredLogs.filter(l => l.status === 'failed').length} erros
              </span>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="h-7 text-xs rounded-lg px-2 border-border/50 bg-card/60 w-28">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos canais</SelectItem>
                {CHANNEL_DEFS.map(ch => (
                  <SelectItem key={ch.key} value={ch.key}>{ch.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-7 text-xs rounded-lg px-2 border-border/50 bg-card/60 w-24">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="failed">Falha</SelectItem>
              </SelectContent>
            </Select>

            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="h-7 text-xs rounded-lg px-2 border-border/50 bg-card/60 w-32">
                <SelectValue placeholder="Evento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos eventos</SelectItem>
                {uniqueEvents.map(ev => (
                  <SelectItem key={ev} value={ev}>{EVENT_LABELS[ev] || ev}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={onRefresh}
              className="h-7 w-7 rounded-lg border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              style={{ borderColor: 'hsl(var(--border)/0.5)', background: 'hsl(var(--card)/0.6)' }}
            >
              <RefreshCw className={cn('h-3 w-3', logsLoading && 'animate-spin')} />
            </motion.button>
          </div>
        </div>

        {/* Table content */}
        {logsLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <motion.div key={i} className="h-11 rounded-xl bg-muted/40"
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.1 }} />
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <BarChart3 className="h-10 w-10 text-muted-foreground/25" />
            <p className="text-sm text-muted-foreground font-medium">Nenhum disparo encontrado</p>
            <p className="text-xs text-muted-foreground/60">
              {dispatchLogs.length === 0
                ? 'Os disparos aparecerão aqui após o primeiro envio multicanal'
                : 'Tente ajustar os filtros'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: 'hsl(var(--border)/0.3)' }}>
                  {['Canal', 'Evento', 'Destinatário', 'Status', 'Tent.', 'Data'].map(h => (
                    <th key={h} className="text-left px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground first:pl-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLogs.slice(0, 150).map((log, i) => (
                  <LogRow key={log.id} log={log} index={i} />
                ))}
              </tbody>
            </table>
            {filteredLogs.length > 150 && (
              <div className="px-5 py-3 border-t text-center" style={{ borderColor: 'hsl(var(--border)/0.3)' }}>
                <p className="text-xs text-muted-foreground">
                  Exibindo <strong>150</strong> de <strong>{filteredLogs.length}</strong> registros
                </p>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
