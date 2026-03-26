import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import {
  FileStack, Plus, RefreshCw, Edit, Trash2, Copy, Eye, Upload,
  Search, FileText, CheckCircle2, XCircle, Layers, Braces, Sparkles,
  TrendingUp, Clock, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { TemplateUploader } from '@/components/admin/contracts/TemplateUploader';
import { ContractRenderer } from '@/components/contracts/ContractRenderer';
import { ContractTemplateEditor } from '@/components/admin/contracts/ContractTemplateEditor';
import { cn } from '@/lib/utils';

interface ContractTemplate {
  id: string;
  name: string;
  content: string;
  contract_type_id: string | null;
  is_active: boolean;
  variables: unknown[];
  created_at: string;
  contract_type?: { name: string } | null;
}

interface ContractType {
  id: string;
  name: string;
}

function getDocumentType(name: string) {
  const n = name.toLowerCase();
  if (n.includes('procura')) return 'procuracao';
  if (n.includes('distrato') && n.includes('multa')) return 'distrato_multa';
  if (n.includes('distrato')) return 'distrato_sem_multa';
  return 'contract';
}

function renderPreviewContent(content: string): string {
  const sampleData: Record<string, string> = {
    '{{nome_cliente}}': 'João da Silva',
    '{{cpf}}': '123.456.789-00',
    '{{cpf_cnpj}}': '123.456.789-00',
    '{{email}}': 'joao@exemplo.com',
    '{{telefone}}': '(11) 99999-9999',
    '{{razao_social_ou_nome}}': 'João da Silva',
    '{{dados_cnpj}}': '',
    '{{endereco_completo}}': 'Rua das Flores, 123, Centro, São Paulo - SP',
    '{{endereco}}': 'Rua das Flores, 123',
    '{{bairro}}': 'Centro',
    '{{cidade}}': 'São Paulo',
    '{{estado}}': 'SP',
    '{{cep}}': '01234-567',
    '{{marca}}': 'MARCA EXEMPLO',
    '{{ramo_atividade}}': 'Tecnologia',
    '{{numero_contrato}}': '2026/001',
    '{{valor}}': 'R$ 699,00',
    '{{forma_pagamento_detalhada}}': '• Pagamento à vista via PIX: R$ 699,00',
    '{{data_extenso}}': new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
    '{{data}}': new Date().toLocaleDateString('pt-BR'),
    '{{data_inicio}}': new Date().toLocaleDateString('pt-BR'),
    '{{data_fim}}': new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
    '{{dia_vencimento}}': '10',
    '{{endereco_cliente}}': 'Rua das Flores, 123, Centro, São Paulo - SP, CEP 01234-567',
    '{{data_assinatura}}': new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
  };
  let result = content;
  Object.entries(sampleData).forEach(([key, val]) => {
    result = result.split(key).join(val);
  });
  return result;
}

// Animated stats card
function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  gradient,
  index,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  gradient: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
    >
      {/* Gradient accent line */}
      <div className={cn('absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r', gradient)} />

      {/* Glow */}
      <div className={cn('absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl bg-gradient-to-r', gradient)} style={{ opacity: 0.05 }} />

      <div className="flex items-start justify-between mb-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-lg', gradient)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>

      <motion.p
        className="text-2xl font-bold tracking-tight"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 + index * 0.07 }}
      >
        {value}
      </motion.p>
      <p className="text-xs font-medium text-muted-foreground mt-0.5">{label}</p>
      {sub && (
        <p className="text-[11px] text-muted-foreground/70 mt-1 border-t border-border/30 pt-1">{sub}</p>
      )}
    </motion.div>
  );
}

