import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isWithinInterval, subMonths, addMonths, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Trophy, Plus, Users, DollarSign, FileText, Megaphone,
  CreditCard, ChevronLeft, ChevronRight, Pencil, Trash2, BarChart3, Award,
  User, Tag, Hash, Calendar, MessageSquare, Wallet, Search, TrendingUp, Target, Sparkles
} from 'lucide-react';
import { motion } from 'framer-motion';

// ---- Types ----
interface AwardEntry {
  id: string;
  entry_type: 'registro_marca' | 'publicacao' | 'cobranca';
  client_name: string;
  brand_name: string | null;
  responsible_user_id: string;
  entry_date: string;
  observations: string | null;
  brand_quantity: number | null;
  payment_type: string | null;
  publication_type: string | null;
  pub_quantity: number | null;
  installments_paid: number | null;
  total_resolved_value: number | null;
  payment_date: string | null;
  payment_form: string | null;
  created_at: string;
}

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
}

// ---- Config type (matches AwardSettings) ----
interface AwardConfig {
  enabled: boolean;
  registro_marca: {
    base_rate: number;
    above_goal_avista_rate: number;
    above_goal_parcelado_rate: number;
    monthly_goal: number;
  };
  publicacao: {
    base_rate: number;
    above_goal_rate: number;
    monthly_goal: number;
    milestone_interval: number;
    milestone_bonus: number;
  };
  cobranca: {
    tiers: { min: number; max: number; rate: number }[];
    milestone_interval: number;
    milestone_bonus: number;
  };
  master_admin_email: string;
}

const DEFAULT_CONFIG: AwardConfig = {
  enabled: true,
  registro_marca: { base_rate: 50, above_goal_avista_rate: 100, above_goal_parcelado_rate: 50, monthly_goal: 30 },
  publicacao: { base_rate: 50, above_goal_rate: 100, monthly_goal: 50, milestone_interval: 10, milestone_bonus: 100 },
  cobranca: {
    tiers: [
      { min: 199, max: 397, rate: 10 },
      { min: 398, max: 597, rate: 25 },
      { min: 598, max: 999, rate: 50 },
      { min: 1000, max: 1500, rate: 75 },
      { min: 1518, max: 99999, rate: 100 },
    ],
    milestone_interval: 10,
    milestone_bonus: 50,
  },
  master_admin_email: 'davillys@gmail.com',
};

// ---- Calculation helpers (config-aware) ----
function calcRegistroMarcaPremium(entries: AwardEntry[], cfg: AwardConfig['registro_marca']): number {
  let total = 0;
  const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  let accumulated = 0;
  for (const entry of sorted) {
    const qty = entry.brand_quantity || 1;
    for (let i = 0; i < qty; i++) {
      accumulated++;
      if (accumulated <= cfg.monthly_goal) {
        total += cfg.base_rate;
      } else {
        total += entry.payment_type === 'avista' ? cfg.above_goal_avista_rate : cfg.above_goal_parcelado_rate;
      }
    }
  }
  return total;
}

function calcPublicacaoPremium(entries: AwardEntry[], cfg: AwardConfig['publicacao']): number {
  const totalPubs = entries.reduce((s, e) => s + (e.pub_quantity || 1), 0);
  const rate = totalPubs >= cfg.monthly_goal ? cfg.above_goal_rate : cfg.base_rate;
  return totalPubs * rate;
}

function calcPublicacaoMilestoneBonus(entries: AwardEntry[], cfg: AwardConfig['publicacao']): { bonus: number; milestones: number; nextAt: number } {
  const totalPubs = entries.reduce((s, e) => s + (e.pub_quantity || 1), 0);
  const interval = cfg.milestone_interval || 10;
  const milestones = Math.floor(totalPubs / interval);
  const bonus = milestones * (cfg.milestone_bonus || 100);
  const nextAt = (milestones + 1) * interval;
  return { bonus, milestones, nextAt };
}

function calcCobrancaMilestoneBonus(entries: AwardEntry[], cfg: AwardConfig['cobranca']): { bonus: number; milestones: number; nextAt: number } {
  const totalCob = entries.length;
  const interval = cfg.milestone_interval || 10;
  const milestones = Math.floor(totalCob / interval);
  const bonus = milestones * (cfg.milestone_bonus || 50);
  const nextAt = (milestones + 1) * interval;
  return { bonus, milestones, nextAt };
}

function calcCobrancaPremium(entries: AwardEntry[], cfg: AwardConfig['cobranca']): number {
  let total = 0;
  for (const entry of entries) {
    if (!entry.total_resolved_value || !entry.installments_paid || entry.installments_paid === 0) continue;
    const perInstallment = entry.total_resolved_value / entry.installments_paid;
    let rate = 0;
    for (const tier of cfg.tiers) {
      if (perInstallment >= tier.min && perInstallment <= tier.max) {
        rate = tier.rate;
        break;
      }
    }
    total += rate * entry.installments_paid;
  }
  return total;
}

const formatCurrency = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

