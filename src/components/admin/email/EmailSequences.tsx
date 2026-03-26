import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Layers, Plus, Mail, Clock, ChevronDown, ChevronRight,
  Play, Pause, Edit, Trash2, Users, CheckCircle2,
  ArrowRight, X, Loader2, CheckCircle, Zap, GripVertical,
  PlusCircle, MinusCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface SequenceStep {
  id: string;
  day: number;
  subject: string;
  content: string;
  openRate?: number;
}

interface Sequence {
  id: string;
  name: string;
  description: string;
  trigger: string;
  isActive: boolean;
  enrolledCount: number;
  completedCount: number;
  steps: SequenceStep[];
}

const TRIGGER_OPTIONS = [
  'Assinatura de contrato',
  'Lead novo',
  'Processo aprovado',
  'Processo com exigência',
  'Marca próxima do vencimento',
  'Sem resposta após 48h',
  'Pagamento confirmado',
  'Manual (inscrição manual)',
];

const INITIAL_SEQUENCES: Sequence[] = [
  {
    id: '1',
    name: 'Onboarding Novo Cliente',
    description: 'Sequência automática de boas-vindas para clientes que assinaram contrato',
    trigger: 'Assinatura de contrato',
    isActive: true,
    enrolledCount: 48,
    completedCount: 31,
    steps: [
      { id: 's1', day: 0, subject: 'Bem-vindo à WebMarcas! 🎉', content: 'Olá {{nome_cliente}},\n\nSeja bem-vindo(a)! Seu processo foi iniciado com sucesso.', openRate: 91 },
      { id: 's2', day: 2, subject: 'Como acompanhar seu processo no INPI', content: 'Olá {{nome_cliente}},\n\nVeja como você pode acompanhar seu processo {{numero_processo}} no INPI...', openRate: 74 },
      { id: 's3', day: 5, subject: 'Status do seu registro de marca', content: 'Prezado(a) {{nome_cliente}},\n\nAtualizamos o status do seu registro da marca {{nome_marca}}...', openRate: 68 },
      { id: 's4', day: 10, subject: 'Dúvidas frequentes sobre registro de marca', content: 'Olá {{nome_cliente}},\n\nResponderemos as principais dúvidas dos nossos clientes...', openRate: 55 },
    ],
  },
  {
    id: '2',
    name: 'Recuperação de Leads',
    description: 'Reengajar leads que não responderam após 48h',
    trigger: 'Sem resposta após 48h',
    isActive: true,
    enrolledCount: 124,
    completedCount: 89,
    steps: [
      { id: 's5', day: 0, subject: 'Sua marca merece proteção - comece agora', content: 'Olá,\n\nVimos que você se interessou pelo registro da sua marca...', openRate: 43 },
      { id: 's6', day: 3, subject: 'Última chance: registre sua marca com desconto', content: 'Olá,\n\nEsta é uma oportunidade imperdível para proteger sua marca...', openRate: 38 },
      { id: 's7', day: 7, subject: 'Posso ajudar? Tire suas dúvidas', content: 'Olá,\n\nEstou à disposição para esclarecer suas dúvidas sobre o processo...', openRate: 29 },
    ],
  },
  {
    id: '3',
    name: 'Renovação de Marcas',
    description: 'Alerta automático quando a marca está próxima do vencimento',
    trigger: 'Marca próxima do vencimento',
    isActive: false,
    enrolledCount: 12,
    completedCount: 8,
    steps: [
      { id: 's8', day: 0, subject: 'Sua marca vence em 90 dias - renove agora', content: 'Prezado(a) {{nome_cliente}},\n\nSua marca {{nome_marca}} está com vencimento em 90 dias...', openRate: 87 },
      { id: 's9', day: 30, subject: 'Sua marca vence em 60 dias - ação necessária', content: 'Prezado(a) {{nome_cliente}},\n\nAtenção: 60 dias para o vencimento da marca {{nome_marca}}...', openRate: 81 },
      { id: 's10', day: 60, subject: '⚠️ Urgente: sua marca vence em 30 dias', content: 'URGENTE - {{nome_cliente}},\n\nSua marca {{nome_marca}} vence em apenas 30 dias!', openRate: 94 },
    ],
  },
];

const DYNAMIC_VARS = ['{{nome_cliente}}', '{{nome_marca}}', '{{numero_processo}}', '{{status_processo}}', '{{admin_responsavel}}'];

