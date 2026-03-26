import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, differenceInDays, addDays, addYears, isAfter, isBefore, parseISO, subDays, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Newspaper, Search, Filter, Download, Plus, ChevronRight, Clock, AlertTriangle,
  CheckCircle2, Circle, Calendar, Edit3, MessageSquare, Bell, Upload, X,
  FileText, Eye, ArrowRight, RotateCcw, Shield, Gavel, Award, RefreshCw,
  ExternalLink, Trash2, Users, Zap, BellRing, Hash, Paperclip,
  ArrowUpDown, ArrowUp, ArrowDown, List, LayoutGrid, FileDown,
  ChevronLeft, Activity, Wallet, Receipt, FileCheck, TrendingUp, Star, Check, Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { StatsCard } from '@/components/admin/dashboard/StatsCard';
import { PublicacaoCharts } from '@/components/admin/publicacao/PublicacaoCharts';
import { PublicacaoKanban } from '@/components/admin/publicacao/PublicacaoKanban';
import { BulkActionsBar } from '@/components/admin/publicacao/BulkActionsBar';
import { exportPublicacaoPDF } from '@/components/admin/publicacao/PublicacaoPDFExport';
import { ClientDetailSheet } from '@/components/admin/clients/ClientDetailSheet';
import { CreateInvoiceDialog } from '@/components/admin/clients/CreateInvoiceDialog';
import type { ClientWithProcess } from '@/components/admin/clients/ClientKanbanBoard';

// ─── Types ───────────────────────────────────────────────────────────────────
type PubStatus = '003' | 'oposicao' | 'exigencia_merito' | 'indeferimento' | 'deferimento' | 'certificado' | 'renovacao' | 'arquivado';
type PubTipo = 'publicacao_rpi' | 'decisao' | 'certificado' | 'renovacao';
type PrazoFilter = 'todos' | 'hoje' | '7dias' | '30dias' | 'atrasados';
type SortKey = 'cliente' | 'marca' | 'data_pub' | 'prazo' | 'status';
type SortDir = 'asc' | 'desc';
type ViewMode = 'lista' | 'kanban';

interface Publicacao {
  id: string;
  process_id: string | null;
  client_id: string | null;
  admin_id: string | null;
  status: PubStatus;
  tipo_publicacao: PubTipo;
  data_deposito: string | null;
  data_publicacao_rpi: string | null;
  prazo_oposicao: string | null;
  data_decisao: string | null;
  data_certificado: string | null;
  data_renovacao: string | null;
  proximo_prazo_critico: string | null;
  descricao_prazo: string | null;
  oposicao_protocolada: boolean;
  oposicao_data: string | null;
  comentarios_internos: string | null;
  documento_rpi_url: string | null;
  rpi_number: string | null;
  rpi_link: string | null;
  rpi_entry_id: string | null;
  brand_name_rpi: string | null;
  process_number_rpi: string | null;
  created_at: string;
  updated_at: string;
}

