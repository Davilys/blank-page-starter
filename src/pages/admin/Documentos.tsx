import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import {
  Search, Plus, FileText, Download, Eye, Trash2, MoreVertical,
  Image, File as FileIcon, User, Filter, X, RefreshCw,
  FolderOpen, Shield, Scale, Receipt, Landmark, Award,
  Newspaper, MessageSquare, Package, HardDrive, Zap, Activity,
  ArrowUpRight, ChevronRight, BarChart3, Loader2, Upload, FileJson
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DocumentUploader } from '@/components/shared/DocumentUploader';
import { DocumentPreview } from '@/components/shared/DocumentPreview';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────
interface Document {
  id: string;
  name: string;
  file_url: string;
  document_type: string | null;
  mime_type: string | null;
  file_size: number | null;
  created_at: string | null;
  user_id: string | null;
  process_id: string | null;
  protocol?: string | null;
  profiles?: { full_name: string | null; email: string } | null;
  brand_processes?: { brand_name: string } | null;
}

interface Client { id: string; full_name: string | null; email: string; }
interface Process { id: string; brand_name: string; user_id: string | null; }

// ─── Document Type Config ─────────────────────────
const DOC_CONFIG: Record<string, {
  label: string; color: string; glow: string; accent: string;
  bg: string; icon: React.ElementType; order: number;
}> = {
  contrato:   { label: 'Contrato',       color: 'from-blue-500 to-cyan-400',    glow: '#3b82f6', accent: '#60a5fa', bg: '#3b82f618', icon: Shield,      order: 0 },
  contract:   { label: 'Contrato',       color: 'from-blue-500 to-cyan-400',    glow: '#3b82f6', accent: '#60a5fa', bg: '#3b82f618', icon: Shield,      order: 0 },
  procuracao: { label: 'Procuração',     color: 'from-violet-500 to-purple-400',glow: '#8b5cf6', accent: '#a78bfa', bg: '#8b5cf618', icon: Scale,       order: 1 },
  taxa:       { label: 'Taxa',           color: 'from-cyan-500 to-sky-400',     glow: '#06b6d4', accent: '#22d3ee', bg: '#06b6d418', icon: Receipt,     order: 2 },
  busca_inpi: { label: 'Busca INPI',     color: 'from-indigo-500 to-blue-400',  glow: '#6366f1', accent: '#818cf8', bg: '#6366f118', icon: Landmark,    order: 3 },
  certificado:{ label: 'Certificado',    color: 'from-emerald-500 to-green-400',glow: '#10b981', accent: '#34d399', bg: '#10b98118', icon: Award,       order: 4 },
  rpi:        { label: 'Publicação RPI', color: 'from-amber-500 to-yellow-400', glow: '#f59e0b', accent: '#fbbf24', bg: '#f59e0b18', icon: Newspaper,   order: 5 },
  parecer:    { label: 'Parecer INPI',   color: 'from-orange-500 to-amber-400', glow: '#f97316', accent: '#fb923c', bg: '#f9731618', icon: MessageSquare,order: 6 },
  comprovante:{ label: 'Comprovantes',   color: 'from-teal-500 to-cyan-400',    glow: '#14b8a6', accent: '#2dd4bf', bg: '#14b8a618', icon: Package,     order: 7 },
  outro:      { label: 'Outro',          color: 'from-slate-500 to-gray-400',   glow: '#64748b', accent: '#94a3b8', bg: '#64748b18', icon: FileIcon,    order: 8 },
};

// ─── Fixed particles ──────────────────────────────
const PARTICLES = Array.from({ length: 35 }).map((_, i) => ({
  id: i,
  x: (i * 41.3 + 13) % 100,
  y: (i * 57.7 + 9) % 100,
  size: 1 + (i % 5) * 0.4,
  dur: 9 + (i % 8),
  delay: (i * 0.37) % 7,
  op: 0.03 + (i % 5) * 0.018,
}));

