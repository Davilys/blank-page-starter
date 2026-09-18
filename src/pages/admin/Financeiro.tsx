import { useEffect, useState, useRef, lazy, Suspense, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import {
  Search, Plus, CreditCard, CheckCircle, Wallet,
  QrCode, FileText, Loader2, ExternalLink, Copy, EyeOff, RefreshCw,
  DollarSign, AlertTriangle, Zap
} from 'lucide-react';
import { format, subMonths, startOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { useCanViewFinancialValues } from '@/hooks/useCanViewFinancialValues';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { loadClientForSheet } from '@/lib/clientSheet';
import type { ClientWithProcess } from '@/components/admin/clients/ClientKanbanBoard';
import {
  BillingSituationSection,
  type BillingFilters,
  type BillingPeriod,
  type BillingSituationData,
  type BillingSituationKey,
} from '@/components/admin/financeiro/BillingSituationSection';
import { useResponsaveis } from '@/hooks/useResponsaveis';
import { ResponsavelChip } from '@/components/admin/shared/ResponsavelChip';

// Lazy load the heavy ClientDetailSheet — same component used in Clientes/Devedores/Publicações
const ClientDetailSheet = lazy(() =>
  import('@/components/admin/clients/ClientDetailSheet').then((m) => ({ default: m.ClientDetailSheet }))
);

interface Invoice {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: string | null;
  classificacao: string;
  payment_date: string | null;
  user_id: string | null;
  created_at: string | null;
  invoice_url: string | null;
  pix_code: string | null;
  payment_method: string | null;
  sync_status: string | null;
  origem: string | null;
  asaas_invoice_id: string | null;
  cliente_nome: string | null;
  cliente_email: string | null;
  total_count?: number;
}

type SortKey = 'cliente' | 'descricao' | 'valor' | 'metodo' | 'vencimento' | 'status';

const PAGE_SIZE = 50;

interface Client {
  id: string;
  full_name: string | null;
  email: string;
  cpf_cnpj: string | null;
  asaas_customer_id: string | null;
}

interface AsaasAccount {
  asaas_customer_id: string;
  cliente_nome: string;
  cobrancas: number;
}

interface Process {
  id: string;
  brand_name: string;
  user_id: string | null;
}

type PaymentMethod = 'pix' | 'boleto' | 'cartao';
type PaymentType = 'avista' | 'parcelado';

// Classificação vinda do banco (regra única: pago | a_vencer | vencido | inativo)
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string; glow: string }> = {
  pago:     { label: 'Pago',      color: 'text-emerald-400', bg: 'bg-emerald-500/10 border border-emerald-500/20', dot: 'bg-emerald-400', glow: 'shadow-emerald-500/20' },
  recebidas:{ label: 'Recebida',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border border-emerald-500/20', dot: 'bg-emerald-400', glow: 'shadow-emerald-500/20' },
  confirmadas:{ label: 'Confirmada', color: 'text-blue-400', bg: 'bg-blue-500/10 border border-blue-500/20', dot: 'bg-blue-400', glow: 'shadow-blue-500/20' },
  a_vencer: { label: 'A vencer',  color: 'text-amber-400',   bg: 'bg-amber-500/10 border border-amber-500/20',     dot: 'bg-amber-400',   glow: 'shadow-amber-500/20'   },
  aguardando:{ label: 'Aguardando', color: 'text-amber-400', bg: 'bg-amber-500/10 border border-amber-500/20', dot: 'bg-amber-400', glow: 'shadow-amber-500/20' },
  vencido:  { label: 'Vencida',   color: 'text-red-400',     bg: 'bg-red-500/10 border border-red-500/20',         dot: 'bg-red-400',     glow: 'shadow-red-500/20'     },
  vencidas: { label: 'Vencida',   color: 'text-red-400',     bg: 'bg-red-500/10 border border-red-500/20',         dot: 'bg-red-400',     glow: 'shadow-red-500/20'     },
  inativo:  { label: 'Cancelada', color: 'text-muted-foreground', bg: 'bg-muted/40 border border-border',          dot: 'bg-muted-foreground', glow: '' },
  inativas: { label: 'Cancelada', color: 'text-muted-foreground', bg: 'bg-muted/40 border border-border',          dot: 'bg-muted-foreground', glow: '' },
};

const PAYMENT_OPTIONS = {
  pix:    { label: 'PIX',             icon: QrCode,      color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/30', description: 'Pagamento instantâneo' },
  boleto: { label: 'Boleto',          icon: FileText,    color: 'text-blue-500',    bg: 'bg-blue-500/10 border-blue-500/30',       description: 'Vencimento em 3 dias úteis' },
  cartao: { label: 'Cartão de Crédito', icon: CreditCard, color: 'text-violet-500', bg: 'bg-violet-500/10 border-violet-500/30',   description: 'Parcelamento disponível' },
};

const INSTALLMENT_OPTIONS = { boleto: [1, 2, 3, 4, 5, 6], cartao: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] };

const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

const EMPTY_BILLING_CATEGORY = { gross_amount: 0, net_amount: null, clients_count: 0, invoices_count: 0, composition: [] };
const EMPTY_BILLING_DATA: BillingSituationData = {
  total: 0,
  net_available: false,
  categories: {
    recebidas: EMPTY_BILLING_CATEGORY,
    confirmadas: EMPTY_BILLING_CATEGORY,
    aguardando: EMPTY_BILLING_CATEGORY,
    vencidas: EMPTY_BILLING_CATEGORY,
  },
  series: [],
};

export default function AdminFinanceiro() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [asaasAccounts, setAsaasAccounts] = useState<AsaasAccount[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { canViewFinancialValues, isMasterAdmin } = useCanViewFinancialValues();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Client file sheet (same as Clientes/Devedores/Publicações)
  const [sheetClient, setSheetClient] = useState<ClientWithProcess | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loadingClientId, setLoadingClientId] = useState<string | null>(null);

  const openClientFile = useCallback(async (clientId: string) => {
    if (!clientId) return;
    setLoadingClientId(clientId);
    try {
      const clientObj = await loadClientForSheet(clientId);
      if (!clientObj) { toast.error('Cliente não encontrado'); return; }
      setSheetClient(clientObj);
      setSheetOpen(true);
    } catch (err) {
      console.error('Error opening client file:', err);
      toast.error('Erro ao carregar ficha do cliente');
    } finally {
      setLoadingClientId(null);
    }
  }, []);

  // Fetch current user id on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
  }, []);

  const [formData, setFormData] = useState({ description: '', amount: '', due_date: '', user_id: '', process_id: '', observation: '' });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [paymentType, setPaymentType] = useState<PaymentType>('avista');
  const [installments, setInstallments] = useState(1);
  const [invoiceResult, setInvoiceResult] = useState<{ success: boolean; invoice_url?: string; pix_code?: string; pix_qr_code?: string } | null>(null);

  const [clientSearch, setClientSearch] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const clientSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target as Node)) {
        setClientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const [billingData, setBillingData] = useState<BillingSituationData>(EMPTY_BILLING_DATA);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [billingFilters, setBillingFilters] = useState<BillingFilters>({
    account: '', paymentMethod: '', client: '', origin: '',
    dueFrom: '', dueTo: '', paymentFrom: '', paymentTo: '',
  });
  const [syncing, setSyncing] = useState(false);
  const [syncRun, setSyncRun] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>('cliente');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const dateRange = useMemo(() => {
    const today = new Date();
    if (billingPeriod === 'today') {
      const d = format(startOfDay(today), 'yyyy-MM-dd');
      return { from: d, to: d };
    }
    if (billingPeriod === 'week') {
      return {
        from: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        to: format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    }
    if (billingPeriod === 'month') {
      return { from: format(startOfMonth(today), 'yyyy-MM-dd'), to: format(endOfMonth(today), 'yyyy-MM-dd') };
    }
    if (billingPeriod === 'previous_month') {
      const previous = subMonths(today, 1);
      return { from: format(startOfMonth(previous), 'yyyy-MM-dd'), to: format(endOfMonth(previous), 'yyyy-MM-dd') };
    }
    if (billingPeriod === 'quarter') {
      const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
      const quarterStart = new Date(today.getFullYear(), quarterStartMonth, 1);
      const quarterEnd = new Date(today.getFullYear(), quarterStartMonth + 3, 0);
      return { from: format(quarterStart, 'yyyy-MM-dd'), to: format(quarterEnd, 'yyyy-MM-dd') };
    }
    if (billingPeriod === 'year') return { from: `${today.getFullYear()}-01-01`, to: `${today.getFullYear()}-12-31` };
    if (billingPeriod === 'custom') return { from: customFrom || null, to: customTo || null };
    return { from: null as string | null, to: null as string | null };
  }, [billingPeriod, customFrom, customTo]);

  // ── Sincronização geral com o Asaas (em blocos, retomável) ──────────────
  const runSyncLoop = useCallback(async (runInicial: any) => {
    let run = runInicial;
    setSyncing(true);
    setSyncRun(run);
    try {
      let guarda = 0;
      while (run && run.status === 'em_andamento' && guarda < 10000) {
        guarda++;
        const { data, error } = await supabase.functions.invoke('sync-asaas-all', {
          body: { action: 'block', sync_run_id: run.sync_run_id, offset: run.cursor_offset },
        });
        if (error) throw error;
        if (data?.retry) {
          setSyncRun({ ...run, etapa: 'Aguardando o Asaas responder...' });
          await new Promise((r) => setTimeout(r, Math.min((data.retry_after || 5), 60) * 1000));
          continue;
        }
        if (data?.error) throw new Error(data.error);
        run = data.run || run;
        setSyncRun(run);
        if (data.concluido) break;
      }
      toast.success(
        `Sincronização concluída — ${run?.clientes_criados || 0} cliente(s) criado(s), ${run?.criadas || 0} cobrança(s) criada(s), ${run?.atualizadas || 0} atualizada(s)`
      );
    } catch (err: any) {
      toast.error(err?.message || 'Falha na sincronização. O progresso foi salvo, clique em Continuar.');
    } finally {
      setSyncing(false);
      fetchInvoices();
      fetchTotals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSyncAsaas = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-asaas-all', { body: { action: 'start' } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.retry) {
        toast.error('O Asaas não respondeu agora. Tente novamente em instantes.');
        setSyncing(false);
        return;
      }
      await runSyncLoop(data.run);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao sincronizar com Asaas');
      setSyncing(false);
    }
  };

  // Retomada: ao abrir a tela, verifica se existe sincronização em andamento
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('sync-asaas-all', { body: { action: 'status' } });
        if (data?.run) setSyncRun(data.run);
        else if (data?.ultima) setSyncRun(data.ultima);
      } catch { /* silencioso */ }
    })();
  }, []);

  // Helper: get client IDs owned by current admin (assigned_to or created_by)
  const getMyClientIds = async (uid: string): Promise<string[]> => {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .or(`assigned_to.eq.${uid},created_by.eq.${uid}`);
    return data?.map(c => c.id) || [];
  };

  // Filtros, ordenação, busca e paginação são resolvidos no banco (RPC), nunca no navegador.
  const ownerFilter = !isMasterAdmin && currentUserId ? currentUserId : null;

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_invoices_list_filtered', {
        p_search: debouncedSearch || null,
        p_situation: filterStatus,
        p_from: dateRange.from,
        p_to: dateRange.to,
        p_owner: ownerFilter,
        p_sort: sortKey,
        p_dir: sortDir,
        p_limit: PAGE_SIZE,
        p_offset: (page - 1) * PAGE_SIZE,
        p_account: billingFilters.account || null,
        p_payment_method: billingFilters.paymentMethod || null,
        p_client: billingFilters.client || null,
        p_origin: billingFilters.origin || null,
        p_due_from: billingFilters.dueFrom || null,
        p_due_to: billingFilters.dueTo || null,
        p_payment_from: billingFilters.paymentFrom || null,
        p_payment_to: billingFilters.paymentTo || null,
      });
      if (error) throw error;
      const rows = (data || []) as unknown as Invoice[];
      setInvoices(rows);
      const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;
      setTotalCount(total);
      // Se a página atual deixou de existir, volta para a última válida
      const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
      if (rows.length === 0 && page > 1 && total > 0) setPage(maxPage);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao carregar faturas');
      setInvoices([]);
      setTotalCount(0);
    }
    setLoading(false);
  }, [debouncedSearch, filterStatus, dateRange.from, dateRange.to, ownerFilter, sortKey, sortDir, page, billingFilters]);

  const fetchTotals = useCallback(async () => {
    setBillingLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_billing_situation', {
        p_from: dateRange.from,
        p_to: dateRange.to,
        p_owner: ownerFilter,
        p_account: billingFilters.account || null,
        p_payment_method: billingFilters.paymentMethod || null,
        p_client: billingFilters.client || null,
        p_origin: billingFilters.origin || null,
        p_due_from: billingFilters.dueFrom || null,
        p_due_to: billingFilters.dueTo || null,
        p_payment_from: billingFilters.paymentFrom || null,
        p_payment_to: billingFilters.paymentTo || null,
      });
      if (error) throw error;
      const raw = (data || {}) as any;
      const normalized = { ...EMPTY_BILLING_DATA, ...raw, categories: { ...EMPTY_BILLING_DATA.categories, ...(raw.categories || {}) } };
      (Object.keys(normalized.categories) as BillingSituationKey[]).forEach((key) => {
        const category = normalized.categories[key];
        normalized.categories[key] = {
          ...EMPTY_BILLING_CATEGORY,
          ...category,
          gross_amount: Number(category?.gross_amount || 0),
          net_amount: category?.net_amount == null ? null : Number(category.net_amount),
          clients_count: Number(category?.clients_count || 0),
          invoices_count: Number(category?.invoices_count || 0),
          composition: (category?.composition || []).map((item: any) => ({ ...item, amount: Number(item.amount || 0), count: Number(item.count || 0) })),
        };
      });
      setBillingData({ ...normalized, total: Number(normalized.total || 0) });
    } catch (e) { console.warn('totais indisponíveis', e); }
    finally { setBillingLoading(false); }
  }, [dateRange.from, dateRange.to, ownerFilter, billingFilters]);

  useEffect(() => {
    if (currentUserId !== null) { fetchInvoices(); }
  }, [currentUserId, fetchInvoices]);

  useEffect(() => {
    if (currentUserId !== null) { fetchTotals(); }
  }, [currentUserId, fetchTotals]);

  useEffect(() => {
    if (currentUserId === null) return;
    supabase.rpc('admin_asaas_accounts', { p_owner: ownerFilter })
      .then(({ data, error }) => { if (!error) setAsaasAccounts((data || []) as AsaasAccount[]); });
  }, [currentUserId, ownerFilter]);

  useEffect(() => {
    if (currentUserId !== null) { fetchClients(); fetchProcesses(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, isMasterAdmin]);

  const fetchClients = async () => {
    let allClients: Client[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    // Non-master admins only see their own clients
    const buildQuery = () => {
      let q = supabase.from('profiles').select('id, full_name, email, cpf_cnpj, asaas_customer_id');
      if (!isMasterAdmin && currentUserId) {
        q = q.or(`assigned_to.eq.${currentUserId},created_by.eq.${currentUserId}`);
      }
      return q;
    };

    while (hasMore) {
      const { data } = await buildQuery().range(from, from + pageSize - 1);
      if (data && data.length > 0) {
        allClients = [...allClients, ...data];
        from += pageSize;
        if (data.length < pageSize) hasMore = false;
      } else {
        hasMore = false;
      }
    }
    setClients(allClients);
  };

  const fetchProcesses = async () => {
    if (!isMasterAdmin && currentUserId) {
      const clientIds = await getMyClientIds(currentUserId);
      if (clientIds.length > 0) {
        const { data } = await supabase.from('brand_processes').select('id, brand_name, user_id').in('user_id', clientIds);
        setProcesses(data || []);
      } else {
        setProcesses([]);
      }
    } else {
      const { data } = await supabase.from('brand_processes').select('id, brand_name, user_id');
      setProcesses(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount || !formData.due_date || !formData.user_id) { toast.error('Preencha todos os campos obrigatórios'); return; }
    const selectedClient = clients.find(c => c.id === formData.user_id);
    if (!selectedClient?.cpf_cnpj) { toast.error('Cliente selecionado não possui CPF/CNPJ cadastrado'); return; }
    setSubmitting(true);
    try {
      const response = await supabase.functions.invoke('create-admin-invoice', {
        body: {
          user_id: formData.user_id, process_id: formData.process_id || null,
          description: formData.description + (formData.observation ? ` - ${formData.observation}` : ''),
          payment_method: paymentMethod, payment_type: paymentType,
          installments: paymentType === 'parcelado' ? installments : 1,
          total_value: parseFloat(formData.amount), due_date: formData.due_date,
        },
      });
      if (response.error) throw new Error(response.error.message);
      const data = response.data;
      if (data.success) {
        toast.success('Fatura criada com sucesso!');
        setInvoiceResult({ success: true, invoice_url: data.invoice_url, pix_code: data.pix_code, pix_qr_code: data.pix_qr_code });
        fetchInvoices();
      } else throw new Error(data.error || 'Erro ao criar fatura');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar fatura');
    } finally { setSubmitting(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    const updateData: any = { status };
    if (status === 'paid') updateData.payment_date = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('invoices').update(updateData).eq('id', id);
    if (error) toast.error('Erro ao atualizar status');
    else { toast.success('Status atualizado'); fetchInvoices(); }
  };

  const resetForm = () => {
    setFormData({ description: '', amount: '', due_date: '', user_id: '', process_id: '', observation: '' });
    setPaymentMethod('pix'); setPaymentType('avista'); setInstallments(1); setInvoiceResult(null);
    setClientSearch(''); setClientDropdownOpen(false);
  };

  const handleDialogClose = (open: boolean) => { setDialogOpen(open); if (!open) resetForm(); };
  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast.success('Código copiado!'); };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const inicioFaixa = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const fimFaixa = Math.min(page * PAGE_SIZE, totalCount);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const sortArrow = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '');

  const clientProcesses = processes.filter(p => p.user_id === formData.user_id);
  const getInstallmentValue = () => {
    if (!formData.amount) return 0;
    const total = parseFloat(formData.amount);
    if (paymentType === 'avista' || installments <= 1) return total;
    return Math.ceil((total / installments) * 100) / 100;
  };

  return (
    <>
      <div className="space-y-6 p-1">

        {/* ── HEADER ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-background to-emerald-500/5 border border-border/60 p-6"
        >
          {/* decorative orbs */}
          <div className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-8 left-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />

          <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 shadow-lg shadow-primary/20"
              >
                <DollarSign className="h-6 w-6 text-primary" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
                <p className="text-sm text-muted-foreground">Faturas e cobranças integradas ao Asaas</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncAsaas}
                disabled={syncing}
                className="gap-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
              >
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {syncing ? 'Sincronizando...' : 'Sincronizar Asaas'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => { fetchInvoices(); fetchTotals(); }} className="gap-2 border-border/60">
                <RefreshCw className="h-4 w-4" /> Atualizar
              </Button>
              <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2 bg-gradient-to-r from-primary to-primary/70 shadow-md shadow-primary/20">
                    <Plus className="h-4 w-4" /> Nova Fatura
                  </Button>
                </DialogTrigger>

                {/* ── DIALOG ─────────────────────────── */}
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-primary" /> Nova Fatura — Asaas
                    </DialogTitle>
                  </DialogHeader>
                  <AnimatePresence mode="wait">
                    {invoiceResult?.success ? (
                      <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                        <div className="text-center p-6 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                          <h3 className="font-bold text-lg text-emerald-500">Fatura criada com sucesso!</h3>
                          <p className="text-sm text-muted-foreground">A cobrança foi gerada no Asaas</p>
                        </div>
                        {invoiceResult.pix_code && (
                          <div className="space-y-2">
                            <Label>Código PIX Copia e Cola</Label>
                            <div className="flex gap-2">
                              <Input value={invoiceResult.pix_code} readOnly className="text-xs font-mono" />
                              <Button variant="outline" size="icon" onClick={() => copyToClipboard(invoiceResult.pix_code!)}><Copy className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        )}
                        {invoiceResult.pix_qr_code && (
                          <div className="flex justify-center">
                            <img src={`data:image/png;base64,${invoiceResult.pix_qr_code}`} alt="QR Code PIX" className="w-48 h-48 border rounded-lg" />
                          </div>
                        )}
                        {invoiceResult.invoice_url && (
                          <Button variant="outline" className="w-full" onClick={() => window.open(invoiceResult.invoice_url, '_blank')}>
                            <ExternalLink className="h-4 w-4 mr-2" /> Abrir Fatura no Asaas
                          </Button>
                        )}
                        <Button className="w-full" onClick={() => handleDialogClose(false)}>Fechar</Button>
                      </motion.div>
                    ) : (
                      <motion.form key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onSubmit={handleSubmit} className="space-y-5">
                        <div className="relative" ref={clientSearchRef}>
                          <Label className="text-sm font-medium">Cliente *</Label>
                          <div className="relative mt-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input
                              value={clientSearch}
                              onChange={(e) => {
                                setClientSearch(e.target.value);
                                setClientDropdownOpen(true);
                                if (!e.target.value) setFormData({ ...formData, user_id: '', process_id: '' });
                              }}
                              onFocus={() => setClientDropdownOpen(true)}
                              placeholder="Buscar por nome, e-mail ou CPF/CNPJ..."
                              className="pl-9"
                            />
                            {formData.user_id && clientSearch && (
                              <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                onClick={() => { setClientSearch(''); setFormData({ ...formData, user_id: '', process_id: '' }); }}
                              >✕</button>
                            )}
                          </div>
                          {clientDropdownOpen && (
                            <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                              {clients
                                .filter(c => {
                                  if (!clientSearch) return true;
                                  const q = clientSearch.toLowerCase();
                                  return (c.full_name?.toLowerCase().includes(q)) ||
                                    c.email.toLowerCase().includes(q) ||
                                    (c.cpf_cnpj?.toLowerCase().includes(q));
                                })
                                .slice(0, 50)
                                .map(c => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    className={cn(
                                      "w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center justify-between gap-2 transition-colors",
                                      formData.user_id === c.id && "bg-primary/10 font-medium"
                                    )}
                                    onClick={() => {
                                      setFormData({ ...formData, user_id: c.id, process_id: '' });
                                      setClientSearch(c.full_name || c.email);
                                      setClientDropdownOpen(false);
                                    }}
                                  >
                                    <span className="truncate">{c.full_name || c.email}</span>
                                    {!c.cpf_cnpj && <Badge variant="destructive" className="text-[10px] shrink-0">Sem CPF</Badge>}
                                  </button>
                                ))}
                              {clients.filter(c => {
                                if (!clientSearch) return true;
                                const q = clientSearch.toLowerCase();
                                return (c.full_name?.toLowerCase().includes(q)) || c.email.toLowerCase().includes(q) || (c.cpf_cnpj?.toLowerCase().includes(q));
                              }).length === 0 && (
                                <div className="px-3 py-4 text-sm text-muted-foreground text-center">Nenhum cliente encontrado</div>
                              )}
                            </div>
                          )}
                        </div>
                        {formData.user_id && clientProcesses.length > 0 && (
                          <div>
                            <Label className="text-sm font-medium">Processo (opcional)</Label>
                            <Select value={formData.process_id} onValueChange={(v) => setFormData({ ...formData, process_id: v })}>
                              <SelectTrigger className="mt-1"><SelectValue placeholder="Vincular a um processo" /></SelectTrigger>
                              <SelectContent>
                                {clientProcesses.map((p) => <SelectItem key={p.id} value={p.id}>{p.brand_name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div>
                          <Label className="text-sm font-medium">Descrição *</Label>
                          <Input className="mt-1" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Ex: Honorários de Registro de Marca" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium">Valor Total (R$) *</Label>
                            <Input className="mt-1" type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="699.00" />
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Vencimento *</Label>
                            <Input className="mt-1" type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} />
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium mb-3 block">Forma de Pagamento *</Label>
                          <div className="grid grid-cols-3 gap-3">
                            {(Object.keys(PAYMENT_OPTIONS) as PaymentMethod[]).map((method) => {
                              const cfg = PAYMENT_OPTIONS[method]; const Icon = cfg.icon; const sel = paymentMethod === method;
                              return (
                                <motion.button key={method} type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                  onClick={() => { setPaymentMethod(method); if (method === 'pix') { setPaymentType('avista'); setInstallments(1); } }}
                                  className={cn("p-4 rounded-xl border-2 transition-all text-left", sel ? `${cfg.bg} ${cfg.color} shadow-md` : "border-border bg-muted/20 hover:bg-muted/40")}
                                >
                                  <Icon className={cn("h-6 w-6 mb-2", sel ? cfg.color : "text-muted-foreground")} />
                                  <p className={cn("font-medium text-sm", sel ? cfg.color : "text-foreground")}>{cfg.label}</p>
                                  <p className="text-[10px] text-muted-foreground mt-1">{cfg.description}</p>
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>
                        {paymentMethod !== 'pix' && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                            <Label className="text-sm font-medium mb-3 block">Tipo de Pagamento</Label>
                            <RadioGroup value={paymentType} onValueChange={(v) => { setPaymentType(v as PaymentType); if (v === 'avista') setInstallments(1); else setInstallments(2); }} className="flex gap-4">
                              <div className="flex items-center space-x-2"><RadioGroupItem value="avista" id="avista" /><Label htmlFor="avista" className="cursor-pointer">À Vista</Label></div>
                              <div className="flex items-center space-x-2"><RadioGroupItem value="parcelado" id="parcelado" /><Label htmlFor="parcelado" className="cursor-pointer">Parcelado</Label></div>
                            </RadioGroup>
                          </motion.div>
                        )}
                        {paymentMethod !== 'pix' && paymentType === 'parcelado' && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                            <Label className="text-sm font-medium mb-2 block">Número de Parcelas</Label>
                            <Select value={installments.toString()} onValueChange={(v) => setInstallments(parseInt(v))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {INSTALLMENT_OPTIONS[paymentMethod].map((n) => (
                                  <SelectItem key={n} value={n.toString()}>{n}x de R$ {fmt(getInstallmentValue())}{n === 1 && ' (À Vista)'}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </motion.div>
                        )}
                        {formData.amount && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-muted/40 rounded-xl border space-y-2">
                            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Método:</span><span className="font-medium">{PAYMENT_OPTIONS[paymentMethod].label}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Parcelas:</span><span className="font-medium">{paymentMethod === 'pix' ? '1x (À Vista)' : `${installments}x`}</span></div>
                            <div className="flex justify-between text-sm border-t pt-2"><span className="text-muted-foreground">Valor por parcela:</span><span className="font-bold text-lg">R$ {fmt(getInstallmentValue())}</span></div>
                          </motion.div>
                        )}
                        <div>
                          <Label className="text-sm font-medium">Observação (opcional)</Label>
                          <Textarea className="mt-1" value={formData.observation} onChange={(e) => setFormData({ ...formData, observation: e.target.value })} placeholder="Observações adicionais..." rows={2} />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <Button type="button" variant="outline" onClick={() => handleDialogClose(false)} disabled={submitting}>Cancelar</Button>
                          <Button type="submit" disabled={submitting} className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600">
                            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</> : <><Wallet className="h-4 w-4 mr-2" />Criar Fatura</>}
                          </Button>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </motion.div>

        {/* ── PROGRESSO DA SINCRONIZAÇÃO ─────────── */}
        {syncRun && (syncing || syncRun.status === 'em_andamento') && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-emerald-600 flex items-center gap-2">
                {syncing && <Loader2 className="h-4 w-4 animate-spin" />}
                {syncRun.etapa || 'Sincronizando com o Asaas'}
              </span>
              <span className="text-xs text-muted-foreground">
                Conta {syncRun.clientes_processados || 0}
                {syncRun.total_clientes_asaas ? ` de ${syncRun.total_clientes_asaas}` : ''} — {syncRun.cobrancas_encontradas || 0} cobranças processadas
              </span>
            </div>
            <Progress
              value={syncRun.total_clientes_asaas
                ? Math.min(100, ((syncRun.clientes_processados || 0) / syncRun.total_clientes_asaas) * 100)
                : 0}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {syncRun.clientes_criados || 0} cliente(s) criado(s) · {syncRun.criadas || 0} cobrança(s) criada(s) · {syncRun.atualizadas || 0} atualizada(s) · {syncRun.removidas || 0} removida(s)
              </span>
              {!syncing && syncRun.status === 'em_andamento' && (
                <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-500/30 text-emerald-600"
                  onClick={() => runSyncLoop(syncRun)}>
                  Continuar sincronização
                </Button>
              )}
            </div>
          </div>
        )}

        <BillingSituationSection
          data={billingData}
          loading={billingLoading}
          canViewValues={canViewFinancialValues}
          period={billingPeriod}
          customFrom={customFrom}
          customTo={customTo}
          filters={billingFilters}
          activeSituation={filterStatus}
          clients={clients}
          accounts={asaasAccounts}
          onPeriodChange={(value) => { setBillingPeriod(value); setPage(1); }}
          onCustomFromChange={(value) => { setCustomFrom(value); setPage(1); }}
          onCustomToChange={(value) => { setCustomTo(value); setPage(1); }}
          onFiltersChange={(value) => { setBillingFilters(value); setPage(1); }}
          onSituationChange={(value) => { setFilterStatus(value); setPage(1); }}
        />

        {/* ── TABLE ──────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="rounded-2xl border border-border/60 overflow-hidden bg-background/80 backdrop-blur-sm">

          {/* Table toolbar */}
          <div className="flex flex-col gap-3 p-4 border-b border-border/60 bg-muted/20">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por número, assunto ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-background/60 border-border/60 h-9" />
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-semibold cursor-pointer select-none" onClick={() => toggleSort('descricao')}>Descrição{sortArrow('descricao')}</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-semibold cursor-pointer select-none" onClick={() => toggleSort('cliente')}>Cliente{sortArrow('cliente')}</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Usuário</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-semibold hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('valor')}>Valor{sortArrow('valor')}</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-semibold hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('metodo')}>Método{sortArrow('metodo')}</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-semibold hidden lg:table-cell cursor-pointer select-none" onClick={() => toggleSort('vencimento')}>Vencimento{sortArrow('vencimento')}</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-semibold cursor-pointer select-none" onClick={() => toggleSort('status')}>Status{sortArrow('status')}</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                      <p className="text-sm text-muted-foreground">Carregando faturas...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2">
                      <DollarSign className="h-10 w-10 text-muted-foreground/30" />
                      <p className="text-muted-foreground">Nenhuma fatura encontrada</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <AnimatePresence>
                  {invoices.map((invoice, idx) => {
                    const ns = (invoice.classificacao || 'aguardando') as keyof typeof STATUS_CONFIG;
                    const sc = STATUS_CONFIG[ns] || STATUS_CONFIG.aguardando;
                    const isOverdue = ns === 'vencidas';

                    return (
                      <motion.tr
                        key={invoice.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className={cn('border-border/40 transition-colors hover:bg-muted/30 group', isOverdue && 'bg-red-500/3')}
                      >
                        <TableCell className="py-3.5">
                          <div className="flex items-center gap-2">
                            {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                            <span className="font-medium text-sm line-clamp-1 max-w-[200px]">{invoice.description}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3.5">
                          {invoice.user_id ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openClientFile(invoice.user_id!); }}
                              className="text-sm text-foreground hover:text-primary hover:underline inline-flex items-center gap-1.5 text-left"
                              disabled={loadingClientId === invoice.user_id}
                            >
                              {loadingClientId === invoice.user_id && <Loader2 className="h-3 w-3 animate-spin" />}
                              {invoice.cliente_nome || invoice.cliente_email || '—'}
                            </button>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {invoice.cliente_nome || invoice.cliente_email || '—'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-3.5">
                          {invoice.user_id ? (
                            <ResponsavelChip
                              entidade="cliente"
                              entidadeId={invoice.user_id}
                              responsavel={responsaveisClientes[invoice.user_id]}
                            />
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell py-3.5">
                          {canViewFinancialValues ? (
                            <span className="font-semibold text-sm">R$ {fmt(Number(invoice.amount))}</span>
                          ) : (
                            <span className="flex items-center gap-1 text-muted-foreground/40 text-xs"><EyeOff className="h-3 w-3" /> Restrito</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell py-3.5">
                          <Badge variant="outline" className="text-xs border-border/60 text-muted-foreground">
                            {invoice.payment_method || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell py-3.5">
                          <span className="text-sm text-muted-foreground">
                            {new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </span>
                        </TableCell>
                        <TableCell className="py-3.5">
                          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', sc.bg, sc.color)}>
                            <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', sc.dot, ns === 'aguardando' && 'animate-pulse')} />
                            {sc.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-3.5">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {invoice.invoice_url && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(invoice.invoice_url!, '_blank')}>
                                <ExternalLink className="h-3.5 w-3.5 text-blue-500" />
                              </Button>
                            )}
                            {invoice.pix_code && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(invoice.pix_code!)}>
                                <Copy className="h-3.5 w-3.5 text-emerald-500" />
                              </Button>
                            )}
                            {(ns === 'aguardando' || ns === 'vencidas') && (
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 px-2"
                                onClick={() => updateStatus(invoice.id, 'paid')}>
                                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Pago
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              )}
            </TableBody>
          </Table>

          {totalCount > 0 && (
            <div className="px-4 py-3 border-t border-border/60 bg-muted/10 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>Exibindo {inicioFaixa}–{fimFaixa} de {totalCount}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1 || loading}
                  onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</Button>
                <span>Página {page} de {totalPages}</span>
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages || loading}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Próximo</Button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {sheetOpen && sheetClient && (
        <Suspense fallback={null}>
          <ClientDetailSheet
            client={sheetClient}
            open={sheetOpen}
            onOpenChange={(o) => { setSheetOpen(o); if (!o) setSheetClient(null); }}
            onUpdate={fetchInvoices}
          />
        </Suspense>
      )}
    </>
  );
}
