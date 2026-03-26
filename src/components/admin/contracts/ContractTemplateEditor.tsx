import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  X, Eye, Code2, Save, Wand2, Type, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignJustify, List, Hash, ChevronDown,
  CheckCircle, Sparkles, FileText, Braces, RotateCcw, RotateCw,
  PanelLeftClose, PanelLeftOpen, ZoomIn, ZoomOut, Maximize2,
  Copy, Download, Tag, Info, Search, Replace
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ContractType {
  id: string;
  name: string;
}

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

interface ContractTemplateEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: ContractTemplate | null;
  contractTypes: ContractType[];
  onSaved: () => void;
}

const VARIABLE_GROUPS = [
  {
    label: 'Cliente',
    color: 'from-blue-500 to-cyan-500',
    bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    variables: [
      { key: '{{nome_cliente}}', label: 'Nome do Cliente' },
      { key: '{{cpf}}', label: 'CPF' },
      { key: '{{email}}', label: 'E-mail' },
      { key: '{{telefone}}', label: 'Telefone' },
      { key: '{{razao_social_ou_nome}}', label: 'Razão Social / Nome' },
      { key: '{{dados_cnpj}}', label: 'Dados CNPJ' },
    ]
  },
  {
    label: 'Endereço',
    color: 'from-violet-500 to-purple-500',
    bg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    variables: [
      { key: '{{endereco_completo}}', label: 'Endereço Completo' },
      { key: '{{endereco}}', label: 'Endereço' },
      { key: '{{bairro}}', label: 'Bairro' },
      { key: '{{cidade}}', label: 'Cidade' },
      { key: '{{estado}}', label: 'Estado' },
      { key: '{{cep}}', label: 'CEP' },
    ]
  },
  {
    label: 'Marca & Processo',
    color: 'from-emerald-500 to-teal-500',
    bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    variables: [
      { key: '{{marca}}', label: 'Nome da Marca' },
      { key: '{{ramo_atividade}}', label: 'Ramo de Atividade' },
      { key: '{{numero_contrato}}', label: 'Nº do Contrato' },
      { key: '{{valor}}', label: 'Valor do Contrato' },
    ]
  },
  {
    label: 'Pagamento & Datas',
    color: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    variables: [
      { key: '{{forma_pagamento_detalhada}}', label: 'Forma de Pagamento' },
      { key: '{{data_extenso}}', label: 'Data por Extenso' },
      { key: '{{data}}', label: 'Data Atual' },
      { key: '{{data_inicio}}', label: 'Data de Início' },
      { key: '{{data_fim}}', label: 'Data Final' },
    ]
  },
];

const SAMPLE_DATA: Record<string, string> = {
  '{{nome_cliente}}': 'João da Silva',
  '{{cpf}}': '123.456.789-00',
  '{{cpf_cnpj}}': '123.456.789-00',
  '{{email}}': 'joao@exemplo.com',
  '{{telefone}}': '(11) 99999-9999',
  '{{razao_social_ou_nome}}': 'João da Silva',
  '{{dados_cnpj}}': '',
  '{{endereco_completo}}': 'Rua das Flores, 123, Centro, São Paulo - SP, CEP 01234-567',
  '{{endereco}}': 'Rua das Flores, 123',
  '{{bairro}}': 'Centro',
  '{{cidade}}': 'São Paulo',
  '{{estado}}': 'SP',
  '{{cep}}': '01234-567',
  '{{marca}}': 'MARCA EXEMPLO',
  '{{ramo_atividade}}': 'Tecnologia da Informação',
  '{{numero_contrato}}': '2026/001',
  '{{valor}}': 'R$ 699,00',
  '{{forma_pagamento_detalhada}}': '• Pagamento à vista via PIX: R$ 699,00 (seiscentos e noventa e nove reais)',
  '{{data_extenso}}': new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
  '{{data}}': new Date().toLocaleDateString('pt-BR'),
  '{{data_inicio}}': new Date().toLocaleDateString('pt-BR'),
  '{{data_fim}}': new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
};

function renderPreview(content: string): string {
  let result = content;
  Object.entries(SAMPLE_DATA).forEach(([key, value]) => {
    result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), `<mark class="bg-primary/15 text-primary rounded px-0.5 not-italic font-medium">${value}</mark>`);
  });
  // Convert line breaks to <br> and paragraphs
  result = result
    .split('\n\n')
    .map(para => `<p class="mb-3">${para.replace(/\n/g, '<br>')}</p>`)
    .join('');
  return result;
}

function highlightVariables(content: string): string {
  return content.replace(/\{\{[^}]+\}\}/g, (match) => `<span class="var-highlight">${match}</span>`);
}

