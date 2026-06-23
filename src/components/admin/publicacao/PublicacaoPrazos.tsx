import { useEffect, useMemo, useState } from 'react';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, Clock, AlertTriangle, Archive, Search, Eye, Bell, ChevronDown, CalendarCheck, Wallet, UserPlus, X, Ban, Pencil } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { STATUS_CONFIG } from './types';
import { NotificarClienteDialog } from './NotificarClienteDialog';
import { PropostaDesistiuDialog } from './PropostaDesistiuDialog';
import { Sparkles } from 'lucide-react';
import { VincularClienteDialog } from './VincularClienteDialog';
import { EditarMarcaDialog } from './EditarMarcaDialog';
import { ResponsavelChip } from '@/components/admin/shared/ResponsavelChip';
import { useResponsaveis, atribuirResponsavel, useAdminList } from '@/hooks/useResponsaveis';
import { calcDeadlineFromStatus } from '@/components/admin/PublicacaoTab';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, User } from 'lucide-react';

// Admin UUIDs para atribuição automática por bucket de prazo
const AUTO_OWNERS = {
  no_prazo: { id: 'ad9db755-9d8f-4b2c-806b-c9c7245b79bc', nome: 'caroline martins dos santos' },
  '30dias': { id: 'e01073ec-5424-4aab-bfb0-bd8b40396349', nome: 'João Pedro' },
  ultima_semana: { id: '1569b08c-e266-47d0-a384-4b7f29c64dc1', nome: 'Camila Ferreira' },
} as const;

const STATUS_BLOQUEIA_REATRIBUICAO = new Set(['cumprido', 'aguardando_pagamento']);

type Bucket = 'no_prazo' | '30dias' | 'ultima_semana' | 'vencidos' | 'cumpridos' | 'desistiu';

interface PublicacaoPrazosProps {
  publicacoes: any[];
  processMap: Map<string, any>;
  clientMap: Map<string, any>;
  onOpenDetail?: (pubId: string) => void;
  initialBucket?: Bucket;
  clients?: any[];
}

function computeDeadline(pub: any): string | null {
  if (pub.proximo_prazo_critico) return pub.proximo_prazo_critico;
  if (pub.data_publicacao_rpi) {
    return format(addDays(parseISO(pub.data_publicacao_rpi), 60), 'yyyy-MM-dd');
  }
  return null;
}

function bucketOf(days: number | null): Bucket | null {
  if (days === null) return null;
  if (days < 0) return 'vencidos';
  if (days <= 7) return 'ultima_semana';
  if (days <= 30) return '30dias';
  return 'no_prazo';
}

