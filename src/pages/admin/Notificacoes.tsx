import { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import {
  Bell, Plus, Send, Users, FileText, Trash2, Edit, Copy,
  CheckCircle2, AlertTriangle, Info, Zap, Sparkles, Radio,
  Clock, Search, TrendingUp, Activity,
  RefreshCw, Eye, MessageSquare, Smartphone,
  BarChart3, Mail, Calendar, X, Check, Wifi,
} from 'lucide-react';
import { ReportsTab } from '@/components/admin/notifications/ReportsTab';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/* ─────────────────────────────────────────────────────── */
/* Types                                                    */
/* ─────────────────────────────────────────────────────── */
interface Client {
  id: string;
  full_name: string | null;
  email: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string | null;
  created_at: string | null;
  user_id: string | null;
  read: boolean | null;
  link: string | null;
  profiles?: { full_name: string | null; email: string } | null;
}

interface NotificationTemplate {
  id: string;
  name: string;
  title: string;
  message: string;
  type: string;
  category: string;
  is_active: boolean;
  created_at: string;
}

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

interface ScheduledNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  scheduled_at: string;
  status: 'pending' | 'sent' | 'cancelled';
  target: 'all' | string;
  channels: string[];
  created_at: string;
}

/* ─────────────────────────────────────────────────────── */
/* Config                                                   */
/* ─────────────────────────────────────────────────────── */
const notificationTypes = [
  { value: 'info',    label: 'Informação', icon: Info,          colorClass: 'text-sky-400',    bgClass: 'bg-sky-500/10',    borderClass: 'border-sky-500/20',    glow: 'rgba(14,165,233,0.25)' },
  { value: 'success', label: 'Sucesso',    icon: CheckCircle2,  colorClass: 'text-emerald-400',bgClass: 'bg-emerald-500/10', borderClass: 'border-emerald-500/20', glow: 'rgba(16,185,129,0.25)' },
  { value: 'warning', label: 'Aviso',      icon: AlertTriangle, colorClass: 'text-amber-400',  bgClass: 'bg-amber-500/10',  borderClass: 'border-amber-500/20',  glow: 'rgba(245,158,11,0.25)' },
  { value: 'error',   label: 'Urgente',    icon: Zap,           colorClass: 'text-red-400',    bgClass: 'bg-red-500/10',    borderClass: 'border-red-500/20',    glow: 'rgba(239,68,68,0.25)' },
];

const templateCategories = [
  { value: 'geral',    label: 'Geral' },
  { value: 'cobranca', label: 'Cobrança Extrajudicial' },
  { value: 'inpi',     label: 'Exigências INPI' },
];

/* ─────────────────────────────────────────────────────── */
/* Sub-components                                           */
/* ─────────────────────────────────────────────────────── */

/** Ambient scanline */
function ScanLine() {
  return (
    <motion.div
      className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
      style={{ background: 'linear-gradient(90deg,transparent,rgba(168,85,247,0.5),transparent)' }}
      animate={{ x: ['-100%', '100%'] }}
      transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
    />
  );
}

