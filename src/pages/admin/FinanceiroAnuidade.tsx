import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ArrowLeft, CalendarClock, Download, Eye, Loader2, Mail, Pause, Play, RefreshCw, Search, Settings, Sparkles, XCircle,
  ExternalLink, Link2, RotateCcw, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { calcAnnuityDueDate, campaignStartDate, fmtBR, todaySaoPaulo } from '@/lib/annuity';
import { cn } from '@/lib/utils';

type Item = Record<string, any>;
type Campaign = Record<string, any> | null;

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const GEN: Record<string, { label: string; cls: string }> = {
  scheduled: { label: 'Programada', cls: 'bg-primary/10 text-primary' },
  processing: { label: 'Processando', cls: 'bg-primary/10 text-primary' },
  generated: { label: 'Gerada', cls: 'bg-emerald-500/10 text-emerald-700' },
  failed: { label: 'Não gerada — ação manual', cls: 'bg-destructive/10 text-destructive' },
  manual: { label: 'Em resolução manual', cls: 'bg-accent/15 text-accent-foreground' },
  reconciling: { label: 'Em reconciliação', cls: 'bg-amber-500/15 text-amber-700' },
  excluded: { label: 'Excluída', cls: 'bg-muted text-muted-foreground' },
  review: { label: 'Em revisão', cls: 'bg-amber-500/15 text-amber-700' },
};
const MAIL: Record<string, string> = {
  not_sent: 'Não enviado', queued: 'Na fila', sending: 'Enviando', accepted: 'Aceito pelo provedor',
  delivered: 'Entregue', failed: 'Falha', uncertain: 'Resultado incerto', manual_sent: 'Enviado pelo Asaas',
};
const FIN: Record<string, string> = {
  none: 'Sem cobrança', pending: 'Pendente', overdue: 'Vencida', paid: 'Paga', cancelled: 'Cancelada', refunded: 'Estornada',
};
const CAMP: Record<string, string> = {
  scanning: 'Buscando clientes', scheduled: 'Programada', running: 'Em execução', paused: 'Pausada',
  cancelled: 'Cancelada', completed: 'Concluída', draft: 'Rascunho',
};

function message(it: Item): string {
  if (it.generation_status === 'excluded') return it.reason || 'Cliente excluído.';
  if (it.generation_status === 'review') return it.reason || 'Em revisão.';
  if (it.generation_status === 'reconciling') return 'Resultado em verificação. Aguarde antes de gerar manualmente.';
  if (it.generation_status === 'failed' || it.generation_status === 'manual') return 'Cobrança não gerada. Necessária geração manual no Asaas.';
  if (it.generation_status === 'generated') {
    if (it.email_status === 'accepted' || it.email_status === 'delivered' || it.email_status === 'manual_sent') return 'Cobrança gerada e e-mail enviado.';
    if (it.email_status === 'failed') return 'Cobrança gerada. Falha no envio do e-mail.';
    return 'Cobrança gerada. E-mail aguardando envio.';
  }
  return 'Aguardando próximo lote diário.';
}

function kanbanColumn(it: Item): string | null {
  if (it.eligibility !== 'eligible') return null;
  if (it.financial_status === 'paid') return 'Pagas';
  if (it.financial_status === 'cancelled' || it.financial_status === 'refunded') return 'Canceladas';
  if (it.financial_status === 'overdue') return 'Vencidas';
  if (it.generation_status === 'generated') return 'Pendentes';
  if (['failed', 'manual', 'reconciling'].includes(it.generation_status)) return 'Ação manual';
  if (it.generation_status === 'processing') return 'A gerar';
  return 'Programadas';
}
const COLUMNS = ['A gerar', 'Programadas', 'Ação manual', 'Pendentes', 'Vencidas', 'Pagas', 'Canceladas'];