// ---- Main Component ----
export default function Premiacao() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [datePeriod, setDatePeriod] = useState<'hoje' | 'semana' | 'mes'>('mes');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AwardEntry | null>(null);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');

  // Form state
  const [formType, setFormType] = useState<'registro_marca' | 'publicacao' | 'cobranca'>('registro_marca');
  const [formClientName, setFormClientName] = useState('');
  const [formBrandName, setFormBrandName] = useState('');
  const [formBrandQty, setFormBrandQty] = useState(1);
  const [formPaymentType, setFormPaymentType] = useState('avista');
  const [formPubType, setFormPubType] = useState('deferimento');
  const [formPubQty, setFormPubQty] = useState(1);
  const [formPubPaymentForm, setFormPubPaymentForm] = useState('avista');
  const [formInstallments, setFormInstallments] = useState(1);
  const [formResolvedValue, setFormResolvedValue] = useState('');
  const [formCustomValue, setFormCustomValue] = useState('');
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formObs, setFormObs] = useState('');

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Load award config from system_settings
  const { data: awardConfig } = useQuery({
    queryKey: ['award-config'],
    queryFn: async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'award_config')
        .maybeSingle();
      if (data?.value) {
        return { ...DEFAULT_CONFIG, ...(data.value as unknown as AwardConfig) };
      }
      return DEFAULT_CONFIG;
    },
    staleTime: 1000 * 60 * 5,
  });

  const cfg = awardConfig || DEFAULT_CONFIG;

  const isMaster = currentUser?.email === cfg.master_admin_email;

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['award-team-members'],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
      if (!roles || roles.length === 0) return [];
      const ids = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', ids);
      return (profiles || []) as TeamMember[];
    },
  });

  interface ClientWithBrand {
    id: string;
    full_name: string | null;
    email: string;
    brand_names: string[];
  }

  const { data: clientsList = [] } = useQuery({
    queryKey: ['award-clients-search'],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');
      if (!profiles) return [];
      const { data: processes } = await supabase
        .from('brand_processes')
        .select('user_id, brand_name');
      const brandMap = new Map<string, string[]>();
      (processes || []).forEach(p => {
        if (p.user_id) {
          const arr = brandMap.get(p.user_id) || [];
          arr.push(p.brand_name);
          brandMap.set(p.user_id, arr);
        }
      });
      return profiles.map(p => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        brand_names: brandMap.get(p.id) || [],
      })) as ClientWithBrand[];
    },
  });

  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) return clientsList.slice(0, 20);
    const q = clientSearchQuery.toLowerCase();
    return clientsList.filter(c =>
      (c.full_name || '').toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [clientsList, clientSearchQuery]);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['award-entries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('award_entries')
        .select('*')
        .order('entry_date', { ascending: false });
      if (error) throw error;
      return data as AwardEntry[];
    },
  });

  const dateRange = useMemo(() => {
    const now = new Date();
    if (datePeriod === 'hoje') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      return { start, end };
    }
    if (datePeriod === 'semana') {
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    }
    return { start: monthStart, end: monthEnd };
  }, [datePeriod, monthStart, monthEnd]);

  const filteredEntries = useMemo(() => {
    const effectiveFilter = isMaster ? filterUser : (currentUser?.id || 'none');
    return entries.filter(e => {
      const d = new Date(e.entry_date);
      const inRange = isWithinInterval(d, { start: dateRange.start, end: dateRange.end });
      const matchUser = effectiveFilter === 'all' || e.responsible_user_id === effectiveFilter;
      return inRange && matchUser;
    });
  }, [entries, dateRange, filterUser, isMaster, currentUser?.id]);

  const registroEntries = filteredEntries.filter(e => e.entry_type === 'registro_marca');
  const publicacaoEntries = filteredEntries.filter(e => e.entry_type === 'publicacao');
  const cobrancaEntries = filteredEntries.filter(e => e.entry_type === 'cobranca');

  const totalRegistroPremium = calcRegistroMarcaPremium(registroEntries, cfg.registro_marca);
  const totalPublicacaoPremium = calcPublicacaoPremium(publicacaoEntries, cfg.publicacao);
  const totalCobrancaPremium = calcCobrancaPremium(cobrancaEntries, cfg.cobranca);
  const pubMilestone = calcPublicacaoMilestoneBonus(publicacaoEntries, cfg.publicacao);
  const cobMilestone = calcCobrancaMilestoneBonus(cobrancaEntries, cfg.cobranca);
  const totalMilestoneBonus = pubMilestone.bonus + cobMilestone.bonus;
  const totalPremium = totalRegistroPremium + totalPublicacaoPremium + totalCobrancaPremium + totalMilestoneBonus;
  const totalBrands = registroEntries.reduce((s, e) => s + (e.brand_quantity || 1), 0);
  const totalPubs = publicacaoEntries.reduce((s, e) => s + (e.pub_quantity || 1), 0);

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (editingEntry) {
        const { error } = await supabase.from('award_entries').update(data as any).eq('id', editingEntry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('award_entries').insert(data as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['award-entries'] });
      toast.success(editingEntry ? 'Registro atualizado!' : 'Registro criado!');
      resetForm();
      setDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('award_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['award-entries'] });
      toast.success('Registro excluído!');
    },
  });

  function resetForm() {
    setFormClientName('');
    setFormBrandName('');
    setFormBrandQty(1);
    setFormPaymentType('avista');
    setFormPubType('deferimento');
    setFormPubQty(1);
    setFormPubPaymentForm('avista');
    setFormInstallments(1);
    setFormResolvedValue('');
    setFormCustomValue('');
    setFormDate(format(new Date(), 'yyyy-MM-dd'));
    setFormObs('');
    setEditingEntry(null);
    setClientSearchQuery('');
    setClientSearchOpen(false);
  }

  function openEdit(entry: AwardEntry) {
    setEditingEntry(entry);
    setFormType(entry.entry_type);
    setFormClientName(entry.client_name);
    setFormBrandName(entry.brand_name || '');
    setFormBrandQty(entry.brand_quantity || 1);
    setFormPaymentType(entry.payment_type || 'avista');
    setFormPubType(entry.publication_type || 'deferimento');
    setFormPubQty(entry.pub_quantity || 1);
    setFormPubPaymentForm(entry.payment_form || 'avista');
    setFormInstallments(entry.installments_paid || 1);
    setFormResolvedValue(String(entry.total_resolved_value || ''));
    setFormCustomValue('');
    setFormDate(entry.entry_date);
    setFormObs(entry.observations || '');
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formClientName.trim()) return toast.error('Nome do cliente é obrigatório');
    const { data: { user } } = await supabase.auth.getUser();
    const responsibleId = user?.id;
    if (!responsibleId) return toast.error('Usuário não encontrado');

    const base: Record<string, unknown> = {
      entry_type: formType,
      client_name: formClientName.trim(),
      brand_name: formBrandName.trim() || null,
      responsible_user_id: responsibleId,
      entry_date: formDate,
      observations: formObs.trim() || null,
      created_by: user?.id,
    };

    if (formType === 'registro_marca') {
      base.brand_quantity = formBrandQty;
      base.payment_type = formPaymentType;
      if (formPaymentType === 'promocao') base.payment_form = 'promocao';
    } else if (formType === 'publicacao') {
      base.publication_type = formPubType;
      base.pub_quantity = formPubQty;
      base.payment_form = formPubPaymentForm;
    } else {
      base.installments_paid = formInstallments;
      base.total_resolved_value = parseFloat(formResolvedValue) || 0;
    }
    saveMutation.mutate(base);
  }

  function getUserName(userId: string) {
    return teamMembers.find(m => m.id === userId)?.full_name || 'Desconhecido';
  }

  const perUserStats = useMemo(() => {
    const map = new Map<string, { registro: number; publicacao: number; cobranca: number; premium: number; pubMilestoneBonus: number; cobMilestoneBonus: number }>();
    for (const member of teamMembers) {
      const userEntries = filteredEntries.filter(e => e.responsible_user_id === member.id);
      const reg = userEntries.filter(e => e.entry_type === 'registro_marca');
      const pub = userEntries.filter(e => e.entry_type === 'publicacao');
      const cob = userEntries.filter(e => e.entry_type === 'cobranca');
      const userPubMilestone = calcPublicacaoMilestoneBonus(pub, cfg.publicacao);
      const userCobMilestone = calcCobrancaMilestoneBonus(cob, cfg.cobranca);
      const basePremium = calcRegistroMarcaPremium(reg, cfg.registro_marca) + calcPublicacaoPremium(pub, cfg.publicacao) + calcCobrancaPremium(cob, cfg.cobranca);
      map.set(member.id, {
        registro: reg.reduce((s, e) => s + (e.brand_quantity || 1), 0),
        publicacao: pub.reduce((s, e) => s + (e.pub_quantity || 1), 0),
        cobranca: cob.length,
        premium: basePremium + userPubMilestone.bonus + userCobMilestone.bonus,
        pubMilestoneBonus: userPubMilestone.bonus,
        cobMilestoneBonus: userCobMilestone.bonus,
      });
    }
    return map;
  }, [teamMembers, filteredEntries, cfg]);

  // ---- Render helpers ----

  const typeLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    registro_marca: { label: 'Registro de Marca', icon: <FileText className="h-4 w-4" />, color: 'text-primary' },
    publicacao: { label: 'Publicação', icon: <Megaphone className="h-4 w-4" />, color: 'text-purple-500' },
    cobranca: { label: 'Cobrança', icon: <CreditCard className="h-4 w-4" />, color: 'text-orange-500' },
  };

  // Mobile card for entries
  const EntryCard = ({ entry, type }: { entry: AwardEntry; type: string }) => (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border bg-card p-4 space-y-3"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1 min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{entry.client_name}</p>
          {type !== 'cobranca' && entry.brand_name && (
            <p className="text-xs text-muted-foreground truncate">
              <Tag className="inline h-3 w-3 mr-1" />{entry.brand_name}
            </p>
          )}
        </div>
        <div className="flex gap-1 shrink-0 ml-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(entry)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => {
            if (confirm('Excluir registro?')) deleteMutation.mutate(entry.id);
          }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className="text-[11px] gap-1">
          <Calendar className="h-3 w-3" />
          {format(new Date(entry.entry_date), 'dd/MM/yyyy')}
        </Badge>
        {type === 'registro_marca' && (
          <>
            <Badge variant="secondary" className="text-[11px]">{entry.brand_quantity} marca(s)</Badge>
            <Badge variant={entry.payment_type === 'avista' ? 'default' : 'secondary'} className="text-[11px]">
              {entry.payment_type === 'avista' ? 'À Vista' : entry.payment_type === 'parcelado' ? 'Parcelado' : 'Promoção'}
            </Badge>
          </>
        )}
        {type === 'publicacao' && (
          <>
            <Badge variant="secondary" className="text-[11px]">{entry.pub_quantity} pub(s)</Badge>
            <Badge variant="outline" className="text-[11px] capitalize">{(entry.publication_type || '').replace(/_/g, ' ')}</Badge>
          </>
        )}
        {type === 'cobranca' && (
          <>
            <Badge variant="secondary" className="text-[11px]">{entry.installments_paid} parcela(s)</Badge>
            <Badge variant="outline" className="text-[11px]">{formatCurrency(entry.total_resolved_value || 0)}</Badge>
          </>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        <User className="inline h-3 w-3 mr-1" />{getUserName(entry.responsible_user_id)}
      </p>
    </motion.div>
  );

  // Stat card component
  const StatCard = ({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color: string }) => (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="overflow-hidden border-0 shadow-md">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
              <p className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</p>
              {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
            </div>
            <div className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-muted/50 ${color}`}>
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  // Progress card for goals
  const GoalCard = ({ label, current, target, premium, color, icon }: { label: string; current: number; target: number; premium: number; color: string; icon: React.ReactNode }) => {
    const pct = Math.min((current / target) * 100, 100);
    const reached = current >= target;
    return (
      <Card className="overflow-hidden border-0 shadow-md">
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-8 h-8 rounded-lg bg-muted/50 ${color}`}>{icon}</div>
              <p className="text-sm font-semibold">{label}</p>
            </div>
            {reached && <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[11px]">✅ Meta</Badge>}
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{current} / {target}</span>
              <span>{Math.round(pct)}%</span>
            </div>
            <Progress value={pct} className="h-2" />
          </div>
          <p className={`text-lg font-bold ${color}`}>{formatCurrency(premium)}</p>
          <div className="text-[11px] text-muted-foreground space-y-0.5">
            {label === 'Registro de Marca' && (
              <>
                <p>Antes da meta: R$ 50/marca</p>
                <p>Após meta (à vista): R$ 100 | Parcelado: R$ 50</p>
              </>
            )}
            {label === 'Publicação' && (
              <>
                <p>Até 49: R$ 50 cada</p>
                <p>50 ou mais: R$ 100 cada</p>
              </>
            )}
            {label === 'Cobrança' && (
              <>
                <p>R$199-397: R$10 | R$398-597: R$25</p>
                <p>R$598-999: R$50 | R$1000+: R$75-100</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Entry form dialog — stable JSX variable
  const entryFormDialog = (
    <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-card border-b px-5 py-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {editingEntry ? <Pencil className="h-4 w-4 text-primary" /> : <Plus className="h-4 w-4 text-primary" />}
              {editingEntry ? 'Editar Registro' : 'Novo Cadastro'}
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Tipo */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tipo *</Label>
            <Select value={formType} onValueChange={(v) => setFormType(v as typeof formType)} disabled={!!editingEntry}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="registro_marca">
                  <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Registro de Marca</span>
                </SelectItem>
                <SelectItem value="publicacao">
                  <span className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-purple-500" /> Publicação</span>
                </SelectItem>
                <SelectItem value="cobranca">
                  <span className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-orange-500" /> Cobrança / Devedores</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Nome do Cliente — Searchable */}
          <div className="relative space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nome do Cliente *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-10 h-11"
                value={formClientName}
                onChange={e => {
                  setFormClientName(e.target.value);
                  setClientSearchQuery(e.target.value);
                  setClientSearchOpen(true);
                }}
                onFocus={() => { if (formClientName.length >= 2) setClientSearchOpen(true); }}
                onBlur={() => setTimeout(() => setClientSearchOpen(false), 200)}
                placeholder="Pesquisar ou digitar nome..."
              />
            </div>
            {clientSearchOpen && clientSearchQuery.length >= 2 && filteredClients.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-popover border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {filteredClients.map(client => (
                  <button
                    key={client.id}
                    type="button"
                    className="w-full text-left px-3 py-2.5 hover:bg-accent/50 text-sm cursor-pointer transition-colors first:rounded-t-xl last:rounded-b-xl"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setFormClientName(client.full_name || client.email);
                      if (client.brand_names.length > 0 && !formBrandName) {
                        setFormBrandName(client.brand_names[0]);
                      }
                      setClientSearchOpen(false);
                      setClientSearchQuery('');
                    }}
                  >
                    <div className="font-medium">{client.full_name || 'Sem nome'}</div>
                    <div className="text-xs text-muted-foreground">{client.email}</div>
                    {client.brand_names.length > 0 && (
                      <div className="text-xs text-primary/70 mt-0.5">
                        <Tag className="inline h-3 w-3 mr-0.5" />
                        {client.brand_names.join(', ')}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ===== REGISTRO DE MARCA ===== */}
          {formType === 'registro_marca' && (
            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nome da Marca *</Label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-10 h-11" value={formBrandName} onChange={e => setFormBrandName(e.target.value)} placeholder="Nome da marca" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Qtd Marcas *</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-10 h-11" type="number" min={1} value={formBrandQty} onChange={e => setFormBrandQty(Number(e.target.value))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Data Pgto *</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-10 h-11" type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Forma de Pagamento *</Label>
                <Select value={formPaymentType} onValueChange={setFormPaymentType}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="avista">À Vista — R$ 699,99</SelectItem>
                    <SelectItem value="parcelado">Parcelado — R$ 1.194,00</SelectItem>
                    <SelectItem value="promocao">Promoção — Valor Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formPaymentType === 'promocao' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Valor Personalizado (R$) *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-10 h-11" type="number" step="0.01" value={formCustomValue} onChange={e => setFormCustomValue(e.target.value)} placeholder="0,00" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== PUBLICAÇÃO ===== */}
          {formType === 'publicacao' && (
            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nome da Marca *</Label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-10 h-11" value={formBrandName} onChange={e => setFormBrandName(e.target.value)} placeholder="Nome da marca" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Qtd Pub *</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-10 h-11" type="number" min={1} value={formPubQty} onChange={e => setFormPubQty(Number(e.target.value))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Data *</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-10 h-11" type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tipo de Publicação *</Label>
                <Select value={formPubType} onValueChange={setFormPubType}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exigencia_merito">Exigência de Mérito</SelectItem>
                    <SelectItem value="recurso">Recurso</SelectItem>
                    <SelectItem value="notificacao_extrajudicial">Notificação Extrajudicial</SelectItem>
                    <SelectItem value="oposicao">Oposição</SelectItem>
                    <SelectItem value="deferimento">Deferimento</SelectItem>
                    <SelectItem value="indeferimento">Indeferimento</SelectItem>
                    <SelectItem value="codigo_003">Código 003</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Forma de Pagamento *</Label>
                <Select value={formPubPaymentForm} onValueChange={setFormPubPaymentForm}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="avista">À Vista — 1 Salário Mínimo</SelectItem>
                    <SelectItem value="parcelado">Parcelado — 6x de R$ 398,00</SelectItem>
                    <SelectItem value="promocao">Promoção — Valor Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formPubPaymentForm === 'promocao' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Valor Personalizado (R$) *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-10 h-11" type="number" step="0.01" value={formCustomValue} onChange={e => setFormCustomValue(e.target.value)} placeholder="0,00" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== COBRANÇA ===== */}
          {formType === 'cobranca' && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Parcelas Pagas *</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-10 h-11" type="number" min={1} value={formInstallments} onChange={e => setFormInstallments(Number(e.target.value))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Data Pgto *</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-10 h-11" type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Valor Total Resolvido (R$) *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-10 h-11" type="number" step="0.01" value={formResolvedValue} onChange={e => setFormResolvedValue(e.target.value)} placeholder="0,00" />
                </div>
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Observações</Label>
            <Textarea
              value={formObs}
              onChange={e => setFormObs(e.target.value)}
              placeholder="Observações adicionais (opcional)"
              className="min-h-[80px] resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-3">
            <Button variant="outline" className="flex-1 h-11" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="flex-1 h-11" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Salvando...' : editingEntry ? 'Atualizar' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      <div className="space-y-5 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/20">
                <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Premiação</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">Metas e bônus da equipe</p>
              </div>
            </div>
            <Button onClick={() => { resetForm(); setDialogOpen(true); }} size="sm" className="gap-1.5 shadow-md">
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo Cadastro</span><span className="sm:hidden">Novo</span>
            </Button>
          </div>

          {/* Date period filter + month nav */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Hoje | Semana | Mês */}
              <div className="flex items-center bg-muted/50 rounded-xl p-1 gap-0.5">
                {(['hoje', 'semana', 'mes'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setDatePeriod(period)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      datePeriod === period
                        ? 'bg-card shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    {period === 'hoje' ? 'Hoje' : period === 'semana' ? 'Semana' : 'Mês'}
                  </button>
                ))}
              </div>

              {/* Month navigator */}
              <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-medium text-sm min-w-[120px] text-center capitalize flex items-center justify-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  {format(selectedMonth, "MMM 'De' yyyy", { locale: ptBR })}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {isMaster && (
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger className="w-[160px] sm:w-[180px] h-9 text-sm">
                  <Users className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {teamMembers.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full h-auto p-1 grid grid-cols-4 sm:grid-cols-5 gap-1 bg-muted/50">
            <TabsTrigger value="dashboard" className="gap-1 text-xs sm:text-sm px-2 py-2 data-[state=active]:shadow-md">
              <BarChart3 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Dashboard</span><span className="sm:hidden">Painel</span>
            </TabsTrigger>
            <TabsTrigger value="registro" className="gap-1 text-xs sm:text-sm px-2 py-2 data-[state=active]:shadow-md">
              <FileText className="h-3.5 w-3.5" /><span className="hidden sm:inline">Registro</span><span className="sm:hidden">Reg.</span>
            </TabsTrigger>
            <TabsTrigger value="publicacao" className="gap-1 text-xs sm:text-sm px-2 py-2 data-[state=active]:shadow-md">
              <Megaphone className="h-3.5 w-3.5" /><span className="hidden sm:inline">Publicação</span><span className="sm:hidden">Pub.</span>
            </TabsTrigger>
            <TabsTrigger value="cobranca" className="gap-1 text-xs sm:text-sm px-2 py-2 data-[state=active]:shadow-md">
              <CreditCard className="h-3.5 w-3.5" /><span className="hidden sm:inline">Cobrança</span><span className="sm:hidden">Cob.</span>
            </TabsTrigger>
            {isMaster && (
              <TabsTrigger value="equipe" className="gap-1 text-xs sm:text-sm px-2 py-2 data-[state=active]:shadow-md col-span-4 sm:col-span-1">
                <Users className="h-3.5 w-3.5" /> Equipe
              </TabsTrigger>
            )}
          </TabsList>

          {/* DASHBOARD TAB */}
          <TabsContent value="dashboard" className="space-y-5 mt-5">
            {/* Hero stat */}
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
              <Card className="overflow-hidden border-0 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-xl">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-emerald-100 text-xs font-medium uppercase tracking-wide flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" /> Premiação Total do Mês
                      </p>
                      <p className="text-3xl sm:text-4xl font-bold">{formatCurrency(totalPremium)}</p>
                      <p className="text-emerald-100 text-xs">{filteredEntries.length} registros neste período</p>
                    </div>
                    <div className="hidden sm:flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm">
                      <Trophy className="h-8 w-8 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Mini stats */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                icon={<FileText className="h-5 w-5" />}
                label="Marcas"
                value={String(totalBrands)}
                sub={totalBrands >= 30 ? '✅ Meta atingida' : `Faltam ${30 - totalBrands}`}
                color="text-primary"
              />
              <StatCard
                icon={<Megaphone className="h-5 w-5" />}
                label="Publicações"
                value={String(totalPubs)}
                sub={totalPubs >= 50 ? '✅ Meta atingida' : `Faltam ${50 - totalPubs}`}
                color="text-purple-500"
              />
              <StatCard
                icon={<CreditCard className="h-5 w-5" />}
                label="Cobranças"
                value={String(cobrancaEntries.length)}
                sub={formatCurrency(totalCobrancaPremium)}
                color="text-orange-500"
              />
            </div>

            {/* Goal breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <GoalCard label="Registro de Marca" current={totalBrands} target={30} premium={totalRegistroPremium} color="text-primary" icon={<FileText className="h-4 w-4" />} />
              <GoalCard label="Publicação" current={totalPubs} target={50} premium={totalPublicacaoPremium} color="text-purple-500" icon={<Megaphone className="h-4 w-4" />} />
              <GoalCard label="Cobrança" current={cobrancaEntries.length} target={20} premium={totalCobrancaPremium} color="text-orange-500" icon={<CreditCard className="h-4 w-4" />} />
            </div>

            {/* ── Bônus por Milestone (10 em 10) ── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/8 via-card to-orange-500/8 p-5 shadow-md"
            >
              {/* Decorative glow */}
              <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full blur-3xl bg-amber-500/10 pointer-events-none" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full blur-2xl bg-orange-500/8 pointer-events-none" />

              <div className="relative z-10 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25">
                      <Sparkles className="h-4.5 w-4.5 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">Bônus por Milestone — A cada 10 resolvidas</p>
                      <p className="text-xs text-muted-foreground">Acumulativo automático · independente de pagamento</p>
                    </div>
                  </div>
                  {totalMilestoneBonus > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30">
                      <Trophy className="h-3.5 w-3.5 text-amber-500" />
                      <span className="font-bold text-sm text-amber-600">{formatCurrency(totalMilestoneBonus)}</span>
                      <span className="text-xs text-amber-500/80">bônus total</span>
                    </div>
                  )}
                </div>

                {/* Two milestone cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Publicação milestone */}
                  <div className="relative rounded-xl border border-purple-500/20 bg-purple-500/6 p-4 space-y-3 overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl bg-purple-500/10 pointer-events-none" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/12 border border-purple-500/20">
                          <Megaphone className="h-4 w-4 text-purple-500" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">Publicações</p>
                          <p className="text-[11px] text-muted-foreground">A cada 10 → +R$ 100</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-purple-500">{formatCurrency(pubMilestone.bonus)}</p>
                        <p className="text-[10px] text-muted-foreground">{pubMilestone.milestones} milestone{pubMilestone.milestones !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    {/* Progress to next */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{totalPubs} publicações resolvidas</span>
                        <span>Próxima em {pubMilestone.nextAt}</span>
                      </div>
                      <div className="h-2 rounded-full bg-purple-500/12 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${((totalPubs % 10) / 10) * 100}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-400"
                        />
                      </div>
                      <p className="text-[10px] text-purple-500/80 font-medium">
                        {10 - (totalPubs % 10) === 10 ? '🎉 Milestone atingido! Próximo em 10 pub.' : `Faltam ${10 - (totalPubs % 10)} pub. para o próximo milestone`}
                      </p>
                    </div>
                    {pubMilestone.milestones > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {Array.from({ length: pubMilestone.milestones }).map((_, i) => (
                          <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/25 text-[10px] font-bold text-purple-600">
                            🏅 +R$100
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Cobrança milestone */}
                  <div className="relative rounded-xl border border-orange-500/20 bg-orange-500/6 p-4 space-y-3 overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl bg-orange-500/10 pointer-events-none" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-500/12 border border-orange-500/20">
                          <CreditCard className="h-4 w-4 text-orange-500" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">Cobranças</p>
                          <p className="text-[11px] text-muted-foreground">A cada 10 → +R$ 50</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-orange-500">{formatCurrency(cobMilestone.bonus)}</p>
                        <p className="text-[10px] text-muted-foreground">{cobMilestone.milestones} milestone{cobMilestone.milestones !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    {/* Progress to next */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{cobrancaEntries.length} cobranças resolvidas</span>
                        <span>Próxima em {cobMilestone.nextAt}</span>
                      </div>
                      <div className="h-2 rounded-full bg-orange-500/12 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${((cobrancaEntries.length % 10) / 10) * 100}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                        />
                      </div>
                      <p className="text-[10px] text-orange-500/80 font-medium">
                        {10 - (cobrancaEntries.length % 10) === 10 ? '🎉 Milestone atingido! Próximo em 10 cob.' : `Faltam ${10 - (cobrancaEntries.length % 10)} cob. para o próximo milestone`}
                      </p>
                    </div>
                    {cobMilestone.milestones > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {Array.from({ length: cobMilestone.milestones }).map((_, i) => (
                          <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/25 text-[10px] font-bold text-orange-600">
                            🏅 +R$50
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Regra explicativa */}
                <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/40 border border-border/50">
                  <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground">Regra automática:</span> Independente do tipo de pagamento (à vista, parcelado ou promoção),
                    cada grupo de 10 publicações resolvidas gera <span className="font-semibold text-purple-500">+R$ 100,00</span> e cada grupo de 10 cobranças resolvidas gera <span className="font-semibold text-orange-500">+R$ 50,00</span> de bônus extra.
                    O valor é somado automaticamente à premiação total.
                  </p>
                </div>
              </div>
            </motion.div>
          </TabsContent>

          {/* REGISTRO DE MARCA TAB */}
          <TabsContent value="registro" className="space-y-4 mt-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-semibold">Registro de Marca</h2>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{totalBrands} marcas</Badge>
                <Badge variant={totalBrands >= 30 ? 'default' : 'secondary'} className="text-xs">
                  {totalBrands >= 30 ? '✅ Meta' : `${totalBrands}/30`}
                </Badge>
              </div>
            </div>
            {/* Mobile: cards, Desktop: hidden (table below) */}
            <div className="space-y-3 md:hidden">
              {registroEntries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Nenhum registro neste período</p>
              ) : registroEntries.map(e => <EntryCard key={e.id} entry={e} type="registro_marca" />)}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block rounded-xl border overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">Data</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Cliente</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Marca</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Qtd</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Pagamento</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Responsável</th>
                    <th className="p-3 w-[80px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {registroEntries.length === 0 ? (
                    <tr><td colSpan={7} className="text-center text-muted-foreground py-8">Nenhum registro</td></tr>
                  ) : registroEntries.map(entry => (
                    <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="p-3">{format(new Date(entry.entry_date), 'dd/MM/yyyy')}</td>
                      <td className="p-3 font-medium">{entry.client_name}</td>
                      <td className="p-3">{entry.brand_name || '-'}</td>
                      <td className="p-3">{entry.brand_quantity}</td>
                      <td className="p-3">
                        <Badge variant={entry.payment_type === 'avista' ? 'default' : 'secondary'} className="text-xs">
                          {entry.payment_type === 'avista' ? 'À Vista' : entry.payment_type === 'parcelado' ? 'Parcelado' : 'Promoção'}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{getUserName(entry.responsible_user_id)}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(entry)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('Excluir?')) deleteMutation.mutate(entry.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* PUBLICAÇÃO TAB */}
          <TabsContent value="publicacao" className="space-y-4 mt-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-semibold">Publicações</h2>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{totalPubs} pub.</Badge>
                <Badge variant={totalPubs >= 50 ? 'default' : 'secondary'} className="text-xs">
                  {totalPubs >= 50 ? '✅ Meta' : `${totalPubs}/50`}
                </Badge>
              </div>
            </div>
            <div className="space-y-3 md:hidden">
              {publicacaoEntries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Nenhum registro neste período</p>
              ) : publicacaoEntries.map(e => <EntryCard key={e.id} entry={e} type="publicacao" />)}
            </div>
            <div className="hidden md:block rounded-xl border overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">Data</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Cliente</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Marca</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Qtd</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Responsável</th>
                    <th className="p-3 w-[80px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {publicacaoEntries.length === 0 ? (
                    <tr><td colSpan={7} className="text-center text-muted-foreground py-8">Nenhum registro</td></tr>
                  ) : publicacaoEntries.map(entry => (
                    <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="p-3">{format(new Date(entry.entry_date), 'dd/MM/yyyy')}</td>
                      <td className="p-3 font-medium">{entry.client_name}</td>
                      <td className="p-3">{entry.brand_name || '-'}</td>
                      <td className="p-3 capitalize">{(entry.publication_type || '').replace(/_/g, ' ')}</td>
                      <td className="p-3">{entry.pub_quantity}</td>
                      <td className="p-3 text-xs text-muted-foreground">{getUserName(entry.responsible_user_id)}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(entry)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('Excluir?')) deleteMutation.mutate(entry.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* COBRANÇA TAB */}
          <TabsContent value="cobranca" className="space-y-4 mt-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-semibold">Cobrança / Devedores</h2>
              <Badge variant="outline" className="text-xs">{cobrancaEntries.length} registros</Badge>
            </div>
            <div className="space-y-3 md:hidden">
              {cobrancaEntries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Nenhum registro neste período</p>
              ) : cobrancaEntries.map(e => <EntryCard key={e.id} entry={e} type="cobranca" />)}
            </div>
            <div className="hidden md:block rounded-xl border overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">Data</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Cliente</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Parcelas</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Valor</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Responsável</th>
                    <th className="p-3 w-[80px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {cobrancaEntries.length === 0 ? (
                    <tr><td colSpan={6} className="text-center text-muted-foreground py-8">Nenhum registro</td></tr>
                  ) : cobrancaEntries.map(entry => (
                    <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="p-3">{format(new Date(entry.entry_date), 'dd/MM/yyyy')}</td>
                      <td className="p-3 font-medium">{entry.client_name}</td>
                      <td className="p-3">{entry.installments_paid}</td>
                      <td className="p-3">{formatCurrency(entry.total_resolved_value || 0)}</td>
                      <td className="p-3 text-xs text-muted-foreground">{getUserName(entry.responsible_user_id)}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(entry)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('Excluir?')) deleteMutation.mutate(entry.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* EQUIPE TAB */}
          <TabsContent value="equipe" className="space-y-5 mt-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-semibold">Desempenho da Equipe</h2>
              <Badge variant="outline" className="text-xs">{teamMembers.length} colaboradores</Badge>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={<DollarSign className="h-5 w-5" />} label="Prêmio Total" value={formatCurrency(totalPremium)} color="text-emerald-600" />
              <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Produção" value={`${totalBrands + totalPubs + cobrancaEntries.length}`} sub="registros" color="text-primary" />
              <StatCard icon={<Users className="h-5 w-5" />} label="Ativos" value={String(teamMembers.length)} color="text-muted-foreground" />
            </div>

            {/* Team cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {teamMembers.map(member => {
                const stats = perUserStats.get(member.id);
                if (!stats) return null;
                return (
                  <motion.div key={member.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <Card
                      className="cursor-pointer hover:shadow-lg transition-all duration-200 border-0 shadow-md hover:-translate-y-0.5"
                      onClick={() => { setFilterUser(member.id); setActiveTab('dashboard'); }}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
                            <Award className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{member.full_name || member.email}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{member.email}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-lg bg-muted/30 p-2">
                            <p className="text-base font-bold text-primary">{stats.registro}</p>
                            <p className="text-[10px] text-muted-foreground">Marcas</p>
                          </div>
                          <div className="rounded-lg bg-muted/30 p-2">
                            <p className="text-base font-bold text-purple-500">{stats.publicacao}</p>
                            <p className="text-[10px] text-muted-foreground">Pub.</p>
                          </div>
                          <div className="rounded-lg bg-muted/30 p-2">
                            <p className="text-base font-bold text-orange-500">{stats.cobranca}</p>
                            <p className="text-[10px] text-muted-foreground">Cob.</p>
                          </div>
                        </div>
                        <div className="pt-2 border-t space-y-1.5">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-emerald-600">{formatCurrency(stats.premium)}</p>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                          {(stats.pubMilestoneBonus > 0 || stats.cobMilestoneBonus > 0) && (
                            <div className="flex flex-wrap gap-1">
                              {stats.pubMilestoneBonus > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-purple-500/12 border border-purple-500/20 text-[10px] font-bold text-purple-600">
                                  🏅 Pub +{formatCurrency(stats.pubMilestoneBonus)}
                                </span>
                              )}
                              {stats.cobMilestoneBonus > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-500/12 border border-orange-500/20 text-[10px] font-bold text-orange-600">
                                  🏅 Cob +{formatCurrency(stats.cobMilestoneBonus)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {entryFormDialog}
    </>
  );
}
