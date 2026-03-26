import { useState, useEffect, useMemo, useRef, type WheelEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  User, Phone, Mail, Building2, DollarSign, Clock, Star,
  FileText, CreditCard, MessageSquare, Calendar as CalendarIcon, Paperclip,
  Upload, Loader2, ExternalLink, Plus, Edit, X, Check,
  MessageCircle, ArrowUpRight, Tag, Zap, AlertTriangle,
  CheckCircle, TrendingUp, Receipt, Trash2, UserCheck,
  Bell, Send, MapPin, Hash, Globe, Briefcase, Shield,
  ChevronRight, Activity, RefreshCw, Eye, Copy, Edit2,
  Package, BarChart3, Wallet, FileCheck, Lock, Video
} from 'lucide-react';
import type { ClientWithProcess } from './ClientKanbanBoard';
import { PIPELINE_STAGES, COMMERCIAL_PIPELINE_STAGES } from './ClientKanbanBoard';
import { normalizePipelineStageId, sanitizePipelineStagesConfig } from '@/lib/pipelineStage';
import { ServiceActionPanel } from './ServiceActionPanel';
import { usePricing } from '@/hooks/usePricing';
import { EmailCompose } from '@/components/admin/email/EmailCompose';
import { CreateInvoiceDialog } from './CreateInvoiceDialog';
import { Separator } from '@/components/ui/separator';
import { Newspaper, Gavel, Award, BellRing, Activity as ActivityIcon } from 'lucide-react';

const MASTER_ADMIN_EMAIL = 'davillys@gmail.com';

interface ClientDetailSheetProps {
  client: ClientWithProcess | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
  extraActions?: React.ReactNode;
  initialShowProcessDetails?: boolean;
  focusProcessId?: string;
}

interface ClientNote { id: string; content: string; created_at: string; }
interface ClientAppointment { id: string; title: string; description: string | null; scheduled_at: string; completed: boolean; google_meet_link?: string | null; google_event_id?: string | null; }
interface ClientDocument { id: string; name: string; file_url: string; created_at: string; file_size?: number | null; mime_type?: string | null; }
interface ClientInvoice { id: string; description: string; amount: number; status: string; due_date: string; payment_method?: string | null; pix_code?: string | null; }