/** Floating particle field */
function ParticleField({ n = 18, color = '168,85,247' }: { n?: number; color?: string }) {
  const pts = useRef(
    Array.from({ length: n }).map(() => ({
      x: Math.random() * 100, y: Math.random() * 100,
      s: 1.5 + Math.random() * 2,
      d: 8 + Math.random() * 12,
      delay: Math.random() * 6,
      op: 0.06 + Math.random() * 0.12,
    }))
  );
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {pts.current.map((p, i) => (
        <motion.div key={i} className="absolute rounded-full"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s,
            background: `radial-gradient(circle,rgba(${color},${p.op}) 0%,transparent 70%)` }}
          animate={{ y: [0, -22, 0], opacity: [p.op, p.op * 2.5, p.op] }}
          transition={{ duration: p.d, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/** HUD metric chip */
function MetricChip({ icon: Icon, value, label, color }: { icon: React.ElementType; value: number | string; label: string; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 px-3 py-2 rounded-xl border backdrop-blur-sm"
      style={{ background: `${color}10`, borderColor: `${color}30` }}
    >
      <Icon className="h-3.5 w-3.5" style={{ color }} />
      <div>
        <p className="text-[11px] font-bold leading-none" style={{ color }}>{value}</p>
        <p className="text-[9px] text-muted-foreground mt-0.5 leading-none">{label}</p>
      </div>
    </motion.div>
  );
}

/** Type badge */
function TypeBadge({ type }: { type: string | null }) {
  const t = notificationTypes.find(n => n.value === type) || notificationTypes[0];
  const Icon = t.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border', t.bgClass, t.borderClass, t.colorClass)}>
      <Icon className="h-2.5 w-2.5" />
      {t.label}
    </span>
  );
}

/** Notification card with mark-read and delete actions */
function NotificationCard({
  n, index, onMarkRead, onDelete,
}: {
  n: Notification;
  index: number;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = notificationTypes.find(x => x.value === n.type) || notificationTypes[0];
  const Icon = t.icon;
  const recipientName = (n.profiles as any)?.full_name || (n.profiles as any)?.email || 'Desconhecido';
  const timeAgo = n.created_at
    ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })
    : '';
  const [actionsVisible, setActionsVisible] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -16, y: 4 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 16, scale: 0.95 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 300, damping: 26 }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className="group relative rounded-2xl border backdrop-blur-sm overflow-hidden cursor-default"
      style={{
        background: `linear-gradient(135deg,hsl(var(--card)/0.6) 0%,${t.glow.replace('0.25','0.04')} 100%)`,
        borderColor: `${t.glow.replace('0.25','0.18')}`,
        boxShadow: n.read ? 'none' : `0 0 20px -8px ${t.glow}`,
      }}
      onMouseEnter={() => setActionsVisible(true)}
      onMouseLeave={() => setActionsVisible(false)}
    >
      {/* Left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl"
        style={{ background: `linear-gradient(180deg,transparent,${t.glow.replace('0.25','0.9')},transparent)` }} />

      {/* Hover glow */}
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 rounded-2xl pointer-events-none"
        style={{ background: `radial-gradient(600px circle at 50% 50%,${t.glow.replace('0.25','0.06')},transparent 70%)` }}
        transition={{ duration: 0.3 }}
      />

      <div className="flex items-start gap-3 p-4 pl-5 pr-3">
        {/* Icon orb */}
        <div className={cn('flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border', t.bgClass, t.borderClass)}>
          <Icon className={cn('h-4 w-4', t.colorClass)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-sm text-foreground leading-tight">{n.title}</h4>
              <TypeBadge type={n.type} />
              {!n.read && (
                <motion.span
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full bg-primary"
                />
              )}
            </div>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0 flex items-center gap-1 mt-0.5">
              <Clock className="h-2.5 w-2.5" />
              {timeAgo}
            </span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed mb-2 line-clamp-2">{n.message}</p>

          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Users className="h-3 w-3 text-primary" />
            </div>
            <span className="text-[11px] text-muted-foreground">{recipientName}</span>
            {n.link && (
              <span className="text-[10px] text-primary/60 truncate max-w-[100px]">{n.link}</span>
            )}
            {n.read && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/60">
                <Eye className="h-2.5 w-2.5" />
                Lida
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <AnimatePresence>
          {actionsVisible && (
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              className="flex flex-col gap-1 ml-1 flex-shrink-0"
            >
              {!n.read && (
                <motion.button
                  whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }}
                  onClick={() => onMarkRead(n.id)}
                  title="Marcar como lida"
                  className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                >
                  <Check className="h-3 w-3" />
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }}
                onClick={() => onDelete(n.id)}
                title="Excluir notificação"
                className="w-7 h-7 rounded-lg bg-destructive/10 border border-destructive/25 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/** Template card */
function TemplateCard({
  template, index, onEdit, onDelete,
}: {
  template: NotificationTemplate;
  index: number;
  onEdit: (t: NotificationTemplate) => void;
  onDelete: (id: string) => void;
}) {
  const t = notificationTypes.find(x => x.value === template.type) || notificationTypes[0];
  const Icon = t.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 280, damping: 24 }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className="group relative rounded-2xl border backdrop-blur-sm overflow-hidden"
      style={{ background: 'hsl(var(--card)/0.5)', borderColor: 'hsl(var(--border)/0.6)' }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl"
        style={{ background: `linear-gradient(180deg,transparent,${t.glow.replace('0.25','0.8')},transparent)` }} />

      <div className="flex items-start gap-3 p-4 pl-5">
        <div className={cn('flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border', t.bgClass, t.borderClass)}>
          <Icon className={cn('h-4 w-4', t.colorClass)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-sm">{template.name}</h4>
            <TypeBadge type={template.type} />
          </div>
          <p className="text-xs font-medium text-foreground/80 mb-1">{template.title}</p>
          <p className="text-xs text-muted-foreground line-clamp-2">{template.message}</p>
        </div>
        <div className="flex flex-col gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.92 }}
            onClick={() => onEdit(template)}
            className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors">
            <Edit className="h-3 w-3" />
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.92 }}
            onClick={() => onDelete(template.id)}
            className="w-7 h-7 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-colors">
            <Trash2 className="h-3 w-3" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

/** Scheduled notification card */
function ScheduleCard({
  item, index, onCancel,
}: {
  item: ScheduledNotification;
  index: number;
  onCancel: (id: string) => void;
}) {
  const t = notificationTypes.find(x => x.value === item.type) || notificationTypes[0];
  const isPast = new Date(item.scheduled_at) < new Date();
  const isSent = item.status === 'sent';
  const isCancelled = item.status === 'cancelled';

  const statusBadge = isSent
    ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5" />Enviado</span>
    : isCancelled
    ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40 font-semibold">Cancelado</span>
    : isPast
    ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5" />Atrasado</span>
    : <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold flex items-center gap-1"><Clock className="h-2.5 w-2.5" />Agendado</span>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 280, damping: 24 }}
      className="group relative rounded-2xl border backdrop-blur-sm overflow-hidden"
      style={{
        background: 'hsl(var(--card)/0.5)',
        borderColor: isCancelled ? 'hsl(var(--border)/0.3)' : `${t.glow.replace('0.25','0.18')}`,
        opacity: isCancelled ? 0.5 : 1,
      }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl"
        style={{ background: `linear-gradient(180deg,transparent,${t.glow.replace('0.25','0.8')},transparent)` }} />

      <div className="flex items-start gap-3 p-4 pl-5">
        <div className={cn('flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border', t.bgClass, t.borderClass)}>
          <Calendar className={cn('h-4 w-4', t.colorClass)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-semibold text-sm text-foreground">{item.title}</h4>
            <TypeBadge type={item.type} />
            {statusBadge}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.message}</p>
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {format(new Date(item.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-2.5 w-2.5" />
              {item.target === 'all' ? 'Todos os clientes' : 'Cliente específico'}
            </span>
            <span className="flex items-center gap-1">
              <Radio className="h-2.5 w-2.5" />
              {item.channels.join(', ')}
            </span>
          </div>
        </div>
        {item.status === 'pending' && (
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => onCancel(item.id)}
            className="w-7 h-7 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0">
            <X className="h-3 w-3" />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────── */
/* Page                                                     */
/* ─────────────────────────────────────────────────────── */
export default function AdminNotificacoes() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [dispatchLogs, setDispatchLogs] = useState<DispatchLog[]>([]);
  const [scheduledList, setScheduledList] = useState<ScheduledNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'templates' | 'agendamentos' | 'relatorios'>('history');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [realtimePulse, setRealtimePulse] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [sendToAll, setSendToAll] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [formData, setFormData] = useState({ title: '', message: '', type: 'info', user_id: '', link: '' });
  const [templateForm, setTemplateForm] = useState({ name: '', title: '', message: '', type: 'info', category: 'geral' });
  const [channels, setChannels] = useState({ crm: true, sms: false, whatsapp: false, email: false });
  const [scheduleForm, setScheduleForm] = useState({
    title: '', message: '', type: 'info', scheduled_at: '', target: 'all', user_id: '',
    channels: { crm: true, sms: false, whatsapp: false, email: false },
  });

  useEffect(() => { fetchNotifications(); fetchClients(); fetchTemplates(); fetchScheduled(); }, []);
  useEffect(() => { if (activeTab === 'relatorios') fetchDispatchLogs(); }, [activeTab]);

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        setRealtimePulse(true);
        setTimeout(() => setRealtimePulse(false), 1500);
        fetchNotifications();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, () => {
        fetchNotifications();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications' }, () => {
        fetchNotifications();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications').select('*, profiles(full_name, email)')
      .order('created_at', { ascending: false }).limit(200);
    if (error) toast.error('Erro ao carregar notificações');
    else setNotifications((data || []) as Notification[]);
    setLoading(false);
  };

  const fetchDispatchLogs = async () => {
    setLogsLoading(true);
    const { data, error } = await supabase
      .from('notification_dispatch_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) toast.error('Erro ao carregar logs de disparo');
    else setDispatchLogs(data || []);
    setLogsLoading(false);
  };

  const fetchClients = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name, email');
    setClients(data || []);
  };

  const fetchTemplates = async () => {
    const { data } = await supabase.from('notification_templates')
      .select('*').eq('is_active', true).order('category');
    setTemplates(data || []);
  };

  const fetchScheduled = async () => {
    // Load from localStorage as lightweight scheduling store
    const raw = localStorage.getItem('wm_scheduled_notifications');
    if (raw) {
      try { setScheduledList(JSON.parse(raw)); } catch {}
    }
  };

  const handleTemplateSelect = (id: string) => {
    setSelectedTemplate(id);
    const t = templates.find(x => x.id === id);
    if (t) setFormData({ ...formData, title: t.title, message: t.message, type: t.type });
  };

  const handleMarkRead = async (id: string) => {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (error) { toast.error('Erro ao marcar como lida'); return; }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    toast.success('Notificação marcada como lida');
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir notificação'); return; }
    setNotifications(prev => prev.filter(n => n.id !== id));
    toast.success('Notificação excluída');
  };

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) { toast.info('Nenhuma notificação não lida'); return; }
    const { error } = await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
    if (error) { toast.error('Erro ao marcar todas como lidas'); return; }
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast.success(`${unreadIds.length} notificações marcadas como lidas`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.message) { toast.error('Preencha título e mensagem'); return; }
    if (!sendToAll && !formData.user_id) { toast.error('Selecione um cliente ou "Enviar para todos"'); return; }
    setSending(true);

    const base = {
      title: formData.title,
      message: formData.message,
      type: formData.type,
      link: formData.link || null,
      read: false,
    };

    // CRM insert
    if (channels.crm) {
      if (sendToAll) {
        const rows = clients.map(c => ({ ...base, user_id: c.id }));
        const { error } = await supabase.from('notifications').insert(rows);
        if (error) toast.error('Erro ao enviar no CRM');
        else toast.success(`CRM: enviado para ${clients.length} clientes`);
      } else {
        const { error } = await supabase.from('notifications').insert({ ...base, user_id: formData.user_id });
        if (error) toast.error('Erro ao enviar no CRM');
        else toast.success('CRM: notificação enviada!');
      }
    }

    // SMS + WhatsApp + Email via multichannel engine
    const extraChannels = (['sms', 'whatsapp', 'email'] as const).filter(c => channels[c]);
    if (extraChannels.length > 0 && !sendToAll && formData.user_id) {
      const client = clients.find(c => c.id === formData.user_id);
      await supabase.functions.invoke('send-multichannel-notification', {
        body: {
          event_type: 'manual',
          channels: extraChannels,
          recipient: {
            nome: client?.full_name || 'Cliente',
            email: client?.email,
            user_id: formData.user_id,
          },
          data: {
            titulo: formData.title,
            mensagem_custom: formData.message,
            link: formData.link,
          },
        },
      });
      toast.success(`${extraChannels.map(c => c.toUpperCase()).join(' + ')}: enviado!`);
    }

    fetchNotifications(); setDialogOpen(false); resetForm();
    setSending(false);
  };

  const handleTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.name || !templateForm.title || !templateForm.message) { toast.error('Preencha todos os campos'); return; }
    if (editingTemplate) {
      const { error } = await supabase.from('notification_templates').update(templateForm).eq('id', editingTemplate.id);
      if (error) toast.error('Erro ao atualizar'); else { toast.success('Template atualizado'); fetchTemplates(); setTemplateDialogOpen(false); resetTemplateForm(); }
    } else {
      const { error } = await supabase.from('notification_templates').insert(templateForm);
      if (error) toast.error('Erro ao criar'); else { toast.success('Template criado'); fetchTemplates(); setTemplateDialogOpen(false); resetTemplateForm(); }
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Excluir este template?')) return;
    const { error } = await supabase.from('notification_templates').update({ is_active: false }).eq('id', id);
    if (error) toast.error('Erro ao excluir'); else { toast.success('Template excluído'); fetchTemplates(); }
  };

  const handleEditTemplate = (t: NotificationTemplate) => {
    setEditingTemplate(t);
    setTemplateForm({ name: t.name, title: t.title, message: t.message, type: t.type, category: t.category });
    setTemplateDialogOpen(true);
  };

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.title || !scheduleForm.message || !scheduleForm.scheduled_at) {
      toast.error('Preencha título, mensagem e data/hora'); return;
    }
    if (new Date(scheduleForm.scheduled_at) <= new Date()) {
      toast.error('A data/hora precisa ser no futuro'); return;
    }
    const newItem: ScheduledNotification = {
      id: crypto.randomUUID(),
      title: scheduleForm.title,
      message: scheduleForm.message,
      type: scheduleForm.type,
      scheduled_at: scheduleForm.scheduled_at,
      status: 'pending',
      target: scheduleForm.target as 'all' | string,
      channels: Object.entries(scheduleForm.channels).filter(([, v]) => v).map(([k]) => k),
      created_at: new Date().toISOString(),
    };
    const updated = [...scheduledList, newItem];
    setScheduledList(updated);
    localStorage.setItem('wm_scheduled_notifications', JSON.stringify(updated));
    toast.success('Notificação agendada com sucesso!');
    setScheduleDialogOpen(false);
    setScheduleForm({ title: '', message: '', type: 'info', scheduled_at: '', target: 'all', user_id: '', channels: { crm: true, sms: false, whatsapp: false, email: false } });
  };

  const handleCancelSchedule = (id: string) => {
    const updated = scheduledList.map(s => s.id === id ? { ...s, status: 'cancelled' as const } : s);
    setScheduledList(updated);
    localStorage.setItem('wm_scheduled_notifications', JSON.stringify(updated));
    toast.success('Agendamento cancelado');
  };

  const resetForm = () => {
    setFormData({ title: '', message: '', type: 'info', user_id: '', link: '' });
    setSendToAll(false);
    setSelectedTemplate('');
    setChannels({ crm: true, sms: false, whatsapp: false, email: false });
  };

  const resetTemplateForm = () => { setTemplateForm({ name: '', title: '', message: '', type: 'info', category: 'geral' }); setEditingTemplate(null); };

  const getCategoryLabel = (cat: string) => templateCategories.find(c => c.value === cat)?.label || cat;

  const groupedTemplates = templates.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {} as Record<string, NotificationTemplate[]>);

  const filteredNotifications = notifications.filter(n => {
    const matchType = filterType === 'all' || n.type === filterType;
    const matchSearch = !search ||
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.message.toLowerCase().includes(search.toLowerCase()) ||
      (n.profiles as any)?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      (n.profiles as any)?.email?.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const stats = {
    total: notifications.length,
    unread: notifications.filter(n => !n.read).length,
    urgent: notifications.filter(n => n.type === 'error').length,
    today: notifications.filter(n => n.created_at && new Date(n.created_at).toDateString() === new Date().toDateString()).length,
    scheduled: scheduledList.filter(s => s.status === 'pending').length,
  };

  const inputStyle = "bg-card/60 border-border/50 backdrop-blur-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 rounded-xl transition-all";

  const channelOptions = [
    { key: 'crm' as const,      label: 'CRM (in-app)',        icon: Bell,          color: 'rgb(168,85,247)' },
    { key: 'sms' as const,      label: 'SMS (Zenvia)',         icon: Smartphone,    color: 'rgb(99,102,241)' },
    { key: 'whatsapp' as const, label: 'WhatsApp (BotConversa)', icon: MessageSquare, color: 'rgb(34,197,94)' },
    { key: 'email' as const,    label: 'E-mail (Resend)',      icon: Mail,          color: 'rgb(59,130,246)' },
  ];

  return (
    <>
      <div className="space-y-5 pb-24 md:pb-8">

        {/* ── HEADER ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="relative rounded-2xl overflow-hidden border"
          style={{
            background: 'linear-gradient(135deg,hsl(var(--card)) 0%,hsl(var(--card)/0.6) 100%)',
            borderColor: 'hsl(var(--border)/0.5)',
            boxShadow: '0 0 40px -12px rgba(168,85,247,0.15)',
          }}
        >
          <ParticleField />
          <ScanLine />

          <div className="relative p-5 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              {/* Title block */}
              <div className="flex items-center gap-3">
                <motion.div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center relative overflow-hidden flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,rgba(168,85,247,0.2),rgba(139,92,246,0.1))', border: '1px solid rgba(168,85,247,0.3)' }}
                  animate={{ boxShadow: ['0 0 0px rgba(168,85,247,0)', '0 0 20px rgba(168,85,247,0.4)', '0 0 0px rgba(168,85,247,0)'] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <Bell className="h-5 w-5 text-violet-400" />
                  <motion.div className="absolute inset-0 rounded-2xl" style={{ background: 'conic-gradient(from 0deg,transparent,rgba(168,85,247,0.15),transparent)' }}
                    animate={{ rotate: 360 }} transition={{ duration: 5, repeat: Infinity, ease: 'linear' }} />
                </motion.div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Central de Notificações</h1>
                    {/* Realtime indicator */}
                    <motion.div
                      animate={{ scale: realtimePulse ? [1, 1.4, 1] : 1, opacity: realtimePulse ? [1, 0.6, 1] : 1 }}
                      transition={{ duration: 0.5 }}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}
                    >
                      <Wifi className="h-2.5 w-2.5 text-emerald-400" />
                      <span className="text-[9px] font-bold text-emerald-400">LIVE</span>
                    </motion.div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Radio className="h-3 w-3 text-violet-400" />
                    Comunicação em tempo real com seus clientes
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap items-center">
                <motion.button
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border text-emerald-400 hover:text-emerald-300 transition-colors"
                  style={{ background: 'rgba(34,197,94,0.06)', borderColor: 'rgba(34,197,94,0.2)' }}
                >
                  <Check className="h-3.5 w-3.5" />
                  Marcar todas lidas
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                  onClick={() => fetchNotifications()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border text-muted-foreground hover:text-foreground transition-colors"
                  style={{ background: 'hsl(var(--card)/0.6)', borderColor: 'hsl(var(--border)/0.5)' }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Atualizar
                </motion.button>

                {/* New Template button */}
                <Dialog open={templateDialogOpen} onOpenChange={o => { setTemplateDialogOpen(o); if (!o) resetTemplateForm(); }}>
                  <DialogTrigger asChild>
                    <motion.button
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors"
                      style={{ background: 'rgba(168,85,247,0.08)', borderColor: 'rgba(168,85,247,0.25)', color: 'rgb(196,148,255)' }}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Novo Template
                    </motion.button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg border-border/50 backdrop-blur-xl rounded-2xl"
                    style={{ background: 'hsl(var(--card)/0.95)' }}>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-violet-400" />
                        {editingTemplate ? 'Editar Template' : 'Novo Template'}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleTemplateSubmit} className="space-y-4 mt-2">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Nome do Template *</Label>
                        <Input className={inputStyle} value={templateForm.name}
                          onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                          placeholder="Ex: Cobrança — 1ª Notificação" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1.5 block">Categoria</Label>
                          <Select value={templateForm.category} onValueChange={v => setTemplateForm({ ...templateForm, category: v })}>
                            <SelectTrigger className={inputStyle}><SelectValue /></SelectTrigger>
                            <SelectContent>{templateCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1.5 block">Tipo</Label>
                          <Select value={templateForm.type} onValueChange={v => setTemplateForm({ ...templateForm, type: v })}>
                            <SelectTrigger className={inputStyle}><SelectValue /></SelectTrigger>
                            <SelectContent>{notificationTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Título *</Label>
                        <Input className={inputStyle} value={templateForm.title}
                          onChange={e => setTemplateForm({ ...templateForm, title: e.target.value })}
                          placeholder="Ex: Fatura Vencida — Ação Necessária" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Mensagem *</Label>
                        <Textarea className={inputStyle} value={templateForm.message}
                          onChange={e => setTemplateForm({ ...templateForm, message: e.target.value })}
                          placeholder="Conteúdo da notificação..." rows={4} />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setTemplateDialogOpen(false)} className="rounded-xl">Cancelar</Button>
                        <motion.button whileTap={{ scale: 0.96 }} type="submit"
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                          style={{ background: 'linear-gradient(135deg,#7c3aed,#8b5cf6)' }}>
                          {editingTemplate ? <><Edit className="h-3.5 w-3.5" /> Salvar</> : <><Plus className="h-3.5 w-3.5" /> Criar</>}
                        </motion.button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>

                {/* Schedule button */}
                <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
                  <DialogTrigger asChild>
                    <motion.button
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors"
                      style={{ background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.25)', color: 'rgb(147,197,253)' }}
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      Agendar
                    </motion.button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg border-border/50 backdrop-blur-xl rounded-2xl"
                    style={{ background: 'hsl(var(--card)/0.95)' }}>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-blue-400" />
                        Agendar Notificação
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleScheduleSubmit} className="space-y-4 mt-2">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Título *</Label>
                        <Input className={inputStyle} value={scheduleForm.title}
                          onChange={e => setScheduleForm(p => ({ ...p, title: e.target.value }))}
                          placeholder="Ex: Lembrete de renovação" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Mensagem *</Label>
                        <Textarea className={inputStyle} value={scheduleForm.message}
                          onChange={e => setScheduleForm(p => ({ ...p, message: e.target.value }))}
                          placeholder="Conteúdo da notificação..." rows={3} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1.5 block">Tipo</Label>
                          <Select value={scheduleForm.type} onValueChange={v => setScheduleForm(p => ({ ...p, type: v }))}>
                            <SelectTrigger className={inputStyle}><SelectValue /></SelectTrigger>
                            <SelectContent>{notificationTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1.5 block">Data e Hora *</Label>
                          <Input type="datetime-local" className={inputStyle} value={scheduleForm.scheduled_at}
                            onChange={e => setScheduleForm(p => ({ ...p, scheduled_at: e.target.value }))}
                            min={new Date().toISOString().slice(0, 16)} />
                        </div>
                      </div>

                      {/* Canais */}
                      <div className="space-y-2 p-3 rounded-xl border" style={{ background: 'hsl(var(--muted)/0.3)', borderColor: 'hsl(var(--border)/0.4)' }}>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Canais de Envio</p>
                        <div className="flex flex-wrap gap-3">
                          {channelOptions.map(ch => (
                            <label key={ch.key} className="flex items-center gap-2 cursor-pointer">
                              <div
                                onClick={() => setScheduleForm(p => ({ ...p, channels: { ...p.channels, [ch.key]: !p.channels[ch.key] } }))}
                                className={cn('w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0',
                                  scheduleForm.channels[ch.key] ? 'border-transparent' : 'border-border bg-card')}
                                style={scheduleForm.channels[ch.key] ? { background: ch.color } : {}}
                              >
                                {scheduleForm.channels[ch.key] && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                              </div>
                              <span className="text-xs">{ch.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Destinatário */}
                      <div className="space-y-2 p-3 rounded-xl border" style={{ background: 'hsl(var(--muted)/0.3)', borderColor: 'hsl(var(--border)/0.4)' }}>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Destinatário</p>
                        <div className="flex gap-2">
                          {[{ v: 'all', l: 'Todos os clientes' }, { v: 'specific', l: 'Cliente específico' }].map(opt => (
                            <button key={opt.v} type="button"
                              onClick={() => setScheduleForm(p => ({ ...p, target: opt.v }))}
                              className={cn('flex-1 py-1.5 rounded-xl text-xs font-medium border transition-all',
                                scheduleForm.target === opt.v
                                  ? 'bg-violet-500/15 border-violet-500/30 text-violet-400'
                                  : 'bg-card/50 border-border/40 text-muted-foreground hover:text-foreground')}
                            >
                              {opt.l}
                            </button>
                          ))}
                        </div>
                        {scheduleForm.target === 'specific' && (
                          <Select value={scheduleForm.user_id} onValueChange={v => setScheduleForm(p => ({ ...p, user_id: v }))}>
                            <SelectTrigger className={inputStyle}><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                            <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name || c.email}</SelectItem>)}</SelectContent>
                          </Select>
                        )}
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setScheduleDialogOpen(false)} className="rounded-xl">Cancelar</Button>
                        <motion.button whileTap={{ scale: 0.96 }} type="submit"
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                          style={{ background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)' }}>
                          <Calendar className="h-3.5 w-3.5" />
                          Agendar
                        </motion.button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>

                {/* New Notification button */}
                <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) resetForm(); }}>
                  <DialogTrigger asChild>
                    <motion.button
                      whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white relative overflow-hidden"
                      style={{ background: 'linear-gradient(135deg,#7c3aed 0%,#8b5cf6 50%,#a855f7 100%)', boxShadow: '0 4px 20px rgba(139,92,246,0.4)' }}
                    >
                      <motion.div className="absolute inset-0" style={{ background: 'conic-gradient(from 0deg,transparent,rgba(255,255,255,0.1),transparent)' }}
                        animate={{ rotate: 360 }} transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }} />
                      <Plus className="h-4 w-4 relative z-10" />
                      <span className="relative z-10">Nova Notificação</span>
                    </motion.button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg border-border/50 backdrop-blur-xl rounded-2xl"
                    style={{ background: 'hsl(var(--card)/0.95)' }}>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Send className="h-4 w-4 text-violet-400" />
                        Enviar Notificação
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                      {templates.length > 0 && (
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1.5 block">Usar Template (opcional)</Label>
                          <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                            <SelectTrigger className={inputStyle}><SelectValue placeholder="Selecione um template..." /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(groupedTemplates).map(([cat, tpls]) => (
                                <div key={cat}>
                                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/50">{getCategoryLabel(cat)}</div>
                                  {tpls.map(t => (
                                    <SelectItem key={t.id} value={t.id}>
                                      <div className="flex items-center gap-2"><Copy className="h-3 w-3 text-muted-foreground" />{t.name}</div>
                                    </SelectItem>
                                  ))}
                                </div>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Título *</Label>
                        <Input className={inputStyle} value={formData.title}
                          onChange={e => setFormData({ ...formData, title: e.target.value })}
                          placeholder="Ex: Atualização do seu processo" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Mensagem *</Label>
                        <Textarea className={inputStyle} value={formData.message}
                          onChange={e => setFormData({ ...formData, message: e.target.value })}
                          placeholder="Conteúdo da notificação..." rows={3} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1.5 block">Tipo</Label>
                          <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })}>
                            <SelectTrigger className={inputStyle}><SelectValue /></SelectTrigger>
                            <SelectContent>{notificationTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1.5 block">Link (opcional)</Label>
                          <Input className={inputStyle} value={formData.link}
                            onChange={e => setFormData({ ...formData, link: e.target.value })}
                            placeholder="/cliente/processos" />
                        </div>
                      </div>

                      {/* Channels */}
                      <div className="space-y-2 p-3 rounded-xl border" style={{ background: 'hsl(var(--muted)/0.3)', borderColor: 'hsl(var(--border)/0.4)' }}>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Canais de Envio</p>
                        <div className="grid grid-cols-2 gap-2">
                          {channelOptions.map(ch => {
                            const ChIcon = ch.icon;
                            return (
                              <label key={ch.key} className="flex items-center gap-2 cursor-pointer p-2 rounded-xl border transition-all"
                                style={{
                                  background: channels[ch.key] ? `${ch.color}08` : 'transparent',
                                  borderColor: channels[ch.key] ? `${ch.color}30` : 'hsl(var(--border)/0.4)',
                                }}>
                                <div
                                  onClick={() => setChannels(prev => ({ ...prev, [ch.key]: !prev[ch.key] }))}
                                  className={cn('w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0',
                                    channels[ch.key] ? 'border-transparent' : 'border-border bg-card')}
                                  style={channels[ch.key] ? { background: ch.color } : {}}
                                >
                                  {channels[ch.key] && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                                </div>
                                <ChIcon className="h-3 w-3 flex-shrink-0" style={{ color: ch.color }} />
                                <span className="text-xs leading-tight">{ch.label}</span>
                              </label>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">SMS, WhatsApp e E-mail requerem configuração prévia em Configurações → Integrações.</p>
                      </div>

                      {/* Recipient */}
                      <div className="space-y-3 p-3 rounded-xl border" style={{ background: 'hsl(var(--muted)/0.3)', borderColor: 'hsl(var(--border)/0.4)' }}>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <div onClick={() => setSendToAll(!sendToAll)}
                            className={cn('w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all', sendToAll ? 'bg-violet-500 border-violet-500' : 'border-border bg-card')}>
                            {sendToAll && <CheckCircle2 className="h-3 w-3 text-white" />}
                          </div>
                          <span className="text-sm font-medium flex items-center gap-2">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            Enviar para todos os clientes
                            <span className="text-xs text-muted-foreground">({clients.length})</span>
                          </span>
                        </label>

                        {!sendToAll && (
                          <Select value={formData.user_id} onValueChange={v => setFormData({ ...formData, user_id: v })}>
                            <SelectTrigger className={inputStyle}><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                            <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name || c.email}</SelectItem>)}</SelectContent>
                          </Select>
                        )}
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancelar</Button>
                        <motion.button whileTap={{ scale: 0.96 }} type="submit" disabled={sending}
                          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                          style={{ background: 'linear-gradient(135deg,#7c3aed,#8b5cf6)', boxShadow: '0 4px 16px rgba(139,92,246,0.4)' }}>
                          {sending ? <motion.div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }} />
                            : <Send className="h-3.5 w-3.5" />}
                          {sending ? 'Enviando...' : 'Enviar'}
                        </motion.button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* HUD metrics */}
            <div className="flex flex-wrap gap-2 mt-5">
              <MetricChip icon={Activity}  value={stats.total}     label="Total enviado" color="#a855f7" />
              <MetricChip icon={Bell}      value={stats.unread}    label="Não lidas"     color="#3b82f6" />
              <MetricChip icon={Zap}       value={stats.urgent}    label="Urgentes"      color="#ef4444" />
              <MetricChip icon={TrendingUp} value={stats.today}    label="Hoje"          color="#10b981" />
              <MetricChip icon={FileText}  value={templates.length} label="Templates"    color="#f59e0b" />
              <MetricChip icon={Calendar}  value={stats.scheduled} label="Agendadas"     color="#3b82f6" />
            </div>
          </div>
        </motion.div>

        {/* ── TABS ─────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 rounded-2xl border backdrop-blur-sm overflow-x-auto"
          style={{ background: 'hsl(var(--card)/0.5)', borderColor: 'hsl(var(--border)/0.4)' }}>
          {([
            { key: 'history',      label: 'Histórico',    icon: Bell,      count: notifications.length },
            { key: 'templates',    label: 'Templates',    icon: FileText,  count: templates.length },
            { key: 'agendamentos', label: 'Agendamentos', icon: Calendar,  count: stats.scheduled },
            { key: 'relatorios',   label: 'Relatórios',   icon: BarChart3, count: dispatchLogs.length },
          ] as const).map(tab => (
            <motion.button key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn('flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-medium transition-all relative overflow-hidden whitespace-nowrap',
                activeTab === tab.key ? 'text-white' : 'text-muted-foreground hover:text-foreground')}
              style={activeTab === tab.key ? { background: 'linear-gradient(135deg,#7c3aed,#8b5cf6)', boxShadow: '0 4px 16px rgba(139,92,246,0.3)' } : {}}
            >
              {activeTab === tab.key && (
                <motion.div layoutId="tab-glow" className="absolute inset-0"
                  style={{ background: 'conic-gradient(from 0deg,transparent,rgba(255,255,255,0.06),transparent)' }}
                  animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} />
              )}
              <tab.icon className="h-3.5 w-3.5 relative z-10 flex-shrink-0" />
              <span className="relative z-10">{tab.label}</span>
              {tab.count > 0 && (
                <span className={cn('relative z-10 text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[20px] text-center flex-shrink-0',
                  activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground')}>
                  {tab.count}
                </span>
              )}
            </motion.button>
          ))}
        </div>

        {/* ── TAB CONTENT ──────────────────────────────────── */}
        {/* History */}
        {activeTab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
            className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input
                  className="pl-9 rounded-xl border-border/50 bg-card/50 backdrop-blur-sm placeholder:text-muted-foreground/40 focus:border-primary/50"
                  placeholder="Buscar notificações..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-1 flex-wrap">
                {[{ value: 'all', label: 'Todos' }, ...notificationTypes.map(t => ({ value: t.value, label: t.label }))].map(f => (
                  <motion.button key={f.value} whileTap={{ scale: 0.94 }}
                    onClick={() => setFilterType(f.value)}
                    className={cn('px-3 py-2 rounded-xl text-xs font-medium border transition-all whitespace-nowrap',
                      filterType === f.value
                        ? 'bg-violet-500/15 border-violet-500/30 text-violet-400'
                        : 'bg-card/50 border-border/40 text-muted-foreground hover:text-foreground')}>
                    {f.label}
                  </motion.button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}
                    className="h-20 rounded-2xl border border-border/40 overflow-hidden relative">
                    <motion.div className="absolute inset-0"
                      style={{ background: 'linear-gradient(90deg,transparent,hsl(var(--muted)/0.4),transparent)' }}
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: 'linear', delay: i * 0.1 }} />
                    <div className="h-full bg-card/30" />
                  </motion.div>
                ))}
              </div>
            ) : filteredNotifications.length === 0 ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-16 gap-4">
                <motion.div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', boxShadow: '0 0 30px rgba(168,85,247,0.1)' }}
                  animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                  <Bell className="h-7 w-7 text-violet-400" />
                </motion.div>
                <div className="text-center">
                  <p className="font-semibold text-foreground/70">{search || filterType !== 'all' ? 'Nenhuma notificação encontrada' : 'Sem notificações enviadas'}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {search || filterType !== 'all' ? 'Tente ajustar os filtros' : 'Clique em "Nova Notificação" para começar'}
                  </p>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {filteredNotifications.map((n, i) => (
                  <NotificationCard
                    key={n.id}
                    n={n}
                    index={i}
                    onMarkRead={handleMarkRead}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Templates */}
        {activeTab === 'templates' && (
          <motion.div key="templates" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
            className="space-y-6">
            {templates.length === 0 ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-16 gap-4">
                <motion.div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}
                  animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                  <FileText className="h-7 w-7 text-violet-400" />
                </motion.div>
                <div className="text-center">
                  <p className="font-semibold text-foreground/70">Nenhum template cadastrado</p>
                  <p className="text-xs text-muted-foreground mt-1">Crie templates para agilizar o envio de notificações</p>
                </div>
              </motion.div>
            ) : (
              Object.entries(groupedTemplates).map(([cat, tpls]) => (
                <div key={cat}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border"
                      style={{ background: 'rgba(168,85,247,0.08)', borderColor: 'rgba(168,85,247,0.2)' }}>
                      <Sparkles className="h-3 w-3 text-violet-400" />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-violet-400">{getCategoryLabel(cat)}</span>
                    </div>
                    <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg,rgba(168,85,247,0.2),transparent)' }} />
                    <span className="text-xs text-muted-foreground">{tpls.length} template{tpls.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-3">
                    {tpls.map((t, i) => (
                      <TemplateCard key={t.id} template={t} index={i} onEdit={handleEditTemplate} onDelete={handleDeleteTemplate} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}

        {/* Agendamentos */}
        {activeTab === 'agendamentos' && (
          <motion.div key="agendamentos" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
            className="space-y-4">
            {/* Pending count banner */}
            {stats.scheduled > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3 p-4 rounded-2xl border"
                style={{ background: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.2)' }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)' }}>
                  <Calendar className="h-4 w-4 text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{stats.scheduled} notificação{stats.scheduled !== 1 ? 'ções' : ''} agendada{stats.scheduled !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-muted-foreground">Serão disparadas automaticamente na data/hora definida</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                  onClick={() => setScheduleDialogOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white"
                  style={{ background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)' }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Novo agendamento
                </motion.button>
              </motion.div>
            )}

            {scheduledList.length === 0 ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-16 gap-4">
                <motion.div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}
                  animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                  <Calendar className="h-7 w-7 text-blue-400" />
                </motion.div>
                <div className="text-center">
                  <p className="font-semibold text-foreground/70">Nenhum agendamento criado</p>
                  <p className="text-xs text-muted-foreground mt-1">Agende notificações para enviar no futuro</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                  onClick={() => setScheduleDialogOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
                  style={{ background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)' }}
                >
                  <Plus className="h-4 w-4" />
                  Criar primeiro agendamento
                </motion.button>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {[...scheduledList]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((item, i) => (
                    <ScheduleCard key={item.id} item={item} index={i} onCancel={handleCancelSchedule} />
                  ))
                }
              </div>
            )}
          </motion.div>
        )}

        {/* Relatórios */}
        {activeTab === 'relatorios' && (
          <ReportsTab
            dispatchLogs={dispatchLogs}
            logsLoading={logsLoading}
            onRefresh={fetchDispatchLogs}
          />
        )}
      </div>
    </>
  );
}
