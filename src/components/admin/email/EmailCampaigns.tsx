import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  BarChart3, Plus, Users, Send, Eye, MousePointer,
  TrendingUp, Play, Pause, Edit, Trash2, Calendar,
  Search, Rocket, Clock, X, CheckCircle, Loader2,
  Mail, Target, Zap, UserCheck, Globe, Filter,
  CheckSquare, Square
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Campaign {
  id: string;
  name: string;
  subject: string;
  preview: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused';
  audience: string;
  recipients: number;
  sent: number;
  opened: number;
  clicked: number;
  createdAt: Date;
  scheduledAt?: Date;
  content: string;
  selectedRecipients?: string[];
}

interface Recipient {
  id: string;
  name: string;
  email: string;
  type: 'client' | 'lead';
  company?: string;
  status?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const INITIAL_CAMPAIGNS: Campaign[] = [
  {
    id: '1', name: 'Newsletter Julho 2025', subject: 'Novidades no registro de marcas!',
    preview: 'Confira as últimas atualizações do INPI...',
    status: 'sent', audience: 'Seleção manual', recipients: 340, sent: 340, opened: 231, clicked: 89,
    createdAt: new Date('2025-07-01'), scheduledAt: new Date('2025-07-05'),
    content: '<p>Olá <strong>{{nome_cliente}}</strong>,</p><p>Confira as últimas novidades sobre seu processo de registro...</p>',
  },
  {
    id: '2', name: 'Promoção Renovação de Marcas', subject: 'Renove sua marca com 15% de desconto',
    preview: 'Oferta válida por tempo limitado...',
    status: 'scheduled', audience: 'Clientes com renovação próxima', recipients: 128, sent: 0, opened: 0, clicked: 0,
    createdAt: new Date('2025-07-10'), scheduledAt: new Date('2025-07-20'),
    content: '<p>Prezado(a) <strong>{{nome_cliente}}</strong>,</p><p>Sua marca <em>{{nome_marca}}</em> está próxima do prazo de renovação...</p>',
  },
];

const STATUS_CONFIG = {
  draft:     { label: 'Rascunho',  variant: 'secondary' as const, icon: Edit,       color: 'text-muted-foreground' },
  scheduled: { label: 'Agendado', variant: 'outline' as const,   icon: Calendar,   color: 'text-blue-500' },
  sending:   { label: 'Enviando', variant: 'default' as const,   icon: Loader2,    color: 'text-primary' },
  sent:      { label: 'Enviado',  variant: 'default' as const,   icon: CheckCircle, color: 'text-emerald-500' },
  paused:    { label: 'Pausado',  variant: 'secondary' as const, icon: Pause,      color: 'text-yellow-500' },
};

const DYNAMIC_VARS = [
  { key: '{{nome_cliente}}',      example: 'João Silva' },
  { key: '{{nome_marca}}',        example: 'Minha Marca' },
  { key: '{{numero_processo}}',   example: '901234567' },
  { key: '{{status_processo}}',   example: 'Em análise' },
  { key: '{{admin_responsavel}}', example: 'Dr. Carlos' },
  { key: '{{link_pagamento}}',    example: 'https://pagar.me/...' },
  { key: '{{email}}',             example: 'joao@email.com' },
];

const EXAMPLE_DATA: Record<string, string> = Object.fromEntries(
  DYNAMIC_VARS.map(v => [v.key, v.example])
);

function replaceVarsWithExamples(content: string): string {
  let result = content;
  for (const [key, val] of Object.entries(EXAMPLE_DATA)) {
    result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'gi'), val);
  }
  return result;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface EmailCampaignsProps {
  onCompose?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function EmailCampaigns({ onCompose }: EmailCampaignsProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogTab, setDialogTab] = useState<'compose' | 'recipients' | 'preview'>('compose');

  // Recipient selection state
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientFilter, setRecipientFilter] = useState<'all' | 'clients' | 'leads'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Form state
  const [form, setForm] = useState({
    name: '', subject: '', preview: '', audience: '', content: '', scheduledAt: '',
  });

  // ── Fetch recipients from DB ──────────────────────────────────────────────
  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ['campaign-recipients-clients'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, company_name')
        .not('email', 'is', null)
        .order('full_name');
      return (data || []).map(r => ({
        id: r.id,
        name: r.full_name || r.email,
        email: r.email,
        type: 'client' as const,
        company: r.company_name || undefined,
      }));
    },
    enabled: createOpen,
  });

  const { data: leads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ['campaign-recipients-leads'],
    queryFn: async () => {
      const { data } = await supabase
        .from('leads')
        .select('id, full_name, email, company_name, status')
        .not('email', 'is', null)
        .eq('email_opt_out', false)
        .order('full_name');
      return (data || []).map(r => ({
        id: r.id,
        name: r.full_name || r.email || 'Lead',
        email: r.email!,
        type: 'lead' as const,
        company: r.company_name || undefined,
        status: r.status,
      }));
    },
    enabled: createOpen,
  });

  const allRecipients: Recipient[] = useMemo(() => {
    if (recipientFilter === 'clients') return clients;
    if (recipientFilter === 'leads') return leads;
    return [...clients, ...leads];
  }, [clients, leads, recipientFilter]);

  const filteredRecipients = useMemo(() => {
    const q = recipientSearch.toLowerCase();
    if (!q) return allRecipients;
    return allRecipients.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      (r.company || '').toLowerCase().includes(q)
    );
  }, [allRecipients, recipientSearch]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const resetForm = () => {
    setForm({ name: '', subject: '', preview: '', audience: '', content: '', scheduledAt: '' });
    setSelectedIds(new Set());
    setRecipientSearch('');
    setRecipientFilter('all');
    setDialogTab('compose');
  };

  const openCreate = () => {
    resetForm();
    setEditCampaign(null);
    setCreateOpen(true);
  };

  const openEdit = (c: Campaign) => {
    setForm({
      name: c.name, subject: c.subject, preview: c.preview, audience: c.audience,
      content: c.content,
      scheduledAt: c.scheduledAt ? format(c.scheduledAt, "yyyy-MM-dd'T'HH:mm") : '',
    });
    setSelectedIds(new Set(c.selectedRecipients || []));
    setEditCampaign(c);
    setDialogTab('compose');
    setCreateOpen(true);
  };

  const toggleRecipient = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (filteredRecipients.every(r => selectedIds.has(r.id))) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredRecipients.forEach(r => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredRecipients.forEach(r => next.add(r.id));
        return next;
      });
    }
  };

  const allVisibleSelected = filteredRecipients.length > 0 && filteredRecipients.every(r => selectedIds.has(r.id));

  const handleSave = async () => {
    if (!form.name.trim() || !form.subject.trim() || !form.content.trim()) {
      toast.error('Preencha nome, assunto e conteúdo do email');
      return;
    }
    if (selectedIds.size === 0) {
      toast.error('Selecione ao menos 1 destinatário na aba Destinatários');
      setDialogTab('recipients');
      return;
    }
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 900));

    const audienceLabel = selectedIds.size === allRecipients.length
      ? 'Toda a base'
      : `${selectedIds.size} destinatários selecionados`;

    if (editCampaign) {
      setCampaigns(prev => prev.map(c => c.id === editCampaign.id ? {
        ...c, name: form.name, subject: form.subject, preview: form.preview,
        audience: audienceLabel, content: form.content,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt) : undefined,
        status: form.scheduledAt ? 'scheduled' : 'draft',
        recipients: selectedIds.size,
        selectedRecipients: Array.from(selectedIds),
      } : c));
      toast.success('Campanha atualizada com sucesso!');
    } else {
      setCampaigns(prev => [{
        id: Date.now().toString(),
        name: form.name, subject: form.subject, preview: form.preview,
        audience: audienceLabel, content: form.content,
        status: form.scheduledAt ? 'scheduled' : 'draft',
        recipients: selectedIds.size, sent: 0, opened: 0, clicked: 0,
        createdAt: new Date(),
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt) : undefined,
        selectedRecipients: Array.from(selectedIds),
      }, ...prev]);
      toast.success(`Campanha criada com ${selectedIds.size} destinatários!`);
    }

    setIsSaving(false);
    setCreateOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    setCampaigns(prev => prev.filter(c => c.id !== id));
    toast.success('Campanha removida.');
    setDeleteId(null);
  };

  const handleLaunch = (id: string) => {
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'sending' } : c));
    toast.success('Campanha iniciada! Os emails estão sendo enviados.');
  };

  const handlePause = (id: string) => {
    setCampaigns(prev => prev.map(c => c.id === id ? {
      ...c, status: c.status === 'paused' ? 'sending' : 'paused'
    } : c));
  };

  const insertVar = (v: string) => {
    setForm(f => ({ ...f, content: f.content + v }));
  };

  const filtered = campaigns.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.subject.toLowerCase().includes(search.toLowerCase())
  );

  const totalSent = campaigns.reduce((s, c) => s + c.sent, 0);
  const totalOpened = campaigns.reduce((s, c) => s + c.opened, 0);
  const totalClicked = campaigns.reduce((s, c) => s + c.clicked, 0);
  const avgOpenRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;

  // Preview with variable substitution
  const previewHtml = useMemo(() => replaceVarsWithExamples(form.content), [form.content]);

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Campanhas de Email
          </h2>
          <p className="text-sm text-muted-foreground">Envio em massa com seleção real de destinatários</p>
        </div>
        <Button className="gap-2 shadow-md" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        {[
          { label: 'Total Enviados', value: totalSent,       icon: Send,         color: 'text-primary',     bg: 'bg-primary/10' },
          { label: 'Abertos',        value: totalOpened,     icon: Eye,          color: 'text-foreground',  bg: 'bg-muted' },
          { label: 'Cliques',        value: totalClicked,    icon: MousePointer, color: 'text-foreground',  bg: 'bg-muted' },
          { label: 'Taxa Abertura',  value: `${avgOpenRate}%`, icon: TrendingUp, color: 'text-primary',     bg: 'bg-primary/10' },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
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

      {/* Search */}
      <div className="relative flex-shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar campanhas..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Campaign List */}
      <ScrollArea className="flex-1">
        <div className="space-y-3 pr-1">
          <AnimatePresence>
            {filtered.map((campaign, i) => {
              const statusConf = STATUS_CONFIG[campaign.status];
              const StatusIcon = statusConf.icon;
              const openRate = campaign.sent > 0 ? Math.round((campaign.opened / campaign.sent) * 100) : 0;
              const clickRate = campaign.sent > 0 ? Math.round((campaign.clicked / campaign.sent) * 100) : 0;
              const progress = campaign.recipients > 0 ? Math.round((campaign.sent / campaign.recipients) * 100) : 0;

              return (
                <motion.div key={campaign.id}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.06 }}>
                  <Card className="border-border/50 hover:shadow-md transition-all duration-200 hover:border-primary/20">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-semibold text-sm">{campaign.name}</h3>
                            <Badge variant={statusConf.variant} className="gap-1 text-[10px]">
                              <StatusIcon className={`h-3 w-3 ${campaign.status === 'sending' ? 'animate-spin' : ''}`} />
                              {statusConf.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{campaign.subject}</p>
                          <div className="flex items-center gap-1 mt-1.5">
                            <Target className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">{campaign.audience}</span>
                          </div>
                          {campaign.status === 'sending' && (
                            <div className="mt-3 space-y-1">
                              <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>Progresso</span><span>{campaign.sent}/{campaign.recipients}</span>
                              </div>
                              <Progress value={progress} className="h-1.5" />
                            </div>
                          )}
                          {campaign.status === 'sent' && (
                            <div className="flex items-center gap-4 mt-3">
                              <div className="flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs font-medium">{campaign.recipients}</span>
                                <span className="text-[10px] text-muted-foreground">destinatários</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Eye className="h-3.5 w-3.5 text-primary" />
                                <span className="text-xs font-medium text-primary">{openRate}%</span>
                                <span className="text-[10px] text-muted-foreground">abertura</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <MousePointer className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs font-medium">{clickRate}%</span>
                                <span className="text-[10px] text-muted-foreground">clique</span>
                              </div>
                            </div>
                          )}
                          {campaign.scheduledAt && campaign.status === 'scheduled' && (
                            <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Agendado para {format(campaign.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                            Criado em {format(campaign.createdAt, 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {campaign.status === 'draft' && (
                            <Button size="sm" className="gap-1.5 h-8" onClick={() => handleLaunch(campaign.id)}>
                              <Rocket className="h-3.5 w-3.5" />Enviar
                            </Button>
                          )}
                          {campaign.status === 'sending' && (
                            <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => handlePause(campaign.id)}>
                              <Pause className="h-3.5 w-3.5" />Pausar
                            </Button>
                          )}
                          {campaign.status === 'paused' && (
                            <Button size="sm" className="gap-1.5 h-8" onClick={() => handlePause(campaign.id)}>
                              <Play className="h-3.5 w-3.5" />Retomar
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(campaign)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(campaign.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="font-medium">Nenhuma campanha encontrada</p>
              <p className="text-sm mt-1">Crie sua primeira campanha clicando em "Nova Campanha"</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/50 flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {editCampaign ? 'Editar Campanha' : 'Nova Campanha de Email'}
            </DialogTitle>
            <DialogDescription>
              {selectedIds.size > 0 && (
                <span className="inline-flex items-center gap-1 text-primary font-medium">
                  <Users className="h-3.5 w-3.5" />
                  {selectedIds.size} destinatário{selectedIds.size !== 1 ? 's' : ''} selecionado{selectedIds.size !== 1 ? 's' : ''}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={dialogTab} onValueChange={v => setDialogTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-6 mt-3 grid grid-cols-3 flex-shrink-0">
              <TabsTrigger value="compose" className="gap-1.5">
                <Mail className="h-3.5 w-3.5" />Conteúdo
              </TabsTrigger>
              <TabsTrigger value="recipients" className="gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Destinatários
                {selectedIds.size > 0 && (
                  <Badge className="h-4 text-[10px] px-1 ml-0.5">{selectedIds.size}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-1.5">
                <Eye className="h-3.5 w-3.5" />Pré-visualização
              </TabsTrigger>
            </TabsList>

            {/* ── TAB: CONTEÚDO ── */}
            <TabsContent value="compose" className="flex-1 overflow-y-auto px-6 py-4 space-y-4 mt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="camp-name">Nome da Campanha <span className="text-destructive">*</span></Label>
                  <Input id="camp-name" placeholder="Ex: Newsletter Agosto 2025"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="camp-schedule">Agendar Envio (opcional)</Label>
                  <Input id="camp-schedule" type="datetime-local" value={form.scheduledAt}
                    onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="camp-subject">Assunto do Email <span className="text-destructive">*</span></Label>
                <Input id="camp-subject" placeholder="Ex: Novidades no registro de marcas!"
                  value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="camp-preview">Texto de Pré-visualização</Label>
                <Input id="camp-preview" placeholder="Breve descrição que aparece no cliente de email..."
                  value={form.preview} onChange={e => setForm(f => ({ ...f, preview: e.target.value }))} />
              </div>

              {/* Dynamic Variables */}
              <div className="space-y-2">
                <Label>Variáveis Dinâmicas — clique para inserir no conteúdo</Label>
                <div className="flex flex-wrap gap-1.5">
                  {DYNAMIC_VARS.map(v => (
                    <button key={v.key} type="button" onClick={() => insertVar(v.key)}
                      className="text-[11px] bg-primary/10 text-primary border border-primary/20 rounded-md px-2 py-0.5 hover:bg-primary/20 transition-colors font-mono">
                      {v.key}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="space-y-1.5">
                <Label htmlFor="camp-content">Conteúdo HTML do Email <span className="text-destructive">*</span></Label>
                <Textarea id="camp-content"
                  placeholder="<p>Olá {{nome_cliente}},</p><p>Seu texto aqui...</p>"
                  value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  className="min-h-[200px] font-mono text-xs resize-none" />
                <p className="text-[11px] text-muted-foreground">
                  Suporte a HTML. Use a aba <strong>Pré-visualização</strong> para ver o resultado renderizado.
                </p>
              </div>

              <div className="bg-muted/50 border border-border/50 rounded-lg p-3 flex items-start gap-2">
                <Zap className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  As variáveis como <code className="bg-primary/10 px-1 rounded font-mono">{'{{nome_cliente}}'}</code> serão substituídas automaticamente pelos dados reais de cada destinatário no envio.
                </p>
              </div>
            </TabsContent>

            {/* ── TAB: DESTINATÁRIOS ── */}
            <TabsContent value="recipients" className="flex-1 overflow-hidden flex flex-col px-6 py-4 mt-0 gap-3">
              {/* Filter & Search */}
              <div className="flex gap-2 flex-shrink-0">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar por nome, email ou empresa..."
                    value={recipientSearch} onChange={e => setRecipientSearch(e.target.value)} className="pl-9" />
                </div>
                <div className="flex gap-1">
                  {(['all', 'clients', 'leads'] as const).map(f => (
                    <button key={f} onClick={() => setRecipientFilter(f)}
                      className={cn("text-xs px-3 py-1.5 rounded-lg border transition-all font-medium",
                        recipientFilter === f
                          ? "bg-primary/10 border-primary/30 text-primary"
                          : "border-border/50 text-muted-foreground hover:bg-muted/50")}>
                      {f === 'all' ? 'Todos' : f === 'clients' ? 'Clientes' : 'Leads'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats bar */}
              <div className="flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5" />
                    {clients.length} clientes
                  </span>
                  <span className="flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5" />
                    {leads.length} leads
                  </span>
                  <span className="text-primary font-medium">
                    {selectedIds.size} selecionados
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={toggleAll}>
                    {allVisibleSelected ? <Square className="h-3 w-3" /> : <CheckSquare className="h-3 w-3" />}
                    {allVisibleSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                  </Button>
                  {selectedIds.size > 0 && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive"
                      onClick={() => setSelectedIds(new Set())}>
                      Limpar seleção
                    </Button>
                  )}
                </div>
              </div>

              {/* List */}
              <ScrollArea className="flex-1 border border-border/50 rounded-xl">
                {(loadingClients || loadingLeads) ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Carregando contatos...</span>
                  </div>
                ) : filteredRecipients.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">Nenhum contato encontrado</p>
                    <p className="text-xs mt-1">Tente outro termo de busca</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {filteredRecipients.map(r => {
                      const isSelected = selectedIds.has(r.id);
                      return (
                        <button key={r.id} type="button"
                          onClick={() => toggleRecipient(r.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30",
                            isSelected && "bg-primary/5"
                          )}>
                          <Checkbox checked={isSelected} className="pointer-events-none flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{r.name}</span>
                              <Badge variant={r.type === 'client' ? 'default' : 'secondary'}
                                className="text-[9px] flex-shrink-0">
                                {r.type === 'client' ? 'Cliente' : 'Lead'}
                              </Badge>
                              {r.status && r.type === 'lead' && (
                                <Badge variant="outline" className="text-[9px] flex-shrink-0">{r.status}</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                            {r.company && (
                              <p className="text-[11px] text-muted-foreground/70 truncate">{r.company}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* ── TAB: PRÉ-VISUALIZAÇÃO ── */}
            <TabsContent value="preview" className="flex-1 overflow-hidden flex flex-col px-6 py-4 mt-0 gap-3">
              {/* Email envelope simulation */}
              <div className="bg-muted/30 border border-border/50 rounded-xl p-4 flex-shrink-0 space-y-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground w-16 text-xs font-medium">De:</span>
                  <span className="text-foreground">WebMarcas &lt;noreply@webmarcas.net&gt;</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground w-16 text-xs font-medium">Para:</span>
                  <span className="text-foreground">João Silva &lt;joao@email.com&gt;</span>
                  <Badge variant="outline" className="text-[10px]">exemplo</Badge>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground w-16 text-xs font-medium">Assunto:</span>
                  <span className="text-foreground font-medium">{replaceVarsWithExamples(form.subject) || '(sem assunto)'}</span>
                </div>
                {form.preview && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground w-16 text-xs font-medium">Preview:</span>
                    <span className="text-muted-foreground italic text-xs">{form.preview}</span>
                  </div>
                )}
              </div>

              {/* Rendered HTML */}
              <div className="flex-1 border border-border/50 rounded-xl overflow-hidden bg-white">
                <div className="bg-muted/50 border-b border-border/50 px-4 py-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    Conteúdo renderizado — variáveis substituídas por dados de exemplo
                  </span>
                  <Badge variant="outline" className="text-[10px]">Pré-visualização</Badge>
                </div>
                <ScrollArea className="h-full">
                  <div className="p-6">
                    {form.content ? (
                      <div
                        className="prose prose-sm max-w-none text-foreground"
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                      />
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <Mail className="h-10 w-10 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">Escreva o conteúdo na aba <strong>Conteúdo</strong> para visualizar aqui</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              <div className="bg-muted border border-border rounded-lg p-3 flex-shrink-0">
                <p className="text-xs text-muted-foreground">
                  ⚠️ Esta é uma pré-visualização com dados fictícios. Os valores reais serão inseridos no momento do envio para cada destinatário.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="px-6 py-4 border-t border-border/50 flex-shrink-0 gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={isSaving}>
              <X className="h-4 w-4 mr-1.5" />Cancelar
            </Button>
            {dialogTab !== 'recipients' && (
              <Button variant="outline" onClick={() => setDialogTab('recipients')}>
                <Users className="h-4 w-4 mr-1.5" />
                {selectedIds.size > 0 ? `${selectedIds.size} destinatários` : 'Selecionar destinatários'}
              </Button>
            )}
            {dialogTab !== 'preview' && (
              <Button variant="outline" onClick={() => setDialogTab('preview')}>
                <Eye className="h-4 w-4 mr-1.5" />Pré-visualizar
              </Button>
            )}
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1.5" />}
              {isSaving ? 'Salvando...' : editCampaign ? 'Salvar Alterações' : 'Criar Campanha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Campanha</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A campanha será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
