import { useEffect, useState, useMemo, lazy, Suspense, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Search, LayoutGrid, List, RefreshCw, Users, Filter, X, Upload, Briefcase, Scale, Star, UserCheck, UserPlus, Mail, Settings2 } from 'lucide-react';
import { useCanViewFinancialValues } from '@/hooks/useCanViewFinancialValues';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

import { ClientKanbanBoard, COMMERCIAL_PIPELINE_STAGES, PIPELINE_STAGES, type ClientWithProcess, type KanbanFilters, type FunnelType } from '@/components/admin/clients/ClientKanbanBoard';
import { AdminKanbanConfig, type AdminKanbanStage } from '@/components/admin/clients/AdminKanbanConfig';
import { ClientListView } from '@/components/admin/clients/ClientListView';
import { ClientImportExportDialog } from '@/components/admin/clients/ClientImportExportDialog';
import { ClientRemarketingPanel } from '@/components/admin/clients/ClientRemarketingPanel';
import { DuplicateClientsDialog } from '@/components/admin/clients/DuplicateClientsDialog';
import { CreateClientDialog } from '@/components/admin/clients/CreateClientDialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DatePeriodFilter, type DateFilterType } from '@/components/admin/clients/DatePeriodFilter';
import { startOfDay, startOfWeek, startOfMonth, endOfMonth, endOfDay, isWithinInterval, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Lazy load the heavy ClientDetailSheet (123KB) — only loaded when a client is clicked
const ClientDetailSheet = lazy(() => import('@/components/admin/clients/ClientDetailSheet').then(m => ({ default: m.ClientDetailSheet })));

type ViewMode = 'kanban' | 'list';

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'Alta', color: 'bg-red-500' },
  { value: 'medium', label: 'Média', color: 'bg-yellow-500' },
  { value: 'low', label: 'Baixa', color: 'bg-green-500' },
];

const ORIGIN_OPTIONS = [
  { value: 'site', label: 'Site', color: 'border-blue-500 text-blue-600' },
  { value: 'whatsapp', label: 'WhatsApp', color: 'border-green-500 text-green-600' },
];

