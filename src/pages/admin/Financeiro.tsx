import { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import {
  Search, Plus, CreditCard, TrendingUp, Clock, CheckCircle, Wallet,
  QrCode, FileText, Loader2, ExternalLink, Copy, EyeOff, RefreshCw,
  ArrowUpRight, ArrowDownRight, DollarSign, AlertTriangle, Zap, Filter,
  Calendar, ChevronLeft, ChevronRight
} from 'lucide-react';
import { format, subMonths, addMonths, startOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCanViewFinancialValues } from '@/hooks/useCanViewFinancialValues';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Invoice {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: string | null;
  payment_date: string | null;
  user_id: string | null;
  process_id: string | null;
  created_at: string | null;
  invoice_url: string | null;
  pix_code: string | null;
  payment_method: string | null;
  profiles?: { full_name: string | null; email: string } | null;
  brand_processes?: { brand_name: string } | null;
}

interface Client {
  id: string;
  full_name: string | null;
  email: string;
  cpf_cnpj: string | null;
}

interface Process {
  id: string;
  brand_name: string;
  user_id: string | null;
}

type PaymentMethod = 'pix' | 'boleto' | 'cartao';
type PaymentType = 'avista' | 'parcelado';

// Status normalization: Asaas sends 'confirmed'/'received' → treat as paid
const PAID_STATUSES = ['paid', 'confirmed', 'received', 'RECEIVED', 'CONFIRMED'];
const PENDING_STATUSES = ['pending', 'PENDING'];
const OVERDUE_STATUSES = ['overdue', 'OVERDUE'];

const normalizeStatus = (status: string | null): string => {
  if (!status) return 'pending';
  if (PAID_STATUSES.includes(status)) return 'paid';
  if (OVERDUE_STATUSES.includes(status)) return 'overdue';
  if (status === 'cancelled' || status === 'CANCELLED') return 'cancelled';
  return 'pending';
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string; glow: string }> = {
  paid:      { label: 'Pago',      color: 'text-emerald-400', bg: 'bg-emerald-500/10 border border-emerald-500/20', dot: 'bg-emerald-400', glow: 'shadow-emerald-500/20' },
  pending:   { label: 'Pendente',  color: 'text-amber-400',   bg: 'bg-amber-500/10 border border-amber-500/20',     dot: 'bg-amber-400',   glow: 'shadow-amber-500/20'   },
  overdue:   { label: 'Vencida',   color: 'text-red-400',     bg: 'bg-red-500/10 border border-red-500/20',         dot: 'bg-red-400',     glow: 'shadow-red-500/20'     },
  cancelled: { label: 'Cancelada', color: 'text-muted-foreground', bg: 'bg-muted/40 border border-border',          dot: 'bg-muted-foreground', glow: '' },
};

const PAYMENT_OPTIONS = {
  pix:    { label: 'PIX',             icon: QrCode,      color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/30', description: 'Pagamento instantâneo' },
  boleto: { label: 'Boleto',          icon: FileText,    color: 'text-blue-500',    bg: 'bg-blue-500/10 border-blue-500/30',       description: 'Vencimento em 3 dias úteis' },
  cartao: { label: 'Cartão de Crédito', icon: CreditCard, color: 'text-violet-500', bg: 'bg-violet-500/10 border-violet-500/30',   description: 'Parcelamento disponível' },
};

const INSTALLMENT_OPTIONS = { boleto: [1, 2, 3, 4, 5, 6], cartao: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] };

const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export default function AdminFinanceiro() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { canViewFinancialValues, isMasterAdmin } = useCanViewFinancialValues();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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

  const [stats, setStats] = useState({ total: 0, pending: 0, paid: 0, overdue: 0, pendingCount: 0, paidCount: 0, overdueCount: 0 });
  const [syncing, setSyncing] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const handleSyncAsaas = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-asaas-invoices');
      if (error) throw error;
      if (data?.success) {
        if (data.synced > 0) {
          toast.success(`${data.synced} fatura(s) sincronizada(s) com o Asaas`);
        } else {
          toast.info(data.message || 'Todas as faturas já estão atualizadas');
        }
        fetchInvoices();
      } else {
        throw new Error(data?.error || 'Erro na sincronização');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao sincronizar com Asaas');
    } finally {
      setSyncing(false);
    }
  };

  // Helper: get client IDs owned by current admin (assigned_to or created_by)
  const getMyClientIds = async (uid: string): Promise<string[]> => {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .or(`assigned_to.eq.${uid},created_by.eq.${uid}`);
    return data?.map(c => c.id) || [];
  };

  useEffect(() => {
    if (currentUserId !== null) {
      fetchInvoices(); fetchClients(); fetchProcesses();
    }
  }, [currentUserId, isMasterAdmin]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('invoices')
        .select('*, profiles(full_name, email), brand_processes(brand_name)')
        .order('created_at', { ascending: false });

      // Non-master admins only see invoices from their own clients
      if (!isMasterAdmin && currentUserId) {
        const clientIds = await getMyClientIds(currentUserId);
        if (clientIds.length > 0) {
          query = query.in('user_id', clientIds);
        } else {
          // No clients assigned → no invoices
          setInvoices([]);
          setStats({ total: 0, pending: 0, paid: 0, overdue: 0, pendingCount: 0, paidCount: 0, overdueCount: 0 });
          setLoading(false);
          return;
        }
      }

      const { data, error } = await query;
      if (error) {
        toast.error('Erro ao carregar faturas');
      } else {
        const inv = data || [];
        setInvoices(inv);
        setStats({
          total:        inv.reduce((s, i) => s + Number(i.amount), 0),
          pending:      inv.filter(i => normalizeStatus(i.status) === 'pending').reduce((s, i) => s + Number(i.amount), 0),
          paid:         inv.filter(i => normalizeStatus(i.status) === 'paid').reduce((s, i) => s + Number(i.amount), 0),
          overdue:      inv.filter(i => normalizeStatus(i.status) === 'overdue').reduce((s, i) => s + Number(i.amount), 0),
          pendingCount: inv.filter(i => normalizeStatus(i.status) === 'pending').length,
          paidCount:    inv.filter(i => normalizeStatus(i.status) === 'paid').length,
          overdueCount: inv.filter(i => normalizeStatus(i.status) === 'overdue').length,
        });
      }
    } catch {
      toast.error('Erro ao carregar faturas');
    }
    setLoading(false);
  };

  const fetchClients = async () => {
    let allClients: Client[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    // Non-master admins only see their own clients
    const buildQuery = () => {
      let q = supabase.from('profiles').select('id, full_name, email, cpf_cnpj');
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

  const filteredInvoices = invoices.filter(i => {
    const q = search.toLowerCase().replace(/[.\-\/]/g, '');
    const clientName = (i.profiles as any)?.full_name?.toLowerCase() || '';
    const clientEmail = (i.profiles as any)?.email?.toLowerCase() || '';
    // Find CPF/CNPJ from clients list
    const clientRecord = clients.find(c => c.id === i.user_id);
    const clientCpfCnpj = (clientRecord?.cpf_cnpj || '').replace(/[.\-\/]/g, '').toLowerCase();
    const matchSearch = !q || i.description.toLowerCase().includes(q) ||
      clientName.includes(q) || clientEmail.includes(q) || clientCpfCnpj.includes(q);
    const matchStatus = filterStatus === 'all' || normalizeStatus(i.status) === filterStatus;

    // Date filter
    let matchDate = true;
    if (dateFilter !== 'all') {
      const invoiceDate = new Date(i.created_at || i.due_date);
      const today = new Date();
      if (dateFilter === 'today') {
        matchDate = startOfDay(invoiceDate).getTime() === startOfDay(today).getTime();
      } else if (dateFilter === 'week') {
        matchDate = isWithinInterval(invoiceDate, { start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfWeek(today, { weekStartsOn: 1 }) });
      } else if (dateFilter === 'month') {
        matchDate = isWithinInterval(invoiceDate, { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) });
      }
    }

    return matchSearch && matchStatus && matchDate;
  });

  // Date-only filtered invoices for stats (no search/status filter)
  const dateFilteredInvoices = invoices.filter(i => {
    if (dateFilter === 'all') return true;
    const invoiceDate = new Date(i.created_at || i.due_date);
    const today = new Date();
    if (dateFilter === 'today') return startOfDay(invoiceDate).getTime() === startOfDay(today).getTime();
    if (dateFilter === 'week') return isWithinInterval(invoiceDate, { start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfWeek(today, { weekStartsOn: 1 }) });
    if (dateFilter === 'month') return isWithinInterval(invoiceDate, { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) });
    return true;
  });

  const filteredStats = {
    total:        dateFilteredInvoices.reduce((s, i) => s + Number(i.amount), 0),
    pending:      dateFilteredInvoices.filter(i => normalizeStatus(i.status) === 'pending').reduce((s, i) => s + Number(i.amount), 0),
    paid:         dateFilteredInvoices.filter(i => normalizeStatus(i.status) === 'paid').reduce((s, i) => s + Number(i.amount), 0),
    overdue:      dateFilteredInvoices.filter(i => normalizeStatus(i.status) === 'overdue').reduce((s, i) => s + Number(i.amount), 0),
    pendingCount: dateFilteredInvoices.filter(i => normalizeStatus(i.status) === 'pending').length,
    paidCount:    dateFilteredInvoices.filter(i => normalizeStatus(i.status) === 'paid').length,
    overdueCount: dateFilteredInvoices.filter(i => normalizeStatus(i.status) === 'overdue').length,
    totalCount:   dateFilteredInvoices.length,
  };

  const paidPct = filteredStats.total > 0 ? (filteredStats.paid / filteredStats.total) * 100 : 0;
  const pendingPct = filteredStats.total > 0 ? (filteredStats.pending / filteredStats.total) * 100 : 0;

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
              <Button variant="outline" size="sm" onClick={fetchInvoices} className="gap-2 border-border/60">
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

        {/* ── STAT CARDS ─────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: 'Total Faturado', value: filteredStats.total, icon: TrendingUp, color: 'text-primary', accent: 'from-primary/20 to-primary/5', border: 'border-primary/20', ring: 'bg-primary/15', count: filteredStats.totalCount, countLabel: 'faturas' },
            { title: 'Aguardando',     value: filteredStats.pending, icon: Clock,       color: 'text-amber-500', accent: 'from-amber-500/20 to-amber-500/5', border: 'border-amber-500/20', ring: 'bg-amber-500/15', count: filteredStats.pendingCount, countLabel: 'faturas' },
            { title: 'Recebido',       value: filteredStats.paid,    icon: CheckCircle, color: 'text-emerald-500', accent: 'from-emerald-500/20 to-emerald-500/5', border: 'border-emerald-500/20', ring: 'bg-emerald-500/15', count: filteredStats.paidCount, countLabel: 'pagas' },
            { title: 'Vencido',        value: filteredStats.overdue, icon: AlertTriangle, color: 'text-red-500', accent: 'from-red-500/20 to-red-500/5', border: 'border-red-500/20', ring: 'bg-red-500/15', count: filteredStats.overdueCount, countLabel: 'faturas' },
          ].map((stat, i) => (
            <motion.div key={stat.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <Card className={cn('relative overflow-hidden border transition-all hover:shadow-lg hover:shadow-black/10 hover:-translate-y-0.5', stat.border)}>
                <div className={cn('absolute inset-0 bg-gradient-to-br opacity-60', stat.accent)} />
                <CardContent className="relative pt-5 pb-4 px-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', stat.ring)}>
                      <stat.icon className={cn('h-5 w-5', stat.color)} />
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
                      {stat.count} {stat.countLabel}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{stat.title}</p>
                  {canViewFinancialValues ? (
                    <p className={cn('text-xl font-bold', stat.color)}>
                      R$ {fmt(stat.value)}
                    </p>
                  ) : (
                    <p className="text-lg font-bold flex items-center gap-1.5 text-muted-foreground/40">
                      <EyeOff className="h-4 w-4" /> Restrito
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* ── PROGRESS BAR ───────────────────────── */}
        {filteredStats.total > 0 && canViewFinancialValues && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-muted-foreground">Composição do Faturamento</span>
              <span className="text-xs text-muted-foreground">R$ {fmt(filteredStats.total)} total</span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/60 gap-0.5">
              <motion.div initial={{ width: 0 }} animate={{ width: `${paidPct}%` }} transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }} className="h-full bg-emerald-500 rounded-l-full" />
              <motion.div initial={{ width: 0 }} animate={{ width: `${pendingPct}%` }} transition={{ duration: 1, ease: 'easeOut', delay: 0.55 }} className="h-full bg-amber-500" />
              <div className="h-full flex-1 bg-red-500/60 rounded-r-full" />
            </div>
            <div className="flex gap-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />Recebido {paidPct.toFixed(0)}%</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />Pendente {pendingPct.toFixed(0)}%</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500/60 inline-block" />Vencido {filteredStats.total > 0 ? ((filteredStats.overdue / filteredStats.total) * 100).toFixed(0) : 0}%</span>
            </div>
          </motion.div>
        )}

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
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-36 h-9 bg-background/60 border-border/60">
                  <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="overdue">Vencido</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>

              {/* Date quick filters */}
              <div className="flex items-center border rounded-lg bg-background/60 border-border/60 overflow-hidden">
                <Button
                  variant={dateFilter === 'today' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-none h-9 text-xs"
                  onClick={() => setDateFilter(dateFilter === 'today' ? 'all' : 'today')}
                >
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  Hoje
                </Button>
                <Button
                  variant={dateFilter === 'week' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-none border-l border-border/60 h-9 text-xs"
                  onClick={() => setDateFilter(dateFilter === 'week' ? 'all' : 'week')}
                >
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  Semana
                </Button>
                <Button
                  variant={dateFilter === 'month' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-none border-l border-border/60 h-9 text-xs"
                  onClick={() => setDateFilter(dateFilter === 'month' ? 'all' : 'month')}
                >
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  Mês
                </Button>
              </div>

              {/* Month navigator */}
              <div className="flex items-center border rounded-lg bg-background/60 border-border/60">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-r-none"
                  onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-3 text-sm font-medium capitalize min-w-[120px] text-center">
                  {format(selectedMonth, "MMM 'de' yyyy", { locale: ptBR })}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-l-none"
                  onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Descrição</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Cliente</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-semibold hidden md:table-cell">Valor</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-semibold hidden md:table-cell">Método</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-semibold hidden lg:table-cell">Vencimento</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Status</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                      <p className="text-sm text-muted-foreground">Carregando faturas...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2">
                      <DollarSign className="h-10 w-10 text-muted-foreground/30" />
                      <p className="text-muted-foreground">Nenhuma fatura encontrada</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <AnimatePresence>
                  {filteredInvoices.map((invoice, idx) => {
                    const ns = normalizeStatus(invoice.status);
                    const sc = STATUS_CONFIG[ns] || STATUS_CONFIG.pending;
                    const isOverdue = ns === 'overdue';

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
                          <span className="text-sm text-muted-foreground">
                            {(invoice.profiles as any)?.full_name || (invoice.profiles as any)?.email || '—'}
                          </span>
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
                            <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', sc.dot, ns === 'pending' && 'animate-pulse')} />
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
                            {ns !== 'paid' && ns !== 'cancelled' && (
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

          {filteredInvoices.length > 0 && (
            <div className="px-4 py-3 border-t border-border/60 bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
              <span>{filteredInvoices.length} fatura{filteredInvoices.length !== 1 ? 's' : ''} exibida{filteredInvoices.length !== 1 ? 's' : ''}</span>
              {canViewFinancialValues && (
                <span className="font-medium">
                  Total filtrado: R$ {fmt(filteredInvoices.reduce((s, i) => s + Number(i.amount), 0))}
                </span>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}