function makeStepId() {
  return `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function EmailSequences() {
  const [sequences, setSequences] = useState<Sequence[]>(INITIAL_SEQUENCES);
  const [expandedId, setExpandedId] = useState<string | null>('1');
  const [createOpen, setCreateOpen] = useState(false);
  const [editSequence, setEditSequence] = useState<Sequence | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingStep, setEditingStep] = useState<string | null>(null);

  // Form
  const [form, setForm] = useState({
    name: '',
    description: '',
    trigger: '',
  });
  const [steps, setSteps] = useState<SequenceStep[]>([
    { id: makeStepId(), day: 0, subject: '', content: '' },
  ]);

  const resetForm = () => {
    setForm({ name: '', description: '', trigger: '' });
    setSteps([{ id: makeStepId(), day: 0, subject: '', content: '' }]);
    setEditingStep(null);
  };

  const openCreate = () => {
    resetForm();
    setEditSequence(null);
    setCreateOpen(true);
  };

  const openEdit = (seq: Sequence) => {
    setForm({ name: seq.name, description: seq.description, trigger: seq.trigger });
    setSteps(seq.steps.map(s => ({ ...s })));
    setEditSequence(seq);
    setCreateOpen(true);
  };

  const addStep = () => {
    const lastDay = steps.length > 0 ? steps[steps.length - 1].day : 0;
    const newStep: SequenceStep = {
      id: makeStepId(),
      day: lastDay + 3,
      subject: '',
      content: '',
    };
    setSteps(prev => [...prev, newStep]);
    setEditingStep(newStep.id);
  };

  const removeStep = (id: string) => {
    if (steps.length <= 1) {
      toast.error('A sequência precisa ter pelo menos 1 etapa.');
      return;
    }
    setSteps(prev => prev.filter(s => s.id !== id));
  };

  const updateStep = (id: string, field: keyof SequenceStep, value: string | number) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const insertVarInStep = (stepId: string, v: string) => {
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, content: s.content + v } : s));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.trigger) {
      toast.error('Preencha o nome e o gatilho da sequência');
      return;
    }
    const invalidStep = steps.find(s => !s.subject.trim() || !s.content.trim());
    if (invalidStep) {
      toast.error('Preencha assunto e conteúdo de todas as etapas');
      setEditingStep(invalidStep.id);
      return;
    }

    setIsSaving(true);
    await new Promise(r => setTimeout(r, 900));

    const sortedSteps = [...steps].sort((a, b) => a.day - b.day);

    if (editSequence) {
      setSequences(prev => prev.map(s => s.id === editSequence.id ? {
        ...s,
        name: form.name,
        description: form.description,
        trigger: form.trigger,
        steps: sortedSteps,
      } : s));
      toast.success('Sequência atualizada com sucesso!');
    } else {
      const newSeq: Sequence = {
        id: Date.now().toString(),
        name: form.name,
        description: form.description,
        trigger: form.trigger,
        isActive: false,
        enrolledCount: 0,
        completedCount: 0,
        steps: sortedSteps,
      };
      setSequences(prev => [newSeq, ...prev]);
      toast.success('Sequência criada com sucesso!');
    }

    setIsSaving(false);
    setCreateOpen(false);
    resetForm();
  };

  const toggleSequence = (id: string) => {
    setSequences(prev => prev.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s));
    const seq = sequences.find(s => s.id === id);
    toast.success(seq?.isActive ? 'Sequência pausada.' : 'Sequência ativada!');
  };

  const handleDelete = (id: string) => {
    setSequences(prev => prev.filter(s => s.id !== id));
    toast.success('Sequência removida.');
    setDeleteId(null);
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Sequências de Email
          </h2>
          <p className="text-sm text-muted-foreground">Fluxos multi-etapa automatizados com pausa inteligente</p>
        </div>
        <Button className="gap-2 shadow-md" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nova Sequência
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 flex-shrink-0">
        {[
          { label: 'Sequências Ativas', value: sequences.filter(s => s.isActive).length, icon: Play, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Total Inscritos', value: sequences.reduce((s, seq) => s + seq.enrolledCount, 0), icon: Users, color: 'text-foreground', bg: 'bg-muted' },
          { label: 'Concluídos', value: sequences.reduce((s, seq) => s + seq.completedCount, 0), icon: CheckCircle2, color: 'text-foreground', bg: 'bg-muted' },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="bg-card border border-border/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <div>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Sequences List */}
      <ScrollArea className="flex-1">
        <div className="space-y-3 pr-1">
          <AnimatePresence>
            {sequences.map((seq, i) => (
              <motion.div
                key={seq.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.07 }}
              >
                <Card className="border-border/50 hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    {/* Header row */}
                    <button
                      onClick={() => setExpandedId(expandedId === seq.id ? null : seq.id)}
                      className="w-full text-left p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors rounded-t-xl"
                    >
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Layers className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm">{seq.name}</h3>
                          <Badge variant={seq.isActive ? 'default' : 'secondary'} className="text-[10px]">
                            {seq.isActive ? 'Ativa' : 'Pausada'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {seq.steps.length} emails
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{seq.description}</p>
                        {seq.trigger && (
                          <p className="text-[10px] text-primary mt-0.5 flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            Gatilho: {seq.trigger}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-semibold">{seq.enrolledCount}</p>
                          <p className="text-[10px] text-muted-foreground">inscritos</p>
                        </div>
                        <Switch
                          checked={seq.isActive}
                          onCheckedChange={() => toggleSequence(seq.id)}
                          onClick={e => e.stopPropagation()}
                        />
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={e => { e.stopPropagation(); openEdit(seq); }}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={e => { e.stopPropagation(); setDeleteId(seq.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {expandedId === seq.id
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        }
                      </div>
                    </button>

                    {/* Expandable steps */}
                    <AnimatePresence>
                      {expandedId === seq.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden border-t border-border/50"
                        >
                          <div className="p-4 space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                              Fluxo da Sequência
                            </p>
                            <div className="space-y-2">
                              {seq.steps.map((step, si) => (
                                <div key={step.id} className="flex items-center gap-3">
                                  <div className="flex flex-col items-center flex-shrink-0">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                      {si + 1}
                                    </div>
                                    {si < seq.steps.length - 1 && (
                                      <div className="h-4 w-0.5 bg-border mt-1" />
                                    )}
                                  </div>
                                  <div className="flex-1 flex items-center gap-3 bg-muted/40 rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-[52px]">
                                      <Clock className="h-3 w-3" />
                                      Dia {step.day}
                                    </div>
                                    <Mail className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                                    <span className="text-xs font-medium flex-1 truncate">{step.subject}</span>
                                    {step.openRate && (
                                      <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                                        {step.openRate}% abertura
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                              <p className="text-xs text-muted-foreground flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                                <strong>Pausa inteligente:</strong> a sequência é pausada automaticamente se o cliente responder.
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>

          {sequences.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Layers className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="font-medium">Nenhuma sequência criada</p>
              <p className="text-sm mt-1">Crie sua primeira sequência clicando em "Nova Sequência"</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Create / Edit Dialog */}
      <Dialog open={createOpen} onOpenChange={open => { if (!open) resetForm(); setCreateOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              {editSequence ? 'Editar Sequência' : 'Nova Sequência de Email'}
            </DialogTitle>
            <DialogDescription>
              Configure os detalhes e as etapas da sequência automática de emails.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label>Nome da Sequência <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Ex: Onboarding Novo Cliente"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input
                placeholder="Breve descrição do objetivo desta sequência..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            {/* Trigger */}
            <div className="space-y-1.5">
              <Label>Gatilho de Início <span className="text-destructive">*</span></Label>
              <select
                className="w-full border border-input bg-background text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.trigger}
                onChange={e => setForm(f => ({ ...f, trigger: e.target.value }))}
              >
                <option value="">Selecione um gatilho...</option>
                {TRIGGER_OPTIONS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Steps */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Etapas da Sequência <span className="text-destructive">*</span></Label>
                <Button type="button" size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={addStep}>
                  <PlusCircle className="h-3.5 w-3.5" />
                  Adicionar Etapa
                </Button>
              </div>

              <div className="space-y-3">
                {steps.map((step, si) => (
                  <div key={step.id} className="border border-border/50 rounded-xl overflow-hidden">
                    {/* Step header */}
                    <button
                      type="button"
                      onClick={() => setEditingStep(editingStep === step.id ? null : step.id)}
                      className="w-full flex items-center gap-3 p-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                        {si + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground font-mono">Dia {step.day}</span>
                          {step.subject
                            ? <span className="text-sm font-medium truncate">{step.subject}</span>
                            : <span className="text-sm text-muted-foreground italic">Sem assunto</span>
                          }
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {editingStep === step.id
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        }
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); removeStep(step.id); }}
                          className="h-6 w-6 flex items-center justify-center text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                        >
                          <MinusCircle className="h-4 w-4" />
                        </button>
                      </div>
                    </button>

                    {/* Step fields */}
                    <AnimatePresence>
                      {editingStep === step.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 space-y-3 border-t border-border/50">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Dia de Envio</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  placeholder="0"
                                  value={step.day}
                                  onChange={e => updateStep(step.id, 'day', parseInt(e.target.value) || 0)}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Assunto <span className="text-destructive">*</span></Label>
                                <Input
                                  placeholder="Assunto do email..."
                                  value={step.subject}
                                  onChange={e => updateStep(step.id, 'subject', e.target.value)}
                                />
                              </div>
                            </div>

                            {/* Dynamic vars */}
                            <div className="flex flex-wrap gap-1.5">
                              {DYNAMIC_VARS.map(v => (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => insertVarInStep(step.id, v)}
                                  className="text-[10px] bg-primary/10 text-primary border border-primary/20 rounded px-1.5 py-0.5 hover:bg-primary/20 transition-colors font-mono"
                                >
                                  {v}
                                </button>
                              ))}
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs">Conteúdo <span className="text-destructive">*</span></Label>
                              <Textarea
                                placeholder="Escreva o corpo do email desta etapa..."
                                value={step.content}
                                onChange={e => updateStep(step.id, 'content', e.target.value)}
                                className="min-h-[100px] text-sm resize-none font-mono"
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>

              {/* Smart pause info */}
              <div className="bg-muted/50 border border-border/50 rounded-lg p-3 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <strong>Pausa inteligente:</strong> a sequência pausa automaticamente quando o cliente responde. As etapas são ordenadas automaticamente pelo dia de envio.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }} disabled={isSaving}>
              <X className="h-4 w-4 mr-1.5" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1.5" />}
              {isSaving ? 'Salvando...' : editSequence ? 'Salvar Alterações' : 'Criar Sequência'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Sequência</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A sequência e todas as suas etapas serão removidas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