async function call(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('annuity', { body: { action, ...payload } });
  if (error) {
    let msg = error.message;
    try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch { /* noop */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function FinanceiroAnuidade() {
  const navigate = useNavigate();
  const thisYear = Number(todaySaoPaulo().slice(0, 4));
  const [exercicio, setExercicio] = useState<number>(thisYear);
  const [campaign, setCampaign] = useState<Campaign>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [quota, setQuota] = useState<{ clients_used: number; emails_used: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Item | null>(null);
  const [events, setEvents] = useState<Item[]>([]);
  const [preview, setPreview] = useState<{ subject: string; html: string; sample?: boolean } | null>(null);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [cfg, setCfg] = useState({ start_date: '', daily_hour: 9, daily_limit: 200, amount: '398,00', period_label: '' });
  const [linkId, setLinkId] = useState('');
  const [linkEmailSent, setLinkEmailSent] = useState(false);
  const [testTo, setTestTo] = useState('');

  const load = useCallback(async () => {
    const { data: c } = await supabase.from('annuity_campaigns' as any).select('*').eq('exercicio', exercicio).maybeSingle();
    setCampaign(c as any);
    if (c) {
      const all: Item[] = [];
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from('annuity_items' as any).select('*').eq('campaign_id', (c as any).id)
          .order('client_name', { ascending: true }).range(from, from + 999);
        all.push(...((data as any[]) || []));
        if (!data || data.length < 1000) break;
      }
      setItems(all);
    } else setItems([]);
    const { data: q } = await supabase.from('annuity_daily_quota' as any).select('clients_used, emails_used').eq('day', todaySaoPaulo()).maybeSingle();
    setQuota((q as any) || { clients_used: 0, emails_used: 0 });
    setLoading(false);
  }, [exercicio]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const debounced = () => { if (t) clearTimeout(t); t = setTimeout(load, 800); };
    const ch = supabase.channel(`annuity-${exercicio}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'annuity_items' }, debounced)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'annuity_campaigns' }, debounced)
      .subscribe();
    return () => { if (t) clearTimeout(t); supabase.removeChannel(ch); };
  }, [exercicio, load]);

  useEffect(() => {
    if (!selected) return;
    supabase.from('annuity_events' as any).select('*').eq('item_id', selected.id).order('created_at', { ascending: false })
      .then(({ data }) => setEvents((data as any[]) || []));
    const fresh = items.find((i) => i.id === selected.id);
    if (fresh && fresh.updated_at !== selected.updated_at) setSelected(fresh);
  }, [selected?.id, items]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (key: string, fn: () => Promise<any>, ok?: string) => {
    setBusy(key);
    try { const r = await fn(); if (ok) toast.success(ok); await load(); return r; }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  const today = todaySaoPaulo();
  const startDate = campaign?.start_date || campaignStartDate(exercicio);

  const stats = useMemo(() => {
    const s = { total: items.length, elig: 0, excl: 0, review: 0, gen: 0, fail: 0, mail: 0, mailFail: 0, pend: 0, over: 0, paid: 0, sched: 0, paidCents: 0, openCents: 0 };
    for (const i of items) {
      if (i.eligibility === 'eligible') s.elig++; else if (i.eligibility === 'excluded') s.excl++; else s.review++;
      if (i.generation_status === 'generated') s.gen++;
      if (['failed', 'manual'].includes(i.generation_status)) s.fail++;
      if (['accepted', 'delivered', 'manual_sent'].includes(i.email_status)) s.mail++;
      if (i.email_status === 'failed') s.mailFail++;
      if (i.eligibility === 'eligible' && i.generation_status === 'scheduled') s.sched++;
      if (i.financial_status === 'pending') { s.pend++; s.openCents += i.amount_cents; }
      if (i.financial_status === 'overdue') { s.over++; s.openCents += i.amount_cents; }
      if (i.financial_status === 'paid') { s.paid++; s.paidCents += i.amount_cents; }
    }
    return s;
  }, [items]);

  const dailyLimit = campaign?.daily_limit || 200;
  const usedToday = quota?.clients_used || 0;
  const daysLeft = Math.ceil(stats.sched / dailyLimit);
  const forecast = (() => {
    if (!stats.sched) return '—';
    const base = today > startDate ? today : startDate;
    const [y, m, d] = base.split('-').map(Number);
    return fmtBR(new Date(Date.UTC(y, m - 1, d + Math.max(daysLeft - 1, 0))).toISOString().slice(0, 10));
  })();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qd = q.replace(/\D/g, '');
    return items.filter((i) => {
      if (statusFilter === 'eligible' && i.eligibility !== 'eligible') return false;
      if (statusFilter !== 'all' && statusFilter !== 'eligible' && i.generation_status !== statusFilter && i.financial_status !== statusFilter && i.email_status !== statusFilter) return false;
      if (!q) return true;
      return (i.client_name || '').toLowerCase().includes(q) || (i.client_email || '').toLowerCase().includes(q)
        || (qd.length >= 3 && (i.doc_digits || '').includes(qd)) || (i.brands || []).some((b: string) => b?.toLowerCase().includes(q))
        || (i.reason || '').toLowerCase().includes(q) || (i.last_error || '').toLowerCase().includes(q);
    });
  }, [items, search, statusFilter]);

  const eligibleRows = filtered.filter((i) => i.eligibility === 'eligible');
  const reviewRows = filtered.filter((i) => i.eligibility !== 'eligible');

  const exportCsv = () => {
    const head = ['Cliente', 'E-mail', 'CPF/CNPJ', 'Marcas', 'Valor', 'Exercício', 'Elegibilidade', 'Geração', 'Emissão', 'Vencimento', 'E-mail', 'Financeiro', 'ID Asaas', 'Motivo/Falha'];
    const rows = items.map((i) => [i.client_name, i.client_email, i.doc_digits, (i.brands || []).join(' | '), (i.amount_cents / 100).toFixed(2).replace('.', ','),
      i.exercicio, i.eligibility, GEN[i.generation_status]?.label, fmtBR(i.emitted_at), fmtBR(i.due_date), MAIL[i.email_status], FIN[i.financial_status], i.asaas_payment_id || '', i.last_error || i.reason || '']);
    const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `anuidades-${exercicio}.csv`; a.click();
  };

  const openCfg = () => {
    setCfg({ start_date: campaign?.start_date || startDate, daily_hour: campaign?.daily_hour ?? 9, daily_limit: dailyLimit,
      amount: ((campaign?.amount_cents || 39800) / 100).toFixed(2).replace('.', ','), period_label: campaign?.period_label || `Exercício ${exercicio}` });
    setCfgOpen(true);
  };

  const scanning = campaign && !campaign.scan_done;
  const steps = [
    { label: 'Buscando clientes', done: !!campaign?.scan_done, active: !!scanning },
    { label: 'Verificando contratos e distratos', done: !!campaign?.scan_done, active: !!scanning },
    { label: 'Organizando fila', done: !!campaign?.scan_done, active: false },
    { label: 'Gerando cobranças', done: !!campaign && stats.sched === 0 && stats.elig > 0, active: campaign?.status === 'running' },
    { label: 'Enviando e-mails', done: stats.gen > 0 && stats.mail + stats.mailFail >= stats.gen, active: campaign?.status === 'running' },
  ];

  const kpis = [
    { label: 'Clientes identificados', value: stats.total },
    { label: 'Elegíveis', value: stats.elig },
    { label: 'Excluídos', value: stats.excl },
    { label: 'Em revisão', value: stats.review },
    { label: 'Cobranças geradas', value: stats.gen },
    { label: 'Não geradas', value: stats.fail, warn: stats.fail > 0 },
    { label: 'E-mails enviados', value: stats.mail },
    { label: 'Falhas de e-mail', value: stats.mailFail, warn: stats.mailFail > 0 },
    { label: 'Pendentes', value: stats.pend, sub: brl(stats.openCents) },
    { label: 'Vencidas', value: stats.over },
    { label: 'Pagas', value: stats.paid, sub: brl(stats.paidCents) },
    { label: 'Processados hoje', value: usedToday, sub: `Saldo diário: ${Math.max(0, 200 - usedToday)}` },
    { label: 'Previsão de conclusão', value: forecast, sub: stats.sched ? `${stats.sched} na fila` : undefined },
  ];

  const years = Array.from({ length: 5 }, (_, k) => thisYear - 1 + k).filter((y) => y >= 2026);

  const Row = ({ i }: { i: Item }) => (
    <TableRow className="cursor-pointer" onClick={() => setSelected(i)}>
      <TableCell className="font-medium max-w-[220px] truncate">{i.client_name || '—'}</TableCell>
      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{i.client_email || '—'}</TableCell>
      <TableCell className="tabular-nums">{brl(i.amount_cents)}</TableCell>
      <TableCell><Badge variant="secondary" className={cn('font-medium', GEN[i.generation_status]?.cls)}>{GEN[i.generation_status]?.label}</Badge></TableCell>
      <TableCell className="tabular-nums">{fmtBR(i.emitted_at)}</TableCell>
      <TableCell className="tabular-nums">{fmtBR(i.due_date)}</TableCell>
      <TableCell className="text-xs">{MAIL[i.email_status]}</TableCell>
      <TableCell className="text-xs">{FIN[i.financial_status]}</TableCell>
      <TableCell className="text-xs text-muted-foreground max-w-[260px]">{i.last_error || message(i)}</TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/financeiro')} aria-label="Voltar ao Financeiro"><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Anuidades</h1>
            <p className="text-sm text-muted-foreground">Cobrança anual contratual — boleto Asaas, envio somente por e-mail.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(exercicio)} onValueChange={(v) => setExercicio(Number(v))}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>Exercício {y}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" className="gap-2 bg-gradient-to-r from-primary to-primary/70 shadow-md shadow-primary/20" disabled={!!busy}
            onClick={() => run('start', () => call('start', { exercicio }), today < startDate ? `Programado para ${fmtBR(startDate)}` : 'Campanha iniciada')}>
            {busy === 'start' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gerar anuidade {exercicio}
          </Button>
          {campaign && ['scanning', 'scheduled', 'running'].includes(campaign.status) && (
            <Button size="sm" variant="outline" className="gap-2" disabled={!!busy} onClick={() => run('pause', () => call('pause', { campaign_id: campaign.id }), 'Campanha pausada')}><Pause className="h-4 w-4" /> Pausar</Button>)}
          {campaign && campaign.status === 'paused' && (
            <Button size="sm" variant="outline" className="gap-2" disabled={!!busy} onClick={() => run('resume', () => call('resume', { campaign_id: campaign.id }), 'Campanha retomada')}><Play className="h-4 w-4" /> Retomar</Button>)}
          {campaign && (
            <Button size="sm" variant="outline" className="gap-2" disabled={!!busy} onClick={() => run('rescan', () => call('rescan', { campaign_id: campaign.id }), 'Nova varredura iniciada (só adiciona clientes ausentes)')}><RefreshCw className="h-4 w-4" /> Nova varredura</Button>)}
          <Button size="sm" variant="outline" className="gap-2" disabled={!campaign} onClick={openCfg}><Settings className="h-4 w-4" /> Configurações</Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => run('preview', async () => setPreview(await call('preview', { campaign_id: campaign?.id, exercicio })))}><Eye className="h-4 w-4" /> Prévia do e-mail</Button>
          <Button size="sm" variant="outline" className="gap-2" disabled={!items.length} onClick={exportCsv}><Download className="h-4 w-4" /> Exportar</Button>
          {campaign && !['cancelled', 'completed'].includes(campaign.status) && (
            <Button size="sm" variant="ghost" className="gap-2 text-destructive" disabled={!!busy}
              onClick={() => { if (confirm('Cancelar a campanha interrompe os trabalhos pendentes. Boletos já emitidos não são cancelados. Continuar?')) run('cancel', () => call('cancel', { campaign_id: campaign.id }), 'Campanha cancelada'); }}>
              <XCircle className="h-4 w-4" /> Cancelar campanha</Button>)}
        </div>
      </div>

      <Card className="p-4 md:p-5 border-border/60">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5"><CalendarClock className="h-5 w-5 text-primary" /></div>
            <div>
              <div className="font-semibold">
                Exercício {exercicio} · {campaign ? CAMP[campaign.status] || campaign.status : 'Ainda não gerada'}
                {campaign && today < startDate && campaign.status !== 'cancelled' && <span className="ml-2 text-primary">Programado para {fmtBR(startDate)}</span>}
              </div>
              <div className="text-xs text-muted-foreground">
                Início: {fmtBR(startDate)} às {String(campaign?.daily_hour ?? 9).padStart(2, '0')}h · Até {dailyLimit} clientes/dia · Valor {brl(campaign?.amount_cents || 39800)}
                {campaign?.last_scan_at && <> · Última varredura: {new Date(campaign.last_scan_at).toLocaleString('pt-BR')}</>}
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground md:text-right max-w-md">
            Vencimento: cinco dias corridos após a emissão. Se cair na sexta, sábado ou domingo, passa para segunda-feira.
            <span className="block">Ex.: emissão hoje ({fmtBR(today)}) → vence {fmtBR(calcAnnuityDueDate(today))}.</span>
          </div>
        </div>
        {campaign && (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-5">
            {steps.map((s, k) => (
              <div key={s.label} className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
                s.done ? 'border-emerald-500/30 bg-emerald-500/5' : s.active ? 'border-primary/40 bg-primary/5' : 'border-border/60')}>
                {s.done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : s.active ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <span className="h-4 w-4 rounded-full border text-center text-[10px] leading-[14px]">{k + 1}</span>}
                <span className="font-medium">{s.label}</span>
              </div>
            ))}
          </div>
        )}
        {scanning && <p className="mt-3 text-xs text-muted-foreground">Varredura em andamento: {campaign?.scan_stats?.varridos || 0} cadastros verificados até agora. O total será exibido ao concluir.</p>}
      </Card>

      {campaign && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
          {kpis.map((k) => (
            <Card key={k.label} className={cn('p-3 border-border/60', k.warn && 'border-destructive/40')}>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{k.label}</div>
              <div className={cn('mt-1 text-xl font-bold tabular-nums', k.warn && 'text-destructive')}>{k.value}</div>
              {k.sub && <div className="text-[11px] text-muted-foreground">{k.sub}</div>}
            </Card>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !campaign ? (
        <Card className="p-10 text-center border-dashed">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-3 text-lg font-semibold">Nenhuma campanha para o exercício {exercicio}</h2>
          <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
            Ao clicar em “Gerar anuidade {exercicio}”, o sistema faz uma varredura completa e atualizada de todos os clientes, revalida contratos e distratos e monta a fila.
            Nenhum boleto é emitido antes de {fmtBR(startDate)}.
          </p>
        </Card>
      ) : (
        <Tabs defaultValue="table">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <TabsList>
              <TabsTrigger value="table">Tabela ({eligibleRows.length})</TabsTrigger>
              <TabsTrigger value="kanban">Kanban</TabsTrigger>
              <TabsTrigger value="review">Excluídos e revisão ({reviewRows.length})</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8 w-[260px]" placeholder="Cliente, CPF/CNPJ, e-mail, marca, motivo" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as situações</SelectItem>
                  {Object.entries(GEN).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  <SelectItem value="pending">Financeiro: pendente</SelectItem>
                  <SelectItem value="overdue">Financeiro: vencida</SelectItem>
                  <SelectItem value="paid">Financeiro: paga</SelectItem>
                  <SelectItem value="failed">E-mail: falha</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <TabsContent value="table">
            <Card className="mt-3 overflow-hidden border-border/60">
              <div className="max-h-[65vh] overflow-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Cliente</TableHead><TableHead>E-mail</TableHead><TableHead>Valor</TableHead><TableHead>Geração</TableHead>
                    <TableHead>Emissão</TableHead><TableHead>Vencimento</TableHead><TableHead>E-mail</TableHead><TableHead>Financeiro</TableHead><TableHead>Situação</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {eligibleRows.slice(0, 500).map((i) => <Row key={i.id} i={i} />)}
                    {!eligibleRows.length && <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">{scanning ? 'Buscando clientes…' : 'Nenhum cliente nesta visão.'}</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
              {eligibleRows.length > 500 && <div className="border-t p-2 text-center text-xs text-muted-foreground">Mostrando 500 de {eligibleRows.length}. Use a busca ou exporte para ver todos.</div>}
            </Card>
          </TabsContent>

          <TabsContent value="kanban">
            <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
              {COLUMNS.map((col) => {
                const list = filtered.filter((i) => kanbanColumn(i) === col);
                return (
                  <div key={col} className="w-[260px] shrink-0 rounded-xl border border-border/60 bg-muted/30">
                    <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold">{col}<Badge variant="secondary">{list.length}</Badge></div>
                    <div className="max-h-[60vh] space-y-2 overflow-y-auto p-2">
                      {list.slice(0, 100).map((i) => (
                        <button key={i.id} onClick={() => setSelected(i)} className="w-full rounded-lg border bg-card p-2.5 text-left text-xs shadow-sm hover:border-primary/40">
                          <div className="font-semibold text-sm truncate">{i.client_name}</div>
                          <div className="text-muted-foreground truncate">{i.client_email}</div>
                          <div className="mt-1 flex justify-between"><span>{brl(i.amount_cents)}</span><span>{i.due_date ? `Vence ${fmtBR(i.due_date)}` : ''}</span></div>
                        </button>
                      ))}
                      {list.length > 100 && <div className="text-center text-[11px] text-muted-foreground">+{list.length - 100}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">As colunas refletem a situação real da cobrança no Asaas; não é possível marcar como pago arrastando cartões.</p>
          </TabsContent>

          <TabsContent value="review">
            <Card className="mt-3 overflow-hidden border-border/60">
              <div className="max-h-[65vh] overflow-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>E-mail</TableHead><TableHead>Situação</TableHead><TableHead>Motivo</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {reviewRows.slice(0, 500).map((i) => (
                      <TableRow key={i.id} className="cursor-pointer" onClick={() => setSelected(i)}>
                        <TableCell className="font-medium">{i.client_name || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{i.client_email || '—'}</TableCell>
                        <TableCell><Badge variant="secondary" className={GEN[i.generation_status]?.cls}>{i.eligibility === 'excluded' ? 'Excluído' : 'Em revisão'}</Badge></TableCell>
                        <TableCell className="text-xs">{i.reason}</TableCell>
                      </TableRow>
                    ))}
                    {!reviewRows.length && <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">Nenhum cliente excluído ou em revisão.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Detalhes */}
      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setLinkId(''); setLinkEmailSent(false); } }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader><SheetTitle>{selected.client_name}</SheetTitle></SheetHeader>
              <div className="mt-4 space-y-4 text-sm">
                <div className={cn('rounded-lg border p-3', ['failed', 'manual'].includes(selected.generation_status) && 'border-destructive/40 bg-destructive/5')}>
                  <div className="flex items-center gap-2 font-medium">
                    {['failed', 'manual', 'reconciling'].includes(selected.generation_status) && <AlertTriangle className="h-4 w-4 text-destructive" />}
                    {message(selected)}
                  </div>
                  {selected.last_error && <div className="mt-1 text-xs text-muted-foreground">{selected.last_error}</div>}
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <dt className="text-muted-foreground">E-mail</dt><dd className="break-all">{selected.client_email || '—'}</dd>
                  <dt className="text-muted-foreground">CPF/CNPJ</dt><dd>{selected.doc_digits || '—'}</dd>
                  <dt className="text-muted-foreground">Marcas/processos</dt><dd>{(selected.brands || []).join(', ') || '—'}</dd>
                  <dt className="text-muted-foreground">Contrato</dt><dd>{selected.contract_id ? 'Assinado (cl. 5.2 e 10.1)' : '—'}</dd>
                  <dt className="text-muted-foreground">Referência contratual</dt><dd>{fmtBR(selected.contract_ref_date)}</dd>
                  <dt className="text-muted-foreground">Valor</dt><dd>{brl(selected.amount_cents)}</dd>
                  <dt className="text-muted-foreground">Período</dt><dd>{campaign?.period_label}</dd>
                  <dt className="text-muted-foreground">Emissão</dt><dd>{fmtBR(selected.emitted_at)}</dd>
                  <dt className="text-muted-foreground">Vencimento</dt><dd>{fmtBR(selected.due_date)}</dd>
                  <dt className="text-muted-foreground">E-mail</dt><dd>{MAIL[selected.email_status]}</dd>
                  <dt className="text-muted-foreground">Financeiro</dt><dd>{FIN[selected.financial_status]}</dd>
                  <dt className="text-muted-foreground">ID Asaas</dt><dd className="break-all">{selected.asaas_payment_id || '—'}</dd>
                </dl>
                <div className="flex flex-wrap gap-2">
                  {selected.boleto_url && <Button size="sm" variant="outline" className="gap-1" asChild><a href={selected.boleto_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Boleto</a></Button>}
                  <Button size="sm" variant="outline" className="gap-1" asChild><a href="https://www.asaas.com/payment/list" target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Abrir Asaas</a></Button>
                  {selected.eligibility === 'review' && !selected.asaas_payment_id && <>
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => { const r = prompt('Motivo da aprovação (condição contratual conferida):'); if (r) run('approve', () => call('approve', { item_id: selected.id, reason: r }), 'Cliente aprovado e colocado na fila'); }}>Aprovar para cobrança</Button>
                  </>}
                  {selected.eligibility !== 'excluded' && !selected.asaas_payment_id && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => { const r = prompt('Motivo da exclusão:'); if (r) run('exclude', () => call('exclude', { item_id: selected.id, reason: r }), 'Cliente excluído da campanha'); }}>Excluir</Button>}
                  {['failed', 'manual'].includes(selected.generation_status) && <Button size="sm" variant="outline" className="gap-1" disabled={!!busy} onClick={() => run('retry', () => call('retry', { item_id: selected.id }), 'Recolocado na fila')}><RotateCcw className="h-3.5 w-3.5" /> Tentar novamente</Button>}
                  {selected.generation_status === 'failed' && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run('manual', () => call('manual_start', { item_id: selected.id }), 'Resolução manual reservada — o sistema não gerará outro boleto')}>Vou gerar manualmente</Button>}
                  {selected.generation_status === 'reconciling' && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run('rec', () => call('reconcile', { item_id: selected.id }), 'Reconciliação executada')}>Verificar no Asaas</Button>}
                  {selected.asaas_payment_id && !['paid', 'cancelled', 'refunded'].includes(selected.financial_status) && <Button size="sm" variant="outline" className="gap-1" disabled={!!busy} onClick={() => run('resend', () => call('resend', { item_id: selected.id }), 'Reenvio processado')}><Mail className="h-3.5 w-3.5" /> Reenviar e-mail</Button>}
                  <Button size="sm" variant="ghost" className="gap-1" onClick={() => run('pv', async () => setPreview(await call('preview', { campaign_id: campaign?.id, item_id: selected.id })))}><Eye className="h-3.5 w-3.5" /> Prévia</Button>
                </div>
                {['failed', 'manual'].includes(selected.generation_status) && (
                  <Card className="p-3 space-y-2">
                    <div className="flex items-center gap-2 font-medium"><Link2 className="h-4 w-4" /> Vincular cobrança manual</div>
                    <p className="text-xs text-muted-foreground">Gere no Asaas: {brl(selected.amount_cents)}, boleto, “Anuidade contratual WebMarcas — {campaign?.period_label}”, vencimento {fmtBR(calcAnnuityDueDate(today))} (se emitido hoje).</p>
                    <Input placeholder="ID da cobrança (pay_...)" value={linkId} onChange={(e) => setLinkId(e.target.value)} />
                    <label className="flex items-center gap-2 text-xs"><Checkbox checked={linkEmailSent} onCheckedChange={(v) => setLinkEmailSent(!!v)} /> O e-mail já foi enviado pelo Asaas</label>
                    <Button size="sm" disabled={!linkId || !!busy} onClick={() => run('link', () => call('link_manual', { item_id: selected.id, payment_id: linkId, email_sent_in_asaas: linkEmailSent }), 'Cobrança vinculada')}>Vincular</Button>
                  </Card>
                )}
                <div>
                  <div className="mb-2 font-medium">Histórico</div>
                  <div className="space-y-1.5">
                    {events.map((e) => (
                      <div key={e.id} className="rounded border px-2 py-1.5 text-xs">
                        <div className="flex justify-between"><span className="font-medium">{e.action}</span><span className="text-muted-foreground">{new Date(e.created_at).toLocaleString('pt-BR')}</span></div>
                        {e.detail && Object.keys(e.detail).length > 0 && <div className="mt-0.5 break-all text-muted-foreground">{JSON.stringify(e.detail)}</div>}
                      </div>
                    ))}
                    {!events.length && <div className="text-xs text-muted-foreground">Sem eventos.</div>}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Prévia */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Prévia do e-mail</DialogTitle></DialogHeader>
          {preview && <>
            <div className="text-sm"><span className="text-muted-foreground">Assunto:</span> <strong>{preview.subject}</strong></div>
            {preview.sample && <p className="text-xs text-muted-foreground">Prévia com dados de exemplo — o envio real usa os dados e o link do boleto de cada cliente.</p>}
            <iframe title="Prévia" srcDoc={preview.html} sandbox="" className="h-[520px] w-full rounded-lg border" />
            <div className="flex gap-2">
              <Input placeholder="E-mail interno para teste" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
              <Button variant="outline" disabled={!testTo || !!busy} onClick={() => run('test', () => call('test_email', { to: testTo, exercicio }), 'E-mail de teste enviado (sem boleto real)')}>Enviar teste</Button>
            </div>
          </>}
        </DialogContent>
      </Dialog>

      {/* Configurações */}
      <Dialog open={cfgOpen} onOpenChange={setCfgOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Configurações — Exercício {exercicio}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Período de referência</Label><Input value={cfg.period_label} onChange={(e) => setCfg({ ...cfg, period_label: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início</Label><Input type="date" value={cfg.start_date} onChange={(e) => setCfg({ ...cfg, start_date: e.target.value })} /></div>
              <div><Label>Horário diário (h)</Label><Input type="number" min={0} max={23} value={cfg.daily_hour} onChange={(e) => setCfg({ ...cfg, daily_hour: Number(e.target.value) })} /></div>
              <div><Label>Limite diário (até 200)</Label><Input type="number" min={1} max={200} value={cfg.daily_limit} onChange={(e) => setCfg({ ...cfg, daily_limit: Number(e.target.value) })} /></div>
              <div><Label>Valor (R$)</Label><Input value={cfg.amount} onChange={(e) => setCfg({ ...cfg, amount: e.target.value })} /></div>
            </div>
            <p className="text-xs text-muted-foreground">Alterações valem apenas para cobranças ainda não emitidas. Boletos já gerados não são modificados.</p>
          </div>
          <DialogFooter>
            <Button disabled={!!busy} onClick={() => run('cfg', async () => {
              const cents = Math.round(Number(cfg.amount.replace(/\./g, '').replace(',', '.')) * 100);
              await call('config', { campaign_id: campaign?.id, start_date: cfg.start_date, daily_hour: cfg.daily_hour, daily_limit: Math.min(200, cfg.daily_limit), amount_cents: cents, period_label: cfg.period_label });
              setCfgOpen(false);
            }, 'Configurações salvas')}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
