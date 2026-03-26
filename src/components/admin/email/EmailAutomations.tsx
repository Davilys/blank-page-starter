import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Zap, Plus, Play, Edit, Clock, Mail, GitBranch,
  FileText, DollarSign, UserCheck, AlertTriangle,
  ArrowDown, CheckCircle2, ChevronRight, Eye, Settings,
  TrendingUp, Trash2, Loader2, X, PlusCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────
interface WorkflowStep {
  id: string;
  type: 'trigger' | 'action' | 'delay' | 'condition';
  label: string;
  detail: string;
  icon: React.ElementType;
  color: string;
}

interface Automation {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  triggerCount: number;
  successRate: number;
  category: string;
  steps: WorkflowStep[];
  lastTriggered?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────
const TRIGGER_OPTIONS = [
  { value: 'contract_signed',   label: 'Contrato Assinado',       icon: FileText,       color: 'text-emerald-500' },
  { value: 'form_abandoned',    label: 'Formulário Abandonado',   icon: AlertTriangle,  color: 'text-amber-500' },
  { value: 'inpi_status_change',label: 'Status INPI Alterado',    icon: Zap,            color: 'text-red-500' },
  { value: 'invoice_due_soon',  label: 'Fatura Vencendo (3 dias)',icon: DollarSign,     color: 'text-amber-500' },
  { value: 'payment_confirmed', label: 'Pagamento Confirmado',    icon: CheckCircle2,   color: 'text-emerald-500' },
  { value: 'lead_created',      label: 'Novo Lead',               icon: UserCheck,      color: 'text-blue-500' },
  { value: 'brand_expiring',    label: 'Marca Vencendo (90 dias)',icon: Clock,          color: 'text-purple-500' },
];

const ACTION_OPTIONS = [
  { value: 'send_email',        label: 'Enviar Email',            icon: Mail },
  { value: 'notify_admin',      label: 'Notificar Admin',         icon: UserCheck },
  { value: 'wait',              label: 'Aguardar (dias)',          icon: Clock },
  { value: 'check_condition',   label: 'Verificar Condição',      icon: GitBranch },
];

const CATEGORY_OPTIONS = [
  { value: 'onboarding',  label: 'Onboarding' },
  { value: 'leads',       label: 'Leads' },
  { value: 'juridico',    label: 'Jurídico' },
  { value: 'financeiro',  label: 'Financeiro' },
];

const MOCK_AUTOMATIONS: Automation[] = [
  {
    id: '1', name: 'Onboarding Automático',
    description: 'Sequência completa de boas-vindas após assinatura de contrato',
    isActive: true, triggerCount: 48, successRate: 94, category: 'onboarding',
    lastTriggered: '2 horas atrás',
    steps: [
      { id: 's1', type: 'trigger', label: 'Gatilho: Contrato Assinado', detail: 'Evento: contract_signed', icon: FileText, color: 'text-emerald-500' },
      { id: 's2', type: 'action', label: 'Email: Boas-vindas', detail: 'Template: Bem-vindo à WebMarcas', icon: Mail, color: 'text-primary' },
      { id: 's3', type: 'delay', label: 'Aguardar 2 dias', detail: 'Pausa inteligente', icon: Clock, color: 'text-amber-500' },
      { id: 's4', type: 'action', label: 'Email: Tutorial Portal', detail: 'Template: Como acompanhar', icon: Mail, color: 'text-primary' },
    ],
  },
  {
    id: '2', name: 'Recuperação de Leads',
    description: 'Reengajar leads que não converteram após 24h do formulário',
    isActive: true, triggerCount: 124, successRate: 38, category: 'leads',
    lastTriggered: '45 min atrás',
    steps: [
      { id: 's1', type: 'trigger', label: 'Gatilho: Form Abandonado', detail: 'Evento: form_abandoned (24h)', icon: AlertTriangle, color: 'text-amber-500' },
      { id: 's2', type: 'condition', label: 'SE: email_opt_out = false', detail: 'Verificar consentimento LGPD', icon: GitBranch, color: 'text-purple-500' },
      { id: 's3', type: 'action', label: 'Email: Follow-up Personalizado', detail: 'Template: Seguimento Lead', icon: Mail, color: 'text-primary' },
    ],
  },
  {
    id: '3', name: 'Alerta Exigência INPI',
    description: 'Notificar cliente automaticamente quando INPI publica exigência',
    isActive: true, triggerCount: 31, successRate: 97, category: 'juridico',
    lastTriggered: '1 dia atrás',
    steps: [
      { id: 's1', type: 'trigger', label: 'Gatilho: Status INPI Alterado', detail: 'Evento: inpi_status_change', icon: Zap, color: 'text-red-500' },
      { id: 's2', type: 'condition', label: 'SE: Status = Exigência', detail: 'Verificar tipo publicação RPI', icon: GitBranch, color: 'text-purple-500' },
      { id: 's3', type: 'action', label: 'Email: Exigência de Mérito', detail: 'Template: Processual', icon: Mail, color: 'text-primary' },
      { id: 's4', type: 'action', label: 'Notificar Admin', detail: 'Push + Email interno', icon: UserCheck, color: 'text-emerald-500' },
    ],
  },
  {
    id: '4', name: 'Cobrança Automática',
    description: 'Lembrete de cobrança para faturas próximas do vencimento',
    isActive: false, triggerCount: 89, successRate: 71, category: 'financeiro',
    lastTriggered: '3 dias atrás',
    steps: [
      { id: 's1', type: 'trigger', label: 'Gatilho: Fatura Vencendo (3 dias)', detail: 'Evento: invoice_due_soon', icon: DollarSign, color: 'text-amber-500' },
      { id: 's2', type: 'action', label: 'Email: Lembrete de Pagamento', detail: 'Template: Cobrança Amigável', icon: Mail, color: 'text-primary' },
      { id: 's3', type: 'condition', label: 'SE: Não pago após vencimento', detail: 'Verificar status invoice', icon: GitBranch, color: 'text-purple-500' },
      { id: 's4', type: 'action', label: 'Email: Notificação de Débito', detail: 'Template: Débito em Aberto', icon: Mail, color: 'text-red-500' },
    ],
  },
];

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  onboarding: { label: 'Onboarding', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  leads:      { label: 'Leads',      color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-500/10 border-blue-500/20' },
  juridico:   { label: 'Jurídico',   color: 'text-purple-600 dark:text-purple-400',   bg: 'bg-purple-500/10 border-purple-500/20' },
  financeiro: { label: 'Financeiro', color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/10 border-amber-500/20' },
};

const STEP_BADGE: Record<string, string> = {
  trigger: 'bg-emerald-500', action: 'bg-primary', delay: 'bg-amber-500', condition: 'bg-purple-500',
};
const STEP_BG: Record<string, string> = {
  trigger:   'bg-emerald-500/10 border-emerald-500/30',
  action:    'bg-primary/10 border-primary/30',
  delay:     'bg-amber-500/10 border-amber-500/30',
  condition: 'bg-purple-500/10 border-purple-500/30',
};
const STEP_LABEL: Record<string, string> = {
  trigger: 'Gatilho', action: 'Ação', delay: 'Pausa', condition: 'Condição',
};

// ── Step form shape ─────────────────────────────────────────────────────────
interface StepForm {
  id: string;
  type: 'trigger' | 'action' | 'delay' | 'condition';
  actionValue: string;
  detail: string;
}

function makeId() { return `step_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

// ── Component ───────────────────────────────────────────────────────────────
export function EmailAutomations() {
  const [automations, setAutomations] = useState<Automation[]>(MOCK_AUTOMATIONS);
  const [expandedId, setExpandedId] = useState<string | null>('1');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editAutomation, setEditAutomation] = useState<Automation | null>(null);

  // Form state
  const [form, setForm] = useState({ name: '', description: '', category: '', trigger: '' });
  const [steps, setSteps] = useState<StepForm[]>([
    { id: makeId(), type: 'action', actionValue: 'send_email', detail: '' },
  ]);

  const resetForm = () => {
    setForm({ name: '', description: '', category: '', trigger: '' });
    setSteps([{ id: makeId(), type: 'action', actionValue: 'send_email', detail: '' }]);
    setEditAutomation(null);
  };

  const openCreate = () => { resetForm(); setCreateOpen(true); };

  const openEdit = (auto: Automation) => {
    setEditAutomation(auto);
    setForm({ name: auto.name, description: auto.description, category: auto.category, trigger: '' });
    setSteps(auto.steps.map(s => ({
      id: s.id,
      type: s.type,
      actionValue: s.type === 'action' ? 'send_email' : s.type === 'delay' ? 'wait' : s.type === 'condition' ? 'check_condition' : 'send_email',
      detail: s.detail,
    })));
    setCreateOpen(true);
  };

  const addStep = () => setSteps(prev => [...prev, { id: makeId(), type: 'action', actionValue: 'send_email', detail: '' }]);
  const removeStep = (id: string) => {
    if (steps.length <= 1) { toast.error('Precisa de pelo menos 1 ação'); return; }
    setSteps(prev => prev.filter(s => s.id !== id));
  };
  const updateStep = (id: string, field: keyof StepForm, value: string) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const buildWorkflowSteps = (trigger: string, formSteps: StepForm[]): WorkflowStep[] => {
    const triggerOpt = TRIGGER_OPTIONS.find(t => t.value === trigger);
    const triggerStep: WorkflowStep = {
      id: makeId(),
      type: 'trigger',
      label: `Gatilho: ${triggerOpt?.label || trigger}`,
      detail: `Evento: ${trigger}`,
      icon: triggerOpt?.icon || Zap,
      color: triggerOpt?.color || 'text-primary',
    };

    const actionSteps: WorkflowStep[] = formSteps.map(s => {
      const actionOpt = ACTION_OPTIONS.find(a => a.value === s.actionValue);
      const typeMap: Record<string, WorkflowStep['type']> = {
        send_email: 'action', notify_admin: 'action', wait: 'delay', check_condition: 'condition',
      };
      return {
        id: s.id,
        type: typeMap[s.actionValue] || 'action',
        label: `${actionOpt?.label || s.actionValue}${s.detail ? `: ${s.detail}` : ''}`,
        detail: s.detail || actionOpt?.label || '',
        icon: actionOpt?.icon || Mail,
        color: s.actionValue === 'wait' ? 'text-amber-500' : s.actionValue === 'check_condition' ? 'text-purple-500' : 'text-primary',
      };
    });

    return [triggerStep, ...actionSteps];
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.trigger || !form.category) {
      toast.error('Preencha nome, gatilho e categoria');
      return;
    }
    const emptyStep = steps.find(s => !s.detail.trim() && s.type !== 'delay');
    if (emptyStep) {
      toast.error('Preencha o detalhe de todas as ações');
      return;
    }
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 800));

    const workflowSteps = buildWorkflowSteps(form.trigger, steps);

    if (editAutomation) {
      setAutomations(prev => prev.map(a => a.id === editAutomation.id ? {
        ...a, name: form.name, description: form.description, category: form.category, steps: workflowSteps,
      } : a));
      toast.success('Automação atualizada!');
    } else {
      const newAuto: Automation = {
        id: Date.now().toString(),
        name: form.name,
        description: form.description,
        isActive: false,
        triggerCount: 0,
        successRate: 0,
        category: form.category,
        steps: workflowSteps,
      };
      setAutomations(prev => [newAuto, ...prev]);
      toast.success('🚀 Automação criada com sucesso!');
    }
    setIsSaving(false);
    setCreateOpen(false);
    resetForm();
  };

  const toggleAutomation = (id: string) => {
    const auto = automations.find(a => a.id === id);
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, isActive: !a.isActive } : a));
    toast.success(auto?.isActive ? '⏸️ Automação pausada' : '▶️ Automação ativada');
  };

  const handleDelete = (id: string) => {
    setAutomations(prev => prev.filter(a => a.id !== id));
    toast.success('Automação removida.');
    setDeleteId(null);
  };

  const filtered = filterCategory === 'all' ? automations : automations.filter(a => a.category === filterCategory);
  const totalActive = automations.filter(a => a.isActive).length;
  const totalTriggers = automations.reduce((s, a) => s + a.triggerCount, 0);
  const avgSuccess = automations.length > 0
    ? Math.round(automations.reduce((s, a) => s + a.successRate, 0) / automations.length)
    : 0;

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Automações de Email
          </h2>
          <p className="text-sm text-muted-foreground">Workflows inteligentes com triggers e condições visuais</p>
        </div>
        <Button className="gap-2 shadow-lg shadow-primary/20" onClick={openCreate}>
          <Plus className="h-4 w-4" />Nova Automação
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 flex-shrink-0">
        {[
          { label: 'Ativas',        value: totalActive,   icon: Play,       color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Total Disparos',value: totalTriggers, icon: Zap,        color: 'text-primary',     bg: 'bg-primary/10' },
          { label: 'Taxa Sucesso',  value: `${avgSuccess}%`, icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-500/10' },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="bg-card border border-border/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
        {[{ key: 'all', label: 'Todas' }, ...CATEGORY_OPTIONS.map(c => ({ key: c.value, label: c.label }))].map(f => (
          <button key={f.key} onClick={() => setFilterCategory(f.key)}
            className={cn("text-xs px-3 py-1.5 rounded-full border transition-all font-medium",
              filterCategory === f.key
                ? "bg-primary/10 border-primary/30 text-primary"
                : "border-border/50 text-muted-foreground hover:bg-muted/50")}>
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="space-y-3 pr-1">
          <AnimatePresence>
            {filtered.map((auto, i) => {
              const catConf = CATEGORY_CONFIG[auto.category];
              const isExpanded = expandedId === auto.id;
              return (
                <motion.div key={auto.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }} transition={{ delay: i * 0.07 }}>
                  <Card className={cn("border-border/50 hover:shadow-md transition-all duration-200", isExpanded && "border-primary/20 shadow-md")}>
                    <CardContent className="p-0">
                      <button onClick={() => setExpandedId(isExpanded ? null : auto.id)}
                        className="w-full text-left p-4 flex items-center gap-4 hover:bg-muted/20 transition-colors rounded-t-xl">
                        <div className={cn("h-10 w-10 rounded-xl border flex items-center justify-center flex-shrink-0", catConf?.bg || 'bg-muted')}>
                          <Zap className={`h-5 w-5 ${catConf?.color || 'text-muted-foreground'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm">{auto.name}</h3>
                            <Badge variant={auto.isActive ? 'default' : 'secondary'} className="text-[9px]">
                              {auto.isActive ? '● Ativa' : '○ Pausada'}
                            </Badge>
                            <Badge variant="outline" className="text-[9px]">{auto.steps.length} passos</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{auto.description}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-right hidden md:block">
                            <p className="text-sm font-semibold">{auto.triggerCount}</p>
                            <p className="text-[10px] text-muted-foreground">disparos</p>
                          </div>
                          <Switch checked={auto.isActive} onCheckedChange={() => toggleAutomation(auto.id)}
                            onClick={e => e.stopPropagation()} />
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={e => { e.stopPropagation(); openEdit(auto); }}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={e => { e.stopPropagation(); setDeleteId(auto.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                        </div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} className="border-t border-border/50 p-4">
                            <div className="grid md:grid-cols-2 gap-6">
                              {/* Flow */}
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Fluxo Visual</p>
                                <div className="space-y-1">
                                  {auto.steps.map((step, si) => {
                                    const StepIcon = step.icon;
                                    return (
                                      <div key={step.id}>
                                        <div className={cn("flex items-center gap-3 p-3 rounded-xl border", STEP_BG[step.type])}>
                                          <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-primary-foreground text-[10px] font-bold flex-shrink-0", STEP_BADGE[step.type])}>
                                            {si + 1}
                                          </div>
                                          <StepIcon className={`h-4 w-4 flex-shrink-0 ${step.color}`} />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold truncate">{step.label}</p>
                                            <p className="text-[10px] text-muted-foreground truncate">{step.detail}</p>
                                          </div>
                                          <Badge variant="outline" className="text-[9px] flex-shrink-0">{STEP_LABEL[step.type]}</Badge>
                                        </div>
                                        {si < auto.steps.length - 1 && (
                                          <div className="flex justify-center py-0.5">
                                            <ArrowDown className="h-3.5 w-3.5 text-muted-foreground/40" />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              {/* Metrics */}
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'Disparos',    value: auto.triggerCount,              color: 'text-primary' },
                                    { label: 'Taxa Sucesso',value: `${auto.successRate}%`,          color: auto.successRate >= 80 ? 'text-emerald-500' : 'text-amber-500' },
                                    { label: 'Último',      value: auto.lastTriggered || 'Nunca', color: 'text-muted-foreground' },
                                    { label: 'Passos',      value: auto.steps.length,              color: 'text-foreground' },
                                  ].map((m, mi) => (
                                    <div key={mi} className="bg-muted/40 rounded-lg p-2.5">
                                      <p className={`text-sm font-bold ${m.color}`}>{m.value}</p>
                                      <p className="text-[10px] text-muted-foreground">{m.label}</p>
                                    </div>
                                  ))}
                                </div>
                                <div className="p-3 bg-primary/5 rounded-xl border border-primary/20">
                                  <p className="text-xs text-muted-foreground flex items-start gap-2">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                                    <span><strong className="text-foreground">Pausa inteligente:</strong> pausada automaticamente se o cliente responder.</span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="font-medium">Nenhuma automação nesta categoria</p>
              <p className="text-sm mt-1">Crie sua primeira automação clicando em "Nova Automação"</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ── Create / Edit Dialog ─────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) resetForm(); setCreateOpen(o); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              {editAutomation ? 'Editar Automação' : 'Nova Automação'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Name + Category */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome <span className="text-destructive">*</span></Label>
                <Input placeholder="Ex: Onboarding Novo Cliente"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria <span className="text-destructive">*</span></Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar categoria" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input placeholder="Descreva o objetivo desta automação..."
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            {/* Trigger */}
            <div className="space-y-1.5">
              <Label>Gatilho (Trigger) <span className="text-destructive">*</span></Label>
              <Select value={form.trigger} onValueChange={v => setForm(f => ({ ...f, trigger: v }))}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Selecione o evento que dispara a automação" />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_OPTIONS.map(t => {
                    const Icon = t.icon;
                    return (
                      <SelectItem key={t.value} value={t.value}>
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${t.color}`} />
                          <span>{t.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Steps */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Ações do Workflow</Label>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addStep}>
                  <PlusCircle className="h-3.5 w-3.5" /> Adicionar Ação
                </Button>
              </div>

              <div className="space-y-2">
                {/* Trigger preview step */}
                {form.trigger && (
                  <div className="flex items-center gap-3 p-3 rounded-xl border bg-emerald-500/10 border-emerald-500/30 text-xs">
                    <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">T</div>
                    <Zap className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold">{TRIGGER_OPTIONS.find(t => t.value === form.trigger)?.label || form.trigger}</p>
                      <p className="text-muted-foreground text-[10px]">Gatilho automático</p>
                    </div>
                    <Badge variant="outline" className="text-[9px]">Gatilho</Badge>
                  </div>
                )}

                {/* Connector */}
                {form.trigger && steps.length > 0 && (
                  <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground/40" /></div>
                )}

                {steps.map((step, si) => (
                  <div key={step.id}>
                    <div className={cn("flex items-start gap-3 p-3 rounded-xl border", STEP_BG[step.type] || STEP_BG.action)}>
                      <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-primary-foreground text-[10px] font-bold flex-shrink-0 mt-0.5", STEP_BADGE[step.type] || 'bg-primary')}>
                        {si + 1}
                      </div>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Select value={step.actionValue} onValueChange={v => {
                            const typeMap: Record<string, StepForm['type']> = { send_email: 'action', notify_admin: 'action', wait: 'delay', check_condition: 'condition' };
                            updateStep(step.id, 'actionValue', v);
                            updateStep(step.id, 'type', typeMap[v] || 'action');
                          }}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ACTION_OPTIONS.map(a => {
                                const Icon = a.icon;
                                return (
                                  <SelectItem key={a.value} value={a.value}>
                                    <div className="flex items-center gap-2">
                                      <Icon className="h-3.5 w-3.5" />
                                      <span className="text-xs">{a.label}</span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <Input
                          className="h-8 text-xs"
                          placeholder={step.actionValue === 'wait' ? 'Ex: 2 dias' : step.actionValue === 'check_condition' ? 'Ex: email_opt_out = false' : 'Ex: Template Boas-vindas'}
                          value={step.detail}
                          onChange={e => updateStep(step.id, 'detail', e.target.value)}
                        />
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                        onClick={() => removeStep(step.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {si < steps.length - 1 && (
                      <div className="flex justify-center py-0.5">
                        <ArrowDown className="h-3.5 w-3.5 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* LGPD info */}
            <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl text-xs text-muted-foreground flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
              <span>Automações respeitam o consentimento LGPD. Clientes com <code className="text-[10px] bg-muted px-1 rounded">email_opt_out = true</code> são excluídos automaticamente.</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {isSaving ? 'Salvando...' : editAutomation ? 'Atualizar' : 'Criar Automação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover automação?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