const useServicePricingOptions = () => {
  const { pricing } = usePricing();
  return useMemo(() => [
    { id: 'registro_avista', label: 'Registro de Marca – À Vista', value: Math.round(pricing.avista.value), description: 'Pagamento único via PIX', details: `R$ ${pricing.avista.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} à vista` },
    { id: 'registro_boleto', label: 'Registro de Marca – Boleto', value: pricing.boleto.value, description: `${pricing.boleto.installments}x de R$ ${pricing.boleto.installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, details: `${pricing.boleto.installments}x R$ ${pricing.boleto.installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (boleto)` },
    { id: 'registro_cartao', label: 'Registro de Marca – Cartão', value: pricing.cartao.value, description: `${pricing.cartao.installments}x de R$ ${pricing.cartao.installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, details: `${pricing.cartao.installments}x R$ ${pricing.cartao.installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (cartão)` },
    { id: 'exigencia_avista', label: 'Exigência/Publicação – À Vista', value: 1412, description: '1 Salário Mínimo', details: 'R$ 1.412,00 à vista (1 SM)' },
    { id: 'exigencia_parcelado', label: 'Exigência/Publicação – Parcelado', value: 2388, description: '6x de R$ 398,00', details: '6x R$ 398,00 (boleto ou cartão)' },
    { id: 'personalizado', label: 'Valor Personalizado', value: 0, description: 'Definir valor manualmente', details: 'Informe o valor e motivo' },
  ], [pricing]);
};

// Legacy SERVICE_TYPES kept as fallback for orphan detection
const LEGACY_SERVICE_TYPES = [
  { id: 'pedido_registro', label: 'Pedido de Registro', description: 'Solicitação inicial junto ao INPI', stage: 'protocolado', icon: FileText },
  { id: 'cumprimento_exigencia', label: 'Cumprimento de Exigência', description: 'Resposta a exigência formal do INPI', stage: '003', icon: FileCheck },
  { id: 'oposicao', label: 'Manifestação de Oposição', description: 'Defesa contra oposição de terceiros', stage: 'oposicao', icon: Shield },
  { id: 'exigencia_merito', label: 'Exigência de Mérito', description: 'Exigência de mérito emitida pelo INPI', stage: 'exigencia_merito', icon: FileCheck },
  { id: 'recurso', label: 'Recurso Administrativo', description: 'Recurso contra indeferimento do INPI', stage: 'indeferimento', icon: TrendingUp },
  { id: 'renovacao', label: 'Renovação de Marca', description: 'Renovação do registro decenal', stage: 'renovacao', icon: RefreshCw },
  { id: 'notificacao', label: 'Notificação Extrajudicial', description: 'Cessação de uso indevido', stage: 'notificacao', icon: Bell },
  { id: 'deferimento', label: 'Deferimento', description: 'Pedido aprovado, aguardando concessão', stage: 'deferimento', icon: CheckCircle },
  { id: 'certificado', label: 'Certificado', description: 'Marca registrada e certificada', stage: 'certificados', icon: Star },
  { id: 'distrato', label: 'Distrato', description: 'Serviço cancelado ou encerrado', stage: 'distrato', icon: X },
];

const SERVICE_TYPE_TO_STAGE: Record<string, string> = {};
const STAGE_TO_SERVICE_TYPE: Record<string, string> = {};
LEGACY_SERVICE_TYPES.forEach(s => { SERVICE_TYPE_TO_STAGE[s.id] = s.stage; STAGE_TO_SERVICE_TYPE[s.stage] = s.id; });

const AVAILABLE_TAGS = ['VIP', 'Urgente', 'Novo', 'Renovação', 'Em Risco', 'Inativo', 'Prioritário', 'Pendente'];

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  high:   { label: 'Alta',  color: 'bg-red-500/15 text-red-400 border-red-500/30',    dot: 'bg-red-400' },
  medium: { label: 'Média', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  low:    { label: 'Baixa', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
};

// ─── Empty State ─────────────────────────────────────────────────────────────
function EmptyState({ icon: Icon, title, description, action }: { icon: any; title: string; description: string; action?: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-14 gap-3">
      <div className="w-16 h-16 rounded-2xl bg-muted/50 border border-border flex items-center justify-center relative">
        <Icon className="h-7 w-7 text-muted-foreground/40" />
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Plus className="h-3 w-3 text-primary/60" />
        </div>
      </div>
      <div className="text-center">
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-[200px]">{description}</p>
      </div>
      {action}
    </motion.div>
  );
}

// ─── Info Row ────────────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value, mono, copyable, link, onAction }: { icon: any; label: string; value?: string | null; mono?: boolean; copyable?: boolean; link?: string; onAction?: () => void }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0 group">
      <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
        <p className={cn('text-sm font-medium truncate', mono && 'font-mono')}>{value}</p>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {copyable && (
          <button className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center" onClick={() => { navigator.clipboard.writeText(value); toast.success('Copiado!'); }}>
            <Copy className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
        {onAction ? (
          <button className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center" onClick={onAction}>
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </button>
        ) : link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center">
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

// ─── File icon helper ─────────────────────────────────────────────────────────
function DocIcon({ mime }: { mime?: string | null }) {
  if (mime?.startsWith('image/')) return <Eye className="h-4 w-4 text-blue-400" />;
  if (mime?.includes('pdf')) return <FileText className="h-4 w-4 text-red-400" />;
  return <Paperclip className="h-4 w-4 text-muted-foreground" />;
}

function fmtBytes(b?: number | null) {
  if (!b) return '';
  if (b < 1024) return `${b}B`;
  if (b < 1048576) return `${(b/1024).toFixed(1)}KB`;
  return `${(b/1048576).toFixed(1)}MB`;
}

export function ClientDetailSheet({ client: clientProp, open, onOpenChange, onUpdate, extraActions, initialShowProcessDetails, focusProcessId }: ClientDetailSheetProps) {
  const SERVICE_PRICING_OPTIONS = useServicePricingOptions();

  // If focusProcessId is provided and client has brands, override process_id/brand_name/pipeline_stage
  const client = useMemo(() => {
    if (!clientProp) return null;
    if (!focusProcessId || focusProcessId === clientProp.process_id) return clientProp;
    const targetBrand = clientProp.brands?.find(b => b.id === focusProcessId);
    if (!targetBrand) return clientProp;
    return {
      ...clientProp,
      process_id: targetBrand.id,
      brand_name: targetBrand.brand_name,
      pipeline_stage: targetBrand.pipeline_stage || clientProp.pipeline_stage,
      process_number: targetBrand.process_number || clientProp.process_number,
    };
  }, [clientProp, focusProcessId]);

  // Data
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [appointments, setAppointments] = useState<ClientAppointment[]>([]);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [profileData, setProfileData] = useState<any>(null);
  const [clientBrands, setClientBrands] = useState<any[]>([]);
  const [expandedBrandId, setExpandedBrandId] = useState<string | null>(null);
  const [editingBrandData, setEditingBrandData] = useState<any>({});
  const [savingBrand, setSavingBrand] = useState(false);
  const [deletingBrandId, setDeletingBrandId] = useState<string | null>(null);
  const [adminUsersList, setAdminUsersList] = useState<{ id: string; full_name: string | null; email: string }[]>([]);
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [adminEmailAccount, setAdminEmailAccount] = useState<{ id: string; email_address: string } | null>(null);

  // Inline contact editor states
  const [editingContacts, setEditingContacts] = useState(false);
  const [contactForm, setContactForm] = useState<any>({});
  const [savingContacts, setSavingContacts] = useState(false);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState('overview');
  const [newNote, setNewNote] = useState('');
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showTagsDialog, setShowTagsDialog] = useState(false);
  const [showAddProcessDialog, setShowAddProcessDialog] = useState(false);
  const [selectedServiceBrandId, setSelectedServiceBrandId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [showProcessDetails, setShowProcessDetails] = useState(false);
  const [showNewInvoiceDialog, setShowNewInvoiceDialog] = useState(false);
  const [processPublicacoes, setProcessPublicacoes] = useState<any[]>([]);
  const [processLogs, setProcessLogs] = useState<any[]>([]);
  const [processContracts, setProcessContracts] = useState<any[]>([]);
  const [processInvoices, setProcessInvoices] = useState<any[]>([]);
  const [processEvents, setProcessEvents] = useState<any[]>([]);
  const [processActivities, setProcessActivities] = useState<any[]>([]);
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  // Publication action states
  const [editingPubData, setEditingPubData] = useState<any>(null);
  const [showEditPubDialog, setShowEditPubDialog] = useState(false);
  const [deletingPubId, setDeletingPubId] = useState<string | null>(null);
  const [showDeletePubConfirm, setShowDeletePubConfirm] = useState(false);
  const [savingPub, setSavingPub] = useState(false);
  const [uploadingRpi, setUploadingRpi] = useState<string | null>(null);
  const rpiFileInputRef = useRef<HTMLInputElement>(null);
  const [rpiUploadPubId, setRpiUploadPubId] = useState<string | null>(null);

  // Scheduling dialog state (for pub "Agenda" button)
  const [schedulingPub, setSchedulingPub] = useState<any | null>(null);
  const [schedulingForm, setSchedulingForm] = useState({ title: '', description: '', date: new Date(), time: '10:00', duration: '30', generateMeet: true });
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Link client states (for orphan publications)
  const [linkClientSearch, setLinkClientSearch] = useState('');
  const [linkClientResults, setLinkClientResults] = useState<any[]>([]);
  const [linkingClient, setLinkingClient] = useState(false);
  const [linkSearchLoading, setLinkSearchLoading] = useState(false);

  // Debounced search for linking client
  useEffect(() => {
    if (linkClientSearch.length < 2) { setLinkClientResults([]); setLinkSearchLoading(false); return; }
    setLinkSearchLoading(true);
    const timer = setTimeout(async () => {
      const term = `%${linkClientSearch}%`;
      const { data } = await supabase.from('profiles').select('id, full_name, email, cpf_cnpj, company_name, phone')
        .or(`full_name.ilike.${term},email.ilike.${term},cpf_cnpj.ilike.${term}`)
        .limit(10);
      setLinkClientResults(data || []);
      setLinkSearchLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [linkClientSearch]);

  const handleLinkClient = async (profileId: string) => {
    if (!client) return;
    setLinkingClient(true);
    try {
      if (client.process_id) {
        await supabase.from('publicacoes_marcas').update({ client_id: profileId }).eq('process_id', client.process_id);
        await supabase.from('brand_processes').update({ user_id: profileId }).eq('id', client.process_id);
      } else if (client.publicacao_id) {
        // No process linked — just update the publication's client_id
        await supabase.from('publicacoes_marcas').update({ client_id: profileId }).eq('id', client.publicacao_id);
      }
      toast.success('Cliente vinculado com sucesso!');
      onUpdate();
      onOpenChange(false);
    } catch (e) {
      toast.error('Erro ao vincular cliente');
    } finally {
      setLinkingClient(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newAppointment, setNewAppointment] = useState({ title: '', description: '', date: new Date(), time: '10:00', duration: '30', generateMeet: true });
  const [selectedPricing, setSelectedPricing] = useState('');
  const [customValue, setCustomValue] = useState(0);
  const [customValueReason, setCustomValueReason] = useState('');
  const [notificationTemplates, setNotificationTemplates] = useState<any[]>([]);
  const [notificationForm, setNotificationForm] = useState({ title: '', message: '', type: 'info', link: '/cliente/processos' });
  const [clientTags, setClientTags] = useState<string[]>([]);
  const [selectedServiceType, setSelectedServiceType] = useState('pedido_registro');
  const [dynamicServiceStages, setDynamicServiceStages] = useState<any[] | null>(null);
  const [expandedStageAction, setExpandedStageAction] = useState<string | null>(null);
  const [sentStagesMap, setSentStagesMap] = useState<Record<string, { sent_at: string; description: string }>>({});

  const [editData, setEditData] = useState({ priority: '', origin: '', contract_value: 0, pipeline_stage: '' });
  const [editFormData, setEditFormData] = useState({
    full_name: '', email: '', phone: '', cpf: '', cnpj: '', company_name: '',
    address: '', neighborhood: '', city: '', state: '', zip_code: '',
    priority: 'medium', origin: 'site', brand_name: '', business_area: '', assigned_to: '',
  });
  const [newProcess, setNewProcess] = useState({ brand_name: '', process_number: '', pipeline_stage: 'protocolado', business_area: '' });

  useEffect(() => {
    if (client && open) {
      fetchClientData();
      setShowProcessDetails(false);
      setActiveTab('overview');
      setSelectedServiceBrandId(client.process_id || null);
      setEditData({ priority: client.priority || 'medium', origin: client.origin || 'site', contract_value: client.contract_value || 0, pipeline_stage: client.pipeline_stage || 'protocolado' });
      setSelectedServiceType(client.pipeline_stage || 'protocolado');
      setEditFormData({
        full_name: client.full_name || '', email: client.email || '', phone: client.phone || '',
        cpf: '', cnpj: '', company_name: client.company_name || '',
        address: '', neighborhood: '', city: '', state: '', zip_code: '',
        priority: client.priority || 'medium', origin: client.origin || 'site',
        brand_name: client.brand_name || '', business_area: client.business_area || '', assigned_to: client.assigned_to || '',
      });
      const matchedOption = SERVICE_PRICING_OPTIONS.find(opt => opt.value === client.contract_value);
      if (matchedOption) setSelectedPricing(matchedOption.id);
      else if (client.contract_value && client.contract_value > 0) { setSelectedPricing('personalizado'); setCustomValue(client.contract_value); }
    }
  }, [client, open]);

  // Load dynamic stages from system_settings for the services tab
  useEffect(() => {
    if (!client || !open) return;
    const funnelType = client.client_funnel_type || 'juridico';
    const settingsKey = funnelType === 'comercial' ? 'admin_kanban_comercial_stages' : 'admin_kanban_juridico_stages';
    supabase
      .from('system_settings')
      .select('value')
      .eq('key', settingsKey)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value && typeof data.value === 'object' && 'stages' in (data.value as any)) {
          const normalizedStages = sanitizePipelineStagesConfig((data.value as any).stages);
          setDynamicServiceStages(normalizedStages.length > 0 ? normalizedStages : null);
        } else {
          setDynamicServiceStages(null);
        }
      });
  }, [client?.id, client?.client_funnel_type, open]);

  // Load sent notification history for service stages
  useEffect(() => {
    if (!client?.id || !open) return;
    supabase
      .from('client_activities')
      .select('created_at, metadata, description')
      .eq('user_id', client.id)
      .eq('activity_type', 'notificacao_cobranca')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, { sent_at: string; description: string }> = {};
        data.forEach((a: any) => {
          const stageId = a.metadata?.stage_id;
          if (stageId && !map[stageId]) {
            map[stageId] = { sent_at: a.created_at, description: a.description || '' };
          }
        });
        setSentStagesMap(map);
      });
  }, [client?.id, open]);

  // Auto-open process details when prop is set
  useEffect(() => {
    if (initialShowProcessDetails && client && open) {
      handleQuickAction('processo');
    }
  }, [initialShowProcessDetails, client, open]);

  const fetchClientData = async () => {
    if (!client) return;
    setLoading(true);
    try {
      const isOrphan = client.id === '';

      if (isOrphan) {
        // Orphan: fetch brand_process by process_id, skip user-dependent queries
        if (client.process_id) {
          const { data } = await supabase.from('brand_processes')
            .select('id, brand_name, business_area, process_number, pipeline_stage, status, created_at, updated_at, ncl_classes')
            .eq('id', client.process_id);
          setClientBrands(data || []);
        } else if (client.publicacao_id) {
          // No process linked — use pub data directly to build a virtual brand entry
          const { data: pubData } = await supabase.from('publicacoes_marcas').select('*').eq('id', client.publicacao_id).maybeSingle();
          if (pubData) {
            setClientBrands([{
              id: pubData.id,
              brand_name: pubData.brand_name_rpi || client.brand_name || 'Marca',
              business_area: null,
              process_number: pubData.process_number_rpi || client.process_number || null,
              pipeline_stage: pubData.status || 'protocolado',
              status: pubData.status || 'em_andamento',
              created_at: pubData.created_at,
              updated_at: pubData.updated_at,
              ncl_classes: null,
            }]);
          } else {
            setClientBrands(client.brands?.map(b => ({ ...b, business_area: null, status: null, created_at: null, updated_at: null, ncl_classes: null })) || []);
          }
        } else {
          setClientBrands(client.brands?.map(b => ({ ...b, business_area: null, status: null, created_at: null, updated_at: null, ncl_classes: null })) || []);
        }
        setNotes([]); setAppointments([]); setDocuments([]); setInvoices([]);
        setProfileData(null);

        // Still fetch admin users list for assignment
        const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
        if (roles && roles.length > 0) {
          const { data: adminProfiles } = await supabase.from('profiles').select('id, full_name, email').in('id', roles.map(r => r.user_id));
          if (adminProfiles) setAdminUsersList(adminProfiles);
        }

        setLoading(false);
        return;
      }

      const [notesRes, appointmentsRes, docsRes, invoicesRes, profileRes, contractRes, brandsRes, pubsRes] = await Promise.all([
        supabase.from('client_notes').select('*').eq('user_id', client.id).order('created_at', { ascending: false }),
        supabase.from('client_appointments').select('*').eq('user_id', client.id).order('scheduled_at', { ascending: true }),
        supabase.from('documents').select('*').eq('user_id', client.id).order('created_at', { ascending: false }),
        supabase.from('invoices').select('*').eq('user_id', client.id).order('due_date', { ascending: false }),
        supabase.from('profiles').select('cpf, cnpj, company_name, address, neighborhood, city, state, zip_code, assigned_to, contract_value, origin, client_funnel_type, full_name, email, phone').eq('id', client.id).maybeSingle(),
        supabase.from('contracts').select('contract_value, payment_method, signature_status').eq('user_id', client.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('brand_processes').select('id, brand_name, business_area, process_number, pipeline_stage, status, created_at, updated_at, ncl_classes, inpi_protocol, deposit_date, grant_date, expiry_date, next_step, next_step_date, notes').eq('user_id', client.id).order('created_at', { ascending: false }),
        supabase.from('publicacoes_marcas').select('*').eq('client_id', client.id).order('proximo_prazo_critico', { ascending: true, nullsFirst: false }),
      ]);
      setNotes(notesRes.data || []);
      setAppointments(appointmentsRes.data || []);
      setDocuments(docsRes.data || []);
      setInvoices(invoicesRes.data || []);
      setProfileData(profileRes.data);
      setClientBrands(brandsRes.data || (client.brands ? client.brands.map(b => ({ ...b, business_area: null, status: null, created_at: null, updated_at: null, ncl_classes: null })) : []));
      setProcessPublicacoes(pubsRes.data || []);
      if (contractRes.data && contractRes.data.length > 0) {
        const contract = contractRes.data[0];
        if (contract.contract_value && contract.contract_value > 0) {
          setEditData(prev => ({ ...prev, contract_value: Number(contract.contract_value) }));
          if (profileRes.data && Number((profileRes.data as any).contract_value || 0) !== Number(contract.contract_value)) {
            await supabase.from('profiles').update({ contract_value: contract.contract_value }).eq('id', client.id);
          }
        }
      }
      if (profileRes.data) {
        setEditFormData(prev => ({
          ...prev,
          cpf: (profileRes.data as any).cpf || '',
          cnpj: (profileRes.data as any).cnpj || '',
          company_name: (profileRes.data as any).company_name || prev.company_name || '',
          address: (profileRes.data as any).address || '',
          neighborhood: (profileRes.data as any).neighborhood || '',
          city: (profileRes.data as any).city || '',
          state: (profileRes.data as any).state || '',
          zip_code: (profileRes.data as any).zip_code || '',
          assigned_to: (profileRes.data as any).assigned_to || '',
        }));
      }
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
      if (roles && roles.length > 0) {
        const { data: adminProfiles } = await supabase.from('profiles').select('id, full_name, email').in('id', roles.map(r => r.user_id));
        if (adminProfiles) setAdminUsersList(adminProfiles);
      }

      // Fetch admin's assigned email account
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: emailAcc } = await supabase
          .from('email_accounts')
          .select('id, email_address')
          .eq('assigned_to', user.id)
          .limit(1)
          .maybeSingle();
        if (!emailAcc) {
          const { data: defaultAcc } = await supabase
            .from('email_accounts')
            .select('id, email_address')
            .eq('is_default', true)
            .maybeSingle();
          setAdminEmailAccount(defaultAcc);
        } else {
          setAdminEmailAccount(emailAcc);
        }
      }
    } catch (error) { console.error('Error fetching client data:', error); }
    finally { setLoading(false); }
  };

  // ─── Note CRUD ────────────────────────────────────────────────────────────
  const handleAddNote = async () => {
    if (!newNote.trim() || !client) return;
    setSavingNote(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('client_notes').insert({ user_id: client.id, admin_id: user?.id, content: newNote });
      if (error) throw error;
      toast.success('Nota adicionada');
      setNewNote('');
      await fetchClientData();
    } catch { toast.error('Erro ao adicionar nota'); }
    finally { setSavingNote(false); }
  };

  const handleDeleteNote = async (id: string) => {
    const { error } = await supabase.from('client_notes').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir nota'); return; }
    toast.success('Nota excluída');
    await fetchClientData();
  };

  const handleSaveEditNote = async (id: string) => {
    if (!editingNoteContent.trim()) return;
    const { error } = await supabase.from('client_notes').update({ content: editingNoteContent.trim() }).eq('id', id);
    if (error) { toast.error('Erro ao editar nota'); return; }
    setEditingNoteId(null);
    toast.success('Nota atualizada');
    await fetchClientData();
  };

  // ─── Appointment CRUD ─────────────────────────────────────────────────────
  const handleCreateAppointment = async () => {
    if (!newAppointment.title.trim() || !client) return;
    setSavingAppointment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const scheduledAt = new Date(newAppointment.date);
      const [h, m] = newAppointment.time.split(':');
      scheduledAt.setHours(parseInt(h), parseInt(m));
      const { data: aptData, error } = await supabase.from('client_appointments').insert({ user_id: client.id, admin_id: user?.id, title: newAppointment.title, description: newAppointment.description, scheduled_at: scheduledAt.toISOString() }).select().single();
      if (error) throw error;

      // Generate Google Meet link if toggle is on
      if (newAppointment.generateMeet && aptData) {
        try {
          const { data: meetData } = await supabase.functions.invoke('create-google-meet', {
            body: {
              title: newAppointment.title,
              scheduled_at: scheduledAt.toISOString(),
              duration_minutes: parseInt(newAppointment.duration),
              attendee_emails: [client.email].filter(Boolean),
            },
          });
          if (meetData?.meetLink) {
            await supabase.from('client_appointments').update({
              google_meet_link: meetData.meetLink,
              google_event_id: meetData.eventId,
            }).eq('id', aptData.id);
            toast.success('Agendamento criado com Google Meet!');
          } else {
            toast.success('Agendamento criado! (Meet não gerado)');
          }
        } catch {
          toast.success('Agendamento criado! (Erro ao gerar Meet)');
        }
      } else {
        toast.success('Agendamento criado!');
      }

      setShowNewAppointment(false);
      setNewAppointment({ title: '', description: '', date: new Date(), time: '10:00', duration: '30', generateMeet: true });
      await fetchClientData();
    } catch { toast.error('Erro ao criar agendamento'); }
    finally { setSavingAppointment(false); }
  };

  const handleToggleAppointment = async (apt: ClientAppointment) => {
    const { error } = await supabase.from('client_appointments').update({ completed: !apt.completed }).eq('id', apt.id);
    if (error) { toast.error('Erro ao atualizar agendamento'); return; }
    toast.success(apt.completed ? 'Reaberto' : 'Concluído!');
    await fetchClientData();
  };

  const handleDeleteAppointment = async (id: string) => {
    const { error } = await supabase.from('client_appointments').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir agendamento'); return; }
    toast.success('Agendamento excluído');
    await fetchClientData();
  };

  // ─── File Upload ──────────────────────────────────────────────────────────
  const handleFileUpload = async (files: FileList | null) => {
    console.log('[FileUpload] Called with files:', files?.length, 'client:', client?.id);
    if (!files || files.length === 0) { toast.error('Nenhum arquivo selecionado'); return; }
    if (!client) { toast.error('Cliente não carregado'); return; }
    // Clone files array immediately to avoid FileList being cleared by input reset
    const fileArray = Array.from(files);
    console.log('[FileUpload] Cloned file array length:', fileArray.length, 'names:', fileArray.map(f => f.name));
    setUploading(true);
    let uploaded = 0;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Usuário não autenticado'); setUploading(false); return; }
      for (const file of fileArray) {
        const ext = file.name.split('.').pop() || 'bin';
        const sanitized = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 80);
        const fileName = `clients/${client.id}/${Date.now()}_${sanitized}.${ext}`;
        console.log('[FileUpload] Uploading:', fileName, 'size:', file.size, 'type:', file.type);
        const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, file, { upsert: false });
        if (uploadError) { console.error('[FileUpload] Storage error:', uploadError); toast.error(`Erro upload: ${uploadError.message}`); continue; }
        const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(fileName);
        console.log('[FileUpload] Public URL:', publicUrl);
        const { error: dbError } = await supabase.from('documents').insert({ user_id: client.id, name: file.name, file_url: publicUrl, document_type: 'anexo', uploaded_by: user.id, file_size: file.size, mime_type: file.type });
        if (dbError) { console.error('[FileUpload] DB insert error:', dbError); toast.error(`Erro ao salvar registro: ${dbError.message}`); } else { uploaded++; }
      }
      if (uploaded > 0) { toast.success(`${uploaded} arquivo(s) enviado(s)`); await fetchClientData(); } else { toast.warning('Nenhum arquivo foi enviado com sucesso'); }
    } catch (err: any) { console.error('[FileUpload] Unexpected error:', err); toast.error(`Erro inesperado: ${err.message}`); }
    finally { setUploading(false); }
  };

  const handleDeleteDocument = async (doc: ClientDocument) => {
    const urlParts = doc.file_url.split('/storage/v1/object/public/documents/');
    if (urlParts[1]) await supabase.storage.from('documents').remove([urlParts[1]]);
    const { error } = await supabase.from('documents').delete().eq('id', doc.id);
    if (error) { toast.error('Erro ao excluir arquivo'); return; }
    toast.success('Arquivo excluído');
    await fetchClientData();
  };

  // ─── Save Profile ─────────────────────────────────────────────────────────
  const handleSaveFullEdit = async () => {
    if (!client) return;
    setSavingEdit(true);
    try {
      const { error: profileError } = await supabase.from('profiles').update({
        full_name: editFormData.full_name, email: editFormData.email, phone: editFormData.phone,
        cpf: editFormData.cpf || null, cnpj: editFormData.cnpj || null,
        cpf_cnpj: editFormData.cpf || editFormData.cnpj || null,
        company_name: editFormData.company_name, address: editFormData.address,
        neighborhood: editFormData.neighborhood, city: editFormData.city,
        state: editFormData.state, zip_code: editFormData.zip_code,
        priority: editFormData.priority, origin: editFormData.origin,
        assigned_to: editFormData.assigned_to || null,
      }).eq('id', client.id);
      if (profileError) throw profileError;
      if (client.process_id && (editFormData.brand_name || editFormData.business_area)) {
        await supabase.from('brand_processes').update({ brand_name: editFormData.brand_name, business_area: editFormData.business_area || null }).eq('id', client.process_id);
      }
      toast.success('Dados do cliente atualizados!');
      setShowEditDialog(false);
      onUpdate();
      await fetchClientData();
    } catch (error: any) { toast.error(`Erro: ${error?.message}`); }
    finally { setSavingEdit(false); }
  };

  const handleSaveQuickChanges = async () => {
    if (!client) return;
    try {
      await supabase.from('profiles').update({ priority: editData.priority, origin: editData.origin, contract_value: editData.contract_value }).eq('id', client.id);
      if (client.process_id) await supabase.from('brand_processes').update({ pipeline_stage: editData.pipeline_stage }).eq('id', client.process_id);
      toast.success('Alterações salvas');
      onUpdate();
    } catch { toast.error('Erro ao salvar'); }
  };

  // ─── Delete client ────────────────────────────────────────────────────────
  const handleDeleteClient = async () => {
    if (!client || !client.id) return;
    if (client.email === MASTER_ADMIN_EMAIL) { toast.error('Administrador master não pode ser excluído.'); return; }
    setDeleting(true);
    try {
      // Check if this user also has an admin role
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', client.id)
        .eq('role', 'admin')
        .maybeSingle();

      // Always delete client-specific data
      await Promise.all([
        supabase.from('client_notes').delete().eq('user_id', client.id),
        supabase.from('client_activities').delete().eq('user_id', client.id),
        supabase.from('client_appointments').delete().eq('user_id', client.id),
        supabase.from('notifications').delete().eq('user_id', client.id),
        supabase.from('chat_messages').delete().eq('user_id', client.id),
        supabase.from('documents').delete().eq('user_id', client.id),
        supabase.from('invoices').delete().eq('user_id', client.id),
        supabase.from('contracts').delete().eq('user_id', client.id),
        supabase.from('brand_processes').delete().eq('user_id', client.id),
        supabase.from('login_history').delete().eq('user_id', client.id),
      ]);

      if (adminRole) {
        // User is also admin: only remove 'client' role, keep profile and admin role
        await supabase.from('user_roles').delete().eq('user_id', client.id).eq('role', 'user');
        // Clear client-specific fields on profile but keep the profile for admin access
        await supabase.from('profiles').update({
          client_funnel_type: null,
          phone: null,
          cpf: null,
          cnpj: null,
          company_name: null,
          address: null,
          city: null,
          state: null,
          zip_code: null,
        }).eq('id', client.id);
        toast.success('Dados de cliente removidos. Acesso admin preservado.');
      } else {
        // Not an admin: full deletion (roles + profile + auth user)
        await supabase.from('user_roles').delete().eq('user_id', client.id);
        const { error } = await supabase.from('profiles').delete().eq('id', client.id);
        if (error) throw error;
        // Delete auth user to prevent further login
        await supabase.functions.invoke('delete-auth-user', { body: { userId: client.id } });
        toast.success('Cliente excluído com sucesso');
      }

      setShowDeleteConfirm(false);
      onOpenChange(false);
      onUpdate();
    } catch (error: any) { toast.error(`Erro ao excluir: ${error?.message}`); }
    finally { setDeleting(false); }
  };

  // ─── Move funnel ──────────────────────────────────────────────────────────
  const handleMoveFunnel = async (targetFunnel: 'comercial' | 'juridico') => {
    if (!client) return;
    const currentFunnel = client.client_funnel_type || 'juridico';
    if (currentFunnel === targetFunnel) { toast.info('Cliente já está neste funil'); setShowMoveDialog(false); return; }
    try {
      if (targetFunnel === 'juridico') {
        const { data: contracts } = await supabase.from('contracts').select('id, signature_status').eq('user_id', client.id).eq('signature_status', 'signed').limit(1);
        if (!contracts || contracts.length === 0) { toast.error('Cliente precisa ter um contrato assinado para ir ao funil jurídico'); return; }
        await supabase.from('profiles').update({ client_funnel_type: 'juridico' }).eq('id', client.id);
        if (client.process_id) await supabase.from('brand_processes').update({ pipeline_stage: 'protocolado' }).eq('id', client.process_id);
      } else {
        await supabase.from('profiles').update({ client_funnel_type: 'comercial' }).eq('id', client.id);
        if (client.process_id) await supabase.from('brand_processes').update({ pipeline_stage: 'assinou_contrato' }).eq('id', client.process_id);
      }
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('client_activities').insert({ user_id: client.id, admin_id: user?.id, activity_type: 'funnel_move', description: `Movido para funil ${targetFunnel}` });
      toast.success(`Cliente movido para o funil ${targetFunnel === 'comercial' ? 'Comercial' : 'Jurídico'}!`);
      setShowMoveDialog(false);
      onUpdate();
      onOpenChange(false);
    } catch (error: any) { toast.error(`Erro ao mover: ${error?.message}`); }
  };

  // ─── Create process ───────────────────────────────────────────────────────
  const handleCreateProcess = async () => {
    if (!client || !newProcess.brand_name.trim()) { toast.error('Nome da marca é obrigatório'); return; }
    try {
      const { error } = await supabase.from('brand_processes').insert({ user_id: client.id, brand_name: newProcess.brand_name, process_number: newProcess.process_number || null, pipeline_stage: newProcess.pipeline_stage, business_area: newProcess.business_area || null, status: 'em_andamento' });
      if (error) throw error;
      toast.success('Processo criado!');
      setShowAddProcessDialog(false);
      setNewProcess({ brand_name: '', process_number: '', pipeline_stage: 'protocolado', business_area: '' });
      onUpdate();
    } catch (error: any) { toast.error(`Erro: ${error?.message}`); }
  };

  const handleQuickAction = async (actionId: string) => {
    // Auto-close other inline views when switching
    if (actionId === 'email') { setShowProcessDetails(false); }
    if (actionId === 'processo') { setShowEmailCompose(false); }
    if (['chat', 'move', 'notification', 'excluir', 'nova_fatura'].includes(actionId)) {
      setShowProcessDetails(false);
      setShowEmailCompose(false);
    }

    switch (actionId) {
      case 'chat':
        if (client) window.dispatchEvent(new CustomEvent('open-admin-chat', { detail: { clientId: client.id } }));
        break;
      case 'move': setShowMoveDialog(true); break;
      case 'email':
        if (client?.email) setShowEmailCompose(true);
        else toast.error('Cliente sem e-mail cadastrado');
        break;
      case 'notification':
        if (client) {
          const { data: tpls } = await supabase.from('notification_templates' as any).select('id, name, title, message, type').eq('is_active', true);
          setNotificationTemplates((tpls as any) || []);
          setNotificationForm({ title: '', message: '', type: 'info', link: '/cliente/processos' });
          setShowNotificationDialog(true);
        }
        break;
      case 'excluir': setShowDeleteConfirm(true); break;
      case 'processo':
        if (client) {
          const isOrphanProc = client.id === '';
          // Fetch all lifecycle data in parallel - use process_id, publicacao_id, or client_id
          let pubsQuery;
          if (isOrphanProc && client.process_id) {
            pubsQuery = supabase.from('publicacoes_marcas').select('*').eq('process_id', client.process_id).order('proximo_prazo_critico', { ascending: true, nullsFirst: false });
          } else if (isOrphanProc && client.publicacao_id) {
            pubsQuery = supabase.from('publicacoes_marcas').select('*').eq('id', client.publicacao_id);
          } else {
            pubsQuery = supabase.from('publicacoes_marcas').select('*').eq('client_id', client.id).order('proximo_prazo_critico', { ascending: true, nullsFirst: false });
          }

          const eventsQuery = client.process_id
            ? supabase.from('process_events').select('*').eq('process_id', client.process_id).order('event_date', { ascending: false })
            : Promise.resolve({ data: [] as any[] });

          const contractsQuery = !isOrphanProc
            ? supabase.from('contracts').select('id, subject, signature_status, signed_at, created_at, contract_value, payment_method, blockchain_hash, signatory_name').eq('user_id', client.id).order('created_at', { ascending: false })
            : Promise.resolve({ data: [] as any[] });

          const invoicesQuery2 = !isOrphanProc
            ? supabase.from('invoices').select('id, description, amount, status, due_date, payment_date, payment_method, created_at').eq('user_id', client.id).order('created_at', { ascending: false })
            : Promise.resolve({ data: [] as any[] });

          const activitiesQuery = !isOrphanProc
            ? supabase.from('client_activities').select('created_at, activity_type, description, metadata').eq('user_id', client.id).eq('activity_type', 'notificacao_cobranca').order('created_at', { ascending: false })
            : Promise.resolve({ data: [] as any[] });

          const [pubsRes, contractsRes, invoicesRes2, eventsRes, activitiesRes] = await Promise.all([
            pubsQuery, contractsQuery, invoicesQuery2, eventsQuery, activitiesQuery,
          ]);
          setProcessPublicacoes(pubsRes.data || []);
          setProcessContracts(contractsRes.data || []);
          setProcessInvoices(invoicesRes2.data || []);
          setProcessEvents(eventsRes.data || []);
          setProcessActivities(activitiesRes.data || []);
          // Also fetch logs for first publication if exists
          if (pubsRes.data && pubsRes.data.length > 0) {
            const { data: logs } = await supabase.from('publicacao_logs').select('*').eq('publicacao_id', pubsRes.data[0].id).order('created_at', { ascending: false });
            setProcessLogs(logs || []);
          } else {
            setProcessLogs([]);
          }
          setShowProcessDetails(true);
        }
        break;
      case 'nova_fatura': setShowNewInvoiceDialog(true); break;
    }
  };

  // ─── Publication Actions ─────────────────────────────────────────────────
  const handleEditPub = (pub: any) => {
    setEditingPubData({
      id: pub.id,
      status: pub.status || '003',
      data_deposito: pub.data_deposito || '',
      data_publicacao_rpi: pub.data_publicacao_rpi || '',
      prazo_oposicao: pub.prazo_oposicao || '',
      data_decisao: pub.data_decisao || '',
      data_certificado: pub.data_certificado || '',
      data_renovacao: pub.data_renovacao || '',
      tipo_publicacao: pub.tipo_publicacao || 'publicacao_rpi',
      comentarios_internos: pub.comentarios_internos || '',
      rpi_number: pub.rpi_number || '',
    });
    setShowEditPubDialog(true);
  };

  const handleSavePub = async () => {
    if (!editingPubData?.id) return;
    setSavingPub(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const updateData: any = {
        status: editingPubData.status,
        tipo_publicacao: editingPubData.tipo_publicacao,
        comentarios_internos: editingPubData.comentarios_internos,
        rpi_number: editingPubData.rpi_number,
      };
      ['data_deposito', 'data_publicacao_rpi', 'prazo_oposicao', 'data_decisao', 'data_certificado', 'data_renovacao'].forEach(k => {
        updateData[k] = editingPubData[k] || null;
      });
      const { error } = await supabase.from('publicacoes_marcas').update(updateData).eq('id', editingPubData.id);
      if (error) throw error;
      // Log the change
      await supabase.from('publicacao_logs').insert({
        publicacao_id: editingPubData.id,
        campo_alterado: 'status',
        valor_anterior: null,
        valor_novo: editingPubData.status,
        admin_email: user?.email || 'admin',
      });
      toast.success('Publicação atualizada!');
      setShowEditPubDialog(false);
      // Refresh data
      handleQuickAction('processo');
    } catch (err: any) { toast.error(`Erro: ${err?.message}`); }
    finally { setSavingPub(false); }
  };

  const handleDeletePub = async () => {
    if (!deletingPubId) return;
    try {
      const { error } = await supabase.from('publicacoes_marcas').delete().eq('id', deletingPubId);
      if (error) throw error;
      toast.success('Publicação excluída!');
      setShowDeletePubConfirm(false);
      setDeletingPubId(null);
      handleQuickAction('processo');
    } catch (err: any) { toast.error(`Erro: ${err?.message}`); }
  };

  const handleRpiUpload = async (files: FileList | null) => {
    if (!files || !rpiUploadPubId) return;
    setUploadingRpi(rpiUploadPubId);
    try {
      const file = files[0];
      const fileName = `rpi/${rpiUploadPubId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('documents').upload(fileName, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(fileName);
      await supabase.from('publicacoes_marcas').update({ documento_rpi_url: publicUrl }).eq('id', rpiUploadPubId);
      toast.success('Documento RPI enviado!');
      handleQuickAction('processo');
    } catch (err: any) { toast.error(`Erro: ${err?.message}`); }
    finally { setUploadingRpi(null); setRpiUploadPubId(null); }
  };

  const handleOpenSchedulingDialog = (pub: any) => {
    const brandName = pub.brand_name_rpi || client?.brand_name || 'Marca';
    setSchedulingForm({
      title: `Reunião: ${brandName}`,
      description: `Publicação: ${pub.process_number_rpi || ''} — Status: ${pub.status || '003'}`,
      date: new Date(),
      time: '10:00',
      duration: '30',
      generateMeet: true,
    });
    setSchedulingPub(pub);
  };

  const handleCreatePubSchedule = async () => {
    if (!client || !schedulingForm.title.trim()) return;
    setSavingSchedule(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const scheduledAt = new Date(schedulingForm.date);
      const [h, m] = schedulingForm.time.split(':');
      scheduledAt.setHours(parseInt(h), parseInt(m), 0, 0);

      // Use client.id if available, otherwise use admin's own id for orphans
      const userId = client.id && client.id !== '' ? client.id : user?.id;

      const { data: aptData, error } = await supabase.from('client_appointments').insert({
        user_id: userId,
        admin_id: user?.id,
        title: schedulingForm.title,
        description: schedulingForm.description,
        scheduled_at: scheduledAt.toISOString(),
      }).select().single();
      if (error) throw error;

      let meetLink: string | null = null;

      // Generate Google Meet if toggle is on
      if (schedulingForm.generateMeet && aptData) {
        try {
          const attendeeEmails = [client.email].filter(Boolean);
          const { data: meetData } = await supabase.functions.invoke('create-google-meet', {
            body: {
              title: schedulingForm.title,
              scheduled_at: scheduledAt.toISOString(),
              duration_minutes: parseInt(schedulingForm.duration),
              attendee_emails: attendeeEmails,
            },
          });
          if (meetData?.meetLink) {
            meetLink = meetData.meetLink;
            await supabase.from('client_appointments').update({
              google_meet_link: meetData.meetLink,
              google_event_id: meetData.eventId,
            }).eq('id', aptData.id);
          }
        } catch (meetErr) {
          console.error('Meet generation error:', meetErr);
        }
      }

      // Send notification via email + whatsapp if client has contact info
      if (client.email || client.phone) {
        try {
          const dataHoraFormatada = format(scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
          const brandName = schedulingPub?.brand_name_rpi || client.brand_name || 'Marca';
          const mensagemCustom = meetLink
            ? `Olá ${client.full_name || 'Cliente'}! Uma reunião foi agendada:\n\n📋 ${schedulingForm.title}\n📅 ${dataHoraFormatada}\n🔗 Link Google Meet: ${meetLink}\n\nMarca: ${brandName}`
            : `Olá ${client.full_name || 'Cliente'}! Uma reunião foi agendada:\n\n📋 ${schedulingForm.title}\n📅 ${dataHoraFormatada}\n\nMarca: ${brandName}`;

          await supabase.functions.invoke('send-multichannel-notification', {
            body: {
              channels: ['email', 'whatsapp'],
              event_type: 'agendamento_criado',
              recipient: {
                nome: client.full_name || 'Cliente',
                email: client.email || null,
                phone: client.phone || null,
              },
              data: {
                titulo: schedulingForm.title,
                data_hora: dataHoraFormatada,
                meet_link: meetLink,
                marca: brandName,
                mensagem_custom: mensagemCustom,
              },
            },
          });
        } catch (notifErr) {
          console.error('Notification error:', notifErr);
        }
      }

      toast.success(meetLink ? 'Agendamento criado com Google Meet!' : 'Agendamento criado!');
      setSchedulingPub(null);
      await fetchClientData();
      // Refresh process details if open
      if (showProcessDetails) handleQuickAction('processo');
    } catch (err: any) { toast.error(`Erro ao criar agendamento: ${err?.message}`); }
    finally { setSavingSchedule(false); }
  };

  if (!client) return null;

  const funnelType = client.client_funnel_type || 'juridico';
  const fallbackStages = funnelType === 'comercial' ? COMMERCIAL_PIPELINE_STAGES : PIPELINE_STAGES;
  const activeStages = dynamicServiceStages || fallbackStages;
  const currentStage = activeStages.find(s => s.id === (editData.pipeline_stage || client.pipeline_stage || 'protocolado'));
  const priCfg = PRIORITY_CONFIG[client.priority || 'medium'] || PRIORITY_CONFIG.medium;
  const initials = (client.full_name || 'C').trim().split(/\s+/).filter(Boolean).map(n => n[0] || '').slice(0, 2).join('').toUpperCase() || 'C';
  const isSigned = invoices.length > 0 || documents.length > 0;
  const contractValue = editData.contract_value || client.contract_value || 0;

  const QUICK_ACTIONS = [
    { id: 'chat', label: 'Chat', icon: MessageCircle, cls: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700' },
    { id: 'move', label: 'Mover', icon: ArrowUpRight, cls: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60' },
    { id: 'email', label: 'Email', icon: Mail, cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200' },
    { id: 'notification', label: 'Notificar', icon: Bell, cls: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200' },
    { id: 'excluir', label: 'Excluir', icon: Trash2, cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200' },
    { id: 'processo', label: 'Detalhes do Processo', icon: FileText, cls: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/60' },
    { id: 'nova_fatura', label: 'Nova Fatura', icon: Receipt, cls: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 hover:bg-teal-200 dark:hover:bg-teal-900/60' },
  ];

  const handleTabsWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!tabsScrollRef.current) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

    tabsScrollRef.current.scrollLeft += event.deltaY;
    event.preventDefault();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl p-0 overflow-hidden flex flex-col">
        {/* ──────────────────────────────── HEADER ────────────────────────── */}
        <div className={cn('relative overflow-hidden flex-shrink-0 bg-gradient-to-r', currentStage?.color || 'from-blue-600 to-blue-700')}>
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 80%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

          <div className="relative p-5">
            <SheetHeader className="space-y-0">
              {/* Top row */}
              <div className="flex items-start gap-3.5">
                {/* Avatar */}
                <motion.div
                  className="w-14 h-14 rounded-2xl bg-white/25 backdrop-blur-sm border border-white/30 flex items-center justify-center text-white text-xl font-bold shadow-lg flex-shrink-0"
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.05 }}
                >
                  {initials}
                </motion.div>

                {/* Name / info */}
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-white text-lg font-bold flex items-center gap-2 flex-wrap">
                    {client.full_name || 'Sem nome'}
                    <Badge className={cn('border text-[10px] font-bold px-2 py-0.5 ml-1', priCfg.color)}>
                      <div className={cn('w-1.5 h-1.5 rounded-full mr-1', priCfg.dot)} />
                      {priCfg.label}
                    </Badge>
                  </SheetTitle>
                  <p className="text-white/60 text-xs mt-0.5 font-mono">ID: {client.id.slice(0, 8)}…</p>

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-medium">
                      <Globe className="h-3 w-3" />
                      {client.origin === 'whatsapp' ? 'WhatsApp' : client.origin === 'indicacao' ? 'Indicação' : 'Site'}
                    </span>
                    {currentStage && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-medium">
                        <MapPin className="h-3 w-3" />
                        {currentStage.label}
                      </span>
                    )}
                    {client.brand_name && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-medium">
                        <Tag className="h-3 w-3" />
                        {client.brand_name}
                      </span>
                    )}
                    {/* Publication status badge in header */}
                    {processPublicacoes.length > 0 && (() => {
                      const latestPub = processPublicacoes[0];
                      const STATUS_HEADER: Record<string, { label: string; bg: string }> = {
                        depositada: { label: 'Depositada', bg: 'bg-blue-400/30' },
                        '003': { label: '003', bg: 'bg-yellow-400/30' },
                        oposicao: { label: 'Oposição', bg: 'bg-orange-400/30' },
                        exigencia_merito: { label: 'Exig. Mérito', bg: 'bg-violet-400/30' },
                        indeferimento: { label: 'Indeferimento', bg: 'bg-red-400/30' },
                        deferimento: { label: 'Deferimento', bg: 'bg-emerald-400/30' },
                        certificado: { label: 'Certificado', bg: 'bg-teal-400/30' },
                        renovacao: { label: 'Renovação', bg: 'bg-cyan-400/30' },
                        arquivado: { label: 'Arquivado', bg: 'bg-zinc-400/30' },
                      };
                      const sCfg = STATUS_HEADER[latestPub.status] || STATUS_HEADER.depositada;
                      const dLeft = latestPub.proximo_prazo_critico ? Math.ceil((new Date(latestPub.proximo_prazo_critico).getTime() - Date.now()) / 86400000) : null;
                      return (
                        <>
                          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs font-medium', sCfg.bg)}>
                            <Newspaper className="h-3 w-3" />
                            {sCfg.label}
                          </span>
                          {dLeft !== null && (
                            <span className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs font-medium',
                              dLeft < 0 ? 'bg-red-500/40 animate-pulse' : dLeft <= 7 ? 'bg-red-400/30' : dLeft <= 30 ? 'bg-amber-400/30' : 'bg-emerald-400/30'
                            )}>
                              <Clock className="h-3 w-3" />
                              {dLeft < 0 ? `${Math.abs(dLeft)}d atrasado` : `${dLeft}d restantes`}
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-1.5 flex-shrink-0">
                  <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                    <DialogTrigger asChild>
                      <button className="w-9 h-9 rounded-xl bg-red-500/80 hover:bg-red-500 border border-red-400/40 flex items-center justify-center transition-colors">
                        <Trash2 className="h-4 w-4 text-white" />
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Excluir Cliente</DialogTitle></DialogHeader>
                      <div className="py-4 space-y-4">
                        <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir <strong>{client.full_name}</strong>? Esta ação é <strong>irreversível</strong>.</p>
                        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-xs text-muted-foreground space-y-1">
                          <p className="font-semibold text-destructive mb-2">Serão excluídos permanentemente:</p>
                          {['Todos os processos de marca', 'Todos os contratos', 'Todas as faturas', 'Todos os documentos e notas', 'Histórico de acesso'].map(item => (
                            <p key={item}>• {item}</p>
                          ))}
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleDeleteClient} disabled={deleting}>
                          {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                          Excluir
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <button
                    className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 border border-white/30 flex items-center justify-center transition-colors"
                    onClick={() => setShowEditDialog(true)}
                  >
                    <Edit2 className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>

              {/* Responsible admin */}
              <div className="mt-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/20 rounded-xl px-3 py-2 transition-colors">
                      <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center">
                        <UserCheck className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] text-white/60 leading-none">Responsável</p>
                        <p className="text-xs font-bold text-white leading-tight">
                          {client.assigned_to_name || client.created_by_name || (client.origin === 'site' ? 'Site' : 'Não atribuído')}
                        </p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-white/50 ml-1" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" align="start">
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-semibold text-sm">Atribuir Cliente</h4>
                        <p className="text-xs text-muted-foreground">Selecione o administrador responsável</p>
                      </div>
                      <Select value={editFormData.assigned_to} onValueChange={async (value) => {
                        const newAssignedTo = value === 'none' ? null : value;
                        setEditFormData(prev => ({ ...prev, assigned_to: newAssignedTo || '' }));
                        try {
                          await supabase.from('profiles').update({ assigned_to: newAssignedTo }).eq('id', client.id);
                          toast.success('Atribuído com sucesso!');
                          onUpdate();
                        } catch { toast.error('Erro ao atribuir'); }
                      }}>
                        <SelectTrigger><SelectValue placeholder="Selecionar admin…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {adminUsersList.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Quick Actions */}
              <div className="mt-3 pt-3 border-t border-white/15">
                <p className="text-[10px] text-white/50 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Ações Rápidas
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_ACTIONS.map(action => (
                    <motion.button
                      key={action.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={cn('px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors', action.cls)}
                      onClick={() => handleQuickAction(action.id)}
                    >
                      <action.icon className="h-3.5 w-3.5" />
                      {action.label}
                    </motion.button>
                  ))}
                  {extraActions}
                </div>
              </div>
            </SheetHeader>
          </div>
        </div>

        {/* ──────────────────────────────── TABS / EMAIL COMPOSE ──────────────────────────── */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {showProcessDetails ? (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={() => setShowProcessDetails(false)} className="gap-1.5">
                  <X className="h-4 w-4" /> Voltar ao ficheiro
                </Button>
                <span className="text-sm text-muted-foreground">Ciclo Completo — <strong>{client.full_name}</strong></span>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-5 space-y-6">

                  {/* ── SECTION 1: LIFECYCLE TIMELINE ── */}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-3">
                      <Activity className="w-3.5 h-3.5" /> Ciclo de Vida do Processo
                    </p>
                    {(() => {
                      // Build unified lifecycle events
                      const lifecycleEvents: { date: string; label: string; description: string; icon: any; status: 'completed' | 'pending'; category: string }[] = [];

                      // Contract events
                      processContracts.forEach((c: any) => {
                        lifecycleEvents.push({
                          date: c.created_at, label: 'Contrato Gerado',
                          description: c.subject || `Valor: R$ ${Number(c.contract_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                          icon: FileText, status: 'completed', category: 'contrato',
                        });
                        if (c.signature_status === 'signed' && c.signed_at) {
                          lifecycleEvents.push({
                            date: c.signed_at, label: 'Contrato Assinado',
                            description: `Assinado por ${c.signatory_name || client.full_name}${c.blockchain_hash ? ' · Registrado em blockchain' : ''}`,
                            icon: CheckCircle, status: 'completed', category: 'contrato',
                          });
                        }
                      });

                      // Invoice/payment events
                      processInvoices.forEach((inv: any) => {
                        const methodLabel = inv.payment_method === 'pix' ? 'PIX' : inv.payment_method === 'credit_card' ? 'Cartão' : inv.payment_method === 'boleto' ? 'Boleto' : inv.payment_method || '—';
                        lifecycleEvents.push({
                          date: inv.created_at, label: 'Fatura Criada',
                          description: `${inv.description} · R$ ${Number(inv.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · ${methodLabel}`,
                          icon: Receipt, status: 'completed', category: 'financeiro',
                        });
                        if (inv.status === 'paid' && inv.payment_date) {
                          lifecycleEvents.push({
                            date: inv.payment_date, label: 'Pagamento Confirmado',
                            description: `R$ ${Number(inv.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} via ${methodLabel}`,
                            icon: DollarSign, status: 'completed', category: 'financeiro',
                          });
                        }
                      });

                      // Process events (from process_events table)
                      processEvents.forEach((ev: any) => {
                        lifecycleEvents.push({
                          date: ev.event_date || ev.created_at, label: ev.title,
                          description: ev.description || '', icon: Activity, status: 'completed', category: 'processo',
                        });
                      });

                      // Brand process protocol
                      clientBrands.forEach((bp: any) => {
                        if (bp.created_at) {
                          lifecycleEvents.push({
                            date: bp.created_at, label: 'Processo Protocolado',
                            description: `Marca: ${bp.brand_name}${bp.process_number ? ` · Nº ${bp.process_number}` : ''}`,
                            icon: FileCheck, status: 'completed', category: 'processo',
                          });
                        }
                      });

                      // Notification + billing activities (from ServiceActionPanel)
                      const notificationDocUrls = new Set<string>();
                      processActivities.forEach((act: any) => {
                        const meta = act.metadata || {};
                        const channels: string[] = [];
                        if (meta.channels?.email) channels.push('Email');
                        if (meta.channels?.whatsapp) channels.push('WhatsApp');
                        const channelStr = channels.length > 0 ? ` via ${channels.join(' + ')}` : '';
                        
                        // Notification sent event
                        lifecycleEvents.push({
                          date: act.created_at,
                          label: 'Notificação Enviada',
                          description: `${meta.stage_label || act.description || 'Serviço'}${channelStr}`,
                          icon: Send, status: 'completed', category: 'notificacao',
                        });

                        // Attached documents
                        const docUrls = meta.document_urls || [];
                        if (docUrls.length > 0) {
                          docUrls.forEach((url: string) => {
                            notificationDocUrls.add(url);
                            const filename = decodeURIComponent(url.split('/').pop() || 'Documento').replace(/^\d+_/, '');
                            lifecycleEvents.push({
                              date: act.created_at,
                              label: 'Anexo Enviado',
                              description: filename,
                              icon: Paperclip, status: 'completed', category: 'notificacao',
                            });
                          });
                        }
                      });

                      // Documents from Anexos tab (deduplicated)
                      documents.forEach((doc: any) => {
                        if (notificationDocUrls.has(doc.file_url)) return;
                        lifecycleEvents.push({
                          date: doc.created_at,
                          label: 'Anexo Enviado',
                          description: doc.name || 'Documento',
                          icon: Paperclip, status: 'completed', category: 'notificacao',
                        });
                      });

                      // Sort by date ascending
                      lifecycleEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                      if (lifecycleEvents.length === 0) {
                        return <EmptyState icon={Activity} title="Sem eventos" description="Nenhum evento registrado para este cliente." />;
                      }

                      const categoryColors: Record<string, string> = {
                        contrato: 'bg-blue-500',
                        financeiro: 'bg-emerald-500',
                        processo: 'bg-purple-500',
                        notificacao: 'bg-orange-500',
                      };

                      return (
                        <div className="space-y-0">
                          {lifecycleEvents.map((ev, idx) => {
                            const EvIcon = ev.icon;
                            return (
                              <div key={idx} className="flex gap-3 relative">
                                <div className="flex flex-col items-center">
                                  <div className={cn(
                                    'w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all',
                                    'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                  )}>
                                    <EvIcon className="w-4 h-4" />
                                  </div>
                                  {idx < lifecycleEvents.length - 1 && <div className="w-0.5 flex-1 bg-border min-h-[16px]" />}
                                </div>
                                <div className="pb-4 flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold">{ev.label}</p>
                                    <div className={cn('w-2 h-2 rounded-full', categoryColors[ev.category] || 'bg-muted-foreground')} title={ev.category} />
                                  </div>
                                  {ev.description && <p className="text-xs text-muted-foreground mt-0.5">{ev.description}</p>}
                                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                    {format(new Date(ev.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  <Separator />

                  {/* ── SECTION 2: PUBLICAÇÕES / REVISTA INPI ── */}
                  <div className="space-y-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Newspaper className="w-3.5 h-3.5" /> Publicações na Revista INPI ({processPublicacoes.length})
                    </p>
                    {processPublicacoes.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Nenhuma publicação vinculada.</p>
                    ) : processPublicacoes.map((pub: any) => {
                      const brandName = pub.brand_name_rpi || clientBrands.find((b: any) => b.id === pub.process_id)?.brand_name || '—';
                      const processNumber = pub.process_number_rpi || clientBrands.find((b: any) => b.id === pub.process_id)?.process_number || 'Sem número';
                      const TIMELINE_STEPS_INLINE = [
                        { key: 'data_deposito', label: 'Depósito', icon: FileText, description: 'Pedido protocolado no INPI' },
                        { key: 'data_publicacao_rpi', label: 'Publicação RPI', icon: Newspaper, description: 'Publicado na Revista da PI' },
                        { key: 'prazo_oposicao', label: 'Prazo Oposição (60d)', icon: Gavel, description: 'Período para manifestações' },
                        { key: 'data_decisao', label: 'Decisão', icon: Shield, description: 'Deferimento ou indeferimento' },
                        { key: 'data_certificado', label: 'Certificado', icon: Award, description: 'Emissão do certificado' },
                        { key: 'data_renovacao', label: 'Renovação (9 anos)', icon: RefreshCw, description: 'Prazo ordinário + 6m ord. + 6m extra' },
                      ] as const;
                      const STATUS_CONFIG_INLINE: Record<string, { label: string; color: string; bg: string }> = {
                        depositada: { label: 'Depositada', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/40' },
                        '003': { label: '003', color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/40' },
                        oposicao: { label: 'Oposição', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/40' },
                        exigencia_merito: { label: 'Exig. Mérito', color: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/40' },
                        indeferimento: { label: 'Indeferimento', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/40' },
                        deferimento: { label: 'Deferimento', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
                        certificado: { label: 'Certificado', color: 'text-teal-700 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-900/40' },
                        renovacao: { label: 'Renovação', color: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-900/40' },
                        arquivado: { label: 'Arquivado', color: 'text-zinc-700 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-900/40' },
                      };
                      const statusCfg = STATUS_CONFIG_INLINE[pub.status] || STATUS_CONFIG_INLINE.depositada;
                      const getDaysLeft = (dateStr: string | null): number | null => {
                        if (!dateStr) return null;
                        const d = new Date(dateStr);
                        return Math.ceil((d.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                      };
                      const getScheduledAlerts = (prazoCritico: string | null): { label: string; date: Date; days: number }[] => {
                        if (!prazoCritico) return [];
                        const prazoDate = new Date(prazoCritico);
                        return [30, 15, 7].map(d => {
                          const alertDate = new Date(prazoDate.getTime() - d * 86400000);
                          const daysLeft = Math.ceil((alertDate.getTime() - new Date().getTime()) / 86400000);
                          return { label: `${d} dias antes`, date: alertDate, days: daysLeft };
                        }).filter(a => a.days >= 0);
                      };
                      return (
                        <div key={pub.id} className="space-y-4 border border-border rounded-xl p-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-base">{brandName}</p>
                              <Badge className={cn('text-[10px]', statusCfg.bg, statusCfg.color)}>{statusCfg.label}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{processNumber}</p>
                            {pub.descricao_prazo && <p className="text-xs text-primary font-medium mt-1">{pub.descricao_prazo}</p>}
                          </div>

                          {(pub.rpi_number || pub.documento_rpi_url) && (
                            <div className="p-2 rounded-lg bg-muted/50 space-y-1">
                              {pub.rpi_number && <p className="text-xs flex items-center gap-1.5"><Hash className="w-3 h-3 text-primary" /><span className="font-medium">RPI N°:</span> {pub.rpi_number}</p>}
                              {pub.documento_rpi_url && (
                                <a href={pub.documento_rpi_url} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1.5 text-primary hover:underline">
                                  <Paperclip className="w-3 h-3" /> Documento RPI
                                </a>
                              )}
                            </div>
                          )}

                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Timeline</p>
                            {TIMELINE_STEPS_INLINE.map(step => {
                              const date = pub[step.key] as string | null;
                              const isCompleted = !!date && new Date(date) < new Date();
                              const isOverdue = !!date && new Date(date) < new Date() && step.key !== 'data_deposito' && (getDaysLeft(date) ?? 0) < 0;
                              const StepIcon = step.icon;
                              return (
                                <div key={step.key} className="flex gap-3 relative">
                                  <div className="flex flex-col items-center">
                                    <div className={cn(
                                      'w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all',
                                      isCompleted ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                        : isOverdue ? 'bg-red-100 dark:bg-red-900/40 border-red-500 text-red-600 dark:text-red-400 animate-pulse'
                                        : 'bg-muted border-border text-muted-foreground'
                                    )}>
                                      {isCompleted ? <CheckCircle className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                                    </div>
                                    <div className="w-0.5 flex-1 bg-border min-h-[24px]" />
                                  </div>
                                  <div className="pb-6 flex-1">
                                    <p className={cn('text-sm font-semibold', isCompleted ? 'text-foreground' : 'text-muted-foreground')}>{step.label}</p>
                                    <p className="text-xs text-muted-foreground">{step.description}</p>
                                    {date && (
                                      <p className={cn('text-xs mt-1 font-medium', isOverdue ? 'text-red-600 dark:text-red-400' : 'text-primary')}>
                                        {format(new Date(date), "dd/MM/yyyy", { locale: ptBR })}
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
                            })}
                          </div>

                          {pub.proximo_prazo_critico && getScheduledAlerts(pub.proximo_prazo_critico).length > 0 && (
                            <>
                              <Separator />
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                                  <BellRing className="w-3 h-3" /> Alertas Programados
                                </p>
                                <div className="space-y-1">
                                  {getScheduledAlerts(pub.proximo_prazo_critico).map((alert, i) => (
                                    <div key={i} className="text-[10px] flex items-center gap-2 p-1.5 rounded bg-muted/50">
                                      <Bell className="w-3 h-3 text-amber-500" />
                                      <span>{alert.label}</span>
                                      <span className="text-muted-foreground ml-auto">{format(alert.date, 'dd/MM/yyyy')}</span>
                                      <span className="text-muted-foreground">(em {alert.days}d)</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}

                          {pub.comentarios_internos && (
                            <>
                              <Separator />
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Comentários</p>
                                <p className="text-xs text-foreground whitespace-pre-wrap">{pub.comentarios_internos}</p>
                              </div>
                            </>
                          )}

                          {/* ── ACTION BUTTONS ── */}
                          <Separator />
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleEditPub(pub)}>
                              <Edit2 className="h-3 w-3" /> Editar Datas e Status
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleOpenSchedulingDialog(pub)}>
                              <CalendarIcon className="h-3 w-3" /> Agenda
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setRpiUploadPubId(pub.id); rpiFileInputRef.current?.click(); }} disabled={uploadingRpi === pub.id}>
                              {uploadingRpi === pub.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Upload Doc RPI
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => { setDeletingPubId(pub.id); setShowDeletePubConfirm(true); }}>
                              <Trash2 className="h-3 w-3" /> Excluir
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ── SECTION 3: PROCESS LOGS (publicacao_logs) ── */}
                  {processLogs.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <ActivityIcon className="w-3 h-3" /> Histórico de Alterações ({processLogs.length})
                        </p>
                        <div className="space-y-0">
                          {processLogs.slice(0, 15).map((log: any, idx: number) => (
                            <div key={log.id} className="flex gap-2.5">
                              <div className="flex flex-col items-center">
                                <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', log.campo_alterado === 'status' ? 'bg-primary' : 'bg-muted-foreground/40')} />
                                {idx < Math.min(processLogs.length, 15) - 1 && <div className="w-px flex-1 bg-border" />}
                              </div>
                              <div className="pb-3 flex-1 min-w-0">
                                <div className="text-[10px]">
                                  <span className="font-semibold text-primary">{log.campo_alterado}</span>
                                  {log.valor_novo && <span className="font-medium ml-1">→ {log.valor_novo?.substring(0, 30)}</span>}
                                </div>
                                <p className="text-[9px] text-muted-foreground">
                                  {log.admin_email?.split('@')[0] || 'Sistema'} · {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : showEmailCompose ? (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={() => setShowEmailCompose(false)} className="gap-1.5">
                  <X className="h-4 w-4" /> Voltar ao ficheiro
                </Button>
                <span className="text-sm text-muted-foreground">Compor email para <strong>{client.full_name}</strong></span>
              </div>
              <div className="flex-1 overflow-hidden">
                <EmailCompose
                  onClose={() => setShowEmailCompose(false)}
                  initialTo={client.email}
                  initialName={client.full_name || ''}
                  accountId={adminEmailAccount?.id || null}
                  accountEmail={adminEmailAccount?.email_address}
                  hideClientSearch={true}
                  initialClientData={{
                    id: client.id,
                    full_name: client.full_name || '',
                    email: client.email || '',
                    brand_name: client.brand_name,
                    process_number: client.process_number,
                  }}
                />
              </div>
            </div>
          ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
            {/* Tab bar */}
            <div
              ref={tabsScrollRef}
              onWheel={handleTabsWheel}
              className="border-b border-border flex-shrink-0 overflow-x-auto overflow-y-hidden overscroll-x-contain overscroll-y-none scrollbar-hide"
              style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
            >
              <TabsList className="inline-flex h-auto bg-transparent p-0 gap-0 w-max min-w-max justify-start flex-nowrap px-1">
                {[
                  { value: 'overview', label: 'Geral', icon: User },
                  { value: 'contacts', label: 'Contatos', icon: Phone },
                  { value: 'services', label: 'Serviços', icon: Package },
                  { value: 'appointments', label: 'Agenda', icon: CalendarIcon },
                  { value: 'attachments', label: 'Anexos', icon: Paperclip },
                  { value: 'financial', label: 'Financeiro', icon: Wallet },
                  { value: 'brands', label: 'Marcas', icon: Tag },
                ].map(tab => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="relative h-10 min-w-[8.5rem] rounded-none px-3.5 text-xs font-medium text-muted-foreground border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent bg-transparent hover:text-foreground transition-colors gap-1.5 whitespace-nowrap flex-shrink-0"
                  >
                    <tab.icon className="h-3.5 w-3.5 flex-shrink-0" />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <ScrollArea className="flex-1 [&>[data-radix-scroll-area-viewport]]:!overflow-x-auto">
              <div className="p-5 space-y-5 min-w-0">

                {/* ─── GERAL TAB ─────────────────────────────────────────── */}
                <TabsContent value="overview" className="mt-0 space-y-5">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <motion.div
                      className="rounded-2xl border border-border bg-emerald-500/5 border-emerald-500/20 p-4 cursor-pointer group"
                      whileHover={{ scale: 1.02 }}
                      onClick={() => setShowPricingDialog(true)}
                    >
                      <div className="flex items-center gap-1.5 mb-2">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Valor</span>
                        <Edit2 className="h-3 w-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100" />
                      </div>
                      <p className="font-bold text-emerald-500 text-lg leading-none">
                        {contractValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                      {selectedPricing && selectedPricing !== 'personalizado' && (
                        <p className="text-[10px] text-muted-foreground mt-1 truncate">
                          {SERVICE_PRICING_OPTIONS.find(o => o.id === selectedPricing)?.details}
                        </p>
                      )}
                    </motion.div>

                    <div className="rounded-2xl border border-border bg-muted/30 p-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Último Contato</span>
                      </div>
                      <p className="font-semibold text-sm">
                        {notes.length > 0
                          ? formatDistanceToNow(new Date(notes[0].created_at), { addSuffix: true, locale: ptBR })
                          : 'Nunca'}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border bg-amber-500/5 border-amber-500/20 p-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Star className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Prioridade</span>
                      </div>
                      <Badge className={cn('border text-xs', priCfg.color)}>
                        <div className={cn('w-1.5 h-1.5 rounded-full mr-1.5', priCfg.dot)} />
                        {priCfg.label}
                      </Badge>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-semibold">Tags</span>
                      </div>
                      <Dialog open={showTagsDialog} onOpenChange={setShowTagsDialog}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" />Gerenciar</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle className="flex items-center gap-2"><Tag className="h-5 w-5" />Gerenciar Tags</DialogTitle></DialogHeader>
                          <div className="py-4">
                            <div className="grid grid-cols-3 gap-2">
                              {AVAILABLE_TAGS.map(tag => (
                                <Button key={tag} variant={clientTags.includes(tag) ? 'default' : 'outline'} size="sm" onClick={() => setClientTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}>
                                  {clientTags.includes(tag) && <Check className="h-3 w-3 mr-1" />}{tag}
                                </Button>
                              ))}
                            </div>
                          </div>
                          <DialogFooter><Button onClick={() => setShowTagsDialog(false)}>Concluído</Button></DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                    {clientTags.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {clientTags.map(tag => (
                          <Badge key={tag} variant="secondary" className="cursor-pointer gap-1" onClick={() => setClientTags(prev => prev.filter(t => t !== tag))}>
                            {tag}<X className="h-2.5 w-2.5" />
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhuma tag. Clique em "Gerenciar" para adicionar.</p>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">Notas Internas</span>
                      {notes.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{notes.length}</Badge>}
                    </div>

                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Adicionar uma nota interna..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleAddNote(); }}
                        rows={2}
                        className="resize-none flex-1 text-sm"
                      />
                      <Button size="sm" className="self-end h-9 w-9 p-0" onClick={handleAddNote} disabled={savingNote || !newNote.trim()}>
                        {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>

                    {notes.length > 0 && (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        <AnimatePresence>
                          {notes.map(note => (
                            <motion.div
                              key={note.id}
                              initial={{ opacity: 0, y: -6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: -20 }}
                              className="relative rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 group overflow-hidden"
                            >
                              <div className="absolute top-0 left-0 w-0.5 h-full bg-amber-400/60 rounded-l-xl" />
                              <div className="pl-2">
                                {editingNoteId === note.id ? (
                                  <div className="space-y-2">
                                    <Textarea value={editingNoteContent} onChange={(e) => setEditingNoteContent(e.target.value)} rows={2} className="resize-none text-xs" autoFocus />
                                    <div className="flex gap-2 justify-end">
                                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEditingNoteId(null)}>Cancelar</Button>
                                      <Button size="sm" className="h-6 text-xs" onClick={() => handleSaveEditNote(note.id)}>Salvar</Button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <p className="text-sm leading-relaxed">{note.content}</p>
                                    <div className="flex items-center justify-between mt-1.5">
                                      <p className="text-[10px] text-muted-foreground">
                                        {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: ptBR })}
                                      </p>
                                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="w-5 h-5 rounded hover:bg-muted flex items-center justify-center" onClick={() => { setEditingNoteId(note.id); setEditingNoteContent(note.content); }}>
                                          <Edit2 className="h-2.5 w-2.5 text-muted-foreground" />
                                        </button>
                                        <button className="w-5 h-5 rounded hover:bg-destructive/10 flex items-center justify-center" onClick={() => handleDeleteNote(note.id)}>
                                          <Trash2 className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
                                        </button>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>

                  {/* ── PUBLICAÇÕES DO CLIENTE ── */}
                  {processPublicacoes.length > 0 && (
                    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Newspaper className="h-4 w-4 text-primary" />
                          <span className="text-sm font-semibold">Publicações INPI</span>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{processPublicacoes.length}</Badge>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary" onClick={() => handleQuickAction('processo')}>
                          Ver Ciclo Completo <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {processPublicacoes.slice(0, 5).map((pub: any) => {
                          const brandName = pub.brand_name_rpi || clientBrands.find((b: any) => b.id === pub.process_id)?.brand_name || '—';
                          const processNum = pub.process_number_rpi || clientBrands.find((b: any) => b.id === pub.process_id)?.process_number || '';
                          const PUB_STATUS: Record<string, { label: string; color: string; bg: string }> = {
                            depositada: { label: 'Depositada', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/40' },
                            '003': { label: '003', color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/40' },
                            oposicao: { label: 'Oposição', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/40' },
                            exigencia_merito: { label: 'Exig. Mérito', color: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/40' },
                            indeferimento: { label: 'Indeferimento', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/40' },
                            deferimento: { label: 'Deferimento', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
                            certificado: { label: 'Certificado', color: 'text-teal-700 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-900/40' },
                            renovacao: { label: 'Renovação', color: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-900/40' },
                            arquivado: { label: 'Arquivado', color: 'text-zinc-700 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-900/40' },
                          };
                          const sCfg = PUB_STATUS[pub.status] || PUB_STATUS['003'];
                          const dLeft = pub.proximo_prazo_critico ? Math.ceil((new Date(pub.proximo_prazo_critico).getTime() - Date.now()) / 86400000) : null;

                          const MINI_STEPS = [
                            { key: 'data_deposito', label: 'Depósito', icon: FileText },
                            { key: 'data_publicacao_rpi', label: 'RPI', icon: Newspaper },
                            { key: 'prazo_oposicao', label: 'Oposição', icon: Gavel },
                            { key: 'data_decisao', label: 'Decisão', icon: Shield },
                            { key: 'data_certificado', label: 'Certificado', icon: Award },
                            { key: 'data_renovacao', label: 'Renovação', icon: RefreshCw },
                          ] as const;

                          return (
                            <div key={pub.id} className="rounded-xl border border-border p-3 space-y-2.5 hover:border-primary/20 transition-colors">
                              {/* Header row */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold truncate">{brandName}</p>
                                  {processNum && <p className="text-[10px] text-muted-foreground font-mono">{processNum}</p>}
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <Badge className={cn('text-[10px] border-0', sCfg.bg, sCfg.color)}>{sCfg.label}</Badge>
                                  {dLeft !== null && (
                                    <Badge variant={dLeft < 0 ? 'destructive' : 'outline'} className={cn(
                                      'text-[10px]',
                                      dLeft < 0 && 'animate-pulse',
                                      dLeft >= 0 && dLeft <= 7 && 'border-red-500/50 text-red-600 dark:text-red-400',
                                      dLeft > 7 && dLeft <= 30 && 'border-amber-500/50 text-amber-600 dark:text-amber-400',
                                      dLeft > 30 && 'text-emerald-600 dark:text-emerald-400',
                                    )}>
                                      {dLeft < 0 ? `${Math.abs(dLeft)}d atrasado` : `${dLeft}d`}
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Deadline description */}
                              {pub.descricao_prazo && (
                                <p className="text-[10px] text-primary font-medium">{pub.descricao_prazo}</p>
                              )}

                              {/* Mini timeline */}
                              <div className="flex items-center gap-0.5">
                                {MINI_STEPS.map((step, idx) => {
                                  const date = pub[step.key] as string | null;
                                  const isCompleted = !!date && new Date(date) <= new Date();
                                  const StepIcon = step.icon;
                                  return (
                                    <div key={step.key} className="flex items-center">
                                      <div
                                        className={cn(
                                          'w-6 h-6 rounded-full flex items-center justify-center transition-all',
                                          isCompleted
                                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                                            : 'bg-muted text-muted-foreground/50'
                                        )}
                                        title={`${step.label}${date ? ` — ${format(new Date(date), 'dd/MM/yyyy')}` : ''}`}
                                      >
                                        <StepIcon className="w-3 h-3" />
                                      </div>
                                      {idx < MINI_STEPS.length - 1 && (
                                        <div className={cn('w-2 h-0.5', isCompleted ? 'bg-emerald-400' : 'bg-border')} />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ─── CONTACTS TAB ──────────────────────────────────────── */}
                <TabsContent value="contacts" className="mt-0 space-y-4">
                  {/* Link client UI for orphan publications */}
                  {client.id === '' ? (
                    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                          <UserCheck className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Vincular Cliente</p>
                          <p className="text-xs text-muted-foreground">Pesquise e atribua um cliente a esta publicação</p>
                        </div>
                      </div>
                      <Input
                        placeholder="Pesquisar por nome, email ou CPF/CNPJ..."
                        value={linkClientSearch}
                        onChange={e => setLinkClientSearch(e.target.value)}
                        className="h-9 text-sm"
                      />
                      {linkSearchLoading && (
                        <div className="flex items-center justify-center py-3">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      {!linkSearchLoading && linkClientResults.length > 0 && (
                        <div className="space-y-1 max-h-[250px] overflow-y-auto">
                          {linkClientResults.map(r => (
                            <div key={r.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{r.full_name || 'Sem nome'}</p>
                                <p className="text-xs text-muted-foreground truncate">{r.email}{r.cpf_cnpj ? ` · ${r.cpf_cnpj}` : ''}</p>
                              </div>
                              <Button
                                size="sm"
                                className="h-7 text-xs px-3"
                                disabled={linkingClient}
                                onClick={() => handleLinkClient(r.id)}
                              >
                                {linkingClient ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Vincular'}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      {!linkSearchLoading && linkClientSearch.length >= 2 && linkClientResults.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-3">Nenhum cliente encontrado</p>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Personal */}
                      <div className="rounded-2xl border border-border bg-card p-4">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-primary" />
                            <span className="text-sm font-semibold">Dados Pessoais</span>
                          </div>
                          {!editingContacts && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => {
                                setContactForm({
                                  full_name: client.full_name || profileData?.full_name || '',
                                  email: client.email || profileData?.email || '',
                                  cpf: profileData?.cpf || '',
                                  cnpj: profileData?.cnpj || '',
                                  phone: client.phone || profileData?.phone || '',
                                  company_name: client.company_name || profileData?.company_name || '',
                                  address: profileData?.address || '',
                                  neighborhood: profileData?.neighborhood || '',
                                  city: profileData?.city || '',
                                  state: profileData?.state || '',
                                  zip_code: profileData?.zip_code || '',
                                  origin: profileData?.origin || client.origin || 'site',
                                  client_funnel_type: profileData?.client_funnel_type || client.client_funnel_type || 'juridico',
                                  assigned_to: profileData?.assigned_to || client.assigned_to || '',
                                });
                                setEditingContacts(true);
                              }}
                            >
                              <Edit2 className="h-3 w-3" /> Editar
                            </Button>
                          )}
                        </div>

                        <AnimatePresence mode="wait">
                          {editingContacts ? (
                            <motion.div
                              key="editing"
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              className="space-y-3"
                            >
                              <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                  <Label className="text-xs text-muted-foreground">Nome Completo</Label>
                                  <Input value={contactForm.full_name} onChange={e => setContactForm((f: any) => ({ ...f, full_name: e.target.value }))} className="h-9 mt-1" />
                                </div>
                                <div className="col-span-2">
                                  <Label className="text-xs text-muted-foreground">E-mail</Label>
                                  <Input value={contactForm.email} disabled className="h-9 mt-1 opacity-60" />
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">CPF</Label>
                                  <Input value={contactForm.cpf} onChange={e => setContactForm((f: any) => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" className="h-9 mt-1 font-mono" />
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">CNPJ</Label>
                                  <Input value={contactForm.cnpj} onChange={e => setContactForm((f: any) => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" className="h-9 mt-1 font-mono" />
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">Telefone</Label>
                                  <Input value={contactForm.phone} onChange={e => setContactForm((f: any) => ({ ...f, phone: e.target.value }))} placeholder="(00) 00000-0000" className="h-9 mt-1" />
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">Empresa</Label>
                                  <Input value={contactForm.company_name} onChange={e => setContactForm((f: any) => ({ ...f, company_name: e.target.value }))} className="h-9 mt-1" />
                                </div>
                              </div>
                            </motion.div>
                          ) : (
                            <motion.div key="viewing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                              <InfoRow icon={User} label="Nome Completo" value={client.full_name} copyable />
                              <InfoRow icon={Hash} label="CPF" value={profileData?.cpf || client.cpf_cnpj} mono copyable />
                              <InfoRow icon={Hash} label="CNPJ" value={profileData?.cnpj} mono copyable />
                              <InfoRow icon={Mail} label="E-mail" value={client.email} copyable onAction={() => { if (client.email) setShowEmailCompose(true); }} />
                              <InfoRow icon={Phone} label="Telefone" value={client.phone} copyable link={`https://wa.me/55${client.phone?.replace(/\D/g,'')}`} />
                              <InfoRow icon={Building2} label="Empresa" value={client.company_name || profileData?.company_name} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Address */}
                      {(editingContacts || profileData?.address || profileData?.city) && (
                        <div className="rounded-2xl border border-border bg-card p-4">
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                            <MapPin className="h-4 w-4 text-primary" />
                            <span className="text-sm font-semibold">Endereço</span>
                          </div>
                          {editingContacts ? (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="col-span-2">
                                <Label className="text-xs text-muted-foreground">Logradouro</Label>
                                <Input value={contactForm.address} onChange={e => setContactForm((f: any) => ({ ...f, address: e.target.value }))} className="h-9 mt-1" />
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Bairro</Label>
                                <Input value={contactForm.neighborhood} onChange={e => setContactForm((f: any) => ({ ...f, neighborhood: e.target.value }))} className="h-9 mt-1" />
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Cidade</Label>
                                <Input value={contactForm.city} onChange={e => setContactForm((f: any) => ({ ...f, city: e.target.value }))} className="h-9 mt-1" />
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Estado (UF)</Label>
                                <Input value={contactForm.state} onChange={e => setContactForm((f: any) => ({ ...f, state: e.target.value }))} maxLength={2} className="h-9 mt-1 uppercase" />
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">CEP</Label>
                                <Input value={contactForm.zip_code} onChange={e => setContactForm((f: any) => ({ ...f, zip_code: e.target.value }))} placeholder="00000-000" className="h-9 mt-1 font-mono" />
                              </div>
                            </div>
                          ) : (
                            <>
                              <InfoRow icon={MapPin} label="Logradouro" value={[profileData?.address, profileData?.neighborhood].filter(Boolean).join(' – ')} />
                              <InfoRow icon={Globe} label="Cidade / Estado" value={[profileData?.city, profileData?.state].filter(Boolean).join(' – ')} />
                              <InfoRow icon={Hash} label="CEP" value={profileData?.zip_code} mono copyable />
                            </>
                          )}
                        </div>
                      )}

                      {/* Commercial Info - only in edit mode */}
                      {editingContacts && (
                        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card p-4">
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                            <Briefcase className="h-4 w-4 text-primary" />
                            <span className="text-sm font-semibold">Informações Comerciais</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs text-muted-foreground">Origem</Label>
                              <Select value={contactForm.origin || 'site'} onValueChange={v => setContactForm((f: any) => ({ ...f, origin: v }))}>
                                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="site">Site</SelectItem>
                                  <SelectItem value="indicacao">Indicação</SelectItem>
                                  <SelectItem value="google">Google</SelectItem>
                                  <SelectItem value="instagram">Instagram</SelectItem>
                                  <SelectItem value="facebook">Facebook</SelectItem>
                                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                  <SelectItem value="outro">Outro</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Funil</Label>
                              <Select value={contactForm.client_funnel_type || 'juridico'} onValueChange={v => setContactForm((f: any) => ({ ...f, client_funnel_type: v }))}>
                                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="comercial">Comercial</SelectItem>
                                  <SelectItem value="juridico">Jurídico</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs text-muted-foreground">Responsável</Label>
                              <Select value={contactForm.assigned_to || ''} onValueChange={v => setContactForm((f: any) => ({ ...f, assigned_to: v }))}>
                                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                                <SelectContent>
                                  {adminUsersList.map(a => (
                                    <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Save/Cancel buttons */}
                      {editingContacts && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setEditingContacts(false)}>
                            <X className="h-3 w-3 mr-1" /> Cancelar
                          </Button>
                          <Button size="sm" className="h-8 text-xs" disabled={savingContacts} onClick={async () => {
                            if (!client) return;
                            setSavingContacts(true);
                            try {
                              const cpfCnpj = contactForm.cpf || contactForm.cnpj || '';
                              const { error } = await supabase.from('profiles').update({
                                full_name: contactForm.full_name,
                                phone: contactForm.phone,
                                cpf: contactForm.cpf,
                                cnpj: contactForm.cnpj,
                                cpf_cnpj: cpfCnpj,
                                company_name: contactForm.company_name,
                                address: contactForm.address,
                                neighborhood: contactForm.neighborhood,
                                city: contactForm.city,
                                state: contactForm.state,
                                zip_code: contactForm.zip_code,
                                origin: contactForm.origin,
                                client_funnel_type: contactForm.client_funnel_type,
                                assigned_to: contactForm.assigned_to || null,
                              }).eq('id', client.id);
                              if (error) throw error;
                              toast.success('Dados atualizados com sucesso!');
                              setEditingContacts(false);
                              await fetchClientData();
                              onUpdate();
                            } catch (err: any) {
                              toast.error('Erro ao salvar: ' + (err.message || 'Tente novamente'));
                            } finally {
                              setSavingContacts(false);
                            }
                          }}>
                            {savingContacts ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                            Salvar
                          </Button>
                        </motion.div>
                      )}
                    </>
                  )}

                </TabsContent>

                {/* ─── SERVICES TAB ──────────────────────────────────────── */}
                <TabsContent value="services" className="mt-0 space-y-4">
                  {client.process_id ? (
                    <div className="space-y-4">
                      {/* Brand selector when client has multiple brands */}
                      {clientBrands.length > 1 && (
                        <div className="rounded-2xl border border-border bg-card p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Tag className="h-4 w-4 text-primary" />
                            <span className="text-sm font-semibold">Selecionar Marca</span>
                          </div>
                          <Select value={selectedServiceBrandId || ''} onValueChange={(v) => {
                            setSelectedServiceBrandId(v);
                            const brand = clientBrands.find(b => b.id === v);
                            if (brand) {
                              setEditData(prev => ({ ...prev, pipeline_stage: brand.pipeline_stage || 'protocolado' }));
                              setSelectedServiceType(brand.pipeline_stage || 'protocolado');
                            }
                          }}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Selecione uma marca" />
                            </SelectTrigger>
                            <SelectContent>
                              {clientBrands.map(b => (
                                <SelectItem key={b.id} value={b.id}>
                                  {b.brand_name} {b.process_number ? `(${b.process_number})` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Pipeline stage selector */}
                      <div className="rounded-2xl border border-border bg-card p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" />
                            <span className="text-sm font-semibold">Fase do Pipeline</span>
                          </div>
                          <Select value={editData.pipeline_stage} onValueChange={async (v) => {
                            setEditData(prev => ({ ...prev, pipeline_stage: v }));
                            setSelectedServiceType(v);
                            setActiveTab('services');
                            const targetProcessId = selectedServiceBrandId || client.process_id;
                            if (targetProcessId) {
                              await supabase.from('brand_processes').update({ pipeline_stage: v }).eq('id', targetProcessId);
                              toast.success('Pipeline atualizado!');
                              onUpdate();
                            }
                          }}>
                            <SelectTrigger className="h-8 w-auto text-xs border-0 bg-muted/50 rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {activeStages.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        {currentStage && (
                          <div className={cn('rounded-xl p-3 text-sm font-medium flex items-center gap-2', currentStage.bgColor, currentStage.textColor)}>
                            <div className="w-2 h-2 rounded-full bg-current opacity-80" />
                            {currentStage.label}
                          </div>
                        )}
                      </div>

                      {/* Service types - dynamic from Kanban stages */}
                      <div className="rounded-2xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                          <Package className="h-4 w-4 text-primary" />
                          <span className="text-sm font-semibold">Tipo de Serviço</span>
                        </div>
                        <div className="space-y-2">
                          {activeStages.map((stage, idx) => {
                            const isSelected = (editData.pipeline_stage || selectedServiceType) === stage.id;
                            const sentInfo = sentStagesMap[stage.id];
                            return (
                              <motion.button
                                key={stage.id}
                                whileTap={{ scale: 0.98 }}
                                className={cn(
                                  'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                                  sentInfo && !isSelected ? 'border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20' : '',
                                  isSelected ? 'border-primary/40 bg-primary/5' : !sentInfo ? 'border-border hover:border-primary/20 hover:bg-muted/30' : ''
                                )}
                                onClick={async () => {
                                  setSelectedServiceType(stage.id);
                                  setEditData(prev => ({ ...prev, pipeline_stage: stage.id }));
                                  setExpandedStageAction(prev => prev === stage.id ? null : stage.id);
                                    const targetProcessId = selectedServiceBrandId || client.process_id;
                                    if (targetProcessId) {
                                    await supabase.from('brand_processes').update({ pipeline_stage: stage.id }).eq('id', targetProcessId);
                                    toast.success(`Serviço: ${stage.label}`);
                                    onUpdate();
                                  }
                                }}
                              >
                                <div className={cn(
                                  'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                                  sentInfo ? 'bg-green-100 dark:bg-green-900/30' : isSelected ? 'bg-primary/20' : 'bg-muted/50'
                                )}>
                                  {sentInfo ? (
                                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                                  ) : (
                                    <span className={cn('text-xs font-bold', isSelected ? 'text-primary' : 'text-muted-foreground')}>{idx + 1}</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={cn('text-sm font-medium', isSelected && 'text-primary')}>{stage.label}</p>
                                  {sentInfo ? (
                                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">✓ Enviado em {new Date(sentInfo.sent_at).toLocaleDateString('pt-BR')}</p>
                                  ) : stage.description ? (
                                    <p className="text-xs text-muted-foreground">{stage.description}</p>
                                  ) : null}
                                </div>
                                {isSelected && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                              </motion.button>
                            );
                          })}
                        </div>

                        {/* Service Action Panel */}
                        <AnimatePresence>
                          {expandedStageAction && (() => {
                            const actionStage = activeStages.find(s => s.id === expandedStageAction);
                            if (!actionStage) return null;
                            return (
                              <ServiceActionPanel
                                key={expandedStageAction}
                                client={{
                                  id: client.id,
                                  full_name: client.full_name,
                                  email: client.email,
                                  phone: client.phone,
                                  brand_name: (() => {
                                    const targetBrand = clientBrands.find(b => b.id === selectedServiceBrandId);
                                    return targetBrand ? targetBrand.brand_name : (clientBrands.length > 0 ? clientBrands[0].brand_name : client.brand_name);
                                  })(),
                                  process_number: (() => {
                                    const targetBrand = clientBrands.find(b => b.id === selectedServiceBrandId);
                                    return targetBrand ? targetBrand.process_number : (clientBrands.length > 0 ? clientBrands[0].process_number : client.process_number);
                                  })(),
                                  process_id: selectedServiceBrandId || (clientBrands.length > 0 ? clientBrands[0].id : client.process_id),
                                }}
                                stage={actionStage}
                                onClose={() => setExpandedStageAction(null)}
                                onUpdate={() => {
                                  // Refresh sent history
                                  supabase
                                    .from('client_activities')
                                    .select('created_at, metadata, description')
                                    .eq('user_id', client.id)
                                    .eq('activity_type', 'notificacao_cobranca')
                                    .order('created_at', { ascending: false })
                                    .then(({ data }) => {
                                      if (!data) return;
                                      const map: Record<string, { sent_at: string; description: string }> = {};
                                      data.forEach((a: any) => {
                                        const stageId = a.metadata?.stage_id;
                                        if (stageId && !map[stageId]) {
                                          map[stageId] = { sent_at: a.created_at, description: a.description || '' };
                                        }
                                      });
                                      setSentStagesMap(map);
                                    });
                                  onUpdate();
                                }}
                                alreadySent={sentStagesMap[expandedStageAction] || null}
                              />
                            );
                          })()}
                        </AnimatePresence>
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      icon={Package}
                      title="Nenhum processo registrado"
                      description="Adicione um processo na aba Marcas para habilitar os serviços"
                    />
                  )}
                </TabsContent>

                {/* ─── APPOINTMENTS TAB ──────────────────────────────────── */}
                <TabsContent value="appointments" className="mt-0 space-y-4">
                  {/* New appointment form */}
                  <AnimatePresence>
                    {showNewAppointment ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3 overflow-hidden"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">Novo Agendamento</span>
                          <button className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center" onClick={() => setShowNewAppointment(false)}>
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <Input placeholder="Título do agendamento *" value={newAppointment.title} onChange={(e) => setNewAppointment({ ...newAppointment, title: e.target.value })} autoFocus />
                        <Textarea placeholder="Descrição (opcional)" rows={2} value={newAppointment.description} onChange={(e) => setNewAppointment({ ...newAppointment, description: e.target.value })} className="resize-none" />
                        <div className="grid grid-cols-2 gap-3">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start h-9 text-xs">
                                <CalendarIcon className="h-3.5 w-3.5 mr-2" />
                                {format(newAppointment.date, 'dd/MM/yyyy')}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar mode="single" selected={newAppointment.date} onSelect={(d) => d && setNewAppointment({ ...newAppointment, date: d })} initialFocus />
                            </PopoverContent>
                          </Popover>
                          <Input type="time" value={newAppointment.time} onChange={(e) => setNewAppointment({ ...newAppointment, time: e.target.value })} className="h-9 text-xs" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs mb-1">Duração</Label>
                            <Select value={newAppointment.duration} onValueChange={(v) => setNewAppointment({ ...newAppointment, duration: v })}>
                              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="15">15 min</SelectItem>
                                <SelectItem value="30">30 min</SelectItem>
                                <SelectItem value="45">45 min</SelectItem>
                                <SelectItem value="60">1 hora</SelectItem>
                                <SelectItem value="90">1h30</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-end">
                            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-border bg-card h-9 w-full text-xs">
                              <input type="checkbox" checked={newAppointment.generateMeet} onChange={(e) => setNewAppointment({ ...newAppointment, generateMeet: e.target.checked })} className="rounded" />
                              <Video className="h-3.5 w-3.5 text-blue-500" />
                              Google Meet
                            </label>
                          </div>
                        </div>
                        <Button size="sm" className="w-full h-8" onClick={handleCreateAppointment} disabled={savingAppointment || !newAppointment.title.trim()}>
                          {savingAppointment ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Plus className="h-3 w-3 mr-2" />}
                          Criar Agendamento
                        </Button>
                      </motion.div>
                    ) : (
                      <Button variant="outline" className="w-full h-10 border-dashed" onClick={() => setShowNewAppointment(true)}>
                        <Plus className="h-4 w-4 mr-2" />Novo Agendamento
                      </Button>
                    )}
                  </AnimatePresence>

                  {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                  ) : appointments.length === 0 ? (
                    <EmptyState icon={CalendarIcon} title="Nenhum agendamento" description="Crie agendamentos e compromissos para este cliente" />
                  ) : (
                    <div className="space-y-2">
                      <AnimatePresence>
                        {appointments.map((apt, i) => {
                          const isPast = new Date(apt.scheduled_at) < new Date();
                          const isOverdue = isPast && !apt.completed;
                          return (
                            <motion.div
                              key={apt.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -20 }}
                              transition={{ delay: i * 0.04 }}
                              className={cn(
                                'flex items-center gap-3 p-3 rounded-xl border group transition-all',
                                apt.completed ? 'border-emerald-500/20 bg-emerald-500/5 opacity-70' :
                                isOverdue ? 'border-red-500/20 bg-red-500/5' : 'border-border bg-card hover:bg-muted/20'
                              )}
                            >
                              <button
                                className={cn('w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                                  apt.completed ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/40 hover:border-primary')}
                                onClick={() => handleToggleAppointment(apt)}
                              >
                                {apt.completed && <Check className="h-3.5 w-3.5 text-white" />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className={cn('text-sm font-medium truncate', apt.completed && 'line-through text-muted-foreground')}>{apt.title}</p>
                                {apt.description && <p className="text-xs text-muted-foreground truncate">{apt.description}</p>}
                              </div>
                              {(apt as any).google_meet_link && (
                                <a
                                  href={(apt as any).google_meet_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500 hover:bg-blue-500/20 transition-colors text-xs font-medium flex-shrink-0"
                                >
                                  <Video className="h-3.5 w-3.5" />
                                  Meet
                                </a>
                              )}
                              <div className="text-right flex-shrink-0">
                                <p className={cn('text-xs font-semibold', isOverdue && 'text-red-400')}>
                                  {format(new Date(apt.scheduled_at), 'dd/MM/yyyy')}
                                </p>
                                <p className="text-[10px] text-muted-foreground">{format(new Date(apt.scheduled_at), 'HH:mm')}</p>
                              </div>
                              <button
                                className="w-6 h-6 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 flex items-center justify-center transition-all"
                                onClick={() => handleDeleteAppointment(apt.id)}
                              >
                                <Trash2 className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </TabsContent>

                {/* ─── ATTACHMENTS TAB ───────────────────────────────────── */}
                <TabsContent value="attachments" className="mt-0 space-y-4">
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { const filesCopy = e.target.files ? new DataTransfer() : null; if (e.target.files) { Array.from(e.target.files).forEach(f => filesCopy!.items.add(f)); } handleFileUpload(filesCopy?.files ?? null).finally(() => { if (e.target) e.target.value = ''; }); }} />

                  {/* Drop zone */}
                  <div
                    role="button"
                    tabIndex={0}
                    className={cn(
                      'border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer select-none',
                      dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/20'
                    )}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); fileInputRef.current?.click(); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileUpload(e.dataTransfer.files); }}
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground">Enviando...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Upload className="h-6 w-6 text-primary" />
                        </div>
                        <p className="font-medium text-sm">Arraste arquivos ou clique para selecionar</p>
                        <p className="text-xs text-muted-foreground">PDF, imagens, docs — qualquer formato</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">📌 Arquivos enviados aqui ficam disponíveis na área do cliente</p>
                      </div>
                    )}
                  </div>

                  {loading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                  ) : documents.length === 0 ? (
                    <div className="cursor-pointer" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                      <EmptyState icon={Paperclip} title="Nenhum arquivo" description="Clique aqui ou na área acima para enviar documentos ao cliente" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-muted-foreground">{documents.length} arquivo(s)</p>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                          <Plus className="h-3 w-3" /> Adicionar
                        </Button>
                      </div>
                      <AnimatePresence>
                        {documents.map(doc => (
                          <motion.div
                            key={doc.id}
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/20 transition-colors group"
                          >
                            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                              <DocIcon mime={doc.mime_type} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{doc.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {fmtBytes(doc.file_size)}{doc.file_size ? ' · ' : ''}{format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" download><ExternalLink className="h-3.5 w-3.5" /></a>
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => handleDeleteDocument(doc)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </TabsContent>

                {/* ─── FINANCIAL TAB ─────────────────────────────────────── */}
                <TabsContent value="financial" className="mt-0 space-y-4">
                  {/* Summary card */}
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">Resumo Financeiro</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Total', value: invoices.reduce((a, i) => a + Number(i.amount), 0), color: 'text-foreground' },
                        { label: 'Pago', value: invoices.filter(i => i.status === 'paid').reduce((a, i) => a + Number(i.amount), 0), color: 'text-emerald-500' },
                        { label: 'Pendente', value: invoices.filter(i => i.status !== 'paid').reduce((a, i) => a + Number(i.amount), 0), color: 'text-amber-500' },
                      ].map(item => (
                        <div key={item.label} className="text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{item.label}</p>
                          <p className={cn('font-bold text-sm', item.color)}>
                            {item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {loading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                  ) : invoices.length === 0 ? (
                    <EmptyState icon={CreditCard} title="Nenhuma fatura" description="As faturas deste cliente aparecerão aqui" />
                  ) : (
                    <div className="space-y-2">
                      <AnimatePresence>
                        {invoices.map((inv, i) => {
                          const STATUS = {
                            paid: { label: 'Paga', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
                            pending: { label: 'Pendente', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
                            overdue: { label: 'Vencida', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
                          }[inv.status] || { label: inv.status, cls: 'bg-muted text-muted-foreground' };
                          return (
                            <motion.div
                              key={inv.id}
                              initial={{ opacity: 0, y: -6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.04 }}
                              className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card"
                            >
                              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                <Receipt className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{inv.description}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  Vence: {format(new Date(inv.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="font-bold text-sm">{Number(inv.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                <Badge className={cn('border text-[10px] h-4 px-1.5', STATUS.cls)}>{STATUS.label}</Badge>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </TabsContent>

                {/* ─── BRANDS TAB ──────────────────────────────────────── */}
                <TabsContent value="brands" className="mt-0 space-y-4">
                  {loading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <Tag className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-sm font-semibold">{clientBrands.length} marca{clientBrands.length !== 1 ? 's' : ''} registrada{clientBrands.length !== 1 ? 's' : ''}</span>
                        </div>
                        <Dialog open={showAddProcessDialog} onOpenChange={setShowAddProcessDialog}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline" className="h-8 text-xs">
                              <Plus className="h-3.5 w-3.5 mr-1" />Adicionar Marca
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Adicionar Processo de Marca</DialogTitle></DialogHeader>
                            <DialogDescription>Adicione uma nova marca ao portfólio deste cliente.</DialogDescription>
                            <div className="space-y-4 py-4">
                              <div><Label>Nome da Marca *</Label><Input placeholder="Ex: WebMarcas" value={newProcess.brand_name} onChange={(e) => setNewProcess({...newProcess, brand_name: e.target.value})} /></div>
                              <div><Label>Número do Processo (INPI)</Label><Input placeholder="Ex: 928374651" value={newProcess.process_number} onChange={(e) => setNewProcess({...newProcess, process_number: e.target.value})} /></div>
                              <div><Label>Fase do Pipeline</Label>
                                <Select value={newProcess.pipeline_stage} onValueChange={(v) => setNewProcess({...newProcess, pipeline_stage: v})}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>{activeStages.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                              <div><Label>Área de Atuação</Label><Input placeholder="Ex: Tecnologia" value={newProcess.business_area} onChange={(e) => setNewProcess({...newProcess, business_area: e.target.value})} /></div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setShowAddProcessDialog(false)}>Cancelar</Button>
                              <Button onClick={handleCreateProcess}>Criar Processo</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                      {clientBrands.length === 0 ? (
                        <EmptyState icon={Tag} title="Nenhuma marca" description="Clique em 'Adicionar Marca' para registrar a primeira marca deste cliente" />
                      ) : (
                      <AnimatePresence>
                        {clientBrands.map((brand, i) => {
                          const stageInfo = activeStages.find(s => s.id === brand.pipeline_stage) || activeStages[0];
                          const isExpanded = expandedBrandId === brand.id;
                          return (
                            <div key={brand.id}>
                              <motion.div
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className={cn(
                                  "rounded-2xl border border-border bg-card p-4 space-y-3 cursor-pointer transition-all hover:shadow-md hover:border-primary/30",
                                  isExpanded && "border-primary/50 shadow-md"
                                )}
                                onClick={() => {
                                  if (isExpanded) {
                                    setExpandedBrandId(null);
                                  } else {
                                    setExpandedBrandId(brand.id);
                                    setEditingBrandData({
                                      brand_name: brand.brand_name || '',
                                      process_number: brand.process_number || '',
                                      inpi_protocol: brand.inpi_protocol || '',
                                      ncl_classes: brand.ncl_classes ? brand.ncl_classes.join(', ') : '',
                                      business_area: brand.business_area || '',
                                      status: brand.status || 'em_andamento',
                                      pipeline_stage: normalizePipelineStageId(brand.pipeline_stage) || 'protocolado',
                                      deposit_date: brand.deposit_date || '',
                                      grant_date: brand.grant_date || '',
                                      expiry_date: brand.expiry_date || '',
                                      next_step: brand.next_step || '',
                                      next_step_date: brand.next_step_date || '',
                                      notes: brand.notes || '',
                                    });
                                  }
                                }}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${stageInfo.color}20` }}>
                                      <Tag className="h-4 w-4" style={{ color: stageInfo.color }} />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-semibold text-sm truncate">{brand.brand_name}</p>
                                      {brand.business_area && <p className="text-xs text-muted-foreground line-clamp-2">{brand.business_area}</p>}
                                      {/* Publication status for this brand */}
                                      {(() => {
                                        const linkedPub = processPublicacoes.find((p: any) => p.process_id === brand.id);
                                        if (!linkedPub) return null;
                                        const BRAND_PUB_STATUS: Record<string, { label: string; color: string; bg: string }> = {
                                          depositada: { label: 'Depositada', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/40' },
                                          '003': { label: '003', color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/40' },
                                          oposicao: { label: 'Oposição', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/40' },
                                          exigencia_merito: { label: 'Exig. Mérito', color: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/40' },
                                          indeferimento: { label: 'Indeferimento', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/40' },
                                          deferimento: { label: 'Deferimento', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
                                          certificado: { label: 'Certificado', color: 'text-teal-700 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-900/40' },
                                          renovacao: { label: 'Renovação', color: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-900/40' },
                                          arquivado: { label: 'Arquivado', color: 'text-zinc-700 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-900/40' },
                                        };
                                        const bCfg = BRAND_PUB_STATUS[linkedPub.status] || BRAND_PUB_STATUS.depositada;
                                        const bDays = linkedPub.proximo_prazo_critico ? Math.ceil((new Date(linkedPub.proximo_prazo_critico).getTime() - Date.now()) / 86400000) : null;
                                        return (
                                          <div className="flex items-center gap-1.5 mt-1">
                                            <Badge className={cn('text-[9px] h-4 px-1.5 border-0', bCfg.bg, bCfg.color)}>{bCfg.label}</Badge>
                                            {bDays !== null && (
                                              <span className={cn('text-[9px] font-medium',
                                                bDays < 0 ? 'text-red-500' : bDays <= 7 ? 'text-red-400' : bDays <= 30 ? 'text-amber-500' : 'text-emerald-500'
                                              )}>
                                                {bDays < 0 ? `${Math.abs(bDays)}d atrasado` : `${bDays}d`}
                                              </span>
                                            )}
                                            {linkedPub.descricao_prazo && <span className="text-[9px] text-muted-foreground truncate max-w-[120px]">{linkedPub.descricao_prazo}</span>}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge className="border text-[10px] h-5 px-2 flex-shrink-0" style={{ backgroundColor: `${stageInfo.color}15`, color: stageInfo.color, borderColor: `${stageInfo.color}30` }}>
                                      {stageInfo.label}
                                    </Badge>
                                    <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  {brand.process_number && (
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                      <Hash className="h-3 w-3" />
                                      <span className="font-mono">{brand.process_number}</span>
                                    </div>
                                  )}
                                  {brand.ncl_classes && brand.ncl_classes.length > 0 && (
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                      <Briefcase className="h-3 w-3" />
                                      <span>NCL: {brand.ncl_classes.join(', ')}</span>
                                    </div>
                                  )}
                                  {brand.status && (
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                      <Activity className="h-3 w-3" />
                                      <span>{brand.status === 'em_andamento' ? 'Em andamento' : brand.status}</span>
                                    </div>
                                  )}
                                  {brand.created_at && (
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                      <CalendarIcon className="h-3 w-3" />
                                      <span>{format(new Date(brand.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                                    </div>
                                  )}
                                </div>
                              </motion.div>

                              {/* ─── INLINE BRAND EDITOR ─── */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                                    className="overflow-hidden"
                                  >
                                    <div className="rounded-2xl border border-border bg-card p-5 mt-2 space-y-4" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-bold flex items-center gap-2">
                                          <Edit2 className="h-4 w-4 text-primary" />
                                          Detalhes da Marca
                                        </h4>
                                        <div className="flex items-center gap-2">
                                          <Button size="sm" variant="ghost" onClick={() => setExpandedBrandId(null)}>
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                          <Label className="text-xs">Nome da Marca</Label>
                                          <Input value={editingBrandData.brand_name || ''} onChange={(e) => setEditingBrandData((p: any) => ({ ...p, brand_name: e.target.value }))} className="h-9 text-sm" />
                                        </div>
                                        <div className="space-y-1.5">
                                          <Label className="text-xs">Nº Processo INPI</Label>
                                          <Input value={editingBrandData.process_number || ''} onChange={(e) => setEditingBrandData((p: any) => ({ ...p, process_number: e.target.value }))} className="h-9 text-sm font-mono" />
                                        </div>
                                        <div className="space-y-1.5">
                                          <Label className="text-xs">Protocolo INPI</Label>
                                          <Input value={editingBrandData.inpi_protocol || ''} onChange={(e) => setEditingBrandData((p: any) => ({ ...p, inpi_protocol: e.target.value }))} className="h-9 text-sm font-mono" />
                                        </div>
                                        <div className="space-y-1.5">
                                          <Label className="text-xs">Classes NCL (vírgula)</Label>
                                          <Input value={editingBrandData.ncl_classes || ''} onChange={(e) => setEditingBrandData((p: any) => ({ ...p, ncl_classes: e.target.value }))} className="h-9 text-sm" placeholder="25, 35" />
                                        </div>
                                        <div className="space-y-1.5">
                                          <Label className="text-xs">Ramo de Atividade</Label>
                                          <Input value={editingBrandData.business_area || ''} onChange={(e) => setEditingBrandData((p: any) => ({ ...p, business_area: e.target.value }))} className="h-9 text-sm" />
                                        </div>
                                        <div className="space-y-1.5">
                                          <Label className="text-xs">Status</Label>
                                          <Select value={editingBrandData.status || 'em_andamento'} onValueChange={(v) => setEditingBrandData((p: any) => ({ ...p, status: v }))}>
                                            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="em_andamento">Em andamento</SelectItem>
                                              <SelectItem value="003">003</SelectItem>
                                              <SelectItem value="oposicao">Oposição</SelectItem>
                                              <SelectItem value="exigencia_merito">Exigência de Mérito</SelectItem>
                                              <SelectItem value="indeferimento">Indeferimento</SelectItem>
                                              <SelectItem value="deferimento">Deferimento</SelectItem>
                                              <SelectItem value="certificado">Certificado</SelectItem>
                                              <SelectItem value="renovacao">Renovação</SelectItem>
                                              <SelectItem value="arquivado">Arquivado</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="space-y-1.5 col-span-2">
                                          <Label className="text-xs">Fase do Pipeline</Label>
                                          <Select value={normalizePipelineStageId(editingBrandData.pipeline_stage) || 'protocolado'} onValueChange={(v) => setEditingBrandData((p: any) => ({ ...p, pipeline_stage: v }))}>
                                            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              {activeStages.map(stage => (
                                                <SelectItem key={stage.id} value={stage.id}>{stage.label}</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                          <Label className="text-xs">Data Depósito</Label>
                                          <Input type="date" value={editingBrandData.deposit_date || ''} onChange={(e) => setEditingBrandData((p: any) => ({ ...p, deposit_date: e.target.value }))} className="h-9 text-sm" />
                                        </div>
                                        <div className="space-y-1.5">
                                          <Label className="text-xs">Data Concessão</Label>
                                          <Input type="date" value={editingBrandData.grant_date || ''} onChange={(e) => setEditingBrandData((p: any) => ({ ...p, grant_date: e.target.value }))} className="h-9 text-sm" />
                                        </div>
                                        <div className="space-y-1.5">
                                          <Label className="text-xs">Data Validade</Label>
                                          <Input type="date" value={editingBrandData.expiry_date || ''} onChange={(e) => setEditingBrandData((p: any) => ({ ...p, expiry_date: e.target.value }))} className="h-9 text-sm" />
                                        </div>
                                        <div className="space-y-1.5">
                                          <Label className="text-xs">Data Próximo Passo</Label>
                                          <Input type="date" value={editingBrandData.next_step_date || ''} onChange={(e) => setEditingBrandData((p: any) => ({ ...p, next_step_date: e.target.value }))} className="h-9 text-sm" />
                                        </div>
                                        <div className="space-y-1.5 col-span-2">
                                          <Label className="text-xs">Próximo Passo</Label>
                                          <Input value={editingBrandData.next_step || ''} onChange={(e) => setEditingBrandData((p: any) => ({ ...p, next_step: e.target.value }))} className="h-9 text-sm" placeholder="Ex: Aguardando publicação RPI" />
                                        </div>
                                        <div className="space-y-1.5 col-span-2">
                                          <Label className="text-xs">Notas / Observações</Label>
                                          <Textarea value={editingBrandData.notes || ''} onChange={(e) => setEditingBrandData((p: any) => ({ ...p, notes: e.target.value }))} className="text-sm min-h-[80px]" placeholder="Observações gerais sobre esta marca..." />
                                        </div>
                                      </div>

                                      <div className="flex gap-2">
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          className="flex-shrink-0"
                                          onClick={() => setDeletingBrandId(brand.id)}
                                        >
                                          <Trash2 className="h-4 w-4 mr-1" />
                                          Excluir
                                        </Button>
                                        <Button
                                          className="flex-1"
                                          disabled={savingBrand || !editingBrandData.brand_name?.trim()}
                                          onClick={async () => {
                                            setSavingBrand(true);
                                            try {
                                              const nclParsed = editingBrandData.ncl_classes
                                                ? editingBrandData.ncl_classes.split(',').map((c: string) => parseInt(c.trim(), 10)).filter((n: number) => !isNaN(n))
                                                : null;
                                              const normalizedPipelineStage =
                                                normalizePipelineStageId(editingBrandData.pipeline_stage) ||
                                                normalizePipelineStageId(brand.pipeline_stage) ||
                                                'protocolado';
                                              const { error } = await supabase.from('brand_processes').update({
                                                brand_name: editingBrandData.brand_name,
                                                process_number: editingBrandData.process_number || null,
                                                inpi_protocol: editingBrandData.inpi_protocol || null,
                                                ncl_classes: nclParsed && nclParsed.length > 0 ? nclParsed : null,
                                                business_area: editingBrandData.business_area || null,
                                                status: editingBrandData.status,
                                                pipeline_stage: normalizedPipelineStage,
                                                deposit_date: editingBrandData.deposit_date || null,
                                                grant_date: editingBrandData.grant_date || null,
                                                expiry_date: editingBrandData.expiry_date || null,
                                                next_step: editingBrandData.next_step || null,
                                                next_step_date: editingBrandData.next_step_date || null,
                                                notes: editingBrandData.notes || null,
                                              }).eq('id', brand.id);
                                              if (error) throw error;

                                              const pubStatusMap: Record<string, string> = {
                                                '003': '003', oposicao: 'oposicao', exigencia_merito: 'exigencia_merito',
                                                indeferimento: 'indeferimento', deferimento: 'deferimento',
                                                certificado: 'certificado', renovacao: 'renovacao', arquivado: 'arquivado',
                                              };
                                              const mappedPubStatus = pubStatusMap[editingBrandData.status];
                                              if (mappedPubStatus) {
                                                await supabase.from('publicacoes_marcas').update({ status: mappedPubStatus }).eq('process_id', brand.id);
                                              }

                                              toast.success('Marca atualizada com sucesso!');
                                              setExpandedBrandId(null);
                                              fetchClientData();
                                              onUpdate();
                                            } catch (err: any) {
                                              toast.error('Erro ao salvar: ' + err.message);
                                            } finally {
                                              setSavingBrand(false);
                                            }
                                          }}
                                        >
                                          {savingBrand ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                                          Salvar Alterações
                                        </Button>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </AnimatePresence>
                      )}
                    </div>
                  )}
                </TabsContent>

              </div>
            </ScrollArea>
          </Tabs>
          )}
        </div>

        {/* ──────────────────────────── FOOTER ────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-border bg-background/95 backdrop-blur px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              Ativo
            </span>
            <span className="font-semibold text-foreground">
              {contractValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {notes.length > 0 ? formatDistanceToNow(new Date(notes[0].created_at), { addSuffix: true, locale: ptBR }) : 'Nunca'}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button size="sm" onClick={() => setShowEditDialog(true)}>
              <Edit2 className="h-3.5 w-3.5 mr-1.5" />Editar
            </Button>
          </div>
        </div>

        {/* ─── Pricing Dialog ──────────────────────────────────────────────── */}
        <Dialog open={showPricingDialog} onOpenChange={setShowPricingDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-emerald-600" />Selecionar Valor</DialogTitle></DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div className="py-4 space-y-2 pr-3">
                <RadioGroup value={selectedPricing} onValueChange={(v) => { setSelectedPricing(v); const opt = SERVICE_PRICING_OPTIONS.find(o => o.id === v); if (opt && v !== 'personalizado') setEditData(prev => ({ ...prev, contract_value: opt.value })); }}>
                  {SERVICE_PRICING_OPTIONS.map(option => (
                    <div key={option.id} className={cn('flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all', selectedPricing === option.id ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border hover:border-emerald-300/40')}
                      onClick={() => { setSelectedPricing(option.id); const opt = SERVICE_PRICING_OPTIONS.find(o => o.id === option.id); if (opt && option.id !== 'personalizado') setEditData(prev => ({ ...prev, contract_value: opt.value })); }}>
                      <RadioGroupItem value={option.id} id={option.id} className="mt-1" />
                      <div className="flex-1">
                        <label htmlFor={option.id} className="font-medium text-sm cursor-pointer">{option.label}</label>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                        {option.id !== 'personalizado' && <p className="text-sm font-bold text-emerald-600 mt-0.5">R$ {option.value.toLocaleString('pt-BR')}</p>}
                      </div>
                    </div>
                  ))}
                </RadioGroup>
                <AnimatePresence>
                  {selectedPricing === 'personalizado' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3 pt-2 overflow-hidden">
                      <div><Label>Valor (R$)</Label><Input type="number" placeholder="0,00" value={customValue || ''} onChange={(e) => { const v = Number(e.target.value); setCustomValue(v); setEditData(prev => ({ ...prev, contract_value: v })); }} className="mt-1" /></div>
                      <div><Label>Motivo</Label><Textarea placeholder="Motivo do valor personalizado..." value={customValueReason} onChange={(e) => setCustomValueReason(e.target.value)} rows={2} className="mt-1 resize-none" /></div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPricingDialog(false)}>Cancelar</Button>
              <Button onClick={() => { setShowPricingDialog(false); handleSaveQuickChanges(); toast.success(`Valor: ${editData.contract_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`); }} className="bg-emerald-600 hover:bg-emerald-700">
                <Check className="h-4 w-4 mr-2" />Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Edit Dialog ─────────────────────────────────────────────────── */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh]">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit2 className="h-5 w-5" />Editar Cliente</DialogTitle></DialogHeader>
            <ScrollArea className="max-h-[65vh] pr-2">
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="col-span-2"><Label>Nome Completo</Label><Input value={editFormData.full_name} onChange={(e) => setEditFormData({...editFormData, full_name: e.target.value})} placeholder="Nome completo" /></div>
                <div><Label>E-mail</Label><Input type="email" value={editFormData.email} onChange={(e) => setEditFormData({...editFormData, email: e.target.value})} placeholder="email@exemplo.com" /></div>
                <div><Label>Telefone</Label><Input value={editFormData.phone} onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})} placeholder="(11) 99999-9999" /></div>
                <div><Label>CPF</Label><Input value={editFormData.cpf} onChange={(e) => setEditFormData({...editFormData, cpf: e.target.value})} placeholder="000.000.000-00" /></div>
                <div><Label>CNPJ</Label><Input value={editFormData.cnpj} onChange={(e) => setEditFormData({...editFormData, cnpj: e.target.value})} placeholder="00.000.000/0001-00" /></div>
                <div><Label>Empresa</Label><Input value={editFormData.company_name} onChange={(e) => setEditFormData({...editFormData, company_name: e.target.value})} placeholder="Nome da empresa" /></div>
                <div className="col-span-2"><Label>Endereço</Label><Input value={editFormData.address} onChange={(e) => setEditFormData({...editFormData, address: e.target.value})} placeholder="Rua, número" /></div>
                <div><Label>Bairro</Label><Input value={editFormData.neighborhood} onChange={(e) => setEditFormData({...editFormData, neighborhood: e.target.value})} placeholder="Bairro" /></div>
                <div><Label>Cidade</Label><Input value={editFormData.city} onChange={(e) => setEditFormData({...editFormData, city: e.target.value})} placeholder="Cidade" /></div>
                <div><Label>Estado</Label>
                  <Select value={editFormData.state} onValueChange={(v) => setEditFormData({...editFormData, state: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>CEP</Label><Input value={editFormData.zip_code} onChange={(e) => setEditFormData({...editFormData, zip_code: e.target.value})} placeholder="00000-000" /></div>
                {client?.process_id && (
                  <>
                    <div><Label>Nome da Marca</Label><Input value={editFormData.brand_name} onChange={(e) => setEditFormData({...editFormData, brand_name: e.target.value})} placeholder="Nome da marca" /></div>
                    <div><Label>Ramo de Atividade</Label><Input value={editFormData.business_area} onChange={(e) => setEditFormData({...editFormData, business_area: e.target.value})} placeholder="Ex: Tecnologia" /></div>
                  </>
                )}
                <div><Label>Prioridade</Label>
                  <Select value={editFormData.priority} onValueChange={(v) => setEditFormData({...editFormData, priority: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="low">Baixa</SelectItem><SelectItem value="medium">Média</SelectItem><SelectItem value="high">Alta</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Origem</Label>
                  <Select value={editFormData.origin} onValueChange={(v) => setEditFormData({...editFormData, origin: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="site">Site</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="indicacao">Indicação</SelectItem><SelectItem value="instagram">Instagram</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label className="flex items-center gap-1"><UserCheck className="h-3.5 w-3.5" />Atribuir a</Label>
                  <Select value={editFormData.assigned_to} onValueChange={(v) => setEditFormData({...editFormData, assigned_to: v === 'none' ? '' : v})}>
                    <SelectTrigger><SelectValue placeholder="Não atribuído" /></SelectTrigger>
                    <SelectContent className="max-h-60"><SelectItem value="none">Nenhum</SelectItem>{adminUsersList.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
              <Button onClick={handleSaveFullEdit} disabled={savingEdit}>
                {savingEdit ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Move Dialog ──────────────────────────────────────────────────── */}
        <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowUpRight className="h-5 w-5 text-blue-600" />Mover para Funil</DialogTitle></DialogHeader>
            <div className="py-4 space-y-3">
              <p className="text-sm text-muted-foreground">Funil atual: <strong>{(client?.client_funnel_type || 'juridico') === 'comercial' ? 'Comercial' : 'Jurídico'}</strong></p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'comercial', label: 'Comercial', desc: 'Pipeline de vendas', Icon: Building2, color: 'blue' },
                  { id: 'juridico', label: 'Jurídico', desc: 'Processos INPI', Icon: Lock, color: 'purple' },
                ].map(({ id, label, desc, Icon, color }) => {
                  const isCurrent = (client?.client_funnel_type || 'juridico') === id;
                  return (
                    <button key={id} className={cn('p-4 rounded-xl border-2 text-center transition-all', isCurrent ? `border-${color}-500 bg-${color}-50 dark:bg-${color}-950/30 opacity-50 cursor-not-allowed` : `border-border hover:border-${color}-500 hover:bg-${color}-50 dark:hover:bg-${color}-950/20`)} disabled={isCurrent} onClick={() => handleMoveFunnel(id as any)}>
                      <Icon className={`h-8 w-8 mx-auto mb-2 text-${color}-600`} />
                      <p className="font-semibold text-sm">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setShowMoveDialog(false)}>Cancelar</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Notification Dialog ──────────────────────────────────────────── */}
        <Dialog open={showNotificationDialog} onOpenChange={setShowNotificationDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Enviar Notificação</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              {notificationTemplates.length > 0 && (
                <div>
                  <Label>Template</Label>
                  <Select onValueChange={(v) => { const tpl = notificationTemplates.find(t => t.id === v); if (tpl) setNotificationForm(prev => ({ ...prev, title: tpl.title, message: tpl.message, type: tpl.type })); }}>
                    <SelectTrigger><SelectValue placeholder="Selecionar template…" /></SelectTrigger>
                    <SelectContent>{notificationTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div><Label>Título *</Label><Input value={notificationForm.title} onChange={(e) => setNotificationForm(prev => ({ ...prev, title: e.target.value }))} placeholder="Título da notificação" /></div>
              <div><Label>Mensagem *</Label><Textarea value={notificationForm.message} onChange={(e) => setNotificationForm(prev => ({ ...prev, message: e.target.value }))} rows={3} className="resize-none" placeholder="Conteúdo da notificação…" /></div>
              <div><Label>Link (opcional)</Label><Input value={notificationForm.link} onChange={(e) => setNotificationForm(prev => ({ ...prev, link: e.target.value }))} placeholder="/cliente/processos" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNotificationDialog(false)}>Cancelar</Button>
              <Button onClick={async () => {
                if (!notificationForm.title || !notificationForm.message || !client) return;
                try {
                  await supabase.from('notifications').insert({ user_id: client.id, title: notificationForm.title, message: notificationForm.message, type: notificationForm.type, link: notificationForm.link || null, read: false });
                  toast.success('Notificação enviada!');
                  setShowNotificationDialog(false);
                } catch { toast.error('Erro ao enviar notificação'); }
              }} disabled={!notificationForm.title || !notificationForm.message}>
                <Send className="h-4 w-4 mr-2" />Enviar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>

      {/* ─── HIDDEN RPI FILE INPUT ─── */}
      <input ref={rpiFileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => handleRpiUpload(e.target.files)} />

      {/* ─── EDIT PUB DIALOG ─── */}
      <Dialog open={showEditPubDialog} onOpenChange={setShowEditPubDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit2 className="h-5 w-5" />Editar Publicação</DialogTitle>
            <DialogDescription>Atualize datas, status e informações da publicação.</DialogDescription>
          </DialogHeader>
          {editingPubData && (
            <ScrollArea className="max-h-[60vh] pr-2">
              <div className="space-y-4 py-4">
                <div>
                  <Label>Status</Label>
                  <Select value={editingPubData.status} onValueChange={(v) => setEditingPubData((prev: any) => ({ ...prev, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['003','oposicao','exigencia_merito','indeferimento','deferimento','certificado','renovacao','arquivado'].map(s => (
                        <SelectItem key={s} value={s}>{s === '003' ? '003' : s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de Publicação</Label>
                  <Select value={editingPubData.tipo_publicacao} onValueChange={(v) => setEditingPubData((prev: any) => ({ ...prev, tipo_publicacao: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="publicacao_rpi">Publicação RPI</SelectItem>
                      <SelectItem value="oposicao">Oposição</SelectItem>
                      <SelectItem value="exigencia">Exigência</SelectItem>
                      <SelectItem value="deferimento">Deferimento</SelectItem>
                      <SelectItem value="indeferimento">Indeferimento</SelectItem>
                      <SelectItem value="certificado">Certificado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Nº RPI</Label><Input value={editingPubData.rpi_number} onChange={(e) => setEditingPubData((prev: any) => ({ ...prev, rpi_number: e.target.value }))} placeholder="Ex: 2801" /></div>
                {['data_deposito', 'data_publicacao_rpi', 'prazo_oposicao', 'data_decisao', 'data_certificado', 'data_renovacao'].map(field => (
                  <div key={field}>
                    <Label>{field.replace('data_', '').replace('prazo_', 'Prazo ').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</Label>
                    <Input type="date" value={editingPubData[field] || ''} onChange={(e) => setEditingPubData((prev: any) => ({ ...prev, [field]: e.target.value }))} />
                  </div>
                ))}
                <div><Label>Comentários Internos</Label><Textarea value={editingPubData.comentarios_internos} onChange={(e) => setEditingPubData((prev: any) => ({ ...prev, comentarios_internos: e.target.value }))} rows={3} className="resize-none" /></div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditPubDialog(false)}>Cancelar</Button>
            <Button onClick={handleSavePub} disabled={savingPub}>
              {savingPub ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DELETE PUB CONFIRM ─── */}
      <AlertDialog open={showDeletePubConfirm} onOpenChange={setShowDeletePubConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Excluir Publicação</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta publicação? Esta ação é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowDeletePubConfirm(false); setDeletingPubId(null); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePub} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── DELETE BRAND CONFIRM ─── */}
      <AlertDialog open={!!deletingBrandId} onOpenChange={(open) => { if (!open) setDeletingBrandId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Excluir Marca</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta marca e todos os dados vinculados (publicações, contratos, documentos)? Esta ação é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingBrandId(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deletingBrandId) return;
                try {
                  // Delete linked publicacoes_marcas first
                  await supabase.from('publicacoes_marcas').delete().eq('process_id', deletingBrandId);
                  // Delete the brand process
                  const { error } = await supabase.from('brand_processes').delete().eq('id', deletingBrandId);
                  if (error) throw error;
                  toast.success('Marca excluída com sucesso!');
                  setDeletingBrandId(null);
                  setExpandedBrandId(null);
                  fetchClientData();
                  onUpdate();
                } catch (err: any) {
                  toast.error('Erro ao excluir marca: ' + err.message);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateInvoiceDialog
        open={showNewInvoiceDialog}
        onOpenChange={setShowNewInvoiceDialog}
        clientId={client.id}
        clientName={client.full_name || client.email || 'Cliente'}
        onCreated={() => fetchClientData()}
      />

      {/* ─── SCHEDULING DIALOG (from pub Agenda button) ─── */}
      <Dialog open={!!schedulingPub} onOpenChange={(open) => { if (!open) setSchedulingPub(null); }}>
        <DialogContent className="z-[200] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" /> Novo Agendamento
            </DialogTitle>
            <DialogDescription>Crie um agendamento com Google Meet e notifique o cliente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Título</Label>
              <Input value={schedulingForm.title} onChange={(e) => setSchedulingForm(prev => ({ ...prev, title: e.target.value }))} placeholder="Ex: Reunião sobre marca..." />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={schedulingForm.description} onChange={(e) => setSchedulingForm(prev => ({ ...prev, description: e.target.value }))} rows={2} className="resize-none" placeholder="Detalhes do agendamento..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal h-10">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(schedulingForm.date, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[210]" align="start">
                    <Calendar mode="single" selected={schedulingForm.date} onSelect={(d) => d && setSchedulingForm(prev => ({ ...prev, date: d }))} locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Hora</Label>
                <Input type="time" value={schedulingForm.time} onChange={(e) => setSchedulingForm(prev => ({ ...prev, time: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Duração</Label>
                <Select value={schedulingForm.duration} onValueChange={(v) => setSchedulingForm(prev => ({ ...prev, duration: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[210]">
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">1 hora</SelectItem>
                    <SelectItem value="90">1h30</SelectItem>
                    <SelectItem value="120">2 horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer h-10 px-3 rounded-md border border-input bg-background w-full">
                  <input type="checkbox" checked={schedulingForm.generateMeet} onChange={(e) => setSchedulingForm(prev => ({ ...prev, generateMeet: e.target.checked }))} className="rounded" />
                  <Video className="h-4 w-4 text-primary" />
                  <span className="text-sm">Google Meet</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSchedulingPub(null)}>Cancelar</Button>
            <Button onClick={handleCreatePubSchedule} disabled={savingSchedule || !schedulingForm.title.trim()}>
              {savingSchedule ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Criar Agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Sheet>
  );
}
