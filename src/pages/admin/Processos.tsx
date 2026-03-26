import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import {
  Search, Plus, Edit, Eye, RefreshCw, FolderOpen,
  CheckCircle2, Clock, AlertTriangle, XCircle, Layers,
  TrendingUp, Users, FileText, Calendar, ChevronRight,
  Filter, MoreHorizontal, Loader2, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Process {
  id: string;
  brand_name: string;
  process_number: string | null;
  status: string | null;
  pipeline_stage: string | null;
  user_id: string | null;
  business_area: string | null;
  deposit_date: string | null;
  next_step: string | null;
  next_step_date: string | null;
  notes: string | null;
  inpi_protocol: string | null;
  ncl_classes: number[] | null;
  created_at: string | null;
  profiles?: { full_name: string | null; email: string } | null;
}

interface Client {
  id: string;
  full_name: string | null;
  email: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; colorRgb: string; icon: React.ElementType; bg: string }> = {
  aguardando_pagamento: { label: 'Aguard. Pagamento', color: '#f59e0b', colorRgb: '245,158,11',  icon: Clock,       bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  em_andamento:         { label: 'Em Andamento',      color: '#3b82f6', colorRgb: '59,130,246',  icon: Layers,      bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  exigencia:            { label: 'Exigência',          color: '#f43f5e', colorRgb: '244,63,94',   icon: AlertTriangle,bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  publicado_rpi:        { label: 'Publicado RPI',      color: '#8b5cf6', colorRgb: '139,92,246',  icon: FileText,    bg: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  deferido:             { label: 'Deferido',           color: '#10b981', colorRgb: '16,185,129',  icon: CheckCircle2,bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  registrada:           { label: 'Registrada',         color: '#22c55e', colorRgb: '34,197,94',   icon: CheckCircle2,bg: 'bg-green-500/10 text-green-400 border-green-500/20' },
  indeferida:           { label: 'Indeferida',         color: '#ef4444', colorRgb: '239,68,68',   icon: XCircle,     bg: 'bg-red-500/10 text-red-400 border-red-500/20' },
  arquivada:            { label: 'Arquivada',          color: '#6b7280', colorRgb: '107,114,128', icon: FolderOpen,  bg: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
};

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label }));

// Fixed particles
const PARTICLES = Array.from({ length: 20 }).map((_, i) => ({
  id: i, x: (i * 51.3 + 7) % 100, y: (i * 37.7 + 13) % 100,
  size: 1.5 + (i % 4) * 0.5, dur: 8 + (i % 7), delay: (i * 0.38) % 6, op: 0.04 + (i % 4) * 0.02,
}));

function StatusBadge({ status }: { status: string | null }) {
  const cfg = STATUS_CONFIG[status || 'em_andamento'] || STATUS_CONFIG.em_andamento;
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wide', cfg.bg)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function KpiMini({ label, value, color, icon: Icon, index }: { label: string; value: number; color: string; icon: React.ElementType; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, type: 'spring', stiffness: 280, damping: 24 }}
      className="relative rounded-2xl border p-4 overflow-hidden"
      style={{
        background: `linear-gradient(135deg,rgba(${color},0.07) 0%,rgba(${color},0.02) 100%)`,
        borderColor: `rgba(${color},0.2)`,
      }}
    >
      <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle,rgba(${color},0.12) 0%,transparent 70%)` }} />
      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
        style={{ background: `rgba(${color},0.15)`, border: `1px solid rgba(${color},0.25)` }}>
        <Icon className="h-4 w-4" style={{ color: `rgb(${color})` }} />
      </div>
      <p className="text-2xl font-black tabular-nums" style={{ color: `rgb(${color})` }}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </motion.div>
  );
}

function ProcessCard({ process, index, onEdit, onView }: {
  process: Process; index: number;
  onEdit: (p: Process) => void;
  onView: (p: Process) => void;
}) {
  const cfg = STATUS_CONFIG[process.status || 'em_andamento'] || STATUS_CONFIG.em_andamento;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12, y: 4 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.5), type: 'spring', stiffness: 280, damping: 24 }}
      whileHover={{ y: -2, transition: { duration: 0.18 } }}
      className="group relative rounded-2xl border overflow-hidden"
      style={{
        background: `linear-gradient(135deg,hsl(var(--card)/0.7) 0%,rgba(${cfg.colorRgb},0.04) 100%)`,
        borderColor: `rgba(${cfg.colorRgb},0.18)`,
        boxShadow: `0 0 20px -10px rgba(${cfg.colorRgb},0.3)`,
      }}
    >
      {/* Left accent */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ background: `linear-gradient(180deg,transparent,rgba(${cfg.colorRgb},0.8),transparent)` }} />

      <div className="flex items-start gap-4 p-4 pl-5">
        {/* Brand icon */}
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-black flex-shrink-0"
          style={{ background: `rgba(${cfg.colorRgb},0.12)`, border: `1px solid rgba(${cfg.colorRgb},0.25)`, color: `rgb(${cfg.colorRgb})` }}>
          {process.brand_name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h3 className="font-bold text-foreground text-sm leading-tight">{process.brand_name}</h3>
              {process.profiles?.full_name && (
                <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Users className="h-2.5 w-2.5" />
                  {process.profiles.full_name}
                </p>
              )}
            </div>
            <StatusBadge status={process.status} />
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
            {process.process_number && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <FileText className="h-2.5 w-2.5" />
                {process.process_number}
              </span>
            )}
            {process.business_area && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <FolderOpen className="h-2.5 w-2.5" />
                {process.business_area}
              </span>
            )}
            {process.deposit_date && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Calendar className="h-2.5 w-2.5" />
                Dep: {format(new Date(process.deposit_date), 'dd/MM/yy')}
              </span>
            )}
            {process.ncl_classes && process.ncl_classes.length > 0 && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Layers className="h-2.5 w-2.5" />
                NCL: {process.ncl_classes.join(', ')}
              </span>
            )}
          </div>

          {process.next_step && (
            <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-2.5 py-1.5 mb-2 flex items-center gap-1.5">
              <ChevronRight className="h-3 w-3 flex-shrink-0 text-primary" />
              {process.next_step}
            </p>
          )}

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {process.created_at
                ? formatDistanceToNow(new Date(process.created_at), { addSuffix: true, locale: ptBR })
                : '—'}
            </span>
            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <motion.button
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.92 }}
                onClick={() => onView(process)}
                className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
              ><Eye className="h-3.5 w-3.5" /></motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.92 }}
                onClick={() => onEdit(process)}
                className="w-7 h-7 rounded-lg bg-secondary/50 border border-border/40 flex items-center justify-center text-foreground hover:bg-secondary transition-colors"
              ><Edit className="h-3.5 w-3.5" /></motion.button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function AdminProcessos() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialog, setViewDialog] = useState<Process | null>(null);
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    brand_name: '', process_number: '', status: 'em_andamento',
    user_id: '', business_area: '', next_step: '', notes: '',
    inpi_protocol: '', deposit_date: '',
  });

  useEffect(() => { fetchProcesses(); fetchClients(); }, []);

  const fetchProcesses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('brand_processes')
      .select('*, profiles(full_name, email)')
      .order('created_at', { ascending: false });
    if (error) toast.error('Erro ao carregar processos');
    else setProcesses(data || []);
    setLoading(false);
  };

  const fetchClients = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name, email');
    setClients(data || []);
  };

  const filtered = useMemo(() => processes.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.brand_name.toLowerCase().includes(q)
      || (p.process_number || '').toLowerCase().includes(q)
      || (p.profiles?.full_name || '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  }), [processes, search, statusFilter]);

  // KPIs
  const kpis = useMemo(() => ({
    total:      processes.length,
    ativos:     processes.filter(p => p.status === 'em_andamento').length,
    exigencia:  processes.filter(p => p.status === 'exigencia').length,
    concluidos: processes.filter(p => p.status === 'registrada' || p.status === 'deferido').length,
  }), [processes]);

  const openCreate = () => {
    setEditingProcess(null);
    setFormData({ brand_name: '', process_number: '', status: 'em_andamento', user_id: '', business_area: '', next_step: '', notes: '', inpi_protocol: '', deposit_date: '' });
    setDialogOpen(true);
  };

  const openEdit = (p: Process) => {
    setEditingProcess(p);
    setFormData({
      brand_name: p.brand_name, process_number: p.process_number || '', status: p.status || 'em_andamento',
      user_id: p.user_id || '', business_area: p.business_area || '', next_step: p.next_step || '',
      notes: p.notes || '', inpi_protocol: p.inpi_protocol || '', deposit_date: p.deposit_date || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.brand_name) { toast.error('Nome da marca é obrigatório'); return; }
    setSaving(true);
    const payload = {
      brand_name: formData.brand_name,
      process_number: formData.process_number || null,
      status: formData.status,
      user_id: formData.user_id || null,
      business_area: formData.business_area || null,
      next_step: formData.next_step || null,
      notes: formData.notes || null,
      inpi_protocol: formData.inpi_protocol || null,
      deposit_date: formData.deposit_date || null,
    };

    let error;
    if (editingProcess) {
      ({ error } = await supabase.from('brand_processes').update(payload).eq('id', editingProcess.id));
    } else {
      ({ error } = await supabase.from('brand_processes').insert(payload));
    }

    if (error) toast.error('Erro ao salvar processo');
    else {
      toast.success(editingProcess ? 'Processo atualizado!' : 'Processo criado!');
      setDialogOpen(false);
      fetchProcesses();
    }
    setSaving(false);
  };

  return (
    <>
      <div className="relative min-h-full">
        {/* Background */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
          {PARTICLES.map(p => (
            <motion.div key={p.id} className="absolute rounded-full bg-primary"
              style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, opacity: p.op }}
              animate={{ y: [-10, 10, -10], opacity: [p.op, p.op * 2, p.op] }}
              transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
            />
          ))}
        </div>

        <div className="relative z-10 space-y-4 pb-8">

          {/* ── Hero Header ── */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-2xl overflow-hidden border border-primary/20 bg-card/60 backdrop-blur-xl p-5"
            style={{ boxShadow: '0 0 40px hsl(var(--primary)/0.05)' }}
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl bg-primary/8 pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <motion.div
                  className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center shadow-lg"
                  animate={{ boxShadow: ['0 0 20px hsl(var(--primary)/0.3)', '0 0 40px hsl(var(--primary)/0.5)', '0 0 20px hsl(var(--primary)/0.3)'] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <FolderOpen className="h-6 w-6 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-2xl font-black text-foreground tracking-tight">Processos de Marca</h1>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }}
                      className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {processes.length} processos · {kpis.ativos} ativos
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={fetchProcesses} disabled={loading}>
                  <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
                  Atualizar
                </Button>
                <Button size="sm" onClick={openCreate} className="bg-gradient-to-r from-primary to-violet-500 text-white shadow-lg">
                  <Plus className="h-4 w-4 mr-2" /> Novo Processo
                </Button>
              </div>
            </div>
          </motion.div>

          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiMini label="Total" value={kpis.total} color="59,130,246" icon={Layers} index={0} />
            <KpiMini label="Ativos" value={kpis.ativos} color="16,185,129" icon={TrendingUp} index={1} />
            <KpiMini label="Exigências" value={kpis.exigencia} color="244,63,94" icon={AlertTriangle} index={2} />
            <KpiMini label="Concluídos" value={kpis.concluidos} color="34,197,94" icon={CheckCircle2} index={3} />
          </div>

          {/* ── Filters ── */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por marca, processo ou cliente..."
                className="pl-9 bg-card/60 border-border/50 backdrop-blur-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 bg-card/60 border-border/50">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Process List ── */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary opacity-40" />
            </div>
          ) : filtered.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                <FolderOpen className="h-8 w-8 text-muted-foreground opacity-40" />
              </div>
              <p className="text-muted-foreground text-sm">Nenhum processo encontrado</p>
              <Button variant="outline" size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" /> Criar primeiro processo
              </Button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <AnimatePresence>
                {filtered.map((p, i) => (
                  <ProcessCard key={p.id} process={p} index={i} onEdit={openEdit} onView={p2 => setViewDialog(p2)} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── Create/Edit Dialog ── */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                  <FolderOpen className="h-4 w-4 text-primary" />
                </div>
                {editingProcess ? 'Editar Processo' : 'Novo Processo'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Nome da Marca *</Label>
                  <Input value={formData.brand_name} onChange={e => setFormData({ ...formData, brand_name: e.target.value })}
                    placeholder="Ex: MINHA MARCA" className="uppercase" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Nº do Processo</Label>
                  <Input value={formData.process_number} onChange={e => setFormData({ ...formData, process_number: e.target.value })}
                    placeholder="000000000000" />
                </div>
                <div className="space-y-1.5">
                  <Label>Protocolo INPI</Label>
                  <Input value={formData.inpi_protocol} onChange={e => setFormData({ ...formData, inpi_protocol: e.target.value })}
                    placeholder="BR000000" />
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Data de Depósito</Label>
                  <Input type="date" value={formData.deposit_date}
                    onChange={e => setFormData({ ...formData, deposit_date: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Cliente</Label>
                  <Select value={formData.user_id} onValueChange={v => setFormData({ ...formData, user_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.full_name || c.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Ramo de Atividade</Label>
                  <Input value={formData.business_area} onChange={e => setFormData({ ...formData, business_area: e.target.value })}
                    placeholder="Ex: Tecnologia, Moda, Alimentação..." />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Próxima Ação</Label>
                  <Input value={formData.next_step} onChange={e => setFormData({ ...formData, next_step: e.target.value })}
                    placeholder="Ex: Aguardar publicação no RPI" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Notas internas sobre o processo..." rows={3} />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                  {editingProcess ? 'Atualizar' : 'Criar Processo'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── View Dialog ── */}
        <AnimatePresence>
          {viewDialog && (
            <Dialog open={!!viewDialog} onOpenChange={() => setViewDialog(null)}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black"
                      style={{
                        background: `rgba(${STATUS_CONFIG[viewDialog.status || 'em_andamento']?.colorRgb || '59,130,246'},0.12)`,
                        color: STATUS_CONFIG[viewDialog.status || 'em_andamento']?.color || '#3b82f6',
                      }}>
                      {viewDialog.brand_name.charAt(0)}
                    </div>
                    {viewDialog.brand_name}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between py-2 border-b border-border/40">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <StatusBadge status={viewDialog.status} />
                  </div>
                  {[
                    { label: 'Nº Processo', value: viewDialog.process_number },
                    { label: 'Protocolo INPI', value: viewDialog.inpi_protocol },
                    { label: 'Cliente', value: viewDialog.profiles?.full_name },
                    { label: 'Ramo', value: viewDialog.business_area },
                    { label: 'Depósito', value: viewDialog.deposit_date ? format(new Date(viewDialog.deposit_date), 'dd/MM/yyyy') : null },
                    { label: 'Próxima Ação', value: viewDialog.next_step },
                    { label: 'Classes NCL', value: viewDialog.ncl_classes?.join(', ') },
                  ].filter(r => r.value).map(row => (
                    <div key={row.label} className="flex items-start justify-between py-1.5 border-b border-border/20 last:border-0">
                      <span className="text-sm text-muted-foreground">{row.label}</span>
                      <span className="text-sm font-medium text-right max-w-[60%]">{row.value}</span>
                    </div>
                  ))}
                  {viewDialog.notes && (
                    <div className="p-3 rounded-xl bg-muted/40 text-sm text-muted-foreground">
                      <p className="text-[10px] uppercase tracking-wider font-bold mb-1.5 text-foreground/60">Observações</p>
                      {viewDialog.notes}
                    </div>
                  )}
                  <Button className="w-full" onClick={() => { setViewDialog(null); openEdit(viewDialog); }}>
                    <Edit className="h-4 w-4 mr-2" /> Editar Processo
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