// ─── Animated counter ─────────────────────────────
function AnimCount({ to, prefix = '' }: { to: number; prefix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (to === 0) { setVal(0); return; }
    let start = 0;
    const step = to / 50;
    const raf = () => {
      start = Math.min(start + step, to);
      setVal(start);
      if (start < to) requestAnimationFrame(raf);
    };
    const t = setTimeout(() => requestAnimationFrame(raf), 140);
    return () => clearTimeout(t);
  }, [to]);
  return <>{prefix}{Math.round(val).toLocaleString('pt-BR')}</>;
}

// ─── KPI Card ─────────────────────────────────────
function KpiCard({ title, value, prefix = '', icon: Icon, gradient, glow, accent, sub, index }: {
  title: string; value: number; prefix?: string; sub?: string;
  icon: React.ElementType; gradient: string; glow: string; accent: string; index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.93 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="group relative"
    >
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
        style={{ background: `radial-gradient(ellipse at center, ${glow}22 0%, transparent 70%)` }}
      />
      <div className="relative rounded-2xl overflow-hidden border bg-card/60 backdrop-blur-xl border-border/50 shadow-[0_4px_24px_hsl(var(--foreground)/0.05)]">
        <div className={cn('absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r', gradient)} />
        <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-10" style={{ background: glow }} />
        <div className="relative p-4">
          <div className="flex items-start justify-between mb-3">
            <motion.div
              className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-lg', gradient)}
              whileHover={{ rotate: 12, scale: 1.15 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <Icon className="h-5 w-5 text-white" />
            </motion.div>
            {sub && (
              <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-0.5">
                <ArrowUpRight className="h-3 w-3" />{sub}
              </span>
            )}
          </div>
          <p className="text-2xl font-black tracking-tight text-foreground leading-none">
            <AnimCount to={value} prefix={prefix} />
          </p>
          <p className="text-[11px] font-medium text-muted-foreground mt-1">{title}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Type Distribution Bar ─────────────────────────
function TypeDistBar({ documents }: { documents: Document[] }) {
  const total = documents.length || 1;
  const types = Object.entries(DOC_CONFIG)
    .filter(([k]) => k !== 'contract')
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, cfg]) => ({
      key, cfg,
      count: documents.filter(d => d.document_type === key || (key === 'contrato' && d.document_type === 'contract')).length,
    }))
    .filter(s => s.count > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.35 }}
      className="rounded-2xl border bg-card/60 backdrop-blur-xl border-border/50 p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="h-4 w-4 text-primary" />
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Distribuição de Tipos</span>
        <span className="ml-auto text-[11px] text-muted-foreground">{documents.length} total</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden gap-px mb-3">
        {types.map(({ key, cfg, count }) => (
          <motion.div
            key={key}
            className={cn('h-full bg-gradient-to-r', cfg.color)}
            initial={{ flex: 0 }}
            animate={{ flex: count / total }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            title={`${cfg.label}: ${count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {types.map(({ key, cfg, count }) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={cn('w-2 h-2 rounded-full bg-gradient-to-br', cfg.color)} />
            <span className="text-[10px] text-muted-foreground">{cfg.label}</span>
            <span className="text-[10px] font-bold text-foreground">{count}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Type Filter Chips ────────────────────────────
const FILTER_TABS = [
  { value: 'todos',      label: 'Todos',          icon: FolderOpen, types: [] as string[] },
  { value: 'contrato',   label: 'Contrato',        icon: Shield,     types: ['contrato', 'contract'] },
  { value: 'procuracao', label: 'Procuração',      icon: Scale,      types: ['procuracao'] },
  { value: 'taxa',       label: 'Taxa',            icon: Receipt,    types: ['taxa'] },
  { value: 'busca_inpi', label: 'Busca INPI',      icon: Landmark,   types: ['busca_inpi'] },
  { value: 'certificado',label: 'Certificado',     icon: Award,      types: ['certificado'] },
  { value: 'rpi',        label: 'RPI',             icon: Newspaper,  types: ['rpi'] },
  { value: 'parecer',    label: 'Parecer',         icon: MessageSquare, types: ['parecer'] },
  { value: 'comprovante',label: 'Comprovantes',    icon: Package,    types: ['comprovante'] },
  { value: 'outro',      label: 'Outros',          icon: FileIcon,   types: ['outro'] },
];

// ─── File icon helper ─────────────────────────────
function FileTypeIcon({ url }: { url: string }) {
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url))
    return <Image className="h-4 w-4 text-blue-400" />;
  if (/\.pdf$/i.test(url))
    return <FileText className="h-4 w-4 text-red-400" />;
  return <FileIcon className="h-4 w-4 text-muted-foreground" />;
}

// ─── Format file size ─────────────────────────────
function fmtSize(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ─── Document Row ─────────────────────────────────
function DocRow({ doc, index, onPreview, onDelete }: {
  doc: Document; index: number;
  onPreview: (d: Document) => void;
  onDelete: (d: Document) => void;
}) {
  const cfg = DOC_CONFIG[doc.document_type || 'outro'] || DOC_CONFIG['outro'];
  const Icon = cfg.icon;

  return (
    <motion.tr
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: index * 0.025, ease: 'easeOut' }}
      className="group border-b border-border/30 hover:bg-muted/25 transition-colors duration-150"
    >
      {/* Document name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 relative overflow-hidden"
            style={{ background: cfg.bg, border: `1px solid ${cfg.glow}30` }}
          >
            <Icon className="h-4 w-4" style={{ color: cfg.accent }} />
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: `radial-gradient(ellipse at center, ${cfg.glow}25 0%, transparent 70%)` }}
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate max-w-[200px]">{doc.name}</p>
            {doc.protocol && (
              <p className="text-[10px] font-mono text-muted-foreground/60 tracking-wide">{doc.protocol}</p>
            )}
          </div>
        </div>
      </td>

      {/* Type badge */}
      <td className="px-4 py-3">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
          style={{ background: cfg.bg, border: `1px solid ${cfg.glow}35`, color: cfg.accent }}
        >
          <Icon className="h-2.5 w-2.5" />
          {cfg.label}
        </span>
      </td>

      {/* Client */}
      <td className="px-4 py-3 hidden md:table-cell">
        {(doc.profiles as any)?.full_name || (doc.profiles as any)?.email ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-[9px] font-black flex-shrink-0">
              {((doc.profiles as any)?.full_name || (doc.profiles as any)?.email || '?').charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-foreground/80 truncate max-w-[140px]">
              {(doc.profiles as any)?.full_name || (doc.profiles as any)?.email}
            </span>
          </div>
        ) : <span className="text-muted-foreground/40 text-sm">—</span>}
      </td>

      {/* Process */}
      <td className="px-4 py-3 hidden lg:table-cell">
        {(doc.brand_processes as any)?.brand_name ? (
          <span className="text-[11px] font-medium text-muted-foreground px-2 py-0.5 rounded-full border border-border/50 bg-muted/40 flex items-center gap-1 w-fit">
            <Landmark className="h-2.5 w-2.5" />
            {(doc.brand_processes as any)?.brand_name}
          </span>
        ) : <span className="text-muted-foreground/40 text-sm">—</span>}
      </td>

      {/* File info */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <div className="flex items-center gap-1.5">
          <FileTypeIcon url={doc.file_url} />
          <span className="text-[11px] text-muted-foreground">{fmtSize(doc.file_size)}</span>
        </div>
      </td>

      {/* Date */}
      <td className="px-4 py-3 hidden xl:table-cell">
        <span className="text-[11px] text-muted-foreground">
          {doc.created_at ? format(new Date(doc.created_at), "dd MMM yy", { locale: ptBR }) : '—'}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 border-border/50 bg-card/90 backdrop-blur-xl">
            <DropdownMenuItem onClick={() => onPreview(doc)} className="gap-2 text-sm cursor-pointer">
              <Eye className="h-3.5 w-3.5 text-primary" /> Visualizar
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={doc.file_url} download={doc.name} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm cursor-pointer px-2 py-1.5 rounded-sm hover:bg-muted/50">
                <Download className="h-3.5 w-3.5 text-emerald-500" /> Baixar
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(doc)}
              className="gap-2 text-sm cursor-pointer text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </motion.tr>
  );
}

// ─── Skeleton Row ─────────────────────────────────
function SkeletonRow({ i }: { i: number }) {
  return (
    <tr className="border-b border-border/20">
      {[200, 120, 140, 110, 60, 60].map((w, j) => (
        <td key={j} className={cn('px-4 py-3', j >= 2 ? 'hidden md:table-cell' : '')}>
          <motion.div
            className="h-4 rounded-lg bg-muted/60"
            style={{ width: w }}
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.08 + j * 0.05 }}
          />
        </td>
      ))}
      <td className="px-4 py-3"><div className="h-7 w-7 rounded-lg bg-muted/40" /></td>
    </tr>
  );
}

// ─── Upload Form Dialog ────────────────────────────
function UploadDialog({
  processes,
  onDone,
}: {
  processes: Process[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', document_type: 'outro', user_id: '', process_id: '' });

  // Client autocomplete state
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchingClients, setSearchingClients] = useState(false);
  const [showClientResults, setShowClientResults] = useState(false);
  const clientSearchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const clientProcesses = processes.filter(p => p.user_id === form.user_id);

  const searchClients = useCallback(async (term: string) => {
    if (term.length < 2) {
      setClientResults([]);
      return;
    }
    setSearchingClients(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
        .limit(20);
      setClientResults(data || []);
    } catch {
      setClientResults([]);
    }
    setSearchingClients(false);
  }, []);

  const handleClientSearchChange = (value: string) => {
    setClientSearch(value);
    setShowClientResults(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchClients(value), 400);
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setForm(prev => ({ ...prev, user_id: client.id, process_id: '' }));
    setClientSearch('');
    setShowClientResults(false);
    setClientResults([]);
  };

  const handleClearClient = () => {
    setSelectedClient(null);
    setForm(prev => ({ ...prev, user_id: '', process_id: '' }));
    setClientSearch('');
    setClientResults([]);
  };

  // Close results on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target as Node)) {
        setShowClientResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const generateProtocol = () => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(10000 + Math.random() * 90000);
    return `DOC-${date}-${rand}`;
  };

  const handleUploadComplete = async (fileUrl: string, fileName: string, fileSize: number) => {
    if (!form.user_id) { toast.error('Selecione um cliente primeiro'); return; }
    try {
      const protocol = generateProtocol();
      const { error } = await supabase.from('documents').insert({
        name: form.name || fileName,
        file_url: fileUrl,
        document_type: form.document_type,
        file_size: fileSize,
        user_id: form.user_id,
        process_id: form.process_id || null,
        uploaded_by: 'admin',
        protocol,
      } as any);
      if (error) throw error;
      toast.success(`Documento enviado! Protocolo: ${protocol}`);
      setOpen(false);
      setForm({ name: '', document_type: 'outro', user_id: '', process_id: '' });
      setSelectedClient(null);
      setClientSearch('');
      onDone();
    } catch { toast.error('Erro ao salvar documento'); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (!v) {
        setSelectedClient(null);
        setClientSearch('');
        setClientResults([]);
        setForm({ name: '', document_type: 'outro', user_id: '', process_id: '' });
      }
    }}>
      <DialogTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-sm font-semibold shadow-[0_4px_16px_hsl(var(--primary)/0.35)] hover:shadow-[0_6px_24px_hsl(var(--primary)/0.45)] transition-shadow"
        >
          <Plus className="h-4 w-4" />
          Enviar Documento
        </motion.button>
      </DialogTrigger>
      <DialogContent className="max-w-lg border-border/50 bg-card/90 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <FolderOpen className="h-4 w-4 text-primary-foreground" />
            </div>
            Enviar Documento
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Client autocomplete */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente *</Label>
            {selectedClient ? (
              <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-md border border-border/50 bg-muted/30">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-[10px] font-black flex-shrink-0">
                  {(selectedClient.full_name || selectedClient.email).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{selectedClient.full_name || selectedClient.email}</p>
                  {selectedClient.full_name && (
                    <p className="text-[10px] text-muted-foreground truncate">{selectedClient.email}</p>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={handleClearClient}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div ref={clientSearchRef} className="relative mt-1.5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-9 bg-muted/30 border-border/50"
                    placeholder="Buscar por nome, email ou telefone..."
                    value={clientSearch}
                    onChange={(e) => handleClientSearchChange(e.target.value)}
                    onFocus={() => { if (clientSearch.length >= 2) setShowClientResults(true); }}
                  />
                  {searchingClients && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {showClientResults && clientSearch.length >= 2 && (
                  <div className="absolute z-50 w-full mt-1 rounded-md border border-border/50 bg-card/95 backdrop-blur-xl shadow-lg overflow-hidden">
                    <Command shouldFilter={false}>
                      <CommandList>
                        {clientResults.length === 0 && !searchingClients && (
                          <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
                            Nenhum cliente encontrado
                          </CommandEmpty>
                        )}
                        {searchingClients && clientResults.length === 0 && (
                          <div className="py-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
                          </div>
                        )}
                        {clientResults.length > 0 && (
                          <CommandGroup>
                            {clientResults.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={c.id}
                                onSelect={() => handleSelectClient(c)}
                                className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                              >
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-[10px] font-black flex-shrink-0">
                                  {(c.full_name || c.email).charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{c.full_name || c.email}</p>
                                  {c.full_name && (
                                    <p className="text-[10px] text-muted-foreground truncate">{c.email}</p>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </div>
                )}
              </div>
            )}
          </div>

          {form.user_id && clientProcesses.length > 0 && (
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Processo (opcional)</Label>
              <Select value={form.process_id} onValueChange={(v) => setForm({ ...form, process_id: v })}>
                <SelectTrigger className="mt-1.5 bg-muted/30 border-border/50">
                  <SelectValue placeholder="Vincular a um processo" />
                </SelectTrigger>
                <SelectContent className="bg-card/95 backdrop-blur-xl border-border/50">
                  {clientProcesses.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.brand_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome</Label>
              <Input
                className="mt-1.5 bg-muted/30 border-border/50"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Contrato v2"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo</Label>
              <Select value={form.document_type} onValueChange={(v) => {
                const label = DOC_CONFIG[v]?.label || '';
                setForm({ ...form, document_type: v, name: label });
              }}>
                <SelectTrigger className="mt-1.5 bg-muted/30 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card/95 backdrop-blur-xl border-border/50">
                  {Object.entries(DOC_CONFIG).filter(([k]) => k !== 'contract').map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.user_id ? (
            <DocumentUploader userId={form.user_id} onUploadComplete={handleUploadComplete} />
          ) : (
            <div className="p-8 border-2 border-dashed border-border/40 rounded-xl text-center text-muted-foreground bg-muted/20">
              <User className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Selecione um cliente para habilitar o upload</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────
export default function AdminDocumentos() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [clients, setClients]     = useState<Client[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [search, setSearch]       = useState('');
  const [activeTab, setActiveTab] = useState('todos');
  const [clientFilter, setClientFilter] = useState('all');
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchDocuments(), fetchClients(), fetchProcesses()]);
    setLoading(false);
  };

  const fetchDocuments = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*, profiles(full_name, email), brand_processes(brand_name)')
      .order('created_at', { ascending: false });
    if (!error) setDocuments(data || []);
  };

  const fetchClients  = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name, email');
    setClients(data || []);
  };

  const fetchProcesses = async () => {
    const { data } = await supabase.from('brand_processes').select('id, brand_name, user_id');
    setProcesses(data || []);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDocuments();
    setRefreshing(false);
    toast.success('Documentos atualizados');
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Excluir "${doc.name}"?`)) return;
    try {
      const urlParts = doc.file_url.split('/documents/');
      if (urlParts.length > 1) await supabase.storage.from('documents').remove([urlParts[1]]);
      const { error } = await supabase.from('documents').delete().eq('id', doc.id);
      if (error) throw error;
      toast.success('Documento excluído');
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
    } catch { toast.error('Erro ao excluir documento'); }
  };

  // ─── Derived stats ─────────────────────────────
  const stats = useMemo(() => {
    const totalSize = documents.reduce((acc, d) => acc + (d.file_size || 0), 0);
    const contratos = documents.filter(d => ['contrato', 'contract'].includes(d.document_type || '')).length;
    const thisMonth = documents.filter(d => {
      if (!d.created_at) return false;
      const now = new Date();
      const dt = new Date(d.created_at);
      return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
    }).length;
    const uniqueClients = new Set(documents.map(d => d.user_id).filter(Boolean)).size;
    return { totalSize, contratos, thisMonth, uniqueClients };
  }, [documents]);

  // ─── Filter ────────────────────────────────────
  const filteredDocs = useMemo(() => {
    const tab = FILTER_TABS.find(t => t.value === activeTab);
    return documents.filter(d => {
      const matchSearch =
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        (d.profiles as any)?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        (d.brand_processes as any)?.brand_name?.toLowerCase().includes(search.toLowerCase()) ||
        d.protocol?.toLowerCase().includes(search.toLowerCase());
      const matchClient = clientFilter === 'all' || d.user_id === clientFilter;
      const matchTab = !tab || tab.types.length === 0 || tab.types.includes(d.document_type || '');
      return matchSearch && matchClient && matchTab;
    });
  }, [documents, search, clientFilter, activeTab]);

  const getTabCount = (tab: typeof FILTER_TABS[0]) => {
    if (tab.types.length === 0) return documents.length;
    return documents.filter(d => tab.types.includes(d.document_type || '')).length;
  };

  return (
    <>
      <div className="relative min-h-full space-y-5 pb-8">

        {/* ── Background particles ── */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
          {PARTICLES.map(p => (
            <motion.div
              key={p.id}
              className="absolute rounded-full bg-primary"
              style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, opacity: p.op }}
              animate={{ y: [-8, 8, -8], opacity: [p.op, p.op * 2.2, p.op] }}
              transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
            />
          ))}
          {/* Scan line */}
          <motion.div
            className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent"
            animate={{ top: ['0%', '100%'] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          />
        </div>

        {/* ── HUD Hero Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-2xl overflow-hidden border border-border/50 bg-card/50 backdrop-blur-xl p-5 md:p-6"
        >
          {/* Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-indigo-500/5 pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

          <div className="relative flex flex-col md:flex-row md:items-center gap-4">
            {/* Icon + Title */}
            <div className="flex items-center gap-4 flex-1">
              <div className="relative">
                <motion.div
                  className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-indigo-500 flex items-center justify-center shadow-[0_0_24px_hsl(var(--primary)/0.4)]"
                  animate={{ boxShadow: ['0 0 24px hsl(var(--primary)/0.3)', '0 0 40px hsl(var(--primary)/0.5)', '0 0 24px hsl(var(--primary)/0.3)'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <FolderOpen className="h-7 w-7 text-white" />
                </motion.div>
                <motion.div
                  className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Documentos
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-[10px] font-bold uppercase tracking-wider">
                    <motion.span
                      className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                    />
                    LIVE
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5" />
                  Central de arquivos e documentação dos clientes
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px h-12 bg-border/40" />

            {/* Quick stats */}
            <div className="flex items-center gap-5 md:gap-6">
              {[
                { label: 'Total', value: documents.length, icon: FolderOpen },
                { label: 'Este mês', value: stats.thisMonth, icon: Activity },
                { label: 'Clientes', value: stats.uniqueClients, icon: User },
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <p className="text-xl font-black text-foreground leading-none">
                    <AnimCount to={s.value} />
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground mt-0.5 uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px h-12 bg-border/40" />

            {/* Actions */}
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRefresh}
                className="w-9 h-9 rounded-xl bg-muted/50 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Atualizar"
              >
                <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              </motion.button>

              {/* Export */}
              <motion.button
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const exportData = documents.map(d => ({
                    name: d.name,
                    file_url: d.file_url,
                    document_type: d.document_type,
                    mime_type: d.mime_type,
                    file_size: d.file_size,
                    user_id: d.user_id,
                    process_id: d.process_id,
                    protocol: d.protocol,
                    created_at: d.created_at,
                  }));
                  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = `documentos_${new Date().toISOString().slice(0,10)}.json`; a.click();
                  URL.revokeObjectURL(url);
                  toast.success(`${exportData.length} documentos exportados`);
                }}
                className="w-9 h-9 rounded-xl bg-muted/50 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Exportar JSON"
              >
                <Download className="h-4 w-4" />
              </motion.button>

              {/* Import JSON */}
              <motion.button
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = async (e: any) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const text = await file.text();
                      const data = JSON.parse(text);
                      const items = Array.isArray(data) ? data : (data.data || data.documents || []);
                      if (!items.length) { toast.error('Nenhum documento encontrado no arquivo'); return; }
                      let imported = 0, failed = 0;
                      for (let i = 0; i < items.length; i += 50) {
                        const batch = items.slice(i, i + 50).map((item: any) => ({
                          name: String(item.name ?? ''),
                          file_url: String(item.file_url ?? ''),
                          document_type: item.document_type ? String(item.document_type) : null,
                          mime_type: item.mime_type ? String(item.mime_type) : null,
                          file_size: item.file_size != null ? Number(item.file_size) : null,
                          protocol: item.protocol ? String(item.protocol) : null,
                          user_id: item.user_id || null,
                          process_id: item.process_id || null,
                          created_at: item.created_at ? new Date(item.created_at).toISOString() : new Date().toISOString(),
                        })).filter((d: any) => d.name && d.file_url);
                        if (!batch.length) continue;
                        const { error } = await supabase.from('documents').insert(batch);
                        if (error) { failed += batch.length; } else { imported += batch.length; }
                      }
                      if (failed === 0) { toast.success(`${imported} documentos importados`); }
                      else { toast.warning(`${imported} importados, ${failed} falharam`); }
                      fetchDocuments();
                    } catch (err: any) { toast.error('Erro ao importar: ' + (err.message || 'Arquivo inválido')); }
                  };
                  input.click();
                }}
                className="w-9 h-9 rounded-xl bg-muted/50 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Importar JSON"
              >
                <Upload className="h-4 w-4" />
              </motion.button>

              <UploadDialog processes={processes} onDone={fetchDocuments} />
            </div>
          </div>
        </motion.div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
          <KpiCard index={0} title="Total de Documentos"  value={documents.length}      icon={FolderOpen}    gradient="from-blue-500 to-cyan-400"     glow="#3b82f6" accent="#60a5fa" />
          <KpiCard index={1} title="Contratos"            value={stats.contratos}        icon={Shield}        gradient="from-violet-500 to-purple-400" glow="#8b5cf6" accent="#a78bfa" />
          <KpiCard index={2} title="Enviados Este Mês"   value={stats.thisMonth}        icon={Zap}           gradient="from-emerald-500 to-green-400" glow="#10b981" accent="#34d399" sub="mês" />
          <KpiCard index={3} title="Clientes Atendidos"  value={stats.uniqueClients}    icon={User}          gradient="from-orange-500 to-amber-400"  glow="#f97316" accent="#fb923c" />
        </div>

        {/* ── Distribution Bar ── */}
        <div className="relative z-10">
          <TypeDistBar documents={documents} />
        </div>

        {/* ── Filters Row ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="flex flex-col sm:flex-row gap-3 relative z-10"
        >
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, protocolo, cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card/60 backdrop-blur-xl border-border/50 h-10 focus:ring-primary/40"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Client filter */}
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-52 bg-card/60 backdrop-blur-xl border-border/50 h-10">
              <User className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Todos os clientes" />
            </SelectTrigger>
            <SelectContent className="max-h-64 overflow-y-auto bg-card/95 backdrop-blur-xl border-border/50">
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.full_name || c.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(clientFilter !== 'all' || search) && (
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0"
              onClick={() => { setClientFilter('all'); setSearch(''); }}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </motion.div>

        {/* ── Category Filter Tabs ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex gap-2 flex-wrap relative z-10"
        >
          {FILTER_TABS.map((tab) => {
            const Icon = tab.icon;
            const count = getTabCount(tab);
            const isActive = activeTab === tab.value;
            const cfg = DOC_CONFIG[tab.value];

            return (
              <motion.button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className={cn(
                  'relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200',
                  isActive
                    ? 'text-primary-foreground border-transparent shadow-[0_2px_12px_hsl(var(--primary)/0.35)]'
                    : 'bg-card/50 backdrop-blur-sm border-border/40 text-muted-foreground hover:text-foreground hover:border-border'
                )}
                style={isActive ? {
                  background: cfg
                    ? `linear-gradient(135deg, ${cfg.glow}dd, ${cfg.glow}99)`
                    : 'hsl(var(--primary))',
                } : {}}
              >
                <Icon className="h-3 w-3" />
                {tab.label}
                <span className={cn(
                  'inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-black px-1',
                  isActive ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                )}>
                  {count}
                </span>
              </motion.button>
            );
          })}
        </motion.div>

        {/* ── Documents Table ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.38 }}
          className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl overflow-hidden relative z-10"
        >
          {/* Top line */}
          <div className="h-[1.5px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

          {/* Table header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/30">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Arquivos
              </span>
              <span className="text-xs text-muted-foreground/60 ml-1">
                {filteredDocs.length} resultado{filteredDocs.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/50 tracking-widest uppercase">
              <HardDrive className="h-3 w-3" />
              {fmtSize(stats.totalSize)}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/20">
                  {['Documento', 'Tipo', 'Cliente', 'Processo', 'Arquivo', 'Data', ''].map((h, i) => (
                    <th
                      key={i}
                      className={cn(
                        'px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70',
                        i === 2 && 'hidden md:table-cell',
                        i === 3 && 'hidden lg:table-cell',
                        i === 4 && 'hidden lg:table-cell',
                        i === 5 && 'hidden xl:table-cell',
                        i === 6 && 'text-right',
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} i={i} />)
                ) : filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center gap-3"
                      >
                        <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center">
                          <FolderOpen className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                        <p className="text-sm text-muted-foreground font-medium">Nenhum documento encontrado</p>
                        <p className="text-xs text-muted-foreground/60">Tente ajustar os filtros ou enviar um novo documento</p>
                      </motion.div>
                    </td>
                  </tr>
                ) : (
                  <AnimatePresence initial={false}>
                    {filteredDocs.map((doc, i) => (
                      <DocRow
                        key={doc.id}
                        doc={doc}
                        index={i}
                        onPreview={(d) => { setPreviewDoc(d); setPreviewOpen(true); }}
                        onDelete={handleDelete}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border/20 flex items-center justify-between">
            <span className="text-[10px] font-mono text-muted-foreground/40 tracking-wider uppercase">
              WebMarcas · Vault v2026
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40 font-mono">
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              SYNC ATIVO
            </div>
          </div>
        </motion.div>
      </div>

      <DocumentPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        document={previewDoc}
      />
    </>
  );
}