// Template card
function TemplateCard({
  template,
  index,
  onEdit,
  onPreview,
  onDuplicate,
  onDelete,
  onToggleActive,
}: {
  template: ContractTemplate;
  index: number;
  onEdit: (t: ContractTemplate) => void;
  onPreview: (t: ContractTemplate) => void;
  onDuplicate: (t: ContractTemplate) => void;
  onDelete: (id: string) => void;
  onToggleActive: (t: ContractTemplate) => void;
}) {
  const vars = Array.isArray(template.variables) ? template.variables as string[] : [];
  const docType = getDocumentType(template.name);
  const docTypeLabel = {
    contract: { label: 'Contrato', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    procuracao: { label: 'Procuração', color: 'bg-violet-500/10 text-violet-600 border-violet-500/20' },
    distrato_multa: { label: 'Distrato c/ Multa', color: 'bg-rose-500/10 text-rose-600 border-rose-500/20' },
    distrato_sem_multa: { label: 'Distrato s/ Multa', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  }[docType];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
    >
      {/* Status bar */}
      <div className={cn(
        'absolute top-0 left-0 right-0 h-[3px] transition-all duration-500',
        template.is_active
          ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
          : 'bg-gradient-to-r from-muted to-muted-foreground/30'
      )} />

      {/* Hover glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/[0.02] group-hover:to-blue-500/[0.04] transition-all duration-500 rounded-2xl" />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          {/* Icon */}
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300',
            template.is_active
              ? 'bg-gradient-to-br from-primary to-blue-600 shadow-lg shadow-primary/25'
              : 'bg-muted'
          )}>
            <FileText className={cn('h-5 w-5', template.is_active ? 'text-white' : 'text-muted-foreground')} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight line-clamp-2 mb-1">{template.name}</h3>
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline" className={cn('text-[10px] h-5 border font-medium', docTypeLabel.color)}>
                {docTypeLabel.label}
              </Badge>
              {template.contract_type?.name && (
                <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground">
                  {template.contract_type.name}
                </Badge>
              )}
            </div>
          </div>

          {/* Active toggle */}
          <button
            onClick={() => onToggleActive(template)}
            className={cn(
              'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200',
              template.is_active
                ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
            )}
            title={template.is_active ? 'Desativar' : 'Ativar'}
          >
            {template.is_active
              ? <CheckCircle2 className="h-4 w-4" />
              : <XCircle className="h-4 w-4" />
            }
          </button>
        </div>

        {/* Content preview */}
        <p className="text-xs text-muted-foreground/70 line-clamp-2 mb-3 leading-relaxed font-mono bg-muted/30 rounded-lg p-2">
          {template.content.substring(0, 120)}...
        </p>

        {/* Variables */}
        {vars.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {vars.slice(0, 4).map((v, i) => (
              <span key={i} className="text-[9px] font-mono bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-md">
                {String(v)}
              </span>
            ))}
            {vars.length > 4 && (
              <span className="text-[9px] bg-muted text-muted-foreground border border-border px-1.5 py-0.5 rounded-md">
                +{vars.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Footer meta */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <Braces className="h-3 w-3" />
            {vars.length} variáveis
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(template.created_at).toLocaleDateString('pt-BR')}
          </span>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-4 gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="col-span-2 h-8 text-xs gap-1.5 bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 hover:border-primary/40"
            onClick={() => onEdit(template)}
          >
            <Edit className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => onPreview(template)}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={() => onDuplicate(template)}
              title="Duplicar"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-1 h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => onDelete(template.id)}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Excluir
        </Button>
      </div>
    </motion.div>
  );
}