export default function AdminClientes() {
  const [clients, setClients] = useState<ClientWithProcess[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [selectedClient, setSelectedClient] = useState<ClientWithProcess | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [filters, setFilters] = useState<KanbanFilters>({ priority: [], origin: [] });
  const [filterOpen, setFilterOpen] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [viewOwnOnly, setViewOwnOnly] = useState(false);
  const [adminUsers, setAdminUsers] = useState<{ id: string; full_name: string | null; email: string }[]>([]);
  const [funnelType, setFunnelType] = useState<FunnelType>('comercial');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showRemarketing, setShowRemarketing] = useState(false);
  const [kanbanConfigOpen, setKanbanConfigOpen] = useState(false);
  const [kanbanStages, setKanbanStages] = useState<AdminKanbanStage[]>([]);
  const [stagesVersion, setStagesVersion] = useState(0);
  const { canViewFinancialValues } = useCanViewFinancialValues();

  // Debounce search input — avoids re-rendering 2300+ cards on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load kanban stages for the current funnel type
  useEffect(() => {
    const key = funnelType === 'comercial' ? 'admin_kanban_comercial_stages' : 'admin_kanban_juridico_stages';
    supabase
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value && typeof data.value === 'object' && 'stages' in (data.value as any)) {
          setKanbanStages((data.value as any).stages);
        } else {
          setKanbanStages(funnelType === 'comercial' ? COMMERCIAL_PIPELINE_STAGES : PIPELINE_STAGES);
        }
      });
  }, [funnelType, stagesVersion]);

  // Wait for auth session before fetching — fixes intermittent "0 clients" bug
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // Ensure we have a valid session first
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      if (session) {
        fetchCurrentUserAndPermissions();
        fetchClients();
        fetchAdminUsers();
      } else {
        // Session not ready yet — wait for it
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
          if (sess && mounted) {
            fetchCurrentUserAndPermissions();
            fetchClients();
            fetchAdminUsers();
            subscription.unsubscribe();
          }
        });
      }
    };

    init();

    // Realtime subscription — debounced to avoid cascading refetches
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = () => {
      if (!mounted) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (mounted) fetchClients();
      }, 800);
    };

    const realtimeSub = supabase
      .channel('clients-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'brand_processes' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, debouncedFetch)
      .subscribe();

    return () => {
      mounted = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      realtimeSub.unsubscribe();
    };
  }, []);

  const fetchCurrentUserAndPermissions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      // Check if user has clients_own_only permission
      const { data: perms } = await supabase
        .from('admin_permissions')
        .select('*')
        .eq('user_id', user.id)
        .eq('permission_key', 'clients_own_only');
      
      if (perms && perms.length > 0 && perms[0].can_view) {
        setViewOwnOnly(true);
      }
    }
  };

  const fetchAdminUsers = async () => {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');
    
    if (roles && roles.length > 0) {
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      
      if (profiles) {
        setAdminUsers(profiles);
      }
    }
  };

  // Helper to fetch all rows from a table using pagination (bypasses 1000-row Supabase limit)
  const fetchAllRows = async <T,>(
    table: string,
    select: string,
    extra?: (q: any) => any
  ): Promise<T[]> => {
    const PAGE_SIZE = 1000;
    const allData: T[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase.from(table as any).select(select).range(offset, offset + PAGE_SIZE - 1);
      if (extra) query = extra(query);
      const { data, error } = await query;
      if (error) throw error;
      if (data && data.length > 0) {
        allData.push(...(data as T[]));
        offset += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }
    return allData;
  };

  const fetchClients = useCallback(async (retryCount = 0) => {
    setLoading(true);
    try {
      // Ensure session is active before querying
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (retryCount < 3) {
          setTimeout(() => fetchClients(retryCount + 1), 600);
        } else {
          setLoading(false);
        }
        return;
      }

      // ── Parallelizar as 3 queries principais — SELECT only needed columns ──
      const [profiles, processes, contracts] = await Promise.all([
        fetchAllRows<any>(
          'profiles',
          'id, full_name, email, phone, cpf_cnpj, company_name, priority, origin, contract_value, created_at, last_contact, client_funnel_type, created_by, assigned_to',
          (q) => q.order('created_at', { ascending: false })
        ),
        fetchAllRows<any>('brand_processes', 'id, user_id, brand_name, business_area, pipeline_stage, status, process_number'),
        fetchAllRows<any>(
          'contracts',
          'user_id, contract_value, payment_method',
          (q) => q.order('created_at', { ascending: false })
        ),
      ]);

      // Retry if empty result on first attempt (can happen during auth hydration)
      if (profiles.length === 0 && retryCount < 2) {
        setTimeout(() => fetchClients(retryCount + 1), 800);
        setLoading(false);
        return;
      }

      // Resolve admin names from already-fetched profiles (no extra query needed)
      const adminNameMap: Record<string, string> = {};
      for (const p of profiles) {
        adminNameMap[p.id] = p.full_name || p.email;
      }

      // Build contract value map (latest contract per user)
      const contractValueMap: Record<string, { value: number; method: string | null }> = {};
      for (const c of contracts || []) {
        if (c.user_id && !contractValueMap[c.user_id] && c.contract_value) {
          contractValueMap[c.user_id] = { value: Number(c.contract_value), method: c.payment_method };
        }
      }

      // Combine profiles with their processes
      const clientsWithProcesses: ClientWithProcess[] = [];

      for (const profile of profiles || []) {
        const userProcesses = (processes || []).filter(p => p.user_id === profile.id);
        const createdByName = (profile as any).created_by ? adminNameMap[(profile as any).created_by] || null : null;
        const assignedToName = (profile as any).assigned_to ? adminNameMap[(profile as any).assigned_to] || null : null;
        // Use contract value from contracts table if available, otherwise from profile
        const contractVal = contractValueMap[profile.id]?.value || profile.contract_value;
        
        if (userProcesses.length === 0) {
          clientsWithProcesses.push({
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            phone: profile.phone,
            company_name: profile.company_name,
            priority: profile.priority,
            origin: profile.origin,
            contract_value: contractVal,
            process_id: null,
            brand_name: null,
            business_area: null,
            pipeline_stage: (profile as any).client_funnel_type === 'comercial' ? 'assinou_contrato' : 'protocolado',
            process_status: null,
            created_at: profile.created_at || undefined,
            cpf_cnpj: profile.cpf_cnpj || undefined,
            client_funnel_type: (profile as any).client_funnel_type || 'juridico',
            created_by: (profile as any).created_by || null,
            assigned_to: (profile as any).assigned_to || null,
            created_by_name: createdByName,
            assigned_to_name: assignedToName,
          });
        } else {
          // Create one card per brand/process
          for (const proc of userProcesses) {
            const brands = userProcesses.map(p => ({
              id: p.id,
              brand_name: p.brand_name,
              pipeline_stage: p.pipeline_stage || ((profile as any).client_funnel_type === 'comercial' ? 'assinou_contrato' : 'protocolado'),
              process_number: p.process_number || undefined,
            }));

            clientsWithProcesses.push({
              id: profile.id,
              full_name: profile.full_name,
              email: profile.email,
              phone: profile.phone,
              company_name: profile.company_name,
              priority: profile.priority,
              origin: profile.origin,
              contract_value: contractVal,
              process_id: proc.id,
              brand_name: proc.brand_name,
              business_area: proc.business_area || null,
              pipeline_stage: proc.pipeline_stage || ((profile as any).client_funnel_type === 'comercial' ? 'assinou_contrato' : 'protocolado'),
              process_status: proc.status,
              created_at: profile.created_at || undefined,
              cpf_cnpj: profile.cpf_cnpj || undefined,
              process_number: proc.process_number || undefined,
              client_funnel_type: (profile as any).client_funnel_type || 'juridico',
              created_by: (profile as any).created_by || null,
              assigned_to: (profile as any).assigned_to || null,
              created_by_name: createdByName,
              assigned_to_name: assignedToName,
              brands: brands,
            });
          }
        }
      }

      setClients(clientsWithProcesses);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  }, []);

  // Wrapper without args — safe to pass directly to onClick handlers and callbacks
  const refreshClients = () => fetchClients(0);

  const handleClientClick = (client: ClientWithProcess) => {
    setSelectedClient(client);
    setDetailOpen(true);
  };

  // Consolidated filter: funnel + own + date + search — single pass over clients
  const filteredClients = useMemo(() => {
    let result = clients;

    // Funnel filter
    result = result.filter(c => (c.client_funnel_type || 'juridico') === funnelType);

    // Own filter
    if (viewOwnOnly && currentUserId) {
      result = result.filter(c => c.created_by === currentUserId || c.assigned_to === currentUserId);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      result = result.filter(client => {
        if (!client.created_at) return true;
        const createdAt = parseISO(client.created_at);
        switch (dateFilter) {
          case 'today':
            return isWithinInterval(createdAt, { start: startOfDay(now), end: endOfDay(now) });
          case 'week':
            return isWithinInterval(createdAt, { start: startOfWeek(now, { weekStartsOn: 1 }), end: now });
          case 'month':
            return isWithinInterval(createdAt, { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) });
          default:
            return true;
        }
      });
    }

    // Search filter (uses debounced value)
    if (debouncedSearch.trim()) {
      const s = debouncedSearch.toLowerCase();
      result = result.filter(client =>
        client.full_name?.toLowerCase().includes(s) ||
        client.email.toLowerCase().includes(s) ||
        client.company_name?.toLowerCase().includes(s) ||
        client.brand_name?.toLowerCase().includes(s) ||
        client.brands?.some(b => b.brand_name.toLowerCase().includes(s)) ||
        client.phone?.includes(debouncedSearch) ||
        client.cpf_cnpj?.includes(debouncedSearch)
      );
    }

    return result;
  }, [clients, funnelType, viewOwnOnly, currentUserId, dateFilter, selectedMonth, debouncedSearch]);

  // ── Derived stats ────────────────────────────────────────────────
  const stats = useMemo(() => {
    const base = filteredClients;
    const uniqueIds = new Set(base.map(c => c.id));
    const total = uniqueIds.size;
    const high = [...uniqueIds].filter(id => base.find(c => c.id === id)?.priority === 'high').length;
    const withProcess = [...uniqueIds].filter(id => base.find(c => c.id === id)?.process_id).length;
    // new this month
    const now = new Date();
    const newThisMonth = [...uniqueIds].filter(id => {
      const ca = base.find(c => c.id === id)?.created_at;
      if (!ca) return false;
      const d = parseISO(ca);
      return isWithinInterval(d, { start: startOfMonth(now), end: endOfMonth(now) });
    }).length;
    return { total, high, withProcess, newThisMonth };
  }, [filteredClients]);

  return (
    <>
      <div className="space-y-5">
        {/* ── HERO HEADER ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-background to-violet-500/5 border border-border/60 p-6"
        >
          <div className="pointer-events-none absolute -top-10 -right-10 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-8 left-6 h-28 w-28 rounded-full bg-violet-500/10 blur-2xl" />

          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg',
                  funnelType === 'comercial' ? 'bg-primary/20 shadow-primary/20' : 'bg-violet-500/20 shadow-violet-500/20'
                )}
              >
                {funnelType === 'comercial'
                  ? <Briefcase className="h-6 w-6 text-primary" />
                  : <Scale className="h-6 w-6 text-violet-500" />
                }
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {funnelType === 'comercial' ? 'Clientes Comercial' : 'Clientes Jurídico'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {funnelType === 'comercial'
                    ? 'Pipeline de vendas: assinatura, pagamento e taxa'
                    : 'Pipeline jurídico: processos INPI'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" className="gap-1.5 border-border/60 h-9" onClick={refreshClients}>
                <RefreshCw className="h-3.5 w-3.5" /> Atualizar
              </Button>
              <DuplicateClientsDialog
                onMergeComplete={refreshClients}
                trigger={
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 border-border/60">
                    <Users className="h-3.5 w-3.5" /> Duplicados
                  </Button>
                }
              />
              <Button variant="outline" size="sm" className="h-9 gap-1.5 border-border/60" onClick={() => setImportExportOpen(true)}>
                <Upload className="h-3.5 w-3.5" /> Importar
              </Button>
              <CreateClientDialog onClientCreated={refreshClients} />
            </div>
          </div>
        </motion.div>

        {/* ── STAT CARDS ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: 'Total Clientes',    value: stats.total,        icon: Users,      accent: 'from-primary/20 to-primary/5',          border: 'border-primary/20',        ring: 'bg-primary/15',        color: 'text-primary'       },
            { title: 'Alta Prioridade',   value: stats.high,         icon: Star,       accent: 'from-red-500/20 to-red-500/5',           border: 'border-red-500/20',        ring: 'bg-red-500/15',        color: 'text-red-500'       },
            { title: 'Com Processo',      value: stats.withProcess,  icon: UserCheck,  accent: 'from-emerald-500/20 to-emerald-500/5',   border: 'border-emerald-500/20',    ring: 'bg-emerald-500/15',    color: 'text-emerald-500'   },
            { title: 'Novos no Mês',      value: stats.newThisMonth, icon: UserPlus,   accent: 'from-violet-500/20 to-violet-500/5',     border: 'border-violet-500/20',     ring: 'bg-violet-500/15',     color: 'text-violet-500'    },
          ].map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
              <div className={cn('relative overflow-hidden rounded-2xl border transition-all hover:shadow-lg hover:shadow-black/10 hover:-translate-y-0.5 bg-background', s.border)}>
                <div className={cn('absolute inset-0 bg-gradient-to-br opacity-60', s.accent)} />
                <div className="relative p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', s.ring)}>
                      <s.icon className={cn('h-5 w-5', s.color)} />
                    </div>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{s.title}</p>
                  <p className={cn('text-3xl font-bold', s.color)}>{s.value}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── CONTROLS ─────────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Controls Row: Funnel Toggle + Search + Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Funnel Toggle */}
            <ToggleGroup 
              type="single" 
              value={funnelType} 
              onValueChange={(v) => v && setFunnelType(v as FunnelType)}
              className="border rounded-lg p-0.5 bg-muted/40 shrink-0"
            >
              <ToggleGroupItem value="comercial" aria-label="Funil Comercial" className="text-xs px-3 h-8 data-[state=on]:bg-background data-[state=on]:shadow-sm">
                <Briefcase className="h-3.5 w-3.5 mr-1.5" />
                Comercial
              </ToggleGroupItem>
              <ToggleGroupItem value="juridico" aria-label="Funil Jurídico" className="text-xs px-3 h-8 data-[state=on]:bg-background data-[state=on]:shadow-sm">
                <Scale className="h-3.5 w-3.5 mr-1.5" />
                Jurídico
              </ToggleGroupItem>
            </ToggleGroup>

            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email, CPF/CNPJ, marca ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {/* Email Automático button */}
            <Button
              variant={showRemarketing ? 'default' : 'outline'}
              size="sm"
              className="h-9 gap-1.5 shrink-0"
              onClick={() => setShowRemarketing(!showRemarketing)}
            >
              <Mail className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Email Automático</span>
            </Button>

            {/* Toolbar Icons */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={refreshClients} title="Atualizar">
                <RefreshCw className="h-4 w-4" />
              </Button>
              
              <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className={`h-9 w-9 ${(filters.priority.length > 0 || filters.origin.length > 0) ? "text-primary bg-primary/10" : ""}`}
                    title="Filtros"
                  >
                    <Filter className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72" align="end">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm">Filtros</h4>
                      {(filters.priority.length > 0 || filters.origin.length > 0) && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setFilters({ priority: [], origin: [] })}
                        >
                          Limpar
                        </Button>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Prioridade</Label>
                      <div className="space-y-1.5">
                        {PRIORITY_OPTIONS.map((option) => (
                          <div key={option.value} className="flex items-center gap-2">
                            <Checkbox
                              id={`priority-${option.value}`}
                              checked={filters.priority.includes(option.value)}
                              onCheckedChange={(checked) => {
                                setFilters(prev => ({
                                  ...prev,
                                  priority: checked
                                    ? [...prev.priority, option.value]
                                    : prev.priority.filter(p => p !== option.value)
                                }));
                              }}
                            />
                            <Label 
                              htmlFor={`priority-${option.value}`}
                              className="flex items-center gap-2 cursor-pointer text-sm"
                            >
                              <span className={`w-2 h-2 rounded-full ${option.color}`} />
                              {option.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Origem</Label>
                      <div className="space-y-1.5">
                        {ORIGIN_OPTIONS.map((option) => (
                          <div key={option.value} className="flex items-center gap-2">
                            <Checkbox
                              id={`origin-${option.value}`}
                              checked={filters.origin.includes(option.value)}
                              onCheckedChange={(checked) => {
                                setFilters(prev => ({
                                  ...prev,
                                  origin: checked
                                    ? [...prev.origin, option.value]
                                    : prev.origin.filter(o => o !== option.value)
                                }));
                              }}
                            />
                            <Label 
                              htmlFor={`origin-${option.value}`}
                              className="cursor-pointer text-sm"
                            >
                              {option.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* View Toggle */}
              <div className="border-l pl-1.5 ml-0.5">
                <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as ViewMode)} className="gap-0">
                  <ToggleGroupItem value="kanban" aria-label="Kanban" className="h-9 w-9 p-0">
                    <LayoutGrid className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="list" aria-label="Lista" className="h-9 w-9 p-0">
                    <List className="h-4 w-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
          </div>

          {/* Active Filters + Date Period + Kanban Config Gear */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <DatePeriodFilter
                dateFilter={dateFilter}
                onDateFilterChange={setDateFilter}
                selectedMonth={selectedMonth}
                onMonthChange={setSelectedMonth}
              />
              {viewMode === 'kanban' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5"
                  onClick={() => setKanbanConfigOpen(true)}
                  title="Configurar etapas do Kanban"
                >
                  <Settings2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Configurar Etapas</span>
                </Button>
              )}
            </div>
            
            {(dateFilter !== 'all' || filters.priority.length > 0 || filters.origin.length > 0) && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {dateFilter !== 'all' && (
                  <Badge 
                    variant="secondary"
                    className="cursor-pointer text-xs h-6"
                    onClick={() => setDateFilter('all')}
                  >
                    {dateFilter === 'today' ? 'Hoje' : 
                     dateFilter === 'week' ? 'Semana' : 
                     format(selectedMonth, "MMM/yyyy", { locale: ptBR })}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                )}
                {filters.priority.map(p => (
                  <Badge 
                    key={p} 
                    variant="secondary"
                    className="cursor-pointer text-xs h-6"
                    onClick={() => setFilters(prev => ({ 
                      ...prev, 
                      priority: prev.priority.filter(x => x !== p) 
                    }))}
                  >
                    {PRIORITY_OPTIONS.find(o => o.value === p)?.label}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
                {filters.origin.map(o => (
                  <Badge 
                    key={o} 
                    variant="secondary"
                    className="cursor-pointer text-xs h-6"
                    onClick={() => setFilters(prev => ({ 
                      ...prev, 
                      origin: prev.origin.filter(x => x !== o) 
                    }))}
                  >
                    {ORIGIN_OPTIONS.find(opt => opt.value === o)?.label}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Remarketing Panel */}
        {showRemarketing && (
          <ClientRemarketingPanel
            clients={filteredClients.map(c => ({
              id: c.id,
              full_name: c.full_name,
              email: c.email,
              phone: c.phone || null,
              company_name: c.company_name || null,
              priority: c.priority || null,
              pipeline_stage: c.pipeline_stage || null,
            }))}
            onRefresh={refreshClients}
          />
        )}

        {/* Content */}
        {viewMode === 'kanban' ? (
          <ClientKanbanBoard
            clients={filteredClients}
            onClientClick={handleClientClick}
            onRefresh={refreshClients}
            filters={filters}
            funnelType={funnelType}
            adminUsers={adminUsers}
            canAssign={!viewOwnOnly}
            canViewFinancialValues={canViewFinancialValues}
            onConfigOpen={() => setKanbanConfigOpen(true)}
            stagesVersion={stagesVersion}
          />
        ) : (
          <ClientListView
            clients={filteredClients}
            loading={loading}
            onClientClick={handleClientClick}
          />
        )}

        {/* Client Detail Sheet - lazy loaded */}
        {detailOpen && selectedClient && (
          <Suspense fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-card rounded-xl p-6 shadow-lg flex items-center gap-3">
                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Carregando ficheiro...</span>
              </div>
            </div>
          }>
            <ClientDetailSheet
              client={selectedClient}
              open={detailOpen}
              onOpenChange={setDetailOpen}
              onUpdate={refreshClients}
              focusProcessId={selectedClient?.process_id || undefined}
            />
          </Suspense>
        )}

        {/* Import/Export Dialog */}
        <ClientImportExportDialog
          open={importExportOpen}
          onOpenChange={setImportExportOpen}
          clients={clients.map(c => ({
            id: c.id,
            full_name: c.full_name,
            email: c.email,
            phone: c.phone,
            company_name: c.company_name,
            origin: c.origin,
            priority: c.priority,
            contract_value: c.contract_value,
          }))}
          onImportComplete={refreshClients}
        />

        {/* Admin Kanban Config Dialog */}
        <AdminKanbanConfig
          open={kanbanConfigOpen}
          onOpenChange={setKanbanConfigOpen}
          stages={kanbanStages}
          funnelType={funnelType}
          onSaved={() => setStagesVersion(v => v + 1)}
        />
      </div>
    </>
  );
}