const BUCKETS: { id: Bucket; label: string; color: string; ring: string }[] = [
  { id: 'no_prazo', label: 'No Prazo', color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40', ring: 'ring-emerald-500' },
  { id: '30dias', label: '30 Dias para Vencer', color: 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40', ring: 'ring-amber-500' },
  { id: 'ultima_semana', label: 'Última Semana', color: 'text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/40', ring: 'ring-orange-500' },
  { id: 'vencidos', label: 'Vencidos', color: 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/40', ring: 'ring-red-500' },
  { id: 'cumpridos', label: 'Cumpridos', color: 'text-teal-700 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/40', ring: 'ring-teal-500' },
  { id: 'desistiu', label: 'Desistiu', color: 'text-zinc-700 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-800/60', ring: 'ring-zinc-500' },
];

type AndamentoStatus = 'cumprido' | 'contato_agendado' | 'aguardando_pagamento' | 'desistiu' | null;

const ANDAMENTO_CFG: Record<Exclude<AndamentoStatus, null>, { label: string; trigger: string; icon: any }> = {
  cumprido: {
    label: 'Cumprido',
    trigger: 'border-emerald-500/50 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50',
    icon: CheckCircle2,
  },
  contato_agendado: {
    label: 'Contato Agendado',
    trigger: 'border-sky-500/50 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300 dark:hover:bg-sky-900/50',
    icon: CalendarCheck,
  },
  aguardando_pagamento: {
    label: 'Aguardando Pagamento',
    trigger: 'border-amber-500/50 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50',
    icon: Wallet,
  },
  desistiu: {
    label: 'Desistiu',
    trigger: 'border-zinc-500/50 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-300 dark:hover:bg-zinc-800',
    icon: Ban,
  },
};

export function PublicacaoPrazos({ publicacoes, processMap, clientMap, onOpenDetail, initialBucket, clients = [] }: PublicacaoPrazosProps) {
  const [active, setActive] = useState<Bucket>(initialBucket || 'no_prazo');
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const [notifyPub, setNotifyPub] = useState<any | null>(null);
  const [propostaPub, setPropostaPub] = useState<any | null>(null);
  const [schedules, setSchedules] = useState<Record<string, any>>({});
  const [linkDialogPub, setLinkDialogPub] = useState<any | null>(null);
  const [editMarcaPub, setEditMarcaPub] = useState<any | null>(null);
  const [editPrazoPubId, setEditPrazoPubId] = useState<string | null>(null);
  const [editRpiDate, setEditRpiDate] = useState<string>('');
  const [editDeadline, setEditDeadline] = useState<string>('');
  const [savingPrazo, setSavingPrazo] = useState(false);
  const pubIds = useMemo(() => publicacoes.map(p => p.id), [publicacoes]);
  const responsaveisMap = useResponsaveis('publicacao', pubIds);
  const { admins } = useAdminList();
  const [filtroResp, setFiltroResp] = useState<string>('all'); // 'all' | userId | 'none'
  const [respPopoverOpen, setRespPopoverOpen] = useState(false);

  useEffect(() => {
    const ids = publicacoes.map(p => p.id);
    if (ids.length === 0) { setSchedules({}); return; }
    supabase
      .from('publicacao_cobranca_schedule')
      .select('*')
      .in('publicacao_id', ids)
      .then(({ data }) => {
        const map: Record<string, any> = {};
        (data || []).forEach((s: any) => { map[s.publicacao_id] = s; });
        setSchedules(map);
      });
  }, [publicacoes]);

  // Atribuição automática por bucket de prazo (Caroline 60d → João 30d → Camila 7d)
  useEffect(() => {
    if (publicacoes.length === 0) return;
    // Aguarda o mapa de responsáveis carregar pelo menos uma vez
    const tarefas: Array<{ pubId: string; ownerId: string; ownerNome: string }> = [];
    for (const p of publicacoes) {
      if (p.status === 'certificado' || p.status === 'arquivado') continue;
      if (p.cumprimento_ok) continue;
      if (STATUS_BLOQUEIA_REATRIBUICAO.has(p.cumprimento_status)) continue;

      const deadline = computeDeadline(p);
      if (!deadline) continue;
      const days = differenceInDays(parseISO(deadline), new Date());
      const bucket = bucketOf(days);
      if (bucket !== 'no_prazo' && bucket !== '30dias' && bucket !== 'ultima_semana') continue;

      const expected = AUTO_OWNERS[bucket];
      const atual = responsaveisMap[p.id]?.user_id || null;
      if (atual === expected.id) continue;
      tarefas.push({ pubId: p.id, ownerId: expected.id, ownerNome: expected.nome });
    }
    if (tarefas.length === 0) return;
    // Dispara em background (sem await para não travar render). Limita 25 por ciclo.
    (async () => {
      for (const t of tarefas.slice(0, 25)) {
        try {
          await atribuirResponsavel('publicacao', t.pubId, {
            userId: t.ownerId,
            userNome: t.ownerNome,
            acao: 'atribuiu',
          });
        } catch (e) {
          console.warn('[auto-assign] falhou', t.pubId, e);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicacoes, responsaveisMap]);

  // Filter eligible publications for deadline buckets (not certified/archived/cumprido)
  const eligible = useMemo(() => {
    return publicacoes
      .filter(p => p.status !== 'certificado' && p.status !== 'arquivado' && !p.cumprimento_ok && p.cumprimento_status !== 'cumprido' && p.cumprimento_status !== 'desistiu')
      .map(p => {
        const deadline = computeDeadline(p);
        const days = deadline ? differenceInDays(parseISO(deadline), new Date()) : null;
        return { ...p, _deadline: deadline, _days: days, _bucket: bucketOf(days) };
      })
      .filter(p => p._bucket !== null);
  }, [publicacoes]);

  // Cumpridos list: publications marked as completed
  const cumpridosList = useMemo(() => {
    return publicacoes
      .filter(p => p.cumprimento_status === 'cumprido' || p.cumprimento_ok)
      .map(p => {
        const deadline = computeDeadline(p);
        return { ...p, _deadline: deadline, _days: null as number | null, _bucket: 'cumpridos' as Bucket };
      })
      .sort((a, b) => {
        const ta = a.cumprimento_at ? new Date(a.cumprimento_at).getTime() : 0;
        const tb = b.cumprimento_at ? new Date(b.cumprimento_at).getTime() : 0;
        return tb - ta;
      });
  }, [publicacoes]);

  const desistiuList = useMemo(() => {
    return publicacoes
      .filter(p => p.cumprimento_status === 'desistiu')
      .map(p => {
        const deadline = computeDeadline(p);
        return { ...p, _deadline: deadline, _days: null as number | null, _bucket: 'desistiu' as Bucket };
      });
  }, [publicacoes]);

  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { no_prazo: 0, '30dias': 0, ultima_semana: 0, vencidos: 0, cumpridos: 0, desistiu: 0 };
    eligible.forEach(p => { if (p._bucket && p._bucket !== 'cumpridos' && p._bucket !== 'desistiu') c[p._bucket as Bucket]++; });
    c.cumpridos = cumpridosList.length;
    c.desistiu = desistiuList.length;
    return c;
  }, [eligible, cumpridosList, desistiuList]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source =
      active === 'cumpridos' ? cumpridosList :
      active === 'desistiu' ? desistiuList :
      eligible.filter(p => p._bucket === active);
    return source
      .filter(p => {
        // Filtro de responsável
        if (filtroResp !== 'all') {
          const respId = responsaveisMap[p.id]?.user_id || null;
          if (filtroResp === 'none') {
            if (respId) return false;
          } else if (respId !== filtroResp) {
            return false;
          }
        }
        if (!term) return true;
        const proc = p.process_id ? processMap.get(p.process_id) : null;
        const client = p.client_id ? clientMap.get(p.client_id) : null;
        return (
          (proc?.brand_name || p.brand_name_rpi || '').toLowerCase().includes(term) ||
          (proc?.process_number || p.process_number_rpi || '').toLowerCase().includes(term) ||
          (client?.full_name || client?.email || '').toLowerCase().includes(term)
        );
      })
      .sort((a, b) => (a._days ?? 9999) - (b._days ?? 9999));
  }, [eligible, cumpridosList, desistiuList, active, search, processMap, clientMap, filtroResp, responsaveisMap]);

  const handleSetStatus = async (pub: any, status: AndamentoStatus) => {
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = { cumprimento_status: status };
    if (status === 'cumprido') payload.cumprimento_by = user?.id || null;
    const { error } = await supabase
      .from('publicacoes_marcas')
      .update(payload)
      .eq('id', pub.id);
    if (error) { toast.error('Erro ao atualizar andamento'); return; }
    if (status === 'cumprido') toast.success('Marcado como Cumprido — saiu do controle de prazos');
    else if (status === null) toast.success('Status limpo');
    else toast.success(`Andamento atualizado: ${ANDAMENTO_CFG[status].label}`);
    queryClient.invalidateQueries({ queryKey: ['publicacoes-marcas'] });
  };

  const handleLinkClient = async (pub: any, clientId: string) => {
    // Try resolve a matching process by process_number_rpi
    let processId: string | null = pub.process_id || null;
    if (!processId && pub.process_number_rpi) {
      for (const [pid, p] of processMap.entries()) {
        if (p?.process_number === pub.process_number_rpi && p?.user_id === clientId) {
          processId = pid;
          break;
        }
      }
    }
    const { error } = await supabase
      .from('publicacoes_marcas')
      .update({ client_id: clientId, process_id: processId } as any)
      .eq('id', pub.id);
    if (error) { toast.error('Erro ao vincular cliente'); return; }
    toast.success('Cliente vinculado');
    queryClient.invalidateQueries({ queryKey: ['publicacoes-marcas'] });
  };

  const handleArchiveNow = async (pub: any) => {
    const now = new Date().toISOString();
    await supabase.from('publicacoes_marcas').update({
      status: 'arquivado',
      descricao_prazo: 'Arquivado por decurso de prazo',
      updated_at: now,
    } as any).eq('id', pub.id);
    if (pub.process_id) {
      await supabase.from('brand_processes').update({
        pipeline_stage: 'arquivado',
        status: 'arquivado',
        updated_at: now,
      } as any).eq('id', pub.process_id);
    }
    toast.success('Publicação arquivada');
    queryClient.invalidateQueries({ queryKey: ['publicacoes-marcas'] });
    queryClient.invalidateQueries({ queryKey: ['brand-processes-pub'] });
  };

  // Conta publicações por processo para mostrar "Publicação N/M"
  const pubCountByProcess = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const p of publicacoes) {
      const key = p.process_id || `rpi:${p.process_number_rpi || p.id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    // ordenar por data_publicacao_rpi asc
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const da = a.data_publicacao_rpi ? new Date(a.data_publicacao_rpi).getTime() : 0;
        const db = b.data_publicacao_rpi ? new Date(b.data_publicacao_rpi).getTime() : 0;
        return da - db;
      });
    }
    return map;
  }, [publicacoes]);

  const getPubIndex = (pub: any): { idx: number; total: number } | null => {
    const key = pub.process_id || `rpi:${pub.process_number_rpi || pub.id}`;
    const arr = pubCountByProcess.get(key);
    if (!arr || arr.length < 2) return null;
    const idx = arr.findIndex(p => p.id === pub.id);
    return { idx: idx + 1, total: arr.length };
  };

  const openEditPrazo = (pub: any) => {
    setEditPrazoPubId(pub.id);
    setEditRpiDate(pub.data_publicacao_rpi || '');
    setEditDeadline(pub._deadline || pub.proximo_prazo_critico || '');
  };

  const handleRpiDateChange = (newDate: string, pub: any) => {
    setEditRpiDate(newDate);
    if (newDate) {
      const rule = calcDeadlineFromStatus(pub.status);
      if (rule && rule.days !== null) {
        const d = addDays(parseISO(newDate), rule.days);
        setEditDeadline(format(d, 'yyyy-MM-dd'));
      }
    }
  };

  const savePrazo = async (pub: any) => {
    if (!editRpiDate) { toast.error('Informe a data da publicação'); return; }
    setSavingPrazo(true);
    const finalDeadline = editDeadline || (() => {
      const rule = calcDeadlineFromStatus(pub.status);
      return rule?.days ? format(addDays(parseISO(editRpiDate), rule.days), 'yyyy-MM-dd') : null;
    })();
    const { error } = await supabase
      .from('publicacoes_marcas')
      .update({
        data_publicacao_rpi: editRpiDate,
        proximo_prazo_critico: finalDeadline,
        descricao_prazo: calcDeadlineFromStatus(pub.status)?.desc || pub.descricao_prazo,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', pub.id);
    setSavingPrazo(false);
    if (error) { toast.error('Erro ao salvar prazo'); return; }
    toast.success('Prazo atualizado');
    setEditPrazoPubId(null);
    queryClient.invalidateQueries({ queryKey: ['publicacoes-marcas'] });
  };

  return (
    <div className="space-y-4">
      {/* Bucket tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {BUCKETS.map(b => (
          <button
            key={b.id}
            onClick={() => setActive(b.id)}
            className={cn(
              'p-3 rounded-xl border text-left transition-all',
              active === b.id ? `ring-2 ${b.ring} border-transparent` : 'border-border hover:border-foreground/20'
            )}
          >
            <div className="flex items-center justify-between">
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', b.color)}>{b.label}</span>
              <Badge variant="secondary" className="text-xs">{counts[b.id]}</Badge>
            </div>
          </button>
        ))}
      </div>

      {/* Search + Filtro Responsável */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar marca, processo ou cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <Popover open={respPopoverOpen} onOpenChange={setRespPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 justify-start min-w-[200px]">
              <User className="h-3.5 w-3.5" />
              {filtroResp === 'all'
                ? 'Todos os responsáveis'
                : filtroResp === 'none'
                ? 'Sem responsável'
                : (admins.find(a => a.user_id === filtroResp)?.full_name?.split(' ')[0] || 'Responsável')}
              <ChevronDown className="h-3 w-3 ml-auto opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar responsável..." />
              <CommandList>
                <CommandEmpty>Nenhum admin encontrado</CommandEmpty>
                <CommandGroup>
                  <CommandItem value="todos" onSelect={() => { setFiltroResp('all'); setRespPopoverOpen(false); }}>
                    <User className="h-3.5 w-3.5 mr-2" /> Todos
                    {filtroResp === 'all' && <Check className="h-3 w-3 ml-auto text-emerald-500" />}
                  </CommandItem>
                  <CommandItem value="sem-responsavel" onSelect={() => { setFiltroResp('none'); setRespPopoverOpen(false); }}>
                    <UserPlus className="h-3.5 w-3.5 mr-2" /> Sem responsável
                    {filtroResp === 'none' && <Check className="h-3 w-3 ml-auto text-emerald-500" />}
                  </CommandItem>
                </CommandGroup>
                <CommandGroup heading="Admins">
                  {admins.map(a => (
                    <CommandItem
                      key={a.user_id}
                      value={a.full_name + ' ' + (a.email || '')}
                      onSelect={() => { setFiltroResp(a.user_id); setRespPopoverOpen(false); }}
                    >
                      <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-500 text-white text-[10px] font-semibold mr-2">
                        {(a.full_name || '?').trim().split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase()}
                      </span>
                      <span className="truncate">{a.full_name}</span>
                      {filtroResp === a.user_id && <Check className="h-3 w-3 ml-auto text-emerald-500" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-500px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Cliente</TableHead>
                  <TableHead className="text-xs">Marca / Processo</TableHead>
                  <TableHead className="text-xs">Publicação RPI</TableHead>
                  <TableHead className="text-xs">Prazo Final</TableHead>
                  <TableHead className="text-xs">{active === 'cumpridos' ? 'Cumprido em' : 'Dias Restantes'}</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Cobrança</TableHead>
                  <TableHead className="text-xs">Responsável</TableHead>
                  <TableHead className="text-xs text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-12 text-sm">
                      Nenhuma publicação nesta faixa de prazo.
                    </TableCell>
                  </TableRow>
                ) : filtered.map(pub => {
                  const proc = pub.process_id ? processMap.get(pub.process_id) : null;
                  const client = pub.client_id ? clientMap.get(pub.client_id) : null;
                  const stCfg = STATUS_CONFIG[pub.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG['003'];
                  const days = pub._days as number | null;
                  const sch = schedules[pub.id];
                  const sentCount = sch ? [sch.notif_1_at, sch.notif_2_at, sch.notif_3_at].filter(Boolean).length : 0;
                  const daysColor =
                    days === null ? 'text-muted-foreground' :
                    days < 0 ? 'text-red-600 dark:text-red-400 font-semibold' :
                    days <= 7 ? 'text-orange-600 dark:text-orange-400 font-semibold' :
                    days <= 30 ? 'text-amber-600 dark:text-amber-400 font-medium' :
                    'text-emerald-600 dark:text-emerald-400';
                  const andamento = (pub.cumprimento_status || null) as AndamentoStatus;
                  const andCfg = andamento ? ANDAMENTO_CFG[andamento] : null;
                  const AndIcon = andCfg?.icon;
                  return (
                    <TableRow key={pub.id}>
                      <TableCell className="text-sm">
                        {client ? (
                          <button
                            type="button"
                            onClick={() => onOpenDetail?.(pub.id)}
                            className="font-medium text-left hover:text-primary hover:underline transition-colors"
                          >
                            {client.full_name || client.email}
                          </button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs gap-1 border-dashed border-primary/50 text-primary hover:bg-primary/10"
                            onClick={() => setLinkDialogPub(pub)}
                          >
                            <UserPlus className="w-3.5 h-3.5" /> Vincular cliente
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <button
                          type="button"
                          onClick={() => onOpenDetail?.(pub.id)}
                          className="text-left hover:text-primary transition-colors group"
                        >
                          <div className="font-medium group-hover:underline">{proc?.brand_name || pub.brand_name_rpi || '—'}</div>
                          <div className="text-xs text-muted-foreground">{proc?.process_number || pub.process_number_rpi || ''}</div>
                        </button>
                        {(() => {
                          const info = getPubIndex(pub);
                          if (!info) return null;
                          return (
                            <Badge variant="secondary" className="ml-1 text-[10px] bg-primary/10 text-primary border-primary/20">
                              Publicação {info.idx}/{info.total}
                              {pub.rpi_number ? ` · RPI ${pub.rpi_number}` : ''}
                            </Badge>
                          );
                        })()}
                        {(() => {
                          const hasName = !!(proc?.brand_name || pub.brand_name_rpi);
                          return hasName ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setEditMarcaPub(pub); }}
                              className="ml-1 inline-flex items-center text-muted-foreground hover:text-primary opacity-60 hover:opacity-100 transition"
                              title="Editar nome da marca"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setEditMarcaPub(pub); }}
                              className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                            >
                              <Pencil className="w-3 h-3" /> Editar nome da marca
                            </button>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {pub.data_publicacao_rpi ? format(parseISO(pub.data_publicacao_rpi), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {pub._deadline ? format(parseISO(pub._deadline), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                      </TableCell>
                      <TableCell className={cn('text-sm', daysColor)}>
                        {active === 'cumpridos' ? (
                          <div className="flex items-center gap-1.5 text-teal-700 dark:text-teal-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {pub.cumprimento_at ? format(parseISO(pub.cumprimento_at), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                          </div>
                        ) : (
                          <Popover
                            open={editPrazoPubId === pub.id}
                            onOpenChange={(o) => { if (o) openEditPrazo(pub); else setEditPrazoPubId(null); }}
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1.5 hover:underline group"
                                title="Clique para editar a data da publicação"
                              >
                                {days !== null && days < 0 ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                {days === null ? '—' : days < 0 ? `${Math.abs(days)}d atrasado` : `${days}d restantes`}
                                <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 transition" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-3 space-y-3" align="start">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Data da publicação (RPI)</Label>
                                <Input
                                  type="date"
                                  value={editRpiDate}
                                  onChange={(e) => handleRpiDateChange(e.target.value, pub)}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Prazo final</Label>
                                <Input
                                  type="date"
                                  value={editDeadline}
                                  onChange={(e) => setEditDeadline(e.target.value)}
                                  className="h-8 text-sm"
                                />
                                <p className="text-[10px] text-muted-foreground">
                                  Recalculado automaticamente conforme o status ({pub.status}).
                                </p>
                              </div>
                              <div className="flex justify-end gap-2 pt-1">
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditPrazoPubId(null)}>
                                  Cancelar
                                </Button>
                                <Button size="sm" className="h-7 text-xs" onClick={() => savePrazo(pub)} disabled={savingPrazo}>
                                  {savingPrazo ? 'Salvando...' : 'Salvar'}
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', stCfg.bg, stCfg.color)}>{stCfg.label}</span>
                      </TableCell>
                      <TableCell>
                        {!sch ? (
                          <span className="text-xs text-muted-foreground">não iniciado</span>
                        ) : sch.status === 'pausado_resposta' ? (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 text-[10px]">pausado · respondeu</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-[10px]">{sentCount}/3 enviadas</Badge>
                        )}
                        {sch && active !== 'cumpridos' && (
                          <div className="mt-1">
                            {sch.last_notif_bucket === pub._bucket ? (
                              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-[10px] gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Notificado nesta faixa
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px]">
                                Pendente nesta faixa
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <ResponsavelChip
                          entidade="publicacao"
                          entidadeId={pub.id}
                          responsavel={responsaveisMap[pub.id]}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(pub._bucket === 'desistiu' || pub.cumprimento_status === 'desistiu') ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs gap-1 border-amber-500/60 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                              onClick={() => {
                                setPropostaPub(pub);
                                atribuirResponsavel('publicacao', pub.id, { acao: 'cobrou', somenteSeVazio: true }).catch(() => {});
                              }}
                              disabled={!pub.client_id}
                              title={pub.client_id ? 'Enviar proposta especial R$ 699' : 'Vincule um cliente primeiro'}
                            >
                              <Sparkles className="w-3.5 h-3.5" /> Proposta R$ 699
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10"
                              onClick={() => {
                                setNotifyPub(pub);
                                atribuirResponsavel('publicacao', pub.id, { acao: 'cobrou', somenteSeVazio: true }).catch(() => {});
                              }}
                              disabled={!pub.client_id}
                              title={pub.client_id ? 'Enviar notificação' : 'Vincule um cliente primeiro'}
                            >
                              <Bell className="w-3.5 h-3.5" /> Notificar
                            </Button>
                          )}
                          {onOpenDetail && (
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onOpenDetail(pub.id)} title="Ver detalhe">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className={cn(
                                  'h-7 px-2 text-xs gap-1',
                                  andCfg ? andCfg.trigger : 'border-muted-foreground/30 text-muted-foreground hover:bg-muted'
                                )}
                              >
                                {AndIcon ? <AndIcon className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                {andCfg ? andCfg.label : 'Definir status'}
                                <ChevronDown className="w-3 h-3 opacity-70" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem onClick={() => handleSetStatus(pub, 'cumprido')} className="text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="w-4 h-4 mr-2" /> Cumprido
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleSetStatus(pub, 'contato_agendado')} className="text-sky-700 dark:text-sky-400">
                                <CalendarCheck className="w-4 h-4 mr-2" /> Em Contato Agendado
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleSetStatus(pub, 'aguardando_pagamento')} className="text-amber-700 dark:text-amber-400">
                                <Wallet className="w-4 h-4 mr-2" /> Aguardando Pagamento
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleSetStatus(pub, 'desistiu')} className="text-zinc-700 dark:text-zinc-300">
                                <Ban className="w-4 h-4 mr-2" /> Desistiu
                              </DropdownMenuItem>
                              {andamento && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleSetStatus(pub, null)} className="text-muted-foreground">
                                    <X className="w-4 h-4 mr-2" /> Limpar status
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {active === 'vencidos' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs gap-1 border-red-500/40 text-red-700 dark:text-red-400 hover:bg-red-500/10"
                              onClick={() => handleArchiveNow(pub)}
                            >
                              <Archive className="w-3.5 h-3.5" /> Arquivar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <NotificarClienteDialog
        open={!!notifyPub}
        onOpenChange={(o) => { if (!o) setNotifyPub(null); }}
        publicacao={notifyPub}
        client={notifyPub?.client_id ? clientMap.get(notifyPub.client_id) : null}
        marca={(notifyPub?.process_id && processMap.get(notifyPub.process_id)?.brand_name) || notifyPub?.brand_name_rpi || 'sua marca'}
      />

      <VincularClienteDialog
        open={!!linkDialogPub}
        onOpenChange={(o) => { if (!o) setLinkDialogPub(null); }}
        publicacao={linkDialogPub}
        clients={clients}
        onLink={async (clientId) => { if (linkDialogPub) await handleLinkClient(linkDialogPub, clientId); }}
      />

      <EditarMarcaDialog
        open={!!editMarcaPub}
        onOpenChange={(o) => { if (!o) setEditMarcaPub(null); }}
        publicacao={editMarcaPub}
        processBrandName={editMarcaPub?.process_id ? processMap.get(editMarcaPub.process_id)?.brand_name : null}
      />
    </div>
  );
}