interface LogEntry {
  id: string;
  admin_email: string | null;
  campo_alterado: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  created_at: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<PubStatus, { label: string; color: string; bg: string }> = {
  '003': { label: '003', color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/40' },
  oposicao: { label: 'Oposição', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/40' },
  exigencia_merito: { label: 'Exigência de Mérito', color: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/40' },
  indeferimento: { label: 'Indeferimento', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/40' },
  deferimento: { label: 'Deferimento', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
  certificado: { label: 'Certificado', color: 'text-teal-700 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-900/40' },
  renovacao: { label: 'Renovação', color: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-900/40' },
  arquivado: { label: 'Arquivado', color: 'text-zinc-700 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-900/40' },
};

const TIPO_CONFIG: Record<PubTipo, string> = {
  publicacao_rpi: 'Publicação RPI',
  decisao: 'Decisão',
  certificado: 'Certificado',
  renovacao: 'Renovação',
};

const ITEMS_PER_PAGE = 20;

const SERVICE_TYPES = [
  { id: 'pedido_registro', label: 'Pedido de Registro', description: 'Solicitação inicial junto ao INPI', icon: FileText },
  { id: 'cumprimento_exigencia', label: 'Cumprimento de Exigência', description: 'Resposta a exigência formal do INPI', icon: FileCheck },
  { id: 'oposicao', label: 'Manifestação de Oposição', description: 'Defesa contra oposição de terceiros', icon: Shield },
  { id: 'recurso', label: 'Recurso Administrativo', description: 'Recurso contra indeferimento do INPI', icon: TrendingUp },
  { id: 'renovacao', label: 'Renovação de Marca', description: 'Renovação do registro decenal', icon: RefreshCw },
  { id: 'notificacao', label: 'Notificação Extrajudicial', description: 'Cessação de uso indevido', icon: Bell },
  { id: 'deferimento', label: 'Deferimento', description: 'Pedido aprovado, aguardando concessão', icon: CheckCircle2 },
  { id: 'certificado', label: 'Certificado', description: 'Marca registrada e certificada', icon: Star },
  { id: 'distrato', label: 'Distrato', description: 'Serviço cancelado ou encerrado', icon: X },
];

const SERVICE_TO_STATUS: Record<string, string> = {
  pedido_registro: '003',
  cumprimento_exigencia: 'exigencia_merito',
  oposicao: 'oposicao',
  recurso: 'indeferimento',
  renovacao: 'renovacao',
  notificacao: '003',
  deferimento: 'deferimento',
  certificado: 'certificado',
  distrato: 'arquivado',
};

const STATUS_TO_SERVICE: Record<string, string> = {};
Object.entries(SERVICE_TO_STATUS).forEach(([svc, st]) => { if (!STATUS_TO_SERVICE[st]) STATUS_TO_SERVICE[st] = svc; });

// ─── Helpers ─────────────────────────────────────────────────────────────────
function normalizeProcessNumber(value: string | null | undefined): string {
  return (value || '').replace(/\D/g, '');
}

function getDaysLeft(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return differenceInDays(parseISO(dateStr), new Date());
}

function getUrgencyBadge(days: number | null) {
  if (days === null) return { label: '—', variant: 'outline' as const, className: '' };
  if (days < 0) return { label: `${Math.abs(days)}d atrasado`, variant: 'destructive' as const, className: 'animate-pulse' };
  if (days === 0) return { label: 'Vence hoje', variant: 'destructive' as const, className: '' };
  if (days <= 7) return { label: `${days}d restantes`, variant: 'destructive' as const, className: '' };
  if (days <= 30) return { label: `${days}d restantes`, variant: 'secondary' as const, className: 'border-amber-500/50 text-amber-700 dark:text-amber-400' };
  return { label: `${days}d restantes`, variant: 'outline' as const, className: 'text-emerald-700 dark:text-emerald-400' };
}

function calcDeadlineFromDispatch(dispatchText: string | null, publicationDate: string | null): { days: number | null; desc: string; status?: PubStatus } | null {
  if (!publicationDate || !dispatchText) return null;
  const text = dispatchText.toLowerCase();

  if (text.includes('arquiv') || text.includes('art. 219'))
    return { days: null, desc: 'Processo encerrado' };
  if (text.includes('5 dias') || text.includes('cinco dias'))
    return { days: 5, desc: 'Exigência formal - 5 dias' };
  if (text.includes('oposição') || text.includes('oposicao'))
    return { days: 60, desc: 'Prazo para oposição' };
  if (text.includes('exigência') || text.includes('exigencia') || text.includes('cumpra'))
    return { days: 60, desc: 'Cumprimento de exigência' };
  if (text.includes('recurso'))
    return { days: 60, desc: 'Prazo para recurso' };
  if (text.includes('certificado de registro') || text.includes('concessao') || text.includes('concessão') || text.includes('registro concedido'))
    return { days: 3285, desc: 'Prazo para renovação ordinária (9 anos)', status: 'certificado' as PubStatus };
  if (text.includes('deferido') || text.includes('deferimento'))
    return { days: 60, desc: 'Pagamento de taxas (deferimento)' };
  if (text.includes('indeferido') || text.includes('indeferimento'))
    return { days: 60, desc: 'Prazo para recurso (indeferimento)' };

  return { days: 30, desc: 'Prazo padrão - 30 dias' };
}

function calcAutoFields(pub: Partial<Publicacao>, dispatchText?: string | null): Partial<Publicacao> {
  const out = { ...pub };
  if (out.data_publicacao_rpi) {
    out.prazo_oposicao = format(addDays(parseISO(out.data_publicacao_rpi), 60), 'yyyy-MM-dd');
  }
  if (out.data_certificado) {
    out.data_renovacao = format(addYears(parseISO(out.data_certificado), 9), 'yyyy-MM-dd');
    out.descricao_prazo = 'Renovação ordinária - 9 anos (+ 6m ord. + 6m extra)';
  } else if (out.status === 'certificado' && out.data_publicacao_rpi) {
    out.data_renovacao = format(addYears(parseISO(out.data_publicacao_rpi), 9), 'yyyy-MM-dd');
    out.proximo_prazo_critico = out.data_renovacao;
    out.descricao_prazo = 'Renovação ordinária - 9 anos (+ 6m ord. + 6m extra)';
  }

  // Auto-calculate deadline from dispatch_text if not manually set
  if (!out.proximo_prazo_critico && out.data_publicacao_rpi && dispatchText) {
    const deadline = calcDeadlineFromDispatch(dispatchText, out.data_publicacao_rpi);
    if (deadline) {
      if (deadline.days !== null) {
        out.proximo_prazo_critico = format(addDays(parseISO(out.data_publicacao_rpi), deadline.days), 'yyyy-MM-dd');
      }
      out.descricao_prazo = deadline.desc;
    }
  }

  // Fallback: if still no proximo_prazo_critico but has publication date, use 30 days
  if (!out.proximo_prazo_critico && out.data_publicacao_rpi) {
    out.proximo_prazo_critico = format(addDays(parseISO(out.data_publicacao_rpi), 30), 'yyyy-MM-dd');
    if (!out.descricao_prazo) out.descricao_prazo = 'Prazo padrão - 30 dias';
  }

  const futureDates = [out.prazo_oposicao, out.data_renovacao, out.proximo_prazo_critico]
    .filter(Boolean)
    .map(d => parseISO(d!))
    .filter(d => isAfter(d, new Date()));
  if (futureDates.length > 0) {
    futureDates.sort((a, b) => a.getTime() - b.getTime());
    out.proximo_prazo_critico = format(futureDates[0], 'yyyy-MM-dd');
  }
  return out;
}

function getScheduledAlerts(prazoCritico: string | null): { label: string; date: Date; days: number }[] {
  if (!prazoCritico) return [];
  const prazoDate = parseISO(prazoCritico);
  return [30, 15, 7].map(d => {
    const alertDate = subDays(prazoDate, d);
    return { label: `${d} dias antes`, date: alertDate, days: differenceInDays(alertDate, new Date()) };
  }).filter(a => a.days >= 0);
}

// Highlight search term in text
function HighlightText({ text, search }: { text: string; search: string }) {
  if (!search || !text) return <>{text}</>;
  const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// ─── Timeline step component ────────────────────────────────────────────────
const TIMELINE_STEPS = [
  { key: 'data_deposito', label: 'Depósito', icon: FileText, description: 'Pedido protocolado no INPI' },
  { key: 'data_publicacao_rpi', label: 'Publicação RPI', icon: Newspaper, description: 'Publicado na Revista da PI' },
  { key: 'prazo_oposicao', label: 'Prazo Oposição (60d)', icon: Gavel, description: 'Período para manifestações' },
  { key: 'data_decisao', label: 'Decisão', icon: Shield, description: 'Deferimento ou indeferimento' },
  { key: 'data_certificado', label: 'Certificado', icon: Award, description: 'Emissão do certificado' },
  { key: 'data_renovacao', label: 'Renovação (9 anos)', icon: RefreshCw, description: 'Prazo ordinário + 6m ord. + 6m extra' },
] as const;

function TimelineStep({ step, date, isCompleted, isOverdue }: {
  step: typeof TIMELINE_STEPS[number];
  date: string | null;
  isCompleted: boolean;
  isOverdue: boolean;
}) {
  const Icon = step.icon;
  return (
    <div className="flex gap-3 relative">
      <div className="flex flex-col items-center">
        <div className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all',
          isCompleted ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-500 text-emerald-600 dark:text-emerald-400'
            : isOverdue ? 'bg-red-100 dark:bg-red-900/40 border-red-500 text-red-600 dark:text-red-400 animate-pulse'
            : 'bg-muted border-border text-muted-foreground'
        )}>
          {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
        </div>
        <div className="w-0.5 flex-1 bg-border min-h-[24px]" />
      </div>
      <div className="pb-6 flex-1">
        <p className={cn('text-sm font-semibold', isCompleted ? 'text-foreground' : 'text-muted-foreground')}>
          {step.label}
        </p>
        <p className="text-xs text-muted-foreground">{step.description}</p>
        {date && (
          <p className={cn('text-xs mt-1 font-medium', isOverdue ? 'text-red-600 dark:text-red-400' : 'text-primary')}>
            {format(parseISO(date), "dd/MM/yyyy", { locale: ptBR })}
            {!isCompleted && getDaysLeft(date) !== null && (
              <span className="ml-1 text-muted-foreground">
                ({getDaysLeft(date)! < 0 ? `${Math.abs(getDaysLeft(date)!)}d atrasado` : `em ${getDaysLeft(date)}d`})
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function PublicacaoTab() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterClient, setFilterClient] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterPrazo, setFilterPrazo] = useState<string>('todos');
  const [filterTipo, setFilterTipo] = useState<string>('todos');
  const [filterRpi, setFilterRpi] = useState<string>('todos');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [editData, setEditData] = useState<Partial<Publicacao>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasSyncedRef = useRef(false);

  // New state for premium features
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [sortKey, setSortKey] = useState<SortKey>('prazo');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filterAdmin, setFilterAdmin] = useState<string>('todos');
  const [searchAutocomplete, setSearchAutocomplete] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [editClientSearch, setEditClientSearch] = useState('');
  const [showEditClientDropdown, setShowEditClientDropdown] = useState(false);
  const [showClientSheet, setShowClientSheet] = useState(false);
  const [showProcessDetailFromSheet, setShowProcessDetailFromSheet] = useState(false);
  const [showInvoiceFromPub, setShowInvoiceFromPub] = useState(false);
  const [sheetPubId, setSheetPubId] = useState<string | null>(null);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const [clientAssignSearch, setClientAssignSearch] = useState('');
  const [showClientAssignDropdown, setShowClientAssignDropdown] = useState(false);
  const clientAssignRef = useRef<HTMLDivElement>(null);
  const [selectedAssignProcessId, setSelectedAssignProcessId] = useState<string | null>(null);
  const [editableBrandName, setEditableBrandName] = useState('');
  const [editableProcessNumber, setEditableProcessNumber] = useState('');
  const [editableNclClass, setEditableNclClass] = useState('');
  const [showEditableFields, setShowEditableFields] = useState(false);
  const [expandedProcessId, setExpandedProcessId] = useState<string | null>(null);
  const [selectedServiceType, setSelectedServiceType] = useState('');

  // ─── Create dialog state ────
  const [createProcessId, setCreateProcessId] = useState('');
  const [createDataDeposito, setCreateDataDeposito] = useState('');
  const [createDataPubRpi, setCreateDataPubRpi] = useState('');
  const [createTipo, setCreateTipo] = useState<PubTipo>('publicacao_rpi');
  const [createAdminId, setCreateAdminId] = useState('');

  // ─── Queries ────
  const { data: publicacoes = [], isLoading } = useQuery({
    queryKey: ['publicacoes-marcas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('publicacoes_marcas').select('*').order('proximo_prazo_critico', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as Publicacao[];
    },
    staleTime: 30000,
  });

  const { data: processes = [] } = useQuery({
    queryKey: ['brand-processes-pub'],
    queryFn: async () => {
      const { data, error } = await supabase.from('brand_processes').select('id, brand_name, process_number, user_id, deposit_date, ncl_classes, pipeline_stage, business_area');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30000,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['profiles-pub'],
    queryFn: async () => {
      const allClients: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email, cpf_cnpj, phone, company_name, priority, origin, contract_value, created_at, last_contact, assigned_to, created_by, client_funnel_type')
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allClients.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return allClients;
    },
    staleTime: 60000,
  });

  const { data: admins = [] } = useQuery({
    queryKey: ['admin-profiles-pub'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
      if (error) return [];
      const adminIds = (data || []).map(r => r.user_id);
      if (adminIds.length === 0) return [];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', adminIds);
      return profiles || [];
    },
    staleTime: 60000,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['publicacao-logs', selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      const { data, error } = await supabase.from('publicacao_logs').select('*').eq('publicacao_id', selectedId).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as LogEntry[];
    },
    enabled: !!selectedId,
  });

  const { data: rpiEntries = [] } = useQuery({
    queryKey: ['rpi-entries-matched'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rpi_entries')
        .select('id, rpi_upload_id, matched_process_id, matched_client_id, publication_date, dispatch_code, dispatch_text, process_number, brand_name');
      if (error) return [];
      return data || [];
    },
    staleTime: 60000,
  });

  const { data: rpiUploads = [] } = useQuery({
    queryKey: ['rpi-uploads-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rpi_uploads')
        .select('id, rpi_number, rpi_date')
        .order('rpi_number', { ascending: false });
      if (error) return [];
      return data || [];
    },
    staleTime: 60000,
  });

  const currentUserQuery = useQuery({
    queryKey: ['current-user-pub'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
    staleTime: 60000,
  });

  // ─── Close client assign dropdown on click outside ────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientAssignRef.current && !clientAssignRef.current.contains(e.target as Node)) {
        setShowClientAssignDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ─── Realtime (#8) ────
  useEffect(() => {
    const channel = supabase
      .channel('publicacoes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'publicacoes_marcas' }, () => {
        queryClient.invalidateQueries({ queryKey: ['publicacoes-marcas'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // ─── Sync tracking state (must be before auto-sync useEffect) ────
  const linkedProcessIds = useMemo(() => new Set(publicacoes.map(p => p.process_id)), [publicacoes]);
  const [submittedRpiEntryIds, setSubmittedRpiEntryIds] = useState<Set<string>>(new Set());

  // ─── Auto-archive expired publications ────
  const autoArchiveRef = useRef(false);
  useEffect(() => {
    if (autoArchiveRef.current || isLoading || publicacoes.length === 0) return;

    const expired = publicacoes.filter(p => {
      if (p.status === 'arquivado' || p.status === 'certificado') return false;
      let dl = p.proximo_prazo_critico;
      if (!dl && p.data_publicacao_rpi) {
        dl = format(addDays(parseISO(p.data_publicacao_rpi), 60), 'yyyy-MM-dd');
      }
      if (!dl) return false;
      return differenceInDays(parseISO(dl), new Date()) < 0;
    });

    if (expired.length === 0) return;
    autoArchiveRef.current = true;

    const archiveAll = async () => {
      const now = new Date().toISOString();
      // Batch all updates in parallel instead of sequential
      await Promise.all(expired.map(async (pub) => {
        await supabase.from('publicacoes_marcas').update({
          status: 'arquivado',
          updated_at: now,
        }).eq('id', pub.id);

        if (pub.process_id) {
          await supabase.from('brand_processes').update({
            pipeline_stage: 'arquivado',
            updated_at: now,
          }).eq('id', pub.process_id);
        }
      }));
      queryClient.invalidateQueries({ queryKey: ['publicacoes-marcas'] });
      queryClient.invalidateQueries({ queryKey: ['brand-processes-pub'] });
      toast.info(`${expired.length} publicação(ões) arquivada(s) automaticamente por prazo vencido.`);
    };
    archiveAll();
  }, [publicacoes, isLoading, queryClient]);

  const autoCreateFromProcessesRef = useRef(false);
  // Reset sync flag when rpiEntries change (new matches made in Revista INPI)
  const prevRpiCountRef = useRef(rpiEntries.length);
  const prevProcessCountRef = useRef(processes.length);
  useEffect(() => {
    if (rpiEntries.length !== prevRpiCountRef.current) {
      hasSyncedRef.current = false;
      prevRpiCountRef.current = rpiEntries.length;
    }
    if (processes.length !== prevProcessCountRef.current) {
      autoCreateFromProcessesRef.current = false;
      prevProcessCountRef.current = processes.length;
    }
  }, [rpiEntries.length, processes.length]);

  useEffect(() => {
    if (hasSyncedRef.current) return;
    if (isLoading || rpiEntries.length === 0) return;

    const doSync = async () => {
      hasSyncedRef.current = true;

      // Build lookup maps
      const existingRpiIds = new Set(
        publicacoes.filter(p => (p as any).rpi_entry_id).map(p => (p as any).rpi_entry_id)
      );
      const clientByCpf = new Map<string, string>();
      const clientByEmail = new Map<string, string>();
      clients.forEach((c: any) => {
        if (c.cpf) clientByCpf.set(c.cpf, c.id);
        if (c.email) clientByEmail.set(c.email.toLowerCase(), c.id);
      });

      const processesByUserId = new Map<string, typeof processes>();
      processes.forEach(p => {
        if (p.user_id) {
          const existing = processesByUserId.get(p.user_id) || [];
          existing.push(p);
          processesByUserId.set(p.user_id, existing);
        }
      });

      const processMap = new Map(processes.map(p => [p.id, p]));
      const processByNumber = new Map<string, (typeof processes)[number]>();
      processes.forEach((proc) => {
        const key = normalizeProcessNumber(proc.process_number);
        if (key && !processByNumber.has(key)) processByNumber.set(key, proc);
      });

      // Build lookups for safe update matching
      const existingPubByProcessId = new Map<string, Publicacao>();
      const existingPubByProcessNumber = new Map<string, Publicacao>();
      publicacoes.forEach((p) => {
        if (p.process_id) existingPubByProcessId.set(p.process_id, p);
        const key = normalizeProcessNumber(p.process_number_rpi);
        if (key && !existingPubByProcessNumber.has(key)) existingPubByProcessNumber.set(key, p);
      });

      const toInsert: any[] = [];
      const toUpdate: { id: string; data: any }[] = [];
      let skipped = 0;
      const syncedIds = new Set<string>();

      for (const entry of rpiEntries) {
        // Skip if already synced via rpi_entry_id
        if (existingRpiIds.has(entry.id)) {
          skipped++;
          syncedIds.add(entry.id);
          continue;
        }

        // Skip if already submitted in this session
        if (submittedRpiEntryIds.has(entry.id)) {
          skipped++;
          continue;
        }

        // Try to resolve process_id
        let processId = entry.matched_process_id || null;
        let clientId = entry.matched_client_id || null;

        const entryProcessNumber = normalizeProcessNumber(entry.process_number);
        if (!processId && entryProcessNumber) {
          const proc = processByNumber.get(entryProcessNumber);
          if (proc) {
            processId = proc.id;
            if (!clientId) clientId = proc.user_id || null;
          }
        }

        if (!processId && clientId) {
          const clientProcesses = processesByUserId.get(clientId) || [];
          if (entryProcessNumber) {
            const match = clientProcesses.find(p => normalizeProcessNumber(p.process_number) === entryProcessNumber);
            if (match) processId = match.id;
          }
          // Sem correspondência exata de número de processo: não forçar vínculo por cliente
          if (!processId) clientId = null;
        }

        // Resolve client_id from process if possible
        if (!clientId && processId) {
          const proc = processMap.get(processId);
          clientId = proc?.user_id || null;
        }

        // ★ REGRA FUNDAMENTAL: NÃO criar publicação órfã — só entra no Kanban com cliente vinculado
        if (!clientId) {
          skipped++;
          continue;
        }

        // Determine status from dispatch
        let status: PubStatus = '003';
        const dispatchText = (entry.dispatch_text || '').toLowerCase();
        if (dispatchText.includes('certificado de registro') || dispatchText.includes('concessao') || dispatchText.includes('concessão') || dispatchText.includes('registro concedido')) status = 'certificado';
        else if (dispatchText.includes('deferido') || dispatchText.includes('deferimento')) status = 'deferimento';
        else if (dispatchText.includes('indeferido') || dispatchText.includes('indeferimento')) status = 'indeferimento';
        else if (dispatchText.includes('oposição') || dispatchText.includes('oposicao')) status = 'oposicao';
        else if (dispatchText.includes('exigência') || dispatchText.includes('exigencia') || dispatchText.includes('mérito') || dispatchText.includes('merito')) status = 'exigencia_merito';
        else if (dispatchText.includes('arquiv')) status = 'arquivado';

        const pubData = calcAutoFields({
          process_id: processId,
          client_id: clientId,
          status,
          tipo_publicacao: 'publicacao_rpi' as PubTipo,
          rpi_number: entry.dispatch_code || null,
          data_publicacao_rpi: entry.publication_date || null,
          data_certificado: status === 'certificado' ? (entry.publication_date || null) : null,
          rpi_entry_id: entry.id,
          brand_name_rpi: entry.brand_name || null,
          process_number_rpi: entry.process_number || null,
        } as any, entry.dispatch_text);

        // ★ REGRA: mesmo process_id (ou mesmo nº normalizado sem vínculo) atualiza; processo diferente cria novo card.
        const existingByProcessId = processId ? existingPubByProcessId.get(processId) : null;
        const existingByProcessNumber = entryProcessNumber ? existingPubByProcessNumber.get(entryProcessNumber) : null;
        const existingPub = existingByProcessId || (
          existingByProcessNumber && (
            !existingByProcessNumber.process_id ||
            (processId && existingByProcessNumber.process_id === processId) ||
            (clientId && existingByProcessNumber.client_id === clientId)
          ) ? existingByProcessNumber : null
        );

        if (existingPub) {
          const updateData: any = {
            status: pubData.status,
            data_publicacao_rpi: pubData.data_publicacao_rpi,
            proximo_prazo_critico: pubData.proximo_prazo_critico,
            descricao_prazo: pubData.descricao_prazo,
            rpi_entry_id: entry.id,
            process_id: processId || existingPub.process_id || null,
            client_id: clientId || existingPub.client_id || null,
            brand_name_rpi: entry.brand_name || existingPub.brand_name_rpi || null,
            process_number_rpi: entry.process_number || existingPub.process_number_rpi || null,
            updated_at: new Date().toISOString(),
          };
          if (pubData.data_certificado) updateData.data_certificado = pubData.data_certificado;
          if (pubData.data_renovacao) updateData.data_renovacao = pubData.data_renovacao;
          if (pubData.prazo_oposicao) updateData.prazo_oposicao = pubData.prazo_oposicao;
          toUpdate.push({ id: existingPub.id, data: updateData });
        } else {
          toInsert.push(pubData);
        }
        syncedIds.add(entry.id);
      }

      // Mark all processed entries as submitted to prevent banner from showing
      if (syncedIds.size > 0) {
        setSubmittedRpiEntryIds(prev => {
          const next = new Set(prev);
          syncedIds.forEach(id => next.add(id));
          return next;
        });
      }

      // Process updates (with reverse sync for reactivated publications)
      let updated = 0;
      const stageMap: Record<string, string> = {
        '003': '003', oposicao: 'oposicao', exigencia_merito: 'exigencia_merito',
        deferimento: 'deferimento', certificado: 'certificados', indeferimento: 'indeferimento',
        arquivado: 'distrato', renovacao: 'renovacao',
      };
      for (const { id, data } of toUpdate) {
        const { error } = await supabase.from('publicacoes_marcas').update(data).eq('id', id);
        if (!error) {
          updated++;
          // Reverse sync: if pub was archived and new RPI reactivated it, update process pipeline_stage
          if (data.status && data.process_id && stageMap[data.status]) {
            await supabase.from('brand_processes').update({
              pipeline_stage: stageMap[data.status],
              updated_at: new Date().toISOString(),
            }).eq('id', data.process_id);
          }
        }
      }

      if (toInsert.length > 0) {
        // Insert in batches of 50 to avoid payload limits
        const batchSize = 50;
        let inserted = 0;
        for (let i = 0; i < toInsert.length; i += batchSize) {
          const batch = toInsert.slice(i, i + batchSize);
          const { error } = await supabase.from('publicacoes_marcas').insert(batch);
          if (error) {
            console.error('Auto-sync error:', error);
            toast.error(`Erro na sincronização (lote ${Math.floor(i / batchSize) + 1})`);
            continue;
          }
          inserted += batch.length;
        }
        queryClient.invalidateQueries({ queryKey: ['publicacoes-marcas'] });
        const parts = [];
        if (inserted > 0) parts.push(`${inserted} criada(s)`);
        if (updated > 0) parts.push(`${updated} atualizada(s)`);
        if (skipped > 0) parts.push(`${skipped} já existiam`);
        toast.success(`✅ Sincronização: ${parts.join(', ')}`, { duration: 5000 });
      } else if (updated > 0) {
        queryClient.invalidateQueries({ queryKey: ['publicacoes-marcas'] });
        toast.success(`✅ ${updated} publicação(ões) atualizada(s) da revista`, { duration: 5000 });
      }

    };

    doSync();
  }, [isLoading, rpiEntries, publicacoes, processes, clients, queryClient, submittedRpiEntryIds]);

  // ─── Auto-create publicações for brand_processes in juridical stages without a Kanban card ────
  // (ref declared above at line 514)
  useEffect(() => {
    if (autoCreateFromProcessesRef.current || isLoading || processes.length === 0) return;

    const PIPELINE_TO_PUB: Record<string, PubStatus> = {
      '003': '003',
      oposicao: 'oposicao',
      exigencia_merito: 'exigencia_merito',
      indeferimento: 'indeferimento',
      deferimento: 'deferimento',
      certificados: 'certificado',
      renovacao: 'renovacao',
      distrato: 'arquivado',
    };

    // Set of process IDs already linked to a publicação
    const linkedProcIds = new Set(publicacoes.map(p => p.process_id).filter(Boolean));

    // Find brand_processes in juridical stages that have a client (user_id) but no publicação
    const missing = processes.filter(proc =>
      proc.user_id &&
      proc.pipeline_stage &&
      PIPELINE_TO_PUB[proc.pipeline_stage] &&
      !linkedProcIds.has(proc.id)
    );

    if (missing.length === 0) return;
    autoCreateFromProcessesRef.current = true;

    const createMissing = async () => {
      const toInsert = missing.map(proc => {
        const status = PIPELINE_TO_PUB[proc.pipeline_stage!]!;
        const pubData = calcAutoFields({
          process_id: proc.id,
          client_id: proc.user_id,
          status,
          tipo_publicacao: 'publicacao_rpi' as PubTipo,
          data_deposito: proc.deposit_date || null,
          data_publicacao_rpi: null,
          brand_name_rpi: proc.brand_name || null,
          process_number_rpi: proc.process_number || null,
          ncl_class: proc.ncl_classes ? proc.ncl_classes.join(', ') : null,
        } as any);
        return pubData;
      });

      const batchSize = 50;
      let inserted = 0;
      for (let i = 0; i < toInsert.length; i += batchSize) {
        const batch = toInsert.slice(i, i + batchSize);
        const { error } = await supabase.from('publicacoes_marcas').insert(batch);
        if (error) {
          console.error('Auto-create from processes error:', error);
          continue;
        }
        inserted += batch.length;
      }
      if (inserted > 0) {
        queryClient.invalidateQueries({ queryKey: ['publicacoes-marcas'] });
        toast.success(`✅ ${inserted} publicação(ões) criada(s) a partir de processos existentes`, { duration: 5000 });
      }
    };

    createMissing();
  }, [isLoading, processes, publicacoes, queryClient]);

  // ─── Runtime enrichment: sync missing data from linked brand_processes ───
  const enrichmentRef = useRef(false);
  useEffect(() => {
    if (enrichmentRef.current || isLoading || publicacoes.length === 0 || processes.length === 0) return;

    const processById = new Map(processes.map(p => [p.id, p]));
    const processByNumber = new Map<string, typeof processes[0]>();
    processes.forEach(p => {
      if (p.process_number) processByNumber.set(p.process_number.replace(/\D/g, ''), p);
    });

    const toUpdate: { id: string; updates: Record<string, any> }[] = [];

    publicacoes.forEach(pub => {
      let proc = pub.process_id ? processById.get(pub.process_id) : null;
      if (!proc && (pub as any).process_number_rpi) {
        proc = processByNumber.get(((pub as any).process_number_rpi || '').replace(/\D/g, '')) || null;
      }
      if (!proc) return;

      const updates: Record<string, any> = {};
      if (!(pub as any).ncl_class && proc.ncl_classes) updates.ncl_class = proc.ncl_classes.join(', ');
      if (!(pub as any).brand_name_rpi && proc.brand_name) updates.brand_name_rpi = proc.brand_name;
      if (!(pub as any).process_number_rpi && proc.process_number) updates.process_number_rpi = proc.process_number;
      if (!pub.process_id && proc.id) updates.process_id = proc.id;

      if (Object.keys(updates).length > 0) {
        toUpdate.push({ id: pub.id, updates });
      }
    });

    if (toUpdate.length === 0) return;
    enrichmentRef.current = true;

    const runEnrichment = async () => {
      let enriched = 0;
      for (const item of toUpdate) {
        const { error } = await supabase.from('publicacoes_marcas').update(item.updates).eq('id', item.id);
        if (!error) enriched++;
      }
      if (enriched > 0) {
        queryClient.invalidateQueries({ queryKey: ['publicacoes-marcas'] });
        console.log(`Enriched ${enriched} publicação cards with process data`);
      }
    };
    runEnrichment();
  }, [isLoading, publicacoes, processes, queryClient]);


  const createMutation = useMutation({
    mutationFn: async (data: Partial<Publicacao>) => {
      const computed = calcAutoFields(data);
      const { error } = await supabase.from('publicacoes_marcas').insert(computed as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicacoes-marcas'] });
      toast.success('Publicação criada com sucesso');
      setShowCreate(false);
      resetCreateForm();
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao criar'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, changes, original }: { id: string; changes: Partial<Publicacao>; original: Publicacao }) => {
      const computed = calcAutoFields(changes);
      const { error } = await supabase.from('publicacoes_marcas').update(computed as any).eq('id', id);
      if (error) throw error;
      const user = currentUserQuery.data;
      const logEntries = Object.entries(computed)
        .filter(([k, v]) => (original as any)[k] !== v && !['updated_at', 'created_at'].includes(k))
        .map(([k, v]) => ({
          publicacao_id: id,
          admin_id: user?.id,
          admin_email: user?.email,
          campo_alterado: k,
          valor_anterior: String((original as any)[k] ?? ''),
          valor_novo: String(v ?? ''),
        }));
      if (logEntries.length > 0) {
        await supabase.from('publicacao_logs').insert(logEntries);
      }

      // Auto-notify client on status change (with dedup)
      if (computed.status && computed.status !== original.status) {
        const clientId = (changes.client_id || original.client_id) as string | null;
        const proc = (changes.process_id || original.process_id) ? processMap.get((changes.process_id || original.process_id) as string) : null;
        const brandName = proc?.brand_name || (original as any).brand_name_rpi || 'Marca';
        const statusLabel = STATUS_CONFIG[computed.status as PubStatus]?.label || computed.status;

        // Dedup: only notify if last notification was >1h ago
        const lastNotif = (original as any).last_notification_sent_at;
        const canNotify = !lastNotif || (Date.now() - new Date(lastNotif).getTime()) > 3600000;

        if (clientId && canNotify) {
          await supabase.from('notifications').insert({
            user_id: clientId,
            title: `📋 Atualização: ${brandName}`,
            message: `O status da publicação da marca "${brandName}" foi alterado para "${statusLabel}".`,
            type: 'info',
            link: '/cliente/processos',
          });
          // Update dedup timestamp
          await supabase.from('publicacoes_marcas').update({ last_notification_sent_at: new Date().toISOString() } as any).eq('id', id);
        }

        // Sync reverso: update brand_processes pipeline_stage
        const processId = (changes.process_id || original.process_id) as string | null;
        if (processId) {
          const stageMap: Record<string, string> = {
            '003': '003',
            oposicao: 'oposicao',
            exigencia_merito: 'exigencia_merito',
            deferimento: 'deferimento',
            certificado: 'certificados',
            indeferimento: 'indeferimento',
            arquivado: 'distrato',
            renovacao: 'renovacao',
          };
          const newStage = stageMap[computed.status as string];
          if (newStage) {
            await supabase.from('brand_processes').update({
              pipeline_stage: newStage,
              updated_at: new Date().toISOString(),
            }).eq('id', processId);
          }
        }

        // [SYNC REVERSO] Update rpi_entries.dispatch_type when status changes in Publicações
        const rpiEntryId = (original as any).rpi_entry_id as string | null;
        if (rpiEntryId && computed.status && computed.status !== original.status) {
          const dispatchTypeMap: Record<string, string> = {
            '003': '003',
            oposicao: 'Oposição',
            exigencia_merito: 'Exigência de Mérito',
            deferimento: 'Deferimento',
            certificado: 'Certificado',
            indeferimento: 'Indeferimento',
            renovacao: 'Renovação',
            arquivado: 'Arquivado',
          };
          const newDispatch = dispatchTypeMap[computed.status as string];
          if (newDispatch) {
            await supabase.from('rpi_entries').update({
              dispatch_type: newDispatch,
              updated_at: new Date().toISOString(),
            }).eq('id', rpiEntryId);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicacoes-marcas'] });
      queryClient.invalidateQueries({ queryKey: ['publicacao-logs'] });
      toast.success('Publicação atualizada');
      setShowEdit(false);
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao atualizar'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('publicacao_logs').delete().eq('publicacao_id', id);
      const { error } = await supabase.from('publicacoes_marcas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicacoes-marcas'] });
      toast.success('Publicação excluída');
      setSelectedId(null);
      setShowDelete(false);
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao excluir'),
  });

  // ─── Assign Client Mutation ────
  const assignClientMutation = useMutation({
    mutationFn: async ({ pubId, clientId, oldClientId, processId, selectedProcessId, brandName, processNumber, nclClass }: { 
      pubId: string; clientId: string | null; oldClientId: string | null; processId: string | null;
      selectedProcessId?: string | null; brandName?: string; processNumber?: string; nclClass?: string;
    }) => {
      const updateData: any = { client_id: clientId };
      if (selectedProcessId) updateData.process_id = selectedProcessId;
      if (brandName) updateData.brand_name_rpi = brandName;
      if (processNumber) updateData.process_number_rpi = processNumber;
      if (nclClass) updateData.ncl_class = nclClass;
      
      const { error: pubError } = await supabase.from('publicacoes_marcas').update(updateData).eq('id', pubId);
      if (pubError) throw pubError;
      const linkProcessId = selectedProcessId || processId;
      if (linkProcessId) {
        await supabase.from('brand_processes').update({ user_id: clientId, updated_at: new Date().toISOString() }).eq('id', linkProcessId);
      }
      const user = currentUserQuery.data;
      await supabase.from('publicacao_logs').insert({
        publicacao_id: pubId,
        admin_id: user?.id,
        admin_email: user?.email,
        campo_alterado: 'client_id',
        valor_anterior: oldClientId || '',
        valor_novo: clientId || '',
      });
      if (clientId && linkProcessId) {
        const proc = processMap.get(linkProcessId);
        const bName = brandName || proc?.brand_name || 'Marca';
        await supabase.from('notifications').insert({
          user_id: clientId,
          title: '📋 Processo vinculado',
          message: `O processo da marca "${bName}" foi vinculado ao seu painel.`,
          type: 'info',
          link: '/cliente/processos',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicacoes-marcas'] });
      queryClient.invalidateQueries({ queryKey: ['publicacao-logs'] });
      queryClient.invalidateQueries({ queryKey: ['brand-processes-pub'] });
      queryClient.invalidateQueries({ queryKey: ['profiles-pub'] });
      toast.success('Cliente atribuído com sucesso');
      setClientAssignSearch('');
      setShowClientAssignDropdown(false);
      setSelectedAssignProcessId(null);
      setEditableBrandName('');
      setEditableProcessNumber('');
      setEditableNclClass('');
      setShowEditableFields(false);
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao atribuir cliente'),
  });

  // ─── Maps ────
  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);
  const processMap = useMemo(() => new Map(processes.map(p => [p.id, p])), [processes]);
  const processNumberMap = useMemo(() => {
    const map = new Map<string, (typeof processes)[number]>();
    processes.forEach((proc) => {
      const key = normalizeProcessNumber(proc.process_number);
      if (key && !map.has(key)) map.set(key, proc);
    });
    return map;
  }, [processes]);
  const adminMap = useMemo(() => new Map(admins.map(a => [a.id, a])), [admins]);

  // ─── RPI resolution maps ────
  const rpiUploadMap = useMemo(() => new Map(rpiUploads.map(u => [u.id, u.rpi_number])), [rpiUploads]);
  const rpiEntryToUploadId = useMemo(() => new Map(rpiEntries.map(e => [e.id, e.rpi_upload_id])), [rpiEntries]);

  const resolveRpiNumber = useCallback((pub: Publicacao): string | null => {
    if (pub.rpi_entry_id) {
      const uploadId = rpiEntryToUploadId.get(pub.rpi_entry_id);
      if (uploadId) {
        const realNumber = rpiUploadMap.get(uploadId);
        if (realNumber) return realNumber;
      }
    }
    if (pub.rpi_number && /^\d+$/.test(pub.rpi_number)) return pub.rpi_number;
    return null;
  }, [rpiEntryToUploadId, rpiUploadMap]);

  // ─── KPI Stats ────
  const kpiStats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const withClient = publicacoes.filter(p => {
      const dc = p.client_id ? clientMap.get(p.client_id) : null;
      if (dc) return true;
      const pr = p.process_id ? processMap.get(p.process_id) : null;
      const prByNum = !pr && (p as any).process_number_rpi ? processNumberMap.get(normalizeProcessNumber((p as any).process_number_rpi)) : null;
      const rp = pr || prByNum;
      return rp?.user_id ? !!clientMap.get(rp.user_id) : false;
    });
    const total = withClient.length;
    const urgentes = withClient.filter(p => { const d = getDaysLeft(p.proximo_prazo_critico); return d !== null && d >= 0 && d <= 7; }).length;
    const atrasados = withClient.filter(p => { const d = getDaysLeft(p.proximo_prazo_critico); return d !== null && d < 0; }).length;
    const deferidosMes = withClient.filter(p => p.status === 'deferimento' && p.data_decisao && isAfter(parseISO(p.data_decisao), startOfMonth)).length;
    return { total, urgentes, atrasados, deferidosMes };
  }, [publicacoes, clientMap, processMap, processNumberMap]);

  // ─── Status counts ────
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    publicacoes.filter(p => {
      const dc = p.client_id ? clientMap.get(p.client_id) : null;
      if (dc) return true;
      const pr = p.process_id ? processMap.get(p.process_id) : null;
      const prByNum = !pr && (p as any).process_number_rpi ? processNumberMap.get(normalizeProcessNumber((p as any).process_number_rpi)) : null;
      const rp = pr || prByNum;
      return rp?.user_id ? !!clientMap.get(rp.user_id) : false;
    }).forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1; });
    return counts;
  }, [publicacoes, clientMap, processMap, processNumberMap]);

  // ─── Filtering + Sorting + Pagination ────
  const filtered = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let result = publicacoes.filter(pub => {
      // Try resolving client: direct client_id OR via linked process's user_id
      const directClient = pub.client_id ? clientMap.get(pub.client_id) : null;
      const proc = pub.process_id ? processMap.get(pub.process_id) : null;
      const procByNumber = !proc && (pub as any).process_number_rpi ? processNumberMap.get(normalizeProcessNumber((pub as any).process_number_rpi)) : null;
      const resolvedProc = proc || procByNumber;
      const resolvedClient = directClient || (resolvedProc?.user_id ? clientMap.get(resolvedProc.user_id) : null);
      if (!resolvedClient) return false;
      const client = resolvedClient;
      if (search) {
        const q = search.toLowerCase();
        const matchName = resolvedProc?.brand_name?.toLowerCase().includes(q) || (pub as any).brand_name_rpi?.toLowerCase().includes(q);
        const matchProc = resolvedProc?.process_number?.toLowerCase().includes(q) || (pub as any).process_number_rpi?.toLowerCase().includes(q);
        const matchClient = client?.full_name?.toLowerCase().includes(q);
        if (!matchName && !matchProc && !matchClient) return false;
      }
      if (filterClient !== 'todos' && pub.client_id !== filterClient) return false;
      if (filterStatus !== 'todos' && pub.status !== filterStatus) return false;
      if (filterAdmin !== 'todos' && pub.admin_id !== filterAdmin) return false;
      if (filterTipo !== 'todos' && pub.tipo_publicacao !== filterTipo) return false;
      if (filterRpi !== 'todos') {
        // Resolve real RPI number: via rpi_entry_id → rpi_upload → rpi_number
        const resolvedRpi = resolveRpiNumber(pub);
        if (resolvedRpi !== filterRpi) return false;
      }
      if (filterPrazo !== 'todos') {
        const days = getDaysLeft(pub.proximo_prazo_critico);
        if (days === null) return filterPrazo === 'todos';
        if (filterPrazo === 'hoje' && days !== 0) return false;
        if (filterPrazo === '7dias' && (days < 0 || days > 7)) return false;
        if (filterPrazo === '30dias' && (days < 0 || days > 30)) return false;
        if (filterPrazo === 'atrasados' && days >= 0) return false;
      }
      // Special KPI filter: "deferidos este mês"
      if (activeKpi === 'deferidosMes') {
        if (pub.status !== 'deferimento') return false;
        if (!pub.data_decisao || !isAfter(parseISO(pub.data_decisao), startOfMonth)) return false;
      }
      // Date range filter (#3)
      if (filterDateFrom || filterDateTo) {
        const pubDate = pub.data_publicacao_rpi || pub.data_deposito;
        if (!pubDate) return false;
        const d = parseISO(pubDate);
        if (filterDateFrom && isBefore(d, parseISO(filterDateFrom))) return false;
        if (filterDateTo && isAfter(d, parseISO(filterDateTo))) return false;
      }
      return true;
    });

    // Sorting (#1)
    result.sort((a, b) => {
      let cmp = 0;
      const procA = a.process_id ? processMap.get(a.process_id) : null;
      const procB = b.process_id ? processMap.get(b.process_id) : null;
      const clientA = a.client_id ? clientMap.get(a.client_id) : null;
      const clientB = b.client_id ? clientMap.get(b.client_id) : null;

      switch (sortKey) {
        case 'cliente':
          cmp = (clientA?.full_name || '').localeCompare(clientB?.full_name || '');
          break;
        case 'marca':
          cmp = (procA?.brand_name || (a as any).brand_name_rpi || '').localeCompare(procB?.brand_name || (b as any).brand_name_rpi || '');
          break;
        case 'data_pub':
          cmp = (a.data_publicacao_rpi || '').localeCompare(b.data_publicacao_rpi || '');
          break;
        case 'prazo': {
          const dA = getDaysLeft(a.proximo_prazo_critico) ?? 99999;
          const dB = getDaysLeft(b.proximo_prazo_critico) ?? 99999;
          cmp = dA - dB;
          break;
        }
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [publicacoes, search, filterClient, filterStatus, filterPrazo, filterTipo, filterRpi, filterAdmin, filterDateFrom, filterDateTo, processMap, processNumberMap, clientMap, sortKey, sortDir, activeKpi, resolveRpiNumber]);

  // Pagination (#10)
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [search, filterClient, filterStatus, filterPrazo, filterTipo, filterRpi, filterAdmin, filterDateFrom, filterDateTo]);

  const selected = useMemo(() => publicacoes.find(p => p.id === selectedId) || null, [publicacoes, selectedId]);

  // The pub used for building the ClientDetailSheet (uses sheetPubId, NOT selectedId)
  const sheetPub = useMemo(() => publicacoes.find(p => p.id === sheetPubId) || null, [publicacoes, sheetPubId]);

  // Fetched client for the ClientDetailSheet — loaded on click, identical to Clientes.tsx
  const [fetchedClientForSheet, setFetchedClientForSheet] = useState<ClientWithProcess | null>(null);
  const [fetchingClient, setFetchingClient] = useState(false);

  const fetchClientForSheet = useCallback(async (clientId: string) => {
    setFetchingClient(true);
    try {
      // Parallel fetch: profile, processes, contracts — same as Clientes.tsx
      const [profileRes, processesRes, contractsRes] = await Promise.all([
        supabase.from('profiles')
          .select('id, full_name, email, phone, cpf_cnpj, company_name, priority, origin, contract_value, created_at, last_contact, client_funnel_type, created_by, assigned_to')
          .eq('id', clientId)
          .single(),
        supabase.from('brand_processes')
          .select('id, user_id, brand_name, business_area, pipeline_stage, status, process_number')
          .eq('user_id', clientId),
        supabase.from('contracts')
          .select('user_id, contract_value, payment_method')
          .eq('user_id', clientId)
          .order('created_at', { ascending: false })
          .limit(1),
      ]);

      const profile = profileRes.data;
      if (!profile) { setFetchingClient(false); return; }

      const userProcesses = processesRes.data || [];
      const latestContract = contractsRes.data?.[0];

      // Resolve admin names
      const adminIds = [profile.created_by, profile.assigned_to].filter(Boolean) as string[];
      let adminNameMap: Record<string, string> = {};
      if (adminIds.length > 0) {
        const { data: adminProfiles } = await supabase.from('profiles').select('id, full_name, email').in('id', adminIds);
        for (const a of adminProfiles || []) {
          adminNameMap[a.id] = a.full_name || a.email;
        }
      }

      const createdByName = profile.created_by ? adminNameMap[profile.created_by] || null : null;
      const assignedToName = profile.assigned_to ? adminNameMap[profile.assigned_to] || null : null;
      const contractVal = latestContract?.contract_value ? Number(latestContract.contract_value) : profile.contract_value;

      const mainProcess = userProcesses[0] || null;
      const brands = userProcesses.map(p => ({
        id: p.id,
        brand_name: p.brand_name,
        pipeline_stage: p.pipeline_stage || ((profile as any).client_funnel_type === 'comercial' ? 'assinou_contrato' : 'protocolado'),
        process_number: p.process_number || undefined,
      }));

      const clientObj: ClientWithProcess = {
        id: profile.id,
        full_name: profile.full_name || '',
        email: profile.email || '',
        phone: profile.phone || null,
        company_name: profile.company_name || null,
        priority: profile.priority || 'medium',
        origin: profile.origin || 'site',
        contract_value: contractVal || 0,
        process_id: mainProcess?.id || null,
        brand_name: mainProcess?.brand_name || null,
        business_area: mainProcess?.business_area || null,
        pipeline_stage: mainProcess?.pipeline_stage || ((profile as any).client_funnel_type === 'comercial' ? 'assinou_contrato' : 'protocolado'),
        process_status: mainProcess?.status || null,
        process_number: mainProcess?.process_number || undefined,
        created_at: profile.created_at || undefined,
        cpf_cnpj: profile.cpf_cnpj || undefined,
        client_funnel_type: (profile as any).client_funnel_type || 'juridico',
        created_by: profile.created_by || null,
        assigned_to: profile.assigned_to || null,
        created_by_name: createdByName,
        assigned_to_name: assignedToName,
        brands,
      };

      setFetchedClientForSheet(clientObj);
    } catch (err) {
      console.error('Error fetching client for sheet:', err);
      toast.error('Erro ao carregar ficha do cliente');
    } finally {
      setFetchingClient(false);
    }
  }, []);

  // ─── Alert toast on mount ────
  useEffect(() => {
    const urgentes = publicacoes.filter(p => {
      const d = getDaysLeft(p.proximo_prazo_critico);
      return d !== null && d >= 0 && d <= 7;
    });
    if (urgentes.length > 0) {
      toast.warning(`⚠️ ${urgentes.length} processo(s) com prazo crítico nos próximos 7 dias!`, { duration: 6000 });
    }
  }, [publicacoes.length]);

  // ─── Sort handler (#1) ────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ colKey }: { colKey: SortKey }) => {
    if (sortKey !== colKey) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 ml-1 text-primary" /> : <ArrowDown className="w-3 h-3 ml-1 text-primary" />;
  };

  // ─── Bulk selection (#4) ────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedData.map(p => p.id)));
    }
  };

  const handleBulkStatusChange = async (newStatus: PubStatus) => {
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('publicacoes_marcas').update({ status: newStatus } as any).in('id', ids);
    if (error) { toast.error('Erro ao atualizar em lote'); return; }
    queryClient.invalidateQueries({ queryKey: ['publicacoes-marcas'] });
    toast.success(`${ids.length} publicação(ões) atualizadas para ${STATUS_CONFIG[newStatus]?.label}`);
    setSelectedIds(new Set());
  };

  const handleBulkReminder = async () => {
    const user = currentUserQuery.data;
    if (!user) return;
    const pubs = publicacoes.filter(p => selectedIds.has(p.id));
    const notifications: any[] = [];
    pubs.forEach(pub => {
      const proc = pub.process_id ? processMap.get(pub.process_id) : null;
      const brandName = proc?.brand_name || (pub as any).brand_name_rpi || 'Marca';
      notifications.push({
        user_id: user.id,
        title: `🔔 Lembrete: ${brandName}`,
        message: `Lembrete gerado em lote para o processo "${brandName}".`,
        type: 'warning',
        link: '/admin/publicacao',
      });
    });
    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications);
    }
    toast.success(`${notifications.length} lembrete(s) gerado(s)`);
    setSelectedIds(new Set());
  };

  const handleBulkExport = () => {
    const selectedPubs = filtered.filter(p => selectedIds.has(p.id));
    const exportData = selectedPubs.map(pub => {
      const proc = processMap.get(pub.process_id);
      const client = clientMap.get(pub.client_id);
      const admin = pub.admin_id ? adminMap.get(pub.admin_id) : null;
      return {
        cliente: client?.full_name || '',
        marca: proc?.brand_name || '',
        processo: proc?.process_number || '',
        responsavel: admin?.full_name || '',
        status: pub.status,
        dataDeposito: pub.data_deposito || '',
        dataPubRpi: pub.data_publicacao_rpi || '',
        prazoOposicao: pub.prazo_oposicao || '',
        proximoPrazo: pub.proximo_prazo_critico || '',
      };
    });
    exportPublicacaoPDF(exportData, { status: filterStatus, cliente: filterClient, prazo: filterPrazo });
  };

  // ─── CSV Export ────
  const exportCSV = useCallback(() => {
    const rows = filtered.map(pub => {
      const proc = processMap.get(pub.process_id);
      const client = clientMap.get(pub.client_id);
      const admin = pub.admin_id ? adminMap.get(pub.admin_id) : null;
      return {
        Cliente: client?.full_name || '',
        Marca: proc?.brand_name || '',
        'N. Processo': proc?.process_number || '',
        Responsável: admin?.full_name || '',
        Status: STATUS_CONFIG[pub.status as PubStatus]?.label || pub.status,
        'Data Depósito': pub.data_deposito || '',
        'Data Publicação RPI': pub.data_publicacao_rpi || '',
        'Prazo Oposição': pub.prazo_oposicao || '',
        'Data Decisão': pub.data_decisao || '',
        'Data Certificado': pub.data_certificado || '',
        'Data Renovação': pub.data_renovacao || '',
        'Próximo Prazo': pub.proximo_prazo_critico || '',
      };
    });
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${(r as any)[h]}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `publicacoes_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado');
  }, [filtered, processMap, clientMap, adminMap]);

  // ─── PDF Export (#6) ────
  const exportPDF = useCallback(() => {
    const exportData = filtered.map(pub => {
      const proc = processMap.get(pub.process_id);
      const client = clientMap.get(pub.client_id);
      const admin = pub.admin_id ? adminMap.get(pub.admin_id) : null;
      return {
        cliente: client?.full_name || '',
        marca: proc?.brand_name || '',
        processo: proc?.process_number || '',
        responsavel: admin?.full_name || '',
        status: pub.status,
        dataDeposito: pub.data_deposito || '',
        dataPubRpi: pub.data_publicacao_rpi || '',
        prazoOposicao: pub.prazo_oposicao || '',
        proximoPrazo: pub.proximo_prazo_critico || '',
      };
    });
    exportPublicacaoPDF(exportData, { status: filterStatus, cliente: filterClient, prazo: filterPrazo });
  }, [filtered, processMap, clientMap, adminMap, filterStatus, filterClient, filterPrazo]);

  // ─── Create helpers ────
  // linkedProcessIds and submittedRpiEntryIds moved above auto-sync useEffect
  const [isAutoLinking, setIsAutoLinking] = useState(false);

  // ─── Auto-link clients via process_number + brand_name (#autolink) ────
  const handleAutoLinkClients = async () => {
    setIsAutoLinking(true);
    try {
      const allOrphans = publicacoes.filter(p => !p.client_id);
      if (allOrphans.length === 0) {
        toast.info('Todas as publicações já possuem cliente vinculado');
        setIsAutoLinking(false);
        return;
      }

      // Step 1: Match by process_number (normalized)
      const processByNumber = new Map<string, (typeof processes)[number]>();
      processes.forEach((proc) => {
        const key = normalizeProcessNumber(proc.process_number);
        if (key && !processByNumber.has(key)) processByNumber.set(key, proc);
      });
      let linkedByProcess = 0;
      const stillOrphans: typeof allOrphans = [];

      for (const pub of allOrphans) {
        const key = normalizeProcessNumber(pub.process_number_rpi);
        if (key) {
          const proc = processByNumber.get(key);
          if (proc && proc.user_id) {
            const { error } = await supabase.from('publicacoes_marcas').update({ client_id: proc.user_id, process_id: proc.id }).eq('id', pub.id);
            if (!error) { linkedByProcess++; continue; }
          }
        }
        stillOrphans.push(pub);
      }

      // Step 2: Match by brand_name (normalized, case-insensitive)
      const normalizeBrand = (name: string) => name.replace(/<[^>]+>/g, '').trim().toUpperCase();
      const brandNameMap = new Map<string, typeof processes[0]>();
      for (const proc of processes) {
        if (proc.brand_name && proc.user_id) {
          const key = normalizeBrand(proc.brand_name);
          if (key && !brandNameMap.has(key)) brandNameMap.set(key, proc);
        }
      }

      let linkedByBrand = 0;
      for (const pub of stillOrphans) {
        if (pub.brand_name_rpi) {
          const key = normalizeBrand(pub.brand_name_rpi);
          const proc = brandNameMap.get(key);
          if (proc && proc.user_id) {
            const { error } = await supabase.from('publicacoes_marcas').update({ client_id: proc.user_id, process_id: proc.id }).eq('id', pub.id);
            if (!error) linkedByBrand++;
          }
        }
      }

      const totalLinked = linkedByProcess + linkedByBrand;
      const notFound = allOrphans.length - totalLinked;

      queryClient.invalidateQueries({ queryKey: ['publicacoes-marcas'] });
      if (totalLinked > 0) {
        const details: string[] = [];
        if (linkedByProcess > 0) details.push(`${linkedByProcess} por nº processo`);
        if (linkedByBrand > 0) details.push(`${linkedByBrand} por nome da marca`);
        toast.success(`✅ ${totalLinked} vinculadas (${details.join(', ')})`);
      }
      if (notFound > 0) toast.info(`${notFound} publicação(ões) sem correspondência`);
    } catch (err) {
      toast.error('Erro ao vincular clientes');
    } finally {
      setIsAutoLinking(false);
    }
  };

  // Stats for orphan count
  const orphanCount = useMemo(() => publicacoes.filter(p => !p.client_id || !clientMap.get(p.client_id)).length, [publicacoes, clientMap]);

  const resetCreateForm = () => {
    setCreateProcessId('');
    setCreateDataDeposito('');
    setCreateDataPubRpi('');
    setCreateTipo('publicacao_rpi');
    setCreateAdminId('');
  };

  useEffect(() => {
    if (createProcessId) {
      const proc = processMap.get(createProcessId);
      if (proc?.deposit_date) setCreateDataDeposito(proc.deposit_date);
    }
  }, [createProcessId, processMap]);

  const handleCreate = () => {
    const proc = processMap.get(createProcessId);
    if (!proc) { toast.error('Selecione um processo'); return; }
    createMutation.mutate({
      process_id: createProcessId,
      client_id: proc.user_id!,
      admin_id: createAdminId || currentUserQuery.data?.id || null,
      status: '003',
      tipo_publicacao: createTipo,
      data_deposito: createDataDeposito || proc.deposit_date || null,
      data_publicacao_rpi: createDataPubRpi || null,
    });
  };

  // ─── Real notification insert ────
  const handleGenerateReminder = async (pub: Publicacao) => {
    const proc = pub.process_id ? processMap.get(pub.process_id) : null;
    const brandName = proc?.brand_name || (pub as any).brand_name_rpi || 'Marca';
    const prazoStr = pub.proximo_prazo_critico ? format(parseISO(pub.proximo_prazo_critico), 'dd/MM/yyyy') : 'N/A';
    const user = currentUserQuery.data;
    const notifications: any[] = [];
    if (user?.id) {
      notifications.push({ user_id: user.id, title: `🔔 Prazo crítico: ${brandName}`, message: `O processo "${brandName}" tem prazo crítico em ${prazoStr}.`, type: 'warning', link: '/admin/publicacao' });
    }
    if (pub.client_id) {
      notifications.push({ user_id: pub.client_id, title: `📋 Atualização: ${brandName}`, message: `Seu processo "${brandName}" possui prazo importante em ${prazoStr}.`, type: 'info', link: '/cliente/processos' });
    }
    const alerts = getScheduledAlerts(pub.proximo_prazo_critico);
    alerts.forEach(alert => {
      if (user?.id) {
        notifications.push({ user_id: user.id, title: `⏰ Alerta ${alert.label}: ${brandName}`, message: `Prazo de "${brandName}" vence em ${prazoStr}. Alerta: ${format(alert.date, 'dd/MM/yyyy')}.`, type: 'warning', link: '/admin/publicacao' });
      }
    });
    if (notifications.length > 0) {
      const { error } = await supabase.from('notifications').insert(notifications);
      if (error) { toast.error('Erro ao gerar lembrete'); return; }
    }
    toast.success(`🔔 ${notifications.length} lembrete(s) gerado(s)`);
  };

  // ─── Upload document ────
  const handleUploadDocument = async (file: File) => {
    if (!selected) return;
    const ext = file.name.split('.').pop();
    const path = `publicacoes/${selected.id}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('documents').upload(path, file);
    if (uploadErr) { toast.error('Erro no upload'); return; }
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
    const { error: updateErr } = await supabase.from('publicacoes_marcas').update({ documento_rpi_url: urlData.publicUrl } as any).eq('id', selected.id);
    if (updateErr) { toast.error('Erro ao vincular documento'); return; }
    queryClient.invalidateQueries({ queryKey: ['publicacoes-marcas'] });
    toast.success('Documento RPI enviado');
  };

  // ─── Auto-populate from RPI ────
  const resolveStatusFromDispatch = useCallback((dispatchText: string | null): PubStatus => {
    if (!dispatchText) return '003';
    const text = dispatchText.toLowerCase();
    if (text.includes('certificado de registro') || text.includes('concessao') || text.includes('concessão') || text.includes('registro concedido')) return 'certificado';
    if (text.includes('indeferido') || text.includes('indeferimento')) return 'indeferimento';
    if (text.includes('deferido') || text.includes('deferimento')) return 'deferimento';
    if (text.includes('oposição') || text.includes('oposicao')) return 'oposicao';
    if (text.includes('exigência') || text.includes('exigencia') || text.includes('mérito') || text.includes('merito')) return 'exigencia_merito';
    if (text.includes('arquiv')) return 'arquivado';
    return '003';
  }, []);

  const handleAutoPopulateFromRPI = useCallback((entry: any) => {
    if (linkedProcessIds.has(entry.matched_process_id) || submittedRpiEntryIds.has(entry.id)) {
      toast.error('Este processo já possui uma publicação vinculada');
      return;
    }
    const proc = processMap.get(entry.matched_process_id);
    if (!proc) return;
    
    // Mark as submitted immediately to prevent duplicates
    setSubmittedRpiEntryIds(prev => new Set(prev).add(entry.id));
    
    const status = resolveStatusFromDispatch(entry.dispatch_text);
    createMutation.mutate({
      process_id: entry.matched_process_id,
      client_id: entry.matched_client_id || proc.user_id!,
      admin_id: currentUserQuery.data?.id || null,
      status,
      tipo_publicacao: 'publicacao_rpi',
      data_deposito: proc.deposit_date || null,
      data_publicacao_rpi: entry.publication_date || null,
      data_certificado: status === 'certificado' ? (entry.publication_date || null) : null,
      rpi_number: entry.dispatch_code || null,
      rpi_entry_id: entry.id,
      brand_name_rpi: entry.brand_name || null,
      process_number_rpi: entry.process_number || null,
      descricao_prazo: entry.dispatch_text || null,
    });
  }, [linkedProcessIds, submittedRpiEntryIds, processMap, resolveStatusFromDispatch, createMutation, currentUserQuery.data]);

  const availableRpiEntries = useMemo(() => {
    return rpiEntries.filter(e => e.matched_process_id && !linkedProcessIds.has(e.matched_process_id) && !submittedRpiEntryIds.has(e.id));
  }, [rpiEntries, linkedProcessIds, submittedRpiEntryIds]);

  // Kanban status change handler
  const handleKanbanStatusChange = (id: string, newStatus: PubStatus, pub: any) => {
    updateMutation.mutate({ id, changes: { status: newStatus }, original: pub });
  };

  const clearAllFilters = () => {
    setSearch(''); setFilterClient('todos'); setFilterStatus('todos'); setFilterPrazo('todos'); setFilterTipo('todos'); setFilterRpi('todos'); setFilterAdmin('todos');
    setFilterDateFrom(''); setFilterDateTo('');
  };


  // Unique RPI numbers for filter - from rpi_uploads (real RPI numbers)
  const uniqueRpiNumbers = useMemo(() => {
    const nums = new Set<string>();
    rpiUploads.forEach(u => { if (u.rpi_number) nums.add(u.rpi_number); });
    return Array.from(nums).sort((a, b) => {
      const na = parseInt(a), nb = parseInt(b);
      if (!isNaN(na) && !isNaN(nb)) return nb - na;
      return b.localeCompare(a);
    });
  }, [rpiUploads]);

  return (
    <>
      {/* ─── KPI DASHBOARD ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatsCard title="Total de Processos" value={kpiStats.total} icon={Newspaper} gradient="from-blue-500 to-cyan-500" index={0}
          isActive={activeKpi === 'total'}
          onClick={() => {
            if (activeKpi === 'total') { setActiveKpi(null); setFilterPrazo('todos'); setFilterStatus('todos'); }
            else { setActiveKpi('total'); setFilterPrazo('todos'); setFilterStatus('todos'); setViewMode('lista'); }
            setCurrentPage(1);
          }}
        />
        <StatsCard title="Prazos Urgentes (< 7d)" value={kpiStats.urgentes} icon={AlertTriangle} gradient="from-amber-500 to-orange-500" index={1}
          isActive={activeKpi === 'urgentes'}
          onClick={() => {
            if (activeKpi === 'urgentes') { setActiveKpi(null); setFilterPrazo('todos'); }
            else { setActiveKpi('urgentes'); setFilterPrazo('7dias'); setFilterStatus('todos'); setViewMode('lista'); }
            setCurrentPage(1);
          }}
        />
        <StatsCard title="Atrasados" value={kpiStats.atrasados} icon={Clock} gradient="from-red-500 to-rose-500" index={2}
          isActive={activeKpi === 'atrasados'}
          onClick={() => {
            if (activeKpi === 'atrasados') { setActiveKpi(null); setFilterPrazo('todos'); }
            else { setActiveKpi('atrasados'); setFilterPrazo('atrasados'); setFilterStatus('todos'); setViewMode('lista'); }
            setCurrentPage(1);
          }}
        />
        <StatsCard title="Deferidos este mês" value={kpiStats.deferidosMes} icon={CheckCircle2} gradient="from-emerald-500 to-green-500" index={3}
          isActive={activeKpi === 'deferidosMes'}
          onClick={() => {
            if (activeKpi === 'deferidosMes') { setActiveKpi(null); setFilterStatus('todos'); setFilterPrazo('todos'); }
            else { setActiveKpi('deferidosMes'); setFilterStatus('deferimento'); setFilterPrazo('todos'); setViewMode('lista'); }
            setCurrentPage(1);
          }}
        />
      </div>

      {/* ─── AUTO-LINK ORPHAN BANNER ─── */}
      {orphanCount > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4 p-3 rounded-xl border border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium">
                <span className="font-bold">{orphanCount}</span> publicação(ões) sem cliente vinculado
              </p>
            </div>
            <Button size="sm" variant="default" className="text-xs gap-1.5" onClick={handleAutoLinkClients} disabled={isAutoLinking}>
              {isAutoLinking ? <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> Vinculando...</> : <><Zap className="w-3 h-3" /> Auto-vincular</>}
            </Button>
          </div>
        </motion.div>
      )}

      {/* ─── CHARTS (#2) ─── */}
      <PublicacaoCharts publicacoes={publicacoes} />

      {/* Auto-sync is fully automatic — no manual banner needed */}

      {/* ─── Bulk Actions Bar (#4) ─── */}
      <AnimatePresence>
        <BulkActionsBar
          selectedCount={selectedIds.size}
          onClearSelection={() => setSelectedIds(new Set())}
          onBulkStatusChange={handleBulkStatusChange}
          onBulkReminder={handleBulkReminder}
          onBulkExport={handleBulkExport}
        />
      </AnimatePresence>

      <div className="flex flex-col lg:flex-row gap-4 flex-1">
        {/* ─── FILTERS SHEET ─── */}
        <Sheet open={showFilters} onOpenChange={setShowFilters}>
          <SheetContent side="left" className="w-80 sm:w-96">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 text-sm">
                <Filter className="w-4 h-4 text-primary" /> Filtros
              </SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar marca, processo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Cliente</Label>
                <Select value={filterClient} onValueChange={setFilterClient}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os clientes</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name || c.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos ({publicacoes.filter(p => !!p.client_id).length})</SelectItem>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label} ({statusCounts[k] || 0})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Prazo Crítico</Label>
                <Select value={filterPrazo} onValueChange={v => setFilterPrazo(v as PrazoFilter)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="hoje">Vence hoje</SelectItem>
                    <SelectItem value="7dias">Próximos 7 dias</SelectItem>
                    <SelectItem value="30dias">Próximos 30 dias</SelectItem>
                    <SelectItem value="atrasados">Atrasados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select value={filterTipo} onValueChange={setFilterTipo}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {Object.entries(TIPO_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Revista (RPI)</Label>
                <Select value={filterRpi} onValueChange={setFilterRpi}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as revistas</SelectItem>
                    {uniqueRpiNumbers.map(rpi => (
                      <SelectItem key={rpi} value={rpi}>RPI {rpi}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Responsável</Label>
                <Select value={filterAdmin} onValueChange={setFilterAdmin}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os responsáveis</SelectItem>
                    {admins.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Período
                </Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="h-8 text-xs" />
                  <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
              <Separator />
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { clearAllFilters(); setShowFilters(false); }}>
                <RotateCcw className="w-3 h-3 mr-1" /> Limpar Filtros
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="text-xs" onClick={exportCSV} disabled={filtered.length === 0}>
                  <Download className="w-3 h-3 mr-1" /> CSV
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={exportPDF} disabled={filtered.length === 0}>
                  <FileDown className="w-3 h-3 mr-1" /> PDF
                </Button>
              </div>
              <Button size="sm" className="w-full text-xs" onClick={() => { resetCreateForm(); setShowCreate(true); setShowFilters(false); }}>
                <Plus className="w-3 h-3 mr-1" /> Nova Publicação
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* ─── LISTA / KANBAN ─── */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Header bar */}
          <div className="flex items-center justify-between px-1 mb-3">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setShowFilters(true)}>
                <Filter className="w-3.5 h-3.5" />
                Filtros
                {(filterClient !== 'todos' || filterStatus !== 'todos' || filterPrazo !== 'todos' || filterTipo !== 'todos' || filterRpi !== 'todos' || filterAdmin !== 'todos' || search || filterDateFrom || filterDateTo) && (
                  <Badge variant="default" className="h-4 w-4 p-0 text-[9px] rounded-full flex items-center justify-center ml-0.5">
                    !
                  </Badge>
                )}
              </Button>
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Newspaper className="w-4 h-4 text-primary" />
                Publicações
                <Badge variant="secondary" className="text-xs">{filtered.length}</Badge>
              </div>
              {/* Search autocomplete */}
              <div className="relative">
                <div className="flex items-center">
                  <Search className="absolute left-2 w-3.5 h-3.5 text-muted-foreground z-10" />
                  <Input
                    className="h-8 w-48 pl-7 text-xs"
                    placeholder="Buscar cliente, marca..."
                    value={searchAutocomplete}
                    onChange={e => { setSearchAutocomplete(e.target.value); setShowSearchDropdown(true); }}
                    onFocus={() => { if (searchAutocomplete.length >= 2) setShowSearchDropdown(true); }}
                    onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                  />
                  {(searchAutocomplete || filterClient !== 'todos') && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 ml-1" onClick={() => { setSearchAutocomplete(''); setFilterClient('todos'); setSearch(''); setShowSearchDropdown(false); }}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                {showSearchDropdown && searchAutocomplete.length >= 2 && (
                  <div className="absolute z-50 w-72 mt-1 bg-popover border rounded-md shadow-lg max-h-56 overflow-y-auto">
                    {(() => {
                      const q = searchAutocomplete.toLowerCase();
                      const matchedClients = clients.filter(c => (c.full_name?.toLowerCase().includes(q)) || (c.email?.toLowerCase().includes(q))).slice(0, 6);
                      const matchedProcs = processes.filter(p => (p.brand_name?.toLowerCase().includes(q)) || (p.process_number?.toLowerCase().includes(q))).slice(0, 6);
                      if (matchedClients.length === 0 && matchedProcs.length === 0) return <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum resultado</p>;
                      return (
                        <>
                          {matchedClients.length > 0 && (
                            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">Clientes</div>
                          )}
                          {matchedClients.map(c => (
                            <button key={c.id} className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors" onClick={() => { setFilterClient(c.id); setSearchAutocomplete(c.full_name || c.email); setShowSearchDropdown(false); }}>
                              <p className="text-xs font-medium">{c.full_name || 'Sem nome'}</p>
                              <p className="text-[10px] text-muted-foreground">{c.email}</p>
                            </button>
                          ))}
                          {matchedProcs.length > 0 && (
                            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase border-t">Processos/Marcas</div>
                          )}
                          {matchedProcs.map(p => (
                            <button key={p.id} className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors" onClick={() => { setSearch(p.brand_name || p.process_number || ''); setSearchAutocomplete(p.brand_name || p.process_number || ''); setShowSearchDropdown(false); }}>
                              <p className="text-xs font-medium">{p.brand_name}</p>
                              {p.process_number && <p className="text-[10px] text-muted-foreground font-mono">{p.process_number}</p>}
                            </button>
                          ))}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => { resetCreateForm(); setShowCreate(true); }}>
                <Plus className="w-3.5 h-3.5" /> Nova
              </Button>
              <div className="flex border rounded-md overflow-hidden">
                <Button variant={viewMode === 'lista' ? 'default' : 'ghost'} size="sm" className="h-8 px-2.5 rounded-none" onClick={() => setViewMode('lista')}>
                  <List className="w-3.5 h-3.5" />
                </Button>
                <Button variant={viewMode === 'kanban' ? 'default' : 'ghost'} size="sm" className="h-8 px-2.5 rounded-none" onClick={() => setViewMode('kanban')}>
                  <LayoutGrid className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Newspaper className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">Nenhuma publicação encontrada</p>
            </div>
          ) : viewMode === 'kanban' ? (
            <PublicacaoKanban
              publicacoes={filtered as any}
              processMap={processMap}
              clientMap={clientMap}
              adminMap={adminMap}
              onSelect={id => {
                const pub = publicacoes.find(p => p.id === id);
                if (pub?.client_id) {
                  setSheetPubId(id);
                  fetchClientForSheet(pub.client_id).then(() => {
                    setShowClientSheet(true);
                    setShowProcessDetailFromSheet(true);
                  });
                }
              }}
              selectedId={sheetPubId}
              onStatusChange={handleKanbanStatusChange}
              resolveRpiNumber={resolveRpiNumber}
            />
          ) : (
            <Card className="border">
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-520px)]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {/* Bulk checkbox (#4) */}
                        <TableHead className="w-8">
                          <Checkbox
                            checked={paginatedData.length > 0 && selectedIds.size === paginatedData.length}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        {(['marca', 'cliente', 'status', 'data_pub', 'prazo'] as SortKey[]).map(key => {
                          const labels: Record<SortKey, string> = { marca: 'Marca', cliente: 'Cliente', status: 'Status', data_pub: 'Publicação', prazo: 'Prazo' };
                          return (
                            <TableHead key={key} className="cursor-pointer select-none text-xs" onClick={() => handleSort(key)}>
                              <div className="flex items-center gap-1">
                                {labels[key]}
                                {sortKey === key ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                              </div>
                            </TableHead>
                          );
                        })}
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.map(pub => {
                        const proc = pub.process_id ? processMap.get(pub.process_id) : null;
                        const client = pub.client_id ? clientMap.get(pub.client_id) : null;
                        const days = pub.proximo_prazo_critico ? differenceInDays(parseISO(pub.proximo_prazo_critico), new Date()) : null;
                        const brandName = proc?.brand_name || pub.brand_name_rpi || '—';
                        const processNumber = proc?.process_number || pub.process_number_rpi || null;
                        return (
                          <TableRow
                            key={pub.id}
                            className={cn('cursor-pointer', sheetPubId === pub.id && 'bg-accent')}
                            onClick={() => {
                              if (pub.client_id) {
                                setSheetPubId(pub.id);
                                fetchClientForSheet(pub.client_id).then(() => {
                                  setShowClientSheet(true);
                                  setShowProcessDetailFromSheet(true);
                                });
                              }
                            }}
                          >
                            <TableCell onClick={e => e.stopPropagation()}>
                              <Checkbox checked={selectedIds.has(pub.id)} onCheckedChange={() => toggleSelect(pub.id)} />
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-xs font-bold">{brandName}</p>
                                <div className="flex items-center gap-1.5">
                                  {processNumber && <span className="text-[10px] text-muted-foreground">{processNumber}</span>}
                                  {(() => {
                                    const nclClass = (pub as any).ncl_class || proc?.ncl_classes?.join(', ') || null;
                                    return nclClass ? <span className="text-[9px] text-primary/70 font-medium">NCL {nclClass}</span> : null;
                                  })()}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              {client?.full_name || <span className="text-amber-600 dark:text-amber-400 text-[10px]">Sem cliente</span>}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn('text-[10px]', STATUS_CONFIG[pub.status]?.bg, STATUS_CONFIG[pub.status]?.color)}>
                                {STATUS_CONFIG[pub.status]?.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[10px] text-muted-foreground">
                              {pub.data_publicacao_rpi ? format(parseISO(pub.data_publicacao_rpi), 'dd/MM/yy') : '—'}
                            </TableCell>
                            <TableCell>
                              {days !== null ? (
                                <span className={cn('text-[10px] font-semibold', days < 0 ? 'text-red-600' : days <= 7 ? 'text-amber-600' : 'text-muted-foreground')}>
                                  {days < 0 ? `${Math.abs(days)}d atrasado` : `${days}d`}
                                </span>
                              ) : '—'}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <Eye className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2 border-t">
                    <span className="text-[10px] text-muted-foreground">{filtered.length} processos</span>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-7 px-2" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                        <ChevronLeft className="w-3 h-3" />
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, currentPage - 3), currentPage + 2).map(page => {
                        return (
                          <Button key={page} variant={currentPage === page ? 'default' : 'outline'} size="sm" className="h-7 w-7 px-0 text-[10px]" onClick={() => setCurrentPage(page)}>
                            {page}
                          </Button>
                        );
                      })}
                      <Button variant="outline" size="sm" className="h-7 px-2" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                        <ChevronRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Painel lateral removido — clique no card abre o ficheiro do cliente (ClientDetailSheet) */}
      </div>

      {/* ─── CREATE DIALOG ─── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Publicação</DialogTitle>
            <DialogDescription>Vincule um processo existente e preencha os dados iniciais.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Processo (marca)</Label>
              <Select value={createProcessId} onValueChange={setCreateProcessId}>
                <SelectTrigger><SelectValue placeholder="Selecione um processo" /></SelectTrigger>
                <SelectContent>
                  {processes.filter(p => !linkedProcessIds.has(p.id)).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.brand_name} {p.process_number ? `(${p.process_number})` : ''} — {clientMap.get(p.user_id!)?.full_name || 'Sem cliente'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Data de Depósito</Label>
              <Input type="date" value={createDataDeposito} onChange={e => setCreateDataDeposito(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Data Publicação RPI (opcional)</Label>
              <Input type="date" value={createDataPubRpi} onChange={e => setCreateDataPubRpi(e.target.value)} className="h-9" />
              {createDataPubRpi && (
                <p className="text-[10px] text-muted-foreground mt-1">Prazo oposição auto: {format(addDays(parseISO(createDataPubRpi), 60), 'dd/MM/yyyy')}</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Tipo de Publicação</Label>
              <Select value={createTipo} onValueChange={v => setCreateTipo(v as PubTipo)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Admin Responsável</Label>
              <Select value={createAdminId} onValueChange={setCreateAdminId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                <SelectContent>
                  {admins.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!createProcessId || createMutation.isPending}>
              {createMutation.isPending ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── EDIT DIALOG ─── */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Publicação</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3 pr-4">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={editData.status || ''} onValueChange={v => setEditData(d => ({ ...d, status: v as PubStatus }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tipo de Publicação</Label>
                <Select value={editData.tipo_publicacao || ''} onValueChange={v => setEditData(d => ({ ...d, tipo_publicacao: v as PubTipo }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Manual client assignment with autocomplete */}
              <div>
                <Label className="text-xs">Cliente (vincular manualmente)</Label>
                <div className="relative">
                  <div className="flex items-center gap-1">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        className="h-9 pl-7 text-sm"
                        placeholder="Buscar por nome, email ou CPF..."
                        value={editClientSearch}
                        onChange={e => setEditClientSearch(e.target.value)}
                        onFocus={() => setShowEditClientDropdown(true)}
                      />
                    </div>
                    {editData.client_id && (
                      <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => { setEditData(d => ({ ...d, client_id: null })); setEditClientSearch(''); }}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  {editData.client_id && !editClientSearch && (
                    <p className="text-[10px] text-primary mt-1 font-medium">
                      ✓ {clientMap.get(editData.client_id)?.full_name || clientMap.get(editData.client_id)?.email || editData.client_id}
                    </p>
                  )}
                  {showEditClientDropdown && editClientSearch.length >= 2 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {clients
                        .filter(c => {
                          const q = editClientSearch.toLowerCase();
                          return (c.full_name?.toLowerCase().includes(q)) || (c.email?.toLowerCase().includes(q)) || ((c as any).cpf_cnpj?.toLowerCase().includes(q));
                        })
                        .slice(0, 10)
                        .map(c => (
                          <button
                            key={c.id}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors border-b last:border-0"
                            onClick={() => {
                              setEditData(d => ({ ...d, client_id: c.id }));
                              setEditClientSearch('');
                              setShowEditClientDropdown(false);
                            }}
                          >
                            <p className="font-medium text-xs">{c.full_name || 'Sem nome'}</p>
                            <p className="text-[10px] text-muted-foreground">{c.email}</p>
                          </button>
                        ))
                      }
                      {clients.filter(c => {
                        const q = editClientSearch.toLowerCase();
                        return (c.full_name?.toLowerCase().includes(q)) || (c.email?.toLowerCase().includes(q));
                      }).length === 0 && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum cliente encontrado</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {/* Manual process assignment */}
              <div>
                <Label className="text-xs">Processo (vincular manualmente)</Label>
                <Select value={editData.process_id || ''} onValueChange={v => setEditData(d => ({ ...d, process_id: v || null }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione um processo" /></SelectTrigger>
                  <SelectContent>
                    {processes.map(p => <SelectItem key={p.id} value={p.id}>{p.brand_name} {p.process_number ? `(${p.process_number})` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Admin Responsável</Label>
                <Select value={editData.admin_id || ''} onValueChange={v => setEditData(d => ({ ...d, admin_id: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {admins.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Data Publicação RPI</Label>
                <Input type="date" value={editData.data_publicacao_rpi || ''} onChange={e => setEditData(d => ({ ...d, data_publicacao_rpi: e.target.value || null }))} className="h-9" />
                {editData.data_publicacao_rpi && (
                  <p className="text-[10px] text-muted-foreground mt-1">Prazo oposição auto: {format(addDays(parseISO(editData.data_publicacao_rpi), 60), 'dd/MM/yyyy')}</p>
                )}
              </div>
              <div>
                <Label className="text-xs">Data Decisão</Label>
                <Input type="date" value={editData.data_decisao || ''} onChange={e => setEditData(d => ({ ...d, data_decisao: e.target.value || null }))} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Data Certificado</Label>
                <Input type="date" value={editData.data_certificado || ''} onChange={e => setEditData(d => ({ ...d, data_certificado: e.target.value || null }))} className="h-9" />
                {editData.data_certificado && (
                  <p className="text-[10px] text-muted-foreground mt-1">Renovação ordinária: {format(addYears(parseISO(editData.data_certificado), 9), 'dd/MM/yyyy')} (9 anos + 6m ord. + 6m extra)</p>
                )}
              </div>
              <div>
                <Label className="text-xs">Próximo Prazo Crítico</Label>
                <Input type="date" value={editData.proximo_prazo_critico || ''} onChange={e => setEditData(d => ({ ...d, proximo_prazo_critico: e.target.value || null }))} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Descrição do Prazo</Label>
                <Input value={editData.descricao_prazo || ''} onChange={e => setEditData(d => ({ ...d, descricao_prazo: e.target.value }))} className="h-9" placeholder="Ex.: Prazo de oposição" />
              </div>
              <div>
                <Label className="text-xs">N° RPI</Label>
                <Input value={editData.rpi_number || ''} onChange={e => setEditData(d => ({ ...d, rpi_number: e.target.value }))} className="h-9" placeholder="Ex.: 2800" />
              </div>
              <div>
                <Label className="text-xs">Link RPI Oficial</Label>
                <Input value={editData.rpi_link || ''} onChange={e => setEditData(d => ({ ...d, rpi_link: e.target.value }))} className="h-9" placeholder="https://..." />
              </div>
              <div>
                <Label className="text-xs">Comentários Internos</Label>
                <Textarea value={editData.comentarios_internos || ''} onChange={e => setEditData(d => ({ ...d, comentarios_internos: e.target.value }))} rows={3} className="text-sm" />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (!selected) return;
              updateMutation.mutate({ id: selected.id, changes: editData, original: selected });
            }} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DELETE CONFIRMATION ─── */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Publicação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta publicação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => selected && deleteMutation.mutate(selected.id)}
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* ─── CLIENT DETAIL SHEET (from Kanban click) ─── */}
      {showClientSheet && fetchedClientForSheet && (
        <ClientDetailSheet
          client={fetchedClientForSheet}
          open={showClientSheet}
          onOpenChange={(open) => { setShowClientSheet(open); if (!open) { setShowProcessDetailFromSheet(false); setSheetPubId(null); setFetchedClientForSheet(null); setClientAssignSearch(''); setShowClientAssignDropdown(false); } }}
          onUpdate={() => queryClient.invalidateQueries({ queryKey: ['profiles-pub'] })}
          initialShowProcessDetails={showProcessDetailFromSheet}
          focusProcessId={sheetPub?.process_id || undefined}
          extraActions={
            sheetPub ? (
              <div className="relative w-full mt-2" ref={clientAssignRef}>
                {sheetPub.client_id && clientMap.get(sheetPub.client_id) ? (() => {
                  const cl = clientMap.get(sheetPub.client_id)!;
                  return (
                    <div className="px-3 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-emerald-300 truncate">{cl.full_name}</p>
                          <p className="text-[10px] text-emerald-400/60 truncate">{cl.email}</p>
                        </div>
                        <button
                          onClick={() => assignClientMutation.mutate({ pubId: sheetPub.id, clientId: null, oldClientId: sheetPub.client_id, processId: sheetPub.process_id })}
                          className="p-1 rounded hover:bg-red-500/20 text-emerald-400/60 hover:text-red-400 transition-colors"
                          title="Desvincular cliente"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-emerald-300/80">
                        {cl.phone && (
                          <div><span className="text-emerald-400/50">Tel:</span> {cl.phone}</div>
                        )}
                        {cl.cpf_cnpj && (
                          <div><span className="text-emerald-400/50">CPF/CNPJ:</span> {cl.cpf_cnpj}</div>
                        )}
                        {cl.company_name && (
                          <div className="col-span-2"><span className="text-emerald-400/50">Empresa:</span> {cl.company_name}</div>
                        )}
                        {cl.origin && (
                          <div><span className="text-emerald-400/50">Origem:</span> {cl.origin}</div>
                        )}
                        {cl.contract_value != null && Number(cl.contract_value) > 0 && (
                          <div><span className="text-emerald-400/50">Valor:</span> R$ {Number(cl.contract_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        )}
                      </div>
                    </div>
                  );
                })() : (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-3 h-3 text-white/50" />
                      <span className="text-[10px] text-white/50 font-semibold uppercase tracking-wider">Vincular Cliente</span>
                    </div>
                    <div className="relative" ref={clientAssignRef}>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          placeholder="Buscar por nome, email ou CPF/CNPJ..."
                          value={clientAssignSearch}
                          onChange={e => {
                            setClientAssignSearch(e.target.value);
                            setShowClientAssignDropdown(e.target.value.length >= 2);
                          }}
                          onFocus={() => { if (clientAssignSearch.length >= 2) setShowClientAssignDropdown(true); }}
                          className="h-8 text-xs pl-8 bg-white/10 border-white/20 text-white placeholder:text-white/40"
                        />
                      </div>
                      {showClientAssignDropdown && clientAssignSearch.length >= 2 && (
                        <div className="fixed z-[9999] w-80 bg-popover border border-border rounded-lg shadow-xl max-h-52 overflow-y-auto"
                          style={{
                            top: clientAssignRef.current ? clientAssignRef.current.getBoundingClientRect().bottom + 4 : 0,
                            left: clientAssignRef.current ? clientAssignRef.current.getBoundingClientRect().left : 0,
                          }}
                        >
                          {(() => {
                            const q = clientAssignSearch.toLowerCase();
                            const matches = clients.filter(c =>
                              (c.full_name?.toLowerCase().includes(q)) ||
                              (c.email?.toLowerCase().includes(q)) ||
                              (c.cpf_cnpj?.replace(/\D/g, '').includes(q.replace(/\D/g, '')))
                            ).slice(0, 12);
                            if (matches.length === 0) return <p className="text-xs text-muted-foreground p-3 text-center">Nenhum cliente encontrado</p>;
                            return matches.map(c => (
                              <button
                                key={c.id}
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => {
                                  assignClientMutation.mutate({ pubId: sheetPub.id, clientId: c.id, oldClientId: sheetPub.client_id, processId: sheetPub.process_id });
                                  setShowClientAssignDropdown(false);
                                  setClientAssignSearch('');
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b border-border/50 last:border-0"
                              >
                                <p className="text-xs font-medium truncate">{c.full_name}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{c.email}{c.cpf_cnpj ? ` · ${c.cpf_cnpj}` : ''}</p>
                              </button>
                            ));
                          })()}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : undefined
          }
        />
      )}

      {/* ─── INVOICE DIALOG (from process details panel) ─── */}
      {selected?.client_id && (
        <CreateInvoiceDialog
          open={showInvoiceFromPub}
          onOpenChange={setShowInvoiceFromPub}
          clientId={selected.client_id}
          clientName={clientMap.get(selected.client_id)?.full_name || clientMap.get(selected.client_id)?.email || 'Cliente'}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ['publicacoes-marcas'] })}
        />
      )}
    </>
  );
}