export default function ModelosContrato() {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [contractTypes, setContractTypes] = useState<ContractType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Dialogs
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState({ content: '', name: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [templatesRes, typesRes] = await Promise.all([
        supabase.from('contract_templates').select('*, contract_type:contract_types(name)').order('created_at', { ascending: false }),
        supabase.from('contract_types').select('*'),
      ]);
      if (templatesRes.error) throw templatesRes.error;
      setTemplates(templatesRes.data?.map(t => ({ ...t, variables: Array.isArray(t.variables) ? t.variables : [] })) || []);
      setContractTypes(typesRes.data || []);
    } catch (e) {
      toast.error('Erro ao carregar modelos');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este modelo?')) return;
    try {
      const { error } = await supabase.from('contract_templates').delete().eq('id', id);
      if (error) throw error;
      toast.success('Modelo excluído');
      fetchData();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const handleDuplicate = async (t: ContractTemplate) => {
    try {
      await supabase.from('contract_templates').insert({
        name: `${t.name} (Cópia)`,
        content: t.content,
        contract_type_id: t.contract_type_id,
        is_active: false,
        variables: t.variables as string[],
      });
      toast.success('Modelo duplicado');
      fetchData();
    } catch {
      toast.error('Erro ao duplicar');
    }
  };

  const handleToggleActive = async (t: ContractTemplate) => {
    try {
      await supabase.from('contract_templates').update({ is_active: !t.is_active }).eq('id', t.id);
      setTemplates(prev => prev.map(item => item.id === t.id ? { ...item, is_active: !item.is_active } : item));
      toast.success(t.is_active ? 'Modelo desativado' : 'Modelo ativado');
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const handlePreview = (t: ContractTemplate) => {
    setPreviewData({ content: renderPreviewContent(t.content), name: t.name });
    setPreviewOpen(true);
  };

  const handleEdit = (t: ContractTemplate) => {
    setEditingTemplate(t);
    setEditorOpen(true);
  };

  const handleNew = () => {
    setEditingTemplate(null);
    setEditorOpen(true);
  };

  // Stats
  const stats = useMemo(() => ({
    total: templates.length,
    active: templates.filter(t => t.is_active).length,
    inactive: templates.filter(t => !t.is_active).length,
    totalVars: templates.reduce((acc, t) => acc + (Array.isArray(t.variables) ? t.variables.length : 0), 0),
  }), [templates]);

  // Filtered templates
  const filtered = useMemo(() => {
    return templates.filter(t => {
      const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || (filterStatus === 'active' ? t.is_active : !t.is_active);
      return matchSearch && matchStatus;
    });
  }, [templates, search, filterStatus]);

  return (
    <>
      <div className="space-y-6">

        {/* ─── HERO HEADER ──────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-primary/5 p-6"
        >
          {/* BG decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/10 via-blue-500/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
          <div className="absolute bottom-0 left-24 w-32 h-32 bg-gradient-to-tr from-violet-500/5 to-transparent rounded-full translate-y-1/2 blur-2xl" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                whileHover={{ rotate: 8, scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 400 }}
                className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-xl shadow-primary/25"
              >
                <FileStack className="h-6 w-6 text-white" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Modelos de Contrato</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Crie, edite e gerencie modelos reutilizáveis com variáveis dinâmicas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={fetchData} className="h-9 w-9">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setUploadDialogOpen(true)}
                className="h-9 gap-2"
              >
                <Upload className="h-4 w-4" />
                Importar
              </Button>
              <Button
                onClick={handleNew}
                className="h-9 gap-2 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 shadow-lg shadow-primary/25"
              >
                <Sparkles className="h-4 w-4" />
                Novo Modelo
              </Button>
            </div>
          </div>
        </motion.div>

        {/* ─── STATS CARDS ──────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            icon={Layers}
            label="Total de Modelos"
            value={stats.total}
            sub={`${stats.active} ativos · ${stats.inactive} inativos`}
            gradient="from-primary to-blue-600"
            index={0}
          />
          <MetricCard
            icon={CheckCircle2}
            label="Modelos Ativos"
            value={stats.active}
            sub={stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100)}% do total` : '—'}
            gradient="from-emerald-500 to-teal-600"
            index={1}
          />
          <MetricCard
            icon={Braces}
            label="Variáveis Mapeadas"
            value={stats.totalVars}
            sub="Em todos os modelos"
            gradient="from-violet-500 to-purple-600"
            index={2}
          />
          <MetricCard
            icon={TrendingUp}
            label="Tipos de Documento"
            value={contractTypes.length}
            sub="Categorias configuradas"
            gradient="from-amber-500 to-orange-500"
            index={3}
          />
        </div>

        {/* ─── FILTERS ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar modelos..."
              className="pl-9 h-9 bg-card/80"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {(['all', 'active', 'inactive'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  filterStatus === s
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {{ all: 'Todos', active: 'Ativos', inactive: 'Inativos' }[s]}
              </button>
            ))}
            <span className="text-xs text-muted-foreground ml-2 bg-muted/50 px-2 py-1 rounded-lg">
              {filtered.length} modelo{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </motion.div>

        {/* ─── TEMPLATES GRID ───────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/50 bg-card/40 h-64 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-border/50 bg-card/30"
          >
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <FileStack className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold mb-1">
              {search ? 'Nenhum modelo encontrado' : 'Nenhum modelo cadastrado'}
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              {search ? 'Tente outros termos de busca' : 'Crie seu primeiro modelo de contrato'}
            </p>
            {!search && (
              <Button onClick={handleNew} className="gap-2 bg-gradient-to-r from-primary to-blue-600">
                <Plus className="h-4 w-4" />
                Criar Primeiro Modelo
              </Button>
            )}
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((t, i) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  index={i}
                  onEdit={handleEdit}
                  onPreview={handlePreview}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>

      {/* ─── TEMPLATE EDITOR (futuristic 2026) ─────────── */}
      <ContractTemplateEditor
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setEditingTemplate(null);
        }}
        template={editingTemplate}
        contractTypes={contractTypes}
        onSaved={fetchData}
      />

      {/* ─── IMPORT UPLOADER ────────────────────────────── */}
      <TemplateUploader
        contractTypes={contractTypes}
        onTemplateCreated={fetchData}
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
      />

      {/* ─── PREVIEW DIALOG ─────────────────────────────── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {previewData.name}
            </DialogTitle>
          </DialogHeader>
          <ContractRenderer
            content={previewData.content}
            documentType={getDocumentType(previewData.name) as 'contract' | 'procuracao' | 'distrato_multa' | 'distrato_sem_multa'}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