export function ContractTemplateEditor({
  open,
  onOpenChange,
  template,
  contractTypes,
  onSaved,
}: ContractTemplateEditorProps) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [contractTypeId, setContractTypeId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview' | 'split'>('split');
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [detectedVars, setDetectedVars] = useState<string[]>([]);
  const [previewScale, setPreviewScale] = useState(90);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [showVarPanel, setShowVarPanel] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isEditing = !!template;

  useEffect(() => {
    if (open) {
      if (template) {
        setName(template.name);
        setContent(template.content);
        setContractTypeId(template.contract_type_id || '');
        setIsActive(template.is_active);
      } else {
        setName('');
        setContent('');
        setContractTypeId('');
        setIsActive(true);
      }
      setUndoStack([]);
      setRedoStack([]);
      setShowSearch(false);
    }
  }, [open, template]);

  useEffect(() => {
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    setWordCount(words);
    setCharCount(content.length);
    // Detect variables
    const vars = [...new Set(content.match(/\{\{[^}]+\}\}/g) || [])];
    setDetectedVars(vars);
  }, [content]);

  const pushUndo = useCallback((prev: string) => {
    setUndoStack(s => [...s.slice(-49), prev]);
    setRedoStack([]);
  }, []);

  const handleContentChange = (val: string) => {
    pushUndo(content);
    setContent(val);
  };

  const undo = () => {
    if (!undoStack.length) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(s => [...s, content]);
    setUndoStack(s => s.slice(0, -1));
    setContent(prev);
  };

  const redo = () => {
    if (!redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(s => [...s, content]);
    setRedoStack(s => s.slice(0, -1));
    setContent(next);
  };

  const insertAtCursor = (text: string) => {
    const el = textareaRef.current;
    if (!el) {
      pushUndo(content);
      setContent(c => c + text);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    pushUndo(content);
    const newContent = content.substring(0, start) + text + content.substring(end);
    setContent(newContent);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  const wrapSelection = (before: string, after: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.substring(start, end) || 'texto';
    pushUndo(content);
    const newContent = content.substring(0, start) + before + selected + after + content.substring(end);
    setContent(newContent);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const handleReplace = () => {
    if (!searchQuery) return;
    pushUndo(content);
    const newContent = content.split(searchQuery).join(replaceQuery);
    setContent(newContent);
    toast.success('Substituição realizada');
  };

  const handleSave = async () => {
    if (!name.trim() || !content.trim()) {
      toast.error('Nome e conteúdo são obrigatórios');
      return;
    }
    setIsSaving(true);
    try {
      const usedVars = [...new Set(content.match(/\{\{[^}]+\}\}/g) || [])];
      const payload = {
        name: name.trim(),
        content,
        contract_type_id: contractTypeId || null,
        is_active: isActive,
        variables: usedVars,
      };

      if (isEditing && template) {
        const { error } = await supabase.from('contract_templates').update(payload).eq('id', template.id);
        if (error) throw error;
        toast.success('Modelo atualizado com sucesso!');
      } else {
        const { error } = await supabase.from('contract_templates').insert(payload);
        if (error) throw error;
        toast.success('Modelo criado com sucesso!');
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar modelo');
    } finally {
      setIsSaving(false);
    }
  };

  const copyContent = () => {
    navigator.clipboard.writeText(content);
    toast.success('Conteúdo copiado!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] w-[1400px] h-[95vh] p-0 overflow-hidden flex flex-col bg-background border border-border/50 shadow-2xl">
        {/* ─── TOP BAR ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/80 backdrop-blur-sm flex-shrink-0">
          {/* Icon */}
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center flex-shrink-0">
            <FileText className="h-4 w-4 text-white" />
          </div>

          {/* Name input */}
          <div className="flex-1 min-w-0">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do modelo de contrato..."
              className="border-0 bg-transparent px-0 text-base font-semibold focus-visible:ring-0 placeholder:text-muted-foreground/50 h-auto"
            />
          </div>

          {/* Meta */}
          <div className="hidden lg:flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Type className="h-3.5 w-3.5" />
              <span>{wordCount} palavras</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5">
              <Braces className="h-3.5 w-3.5" />
              <span>{detectedVars.length} variáveis</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <Select value={contractTypeId} onValueChange={setContractTypeId}>
              <SelectTrigger className="h-7 border-border/50 bg-muted/50 text-xs w-44 focus:ring-0">
                <SelectValue placeholder="Tipo de contrato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem tipo</SelectItem>
                {contractTypes.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <Switch checked={isActive} onCheckedChange={setIsActive} className="scale-75" />
              <span className={isActive ? 'text-emerald-500 font-medium' : ''}>
                {isActive ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undo} disabled={!undoStack.length} title="Desfazer">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={redo} disabled={!redoStack.length} title="Refazer">
              <RotateCw className="h-4 w-4" />
            </Button>
            <div className="w-px h-5 bg-border mx-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyContent} title="Copiar conteúdo">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSearch(s => !s)} title="Buscar e substituir">
              <Search className="h-4 w-4" />
            </Button>
            <div className="w-px h-5 bg-border mx-1" />
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="h-8 px-4 text-xs bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
            >
              {isSaving ? (
                <motion.div className="flex items-center gap-1.5" animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
                  <Sparkles className="h-3.5 w-3.5" />
                  Salvando...
                </motion.div>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {isEditing ? 'Atualizar' : 'Salvar'}
                </>
              )}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ─── SEARCH BAR ──────────────────────────────────────────── */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-b border-border/50 overflow-hidden flex-shrink-0"
            >
              <div className="flex items-center gap-2 px-4 py-2 bg-muted/30">
                <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar..."
                  className="h-7 text-sm border-0 bg-transparent focus-visible:ring-0 px-0 flex-1"
                />
                <Replace className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Input
                  value={replaceQuery}
                  onChange={e => setReplaceQuery(e.target.value)}
                  placeholder="Substituir por..."
                  className="h-7 text-sm border-0 bg-transparent focus-visible:ring-0 px-0 flex-1"
                />
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleReplace}>
                  Substituir tudo
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowSearch(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── VIEW TABS & TOOLBAR ─────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-border/50 bg-card/50 flex-shrink-0">
          {/* Formatting toolbar */}
          <div className="flex items-center gap-0.5">
            {[
              { icon: Bold, action: () => wrapSelection('**', '**'), title: 'Negrito' },
              { icon: Italic, action: () => wrapSelection('_', '_'), title: 'Itálico' },
              { icon: Underline, action: () => wrapSelection('__', '__'), title: 'Sublinhado' },
            ].map(({ icon: Icon, action, title }) => (
              <Button key={title} variant="ghost" size="icon" className="h-7 w-7" onClick={action} title={title}>
                <Icon className="h-3.5 w-3.5" />
              </Button>
            ))}
            <div className="w-px h-4 bg-border mx-1" />
            {[
              { icon: AlignLeft, action: () => insertAtCursor('\n'), title: 'Nova linha' },
              { icon: Hash, action: () => insertAtCursor('\n\n'), title: 'Parágrafo' },
              { icon: List, action: () => insertAtCursor('\n• '), title: 'Lista' },
            ].map(({ icon: Icon, action, title }) => (
              <Button key={title} variant="ghost" size="icon" className="h-7 w-7" onClick={action} title={title}>
                <Icon className="h-3.5 w-3.5" />
              </Button>
            ))}
            <div className="w-px h-4 bg-border mx-1" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => setShowVarPanel(s => !s)}
            >
              {showVarPanel ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
              Variáveis
            </Button>
          </div>

          {/* View mode tabs */}
          <div className="flex items-center gap-1 bg-muted/50 p-0.5 rounded-lg">
            {([
              { id: 'edit', label: 'Editor', icon: Code2 },
              { id: 'split', label: 'Split', icon: AlignJustify },
              { id: 'preview', label: 'Preview', icon: Eye },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all',
                  activeTab === id
                    ? 'bg-background shadow text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>

          {/* Preview zoom */}
          {(activeTab === 'preview' || activeTab === 'split') && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewScale(s => Math.max(50, s - 10))}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground w-10 text-center">{previewScale}%</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewScale(s => Math.min(150, s + 10))}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* ─── MAIN AREA ───────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Variable Panel */}
          <AnimatePresence>
            {showVarPanel && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 220, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-r border-border/50 overflow-y-auto overflow-x-hidden flex-shrink-0 bg-card/30"
              >
                <div className="p-3 space-y-3 w-[220px]">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="h-3 w-3" />
                    Variáveis
                  </p>
                  {VARIABLE_GROUPS.map(group => (
                    <div key={group.label}>
                      <p className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${group.color}`} />
                        {group.label}
                      </p>
                      <div className="space-y-0.5">
                        {group.variables.map(v => (
                          <motion.button
                            key={v.key}
                            whileHover={{ x: 2 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => insertAtCursor(v.key)}
                            className={cn(
                              'w-full text-left px-2 py-1 rounded-md text-[11px] border transition-colors hover:bg-primary/10 hover:border-primary/30',
                              detectedVars.includes(v.key)
                                ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                                : 'border-transparent text-foreground/70'
                            )}
                          >
                            <span className="font-mono">{v.label}</span>
                            {detectedVars.includes(v.key) && (
                              <CheckCircle className="h-2.5 w-2.5 inline ml-1 text-primary" />
                            )}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Custom variable */}
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Variável customizada</p>
                    <CustomVarInput onInsert={insertAtCursor} />
                  </div>

                  {/* Detected vars */}
                  {detectedVars.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        Detectadas ({detectedVars.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {detectedVars.map(v => (
                          <span key={v} className="text-[9px] font-mono bg-primary/10 text-primary border border-primary/20 px-1 py-0.5 rounded">
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Editor & Preview */}
          <div className="flex flex-1 overflow-hidden min-w-0">
            {/* Editor pane */}
            {(activeTab === 'edit' || activeTab === 'split') && (
              <div className={cn(
                'flex flex-col overflow-hidden border-r border-border/50',
                activeTab === 'split' ? 'w-1/2' : 'w-full'
              )}>
                <div className="flex items-center justify-between px-3 py-1 bg-muted/20 border-b border-border/30">
                  <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                    <Code2 className="h-3 w-3" />
                    Editor
                  </span>
                  <span className="text-[11px] text-muted-foreground">{charCount} chars</span>
                </div>
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={e => handleContentChange(e.target.value)}
                  placeholder="Digite o conteúdo do contrato aqui...&#10;&#10;Use as variáveis no painel lateral para inserir dados dinâmicos."
                  className="flex-1 w-full resize-none bg-background font-mono text-sm p-4 focus:outline-none text-foreground placeholder:text-muted-foreground/40 leading-relaxed overflow-auto"
                  spellCheck={false}
                />
              </div>
            )}

            {/* Preview pane */}
            {(activeTab === 'preview' || activeTab === 'split') && (
              <div className={cn(
                'flex flex-col overflow-hidden',
                activeTab === 'split' ? 'w-1/2' : 'w-full'
              )}>
                <div className="flex items-center justify-between px-3 py-1 bg-muted/20 border-b border-border/30 flex-shrink-0">
                  <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                    <Eye className="h-3 w-3" />
                    Preview (dados fictícios)
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground bg-amber-500/10 text-amber-600 border border-amber-500/20 px-1.5 py-0.5 rounded font-medium">
                      Simulação
                    </span>
                  </div>
                </div>
                <div className="flex-1 overflow-auto bg-muted/10 p-4">
                  <div
                    className="mx-auto bg-white dark:bg-card border border-border/50 shadow-lg rounded-lg overflow-hidden transition-all duration-200"
                    style={{
                      maxWidth: 860,
                      transform: `scale(${previewScale / 100})`,
                      transformOrigin: 'top center',
                      marginBottom: previewScale < 100 ? `${(previewScale - 100) * 8}px` : 0,
                    }}
                  >
                    {/* Document header */}
                    <div className="bg-gradient-to-r from-primary/5 to-blue-500/5 border-b border-border/30 px-12 py-6 text-center">
                      <div className="text-xs font-semibold text-primary/70 tracking-widest uppercase mb-1">WebMarcas Intelligence PI</div>
                      <div className="text-[10px] text-muted-foreground">CNPJ: 39.528.012/0001-29</div>
                    </div>
                    <div
                      className="px-12 py-8 text-sm leading-relaxed text-foreground contract-preview"
                      dangerouslySetInnerHTML={{ __html: content ? renderPreview(content) : '<p class="text-muted-foreground text-center py-12">O preview aparecerá aqui enquanto você digita...</p>' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── BOTTOM STATUS BAR ───────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-1.5 border-t border-border/30 bg-card/50 text-[11px] text-muted-foreground flex-shrink-0">
          <div className="flex items-center gap-3">
            <span>{wordCount} palavras · {charCount} caracteres</span>
            <span>·</span>
            <span>{content.split('\n').length} linhas</span>
            <span>·</span>
            <span className={detectedVars.length > 0 ? 'text-primary font-medium' : ''}>
              {detectedVars.length} variáveis detectadas
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isEditing && (
              <span className="text-amber-500 font-medium flex items-center gap-1">
                <Wand2 className="h-3 w-3" />
                Editando modelo existente
              </span>
            )}
            <span className={cn(
              'flex items-center gap-1',
              isActive ? 'text-emerald-500' : 'text-muted-foreground'
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full', isActive ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground')} />
              {isActive ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CustomVarInput({ onInsert }: { onInsert: (v: string) => void }) {
  const [val, setVal] = useState('');
  const handleAdd = () => {
    if (!val.trim()) return;
    const formatted = val.startsWith('{{') ? val : `{{${val.trim().replace(/\s+/g, '_')}}}`;
    onInsert(formatted);
    setVal('');
  };
  return (
    <div className="flex gap-1">
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
        placeholder="minha_var"
        className="flex-1 text-[11px] bg-muted/50 border border-border/50 rounded px-2 py-1 focus:outline-none focus:border-primary/50 font-mono"
      />
      <button onClick={handleAdd} className="px-2 py-1 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded text-primary text-[11px] transition-colors">
        +
      </button>
    </div>
  );
}
