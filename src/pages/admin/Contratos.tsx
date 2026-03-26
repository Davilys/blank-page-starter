import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { 
  Search, Plus, RefreshCw, FileSignature, MoreHorizontal, 
  Eye, Trash2, Download, Send, Filter, CheckCircle, XCircle, Loader2, Timer, Edit,
  TrendingUp, DollarSign, FileText, PenTool, RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { format, isToday, isThisWeek, isThisMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ContractDetailSheet } from '@/components/admin/contracts/ContractDetailSheet';
import { CreateContractDialog } from '@/components/admin/contracts/CreateContractDialog';
import { EditContractDialog } from '@/components/admin/contracts/EditContractDialog';
import { generateDocumentPrintHTML, getLogoBase64ForPDF } from '@/components/contracts/DocumentRenderer';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatePeriodFilter, type DateFilterType } from '@/components/admin/clients/DatePeriodFilter';
import { motion } from 'framer-motion';
import { useCanViewFinancialValues } from '@/hooks/useCanViewFinancialValues';
import { EyeOff } from 'lucide-react';

interface Contract {
  id: string;
  contract_number: string | null;
  subject: string | null;
  contract_value: number | null;
  start_date: string | null;
  end_date: string | null;
  signature_status: string | null;
  signature_expires_at: string | null;
  signed_at: string | null;
  visible_to_client: boolean | null;
  user_id: string | null;
  created_at: string | null;
  contract_type_id: string | null;
  contract_html?: string | null;
  description?: string | null;
  payment_method?: string | null;
  asaas_payment_id?: string | null;
  template_id?: string | null;
  contract_type?: { name: string } | null;
  contract_template?: { name: string } | null;
  profile?: { full_name: string | null; phone: string | null } | null;
}

// --- Animated Ring Component ---
const AnimatedRing = ({ percentage, color, size = 64 }: { percentage: number; color: string; size?: number }) => {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (percentage / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        className="text-muted/30"
      />
      <motion.circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference - strokeDash }}
        transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
      />
    </svg>
  );
};

// --- Stat Card Component ---
const StatCard = ({ 
  icon: Icon, label, value, subtitle, color, gradient, delay, ring 
}: { 
  icon: any; label: string; value: string | number; subtitle?: string; 
  color: string; gradient: string; delay: number; ring?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 24, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    whileHover={{ y: -4, scale: 1.02 }}
    className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 group cursor-default"
  >
    {/* Decorative bg */}
    <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-[0.07] ${gradient}`} />
    <div className={`absolute -bottom-8 -left-8 w-24 h-24 rounded-full opacity-[0.04] ${gradient}`} />

    <div className="relative flex items-center justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <div className={`p-2 rounded-xl ${gradient} shadow-lg`}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        <motion.p
          className="text-3xl font-bold tracking-tight"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: delay + 0.2 }}
        >
          {value}
        </motion.p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
      {ring !== undefined && (
        <div className="relative">
          <AnimatedRing percentage={ring} color={color} size={56} />
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
            {Math.round(ring)}%
          </span>
        </div>
      )}
    </div>

    {/* Hover glow */}
    <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}
      style={{ boxShadow: `inset 0 0 40px ${color}15, 0 0 30px ${color}08` }}
    />
  </motion.div>
);

export default function AdminContratos() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [signatureFilter, setSignatureFilter] = useState<string>('all');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editContract, setEditContract] = useState<Contract | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [expiringPromotion, setExpiringPromotion] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const handleExpirePromotions = async () => {
    if (!confirm(
      'Deseja atualizar contratos promocionais não assinados?\n\n' +
      '• Valor atual: R$ 699,00\n' +
      '• Novo valor: R$ 1.194,00\n\n' +
      'Apenas contratos à vista, não assinados e não pagos serão afetados.'
    )) return;
    
    setExpiringPromotion(true);
    try {
      const response = await supabase.functions.invoke('expire-promotion-price', {
        body: { triggered_by: 'manual_admin' }
      });
      
      if (response.error) throw response.error;
      
      const { updated_count } = response.data;
      
      if (updated_count > 0) {
        toast.success(`${updated_count} contrato(s) atualizado(s) com sucesso`);
      } else {
        toast.info('Nenhum contrato elegível para atualização');
      }
      
      refreshContracts();
    } catch (error) {
      console.error('Error expiring promotions:', error);
      toast.error('Erro ao expirar promoções');
    } finally {
      setExpiringPromotion(false);
    }
  };

  const handleDownloadPDF = async (contractId: string) => {
    setDownloadingId(contractId);
    try {
      const { data: contract, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', contractId)
        .single();

      if (error || !contract) {
        toast.error('Erro ao buscar contrato');
        return;
      }

      if (!contract.contract_html) {
        toast.error('Contrato não possui conteúdo HTML');
        return;
      }

      const logoBase64 = await getLogoBase64ForPDF();
      const documentType = (contract.document_type || 'contract') as 'contract' | 'distrato_multa' | 'distrato_sem_multa' | 'procuracao';
      
      const printHtml = generateDocumentPrintHTML(
        documentType,
        contract.contract_html,
        contract.client_signature_image || undefined,
        contract.blockchain_hash ? {
          hash: contract.blockchain_hash,
          timestamp: contract.blockchain_timestamp || '',
          txId: contract.blockchain_tx_id || '',
          network: contract.blockchain_network || '',
          ipAddress: contract.signature_ip || '',
        } : undefined,
        contract.signatory_name || undefined,
        contract.signatory_cpf || undefined,
        contract.signatory_cnpj || undefined,
        undefined,
        window.location.origin,
        logoBase64
      );

      const enhancedHtml = printHtml
        .replace('</head>', `
          <style>
            @media print { .no-print { display: none !important; } }
            .action-buttons {
              position: fixed;
              top: 20px;
              right: 20px;
              z-index: 9999;
              display: flex;
              gap: 8px;
            }
            .action-buttons button {
              padding: 12px 20px;
              border-radius: 8px;
              font-weight: 600;
              cursor: pointer;
              border: none;
              font-size: 14px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            .btn-primary {
              background: linear-gradient(135deg, #f97316, #ea580c);
              color: white;
            }
            .btn-secondary {
              background: #f1f5f9;
              color: #334155;
            }
          </style>
        </head>`)
        .replace('<body', `<body><div class="action-buttons no-print">
          <button class="btn-primary" onclick="window.print()">Salvar como PDF</button>
          <button class="btn-secondary" onclick="window.close()">Fechar</button>
        </div><body`.slice(0, -5));

      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(enhancedHtml);
        newWindow.document.close();
        newWindow.onload = () => setTimeout(() => newWindow.print(), 500);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  // Wait for auth session before fetching
  useEffect(() => {
    let mounted = true;

    // Always listen for auth state — covers both immediate session and delayed hydration
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && mounted) {
        fetchContracts();
      }
    });

    // Also try immediately in case session is already available
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && mounted) {
        fetchContracts();
      }
    });

    // Realtime subscription — auto-refresh when contracts change
    const realtimeSub = supabase
      .channel('contracts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, () => {
        if (mounted) fetchContracts();
      })
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
      realtimeSub.unsubscribe();
    };
  }, []);

  const fetchContracts = async (retryCount = 0) => {
    setLoading(true);
    try {
      // Ensure session is active before querying
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (retryCount < 3) {
          setTimeout(() => fetchContracts(retryCount + 1), 600);
        } else {
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from('contracts')
        .select(`
          id,
          contract_number,
          subject,
          contract_value,
          start_date,
          end_date,
          signature_status,
          signature_expires_at,
          signed_at,
          visible_to_client,
          user_id,
          created_at,
          contract_type_id,
          description,
          payment_method,
          asaas_payment_id,
          template_id,
          document_type,
          contract_type:contract_types(name),
          contract_template:contract_templates(name),
          profile:profiles(full_name, phone)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Retry if empty result on first attempt (auth hydration race)
      if ((!data || data.length === 0) && retryCount < 2) {
        setTimeout(() => fetchContracts(retryCount + 1), 800);
        setLoading(false);
        return;
      }

      setContracts(data || []);
    } catch (error) {
      console.error('Error fetching contracts:', error);
      toast.error('Erro ao carregar contratos');
    } finally {
      setLoading(false);
    }
  };

  // Wrapper without args — safe to pass directly to onClick handlers and callbacks
  const refreshContracts = () => fetchContracts(0);

  const handleRevertPromotion = async (contract: Contract) => {
    // Only allow reverting contracts that are not signed and not paid
    if (contract.signature_status === 'signed') {
      toast.error('Não é possível reverter um contrato já assinado.');
      return;
    }
    if (contract.asaas_payment_id) {
      toast.error('Não é possível reverter um contrato que já possui cobrança gerada.');
      return;
    }

    if (!confirm(`Reverter este contrato para o preço promocional de R$ 699,00 (à vista)?\n\nContrato: ${contract.contract_number || contract.id}`)) return;

    try {
      // Clause 5.1 promotional text
      const PROMO_CLAUSE_51 = `5.1 Os pagamentos à CONTRATADA serão efetuados conforme a opção escolhida pelo CONTRATANTE:\n\n• Pagamento à vista: R$ 699,00 (seiscentos e noventa e nove reais).\n• Pagamento parcelado via cartão de crédito: 6 (seis) parcelas de R$ 116,50 (cento e dezesseis reais e cinquenta centavos) sem incidência de juros.\n\n`;

      const updatePayload: { contract_value: number; payment_method: string; contract_html?: string } = {
        contract_value: 699.00,
        payment_method: 'avista',
      };

      // Update clause 5.1 in contract_html if it exists
      if (contract.contract_html) {
        const clause51Regex = /5\.1 Os pagamentos à CONTRATADA[\s\S]*?(?=5\.2 Taxas do INPI)/;
        if (clause51Regex.test(contract.contract_html)) {
          updatePayload.contract_html = contract.contract_html.replace(clause51Regex, PROMO_CLAUSE_51);
        }
      }

      const { error } = await supabase
        .from('contracts')
        .update(updatePayload)
        .eq('id', contract.id);

      if (error) throw error;

      toast.success(`Contrato ${contract.contract_number || ''} revertido para R$ 699,00 com sucesso!`);
      refreshContracts();
    } catch (error: any) {
      console.error('Error reverting promotion:', error);
      toast.error(error.message || 'Erro ao reverter promoção');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este contrato?')) return;
    
    try {
      await supabase.from('contract_attachments').delete().eq('contract_id', id);
      await supabase.from('contract_comments').delete().eq('contract_id', id);
      await supabase.from('contract_notes').delete().eq('contract_id', id);
      await supabase.from('contract_tasks').delete().eq('contract_id', id);
      await supabase.from('contract_renewal_history').delete().eq('contract_id', id);
      await supabase.from('signature_audit_log').delete().eq('contract_id', id);
      await supabase.from('documents').delete().eq('contract_id', id);

      const { data, error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', id)
        .select('id');
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast.error('Não foi possível excluir o contrato. Verifique suas permissões.');
        return;
      }
      
      toast.success('Contrato excluído com sucesso');
      refreshContracts();
    } catch (error: any) {
      console.error('Error deleting contract:', error);
      toast.error(error.message || 'Erro ao excluir contrato');
    }
  };

  const getSignatureBadge = (status: string | null, expiresAt: string | null) => {
    if (status === 'signed') {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Assinado
        </Badge>
      );
    }
    // Check if link is expired
    const isExpired = expiresAt && new Date(expiresAt) < new Date();
    if (isExpired) {
      return (
        <Badge className="bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20 font-medium gap-1.5">
          <span className="h-2 w-2 rounded-full bg-orange-500/60"></span>
          Expirado
        </Badge>
      );
    }
    return (
      <Badge className="bg-destructive/10 text-destructive border-destructive/20 font-medium gap-1.5">
        <span className="h-2 w-2 rounded-full bg-destructive/60"></span>
        Pendente
      </Badge>
    );
  };

  const CONTRACT_TABS = [
    { value: 'all', label: 'Todos' },
    { value: 'padrao', label: 'Contrato Padrão - Registro de Marca INPI' },
    { value: 'premium', label: 'Contrato Premium' },
    { value: 'corporativo', label: 'Contrato Corporativo' },
    { value: 'procuracao', label: 'Procuração' },
    { value: 'distrato_sem', label: 'Distrato sem Multa' },
    { value: 'distrato_com', label: 'Distrato com Multa' },
  ];

  const getContractTabMatch = (contract: Contract, tab: string): boolean => {
    if (tab === 'all') return true;
    const templateName = (contract.contract_template?.name || '').toLowerCase();
    const typeName = (contract.contract_type?.name || '').toLowerCase();
    const subject = (contract.subject || '').toLowerCase();
    const combined = `${templateName} ${typeName} ${subject}`;

    switch (tab) {
      case 'padrao':
        return (combined.includes('padrão') || combined.includes('padrao')) && 
               combined.includes('registro de marca') &&
               !combined.includes('premium') && !combined.includes('corporativ') && !combined.includes('procura');
      case 'premium':
        return combined.includes('premium');
      case 'corporativo':
        return combined.includes('corporativ');
      case 'procuracao':
        return combined.includes('procura');
      case 'distrato_sem':
        return combined.includes('distrato') && combined.includes('sem');
      case 'distrato_com':
        return combined.includes('distrato') && combined.includes('com') && !combined.includes('sem');
      default:
        return true;
    }
  };

  const filteredContracts = contracts.filter(contract => {
    const clientName = contract.profile?.full_name || '';
    const matchesSearch = 
      contract.contract_number?.toLowerCase().includes(search.toLowerCase()) ||
      contract.subject?.toLowerCase().includes(search.toLowerCase()) ||
      clientName.toLowerCase().includes(search.toLowerCase());
    
    const matchesSignature = 
      signatureFilter === 'all' ||
      (signatureFilter === 'signed' && contract.signature_status === 'signed') ||
      (signatureFilter === 'not_signed' && contract.signature_status !== 'signed');

    const matchesTab = getContractTabMatch(contract, activeTab);

    let matchesDate = true;
    if (dateFilter !== 'all' && contract.created_at) {
      const contractDate = new Date(contract.created_at);
      if (dateFilter === 'today') {
        matchesDate = isToday(contractDate);
      } else if (dateFilter === 'week') {
        matchesDate = isThisWeek(contractDate, { locale: ptBR });
      } else if (dateFilter === 'month') {
        matchesDate = contractDate.getMonth() === selectedMonth.getMonth() && 
                      contractDate.getFullYear() === selectedMonth.getFullYear();
      }
    }
    
    return matchesSearch && matchesSignature && matchesTab && matchesDate;
  });

  const { canViewFinancialValues, isLoading: finLoading } = useCanViewFinancialValues();
  const totalValue = filteredContracts.reduce((sum, c) => sum + (c.contract_value || 0), 0);
  const signedCount = filteredContracts.filter(c => c.signature_status === 'signed').length;
  const pendingCount = filteredContracts.filter(c => c.signature_status !== 'signed').length;
  const signedPct = filteredContracts.length > 0 ? (signedCount / filteredContracts.length) * 100 : 0;
  const pendingPct = filteredContracts.length > 0 ? (pendingCount / filteredContracts.length) * 100 : 0;

  return (
    <>
      <div className="space-y-6">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6"
        >
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />
          
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                className="p-3 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg"
                style={{ boxShadow: '0 8px 32px hsla(210, 100%, 40%, 0.3)' }}
              >
                <FileSignature className="h-7 w-7 text-primary-foreground" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Contratos</h1>
                <p className="text-sm text-muted-foreground">
                  Gestão completa de contratos e assinaturas digitais
                </p>
              </div>
            </div>
            
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-2"
            >
              <Button variant="outline" size="icon" onClick={refreshContracts} className="rounded-xl hover:bg-muted/80">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                onClick={handleExpirePromotions}
                disabled={expiringPromotion}
                className="rounded-xl text-amber-600 border-amber-500/30 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              >
                {expiringPromotion ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Timer className="h-4 w-4 mr-2" />
                )}
                Expirar Promoções
              </Button>
              <Button onClick={() => setCreateOpen(true)} className="rounded-xl bg-gradient-to-r from-primary to-primary/80 shadow-lg hover:shadow-xl transition-shadow">
                <Plus className="h-4 w-4 mr-2" />
                Novo Contrato
              </Button>
            </motion.div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={FileText}
            label="Total"
            value={filteredContracts.length}
            subtitle="contratos encontrados"
            color="hsl(210, 100%, 40%)"
            gradient="bg-gradient-to-br from-primary to-primary/70"
            delay={0.1}
          />
          <StatCard
            icon={CheckCircle}
            label="Assinados"
            value={signedCount}
            subtitle={`de ${filteredContracts.length} contratos`}
            color="hsl(152, 76%, 45%)"
            gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
            delay={0.2}
            ring={signedPct}
          />
          <StatCard
            icon={PenTool}
            label="Pendentes"
            value={pendingCount}
            subtitle="aguardando assinatura"
            color="hsl(0, 72%, 51%)"
            gradient="bg-gradient-to-br from-destructive to-red-600"
            delay={0.3}
            ring={pendingPct}
          />
          <StatCard
            icon={canViewFinancialValues ? DollarSign : EyeOff}
            label="Valor Total"
            value={canViewFinancialValues
              ? `R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
              : '—— ——'
            }
            subtitle={canViewFinancialValues ? "soma dos contratos filtrados" : "restrito ao admin master"}
            color="hsl(210, 100%, 40%)"
            gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
            delay={0.4}
          />
        </div>

        {/* Filters Bar */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap p-4 rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm"
        >
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, assunto ou cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-xl border-border/50 bg-background/50"
            />
          </div>
          <Select value={signatureFilter} onValueChange={setSignatureFilter}>
            <SelectTrigger className="w-[180px] rounded-xl border-border/50">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtrar assinatura" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="signed">Assinados</SelectItem>
              <SelectItem value="not_signed">Não assinados</SelectItem>
            </SelectContent>
          </Select>
          <DatePeriodFilter
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
          />
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start overflow-x-auto rounded-xl bg-muted/50 p-1">
              {CONTRACT_TABS.map(tab => (
                <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="rounded-2xl border border-border/50 overflow-hidden bg-card"
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold text-xs uppercase tracking-wider">#</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider">Assunto</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider">Cliente</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider">Tipo</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider">Valor</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider">Início</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider">Expira</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider">Telefone</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        <Loader2 className="h-8 w-8 text-primary" />
                      </motion.div>
                      <span className="text-sm text-muted-foreground">Carregando contratos...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredContracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 rounded-full bg-muted/50">
                        <FileText className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm text-muted-foreground">Nenhum contrato encontrado</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {filteredContracts.map((contract, index) => (
                    <TableRow
                      key={contract.id}
                      className="group border-b border-border/30 hover:bg-muted/20 transition-colors duration-200"
                      style={{
                        animation: `fadeInRow 0.3s ease forwards`,
                        animationDelay: `${Math.min(index * 0.03, 0.5)}s`,
                        opacity: 0,
                      }}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {contract.contract_number || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{contract.subject || 'Sem assunto'}</p>
                          <div className="flex gap-2 mt-0.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button 
                              className="text-primary hover:underline"
                              onClick={() => { setSelectedContract(contract); setDetailOpen(true); }}
                            >
                              Ver
                            </button>
                            <button 
                              className="text-primary hover:underline"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (contract.signature_status === 'signed') {
                                  toast.error('Contratos assinados não podem ser editados');
                                  return;
                                }
                                setEditContract(contract);
                                setEditOpen(true);
                              }}
                            >
                              Editar
                            </button>
                            <button 
                              className="text-destructive hover:underline"
                              onClick={() => handleDelete(contract.id)}
                            >
                              Deletar
                            </button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{contract.profile?.full_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-lg text-xs font-normal border-border/50">
                          {contract.contract_type?.name || contract.contract_template?.name || 'N/D'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-sm">
                        {finLoading
                          ? <span className="inline-block h-4 w-20 animate-pulse rounded bg-muted" />
                          : canViewFinancialValues
                            ? (contract.contract_value
                                ? `R$ ${contract.contract_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                : '-')
                            : <span className="flex items-center gap-1 text-muted-foreground/50 text-xs"><EyeOff className="h-3 w-3" /> Restrito</span>
                        }
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {contract.start_date
                          ? (() => { const [y,m,d] = contract.start_date.split('-').map(Number); return format(new Date(y, m-1, d), 'dd/MM/yy', { locale: ptBR }); })()
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {contract.signature_status === 'signed'
                          ? '-'
                          : contract.signature_expires_at
                            ? format(new Date(contract.signature_expires_at), 'dd/MM/yy', { locale: ptBR })
                            : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{contract.profile?.phone || '-'}</TableCell>
                      <TableCell>{getSignatureBadge(contract.signature_status, contract.signature_expires_at)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem onClick={() => { setSelectedContract(contract); setDetailOpen(true); }}>
                              <Eye className="h-4 w-4 mr-2" />
                              Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Send className="h-4 w-4 mr-2" />
                              Enviar para Assinatura
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDownloadPDF(contract.id)}
                              disabled={downloadingId === contract.id}
                            >
                              {downloadingId === contract.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4 mr-2" />
                              )}
                              Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {/* Reverter Expiração da Promoção — only shown when contract value is NOT 699 and is not signed/paid */}
                            {contract.contract_value !== 699 &&
                              contract.contract_value !== null &&
                              contract.signature_status !== 'signed' &&
                              !contract.asaas_payment_id && (
                              <DropdownMenuItem
                                onClick={() => handleRevertPromotion(contract)}
                                className="text-amber-600 focus:text-amber-600 dark:text-amber-400 dark:focus:text-amber-400"
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Reverter Expiração (R$ 699)
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              onClick={() => handleDelete(contract.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                      </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )}
            </TableBody>
          </Table>
        </motion.div>
      </div>

      <ContractDetailSheet
        contract={selectedContract}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdate={refreshContracts}
      />

      <CreateContractDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={refreshContracts}
      />

      <EditContractDialog
        contract={editContract}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={refreshContracts}
      />
    </>
  );
}
