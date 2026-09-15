import * as React from 'react';
import { BarChart3, ChevronRight, Filter, Info, LayoutGrid, X } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type BillingSituationKey = 'recebidas' | 'confirmadas' | 'aguardando' | 'vencidas';
export type BillingPeriod = 'today' | 'week' | 'month' | 'previous_month' | 'quarter' | 'year' | 'all' | 'custom';

export interface BillingCompositionItem {
  key: string;
  label: string;
  amount: number;
  count: number;
}

export interface BillingCategory {
  gross_amount: number;
  net_amount: number | null;
  clients_count: number;
  invoices_count: number;
  composition: BillingCompositionItem[];
}

export interface BillingSituationData {
  total: number;
  net_available: boolean;
  categories: Record<BillingSituationKey, BillingCategory>;
  series: Array<Record<BillingSituationKey | 'date', string | number>>;
}

export interface BillingFilters {
  account: string;
  paymentMethod: string;
  client: string;
  origin: string;
  dueFrom: string;
  dueTo: string;
  paymentFrom: string;
  paymentTo: string;
}

interface AsaasAccountOption {
  asaas_customer_id: string;
  cliente_nome: string;
  cobrancas: number;
}

interface ClientOption {
  id: string;
  full_name: string | null;
  email: string;
}

interface BillingSituationSectionProps {
  data: BillingSituationData;
  loading: boolean;
  canViewValues: boolean;
  period: BillingPeriod;
  customFrom: string;
  customTo: string;
  filters: BillingFilters;
  activeSituation: string;
  clients: ClientOption[];
  accounts: AsaasAccountOption[];
  onPeriodChange: (period: BillingPeriod) => void;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
  onFiltersChange: (filters: BillingFilters) => void;
  onSituationChange: (situation: BillingSituationKey | 'all') => void;
}

const EMPTY_FILTERS: BillingFilters = {
  account: '', paymentMethod: '', client: '', origin: '',
  dueFrom: '', dueTo: '', paymentFrom: '', paymentTo: '',
};

const CARD_CONFIG: Array<{
  key: BillingSituationKey;
  title: string;
  tone: string;
  border: string;
  surface: string;
  bar: string;
  chart: string;
}> = [
  { key: 'recebidas', title: 'Recebidas', tone: 'text-billing-received', border: 'border-billing-received/25', surface: 'bg-billing-received/5', bar: 'bg-billing-received', chart: 'hsl(var(--billing-received))' },
  { key: 'confirmadas', title: 'Confirmadas', tone: 'text-billing-confirmed', border: 'border-billing-confirmed/25', surface: 'bg-billing-confirmed/5', bar: 'bg-billing-confirmed', chart: 'hsl(var(--billing-confirmed))' },
  { key: 'aguardando', title: 'Aguardando pagamento', tone: 'text-billing-awaiting', border: 'border-billing-awaiting/25', surface: 'bg-billing-awaiting/5', bar: 'bg-billing-awaiting', chart: 'hsl(var(--billing-awaiting))' },
  { key: 'vencidas', title: 'Vencidas', tone: 'text-billing-overdue', border: 'border-billing-overdue/25', surface: 'bg-billing-overdue/5', bar: 'bg-billing-overdue', chart: 'hsl(var(--billing-overdue))' },
];

const PERIOD_LABELS: Record<BillingPeriod, string> = {
  today: 'Hoje', week: 'Esta semana', month: 'Este mês', previous_month: 'Mês anterior',
  quarter: 'Este trimestre', year: 'Este ano', all: 'Todo o período', custom: 'Período personalizado',
};

const money = (value: number) => `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export function BillingSituationSection({
  data, loading, canViewValues, period, customFrom, customTo, filters, activeSituation,
  clients, accounts, onPeriodChange, onCustomFromChange, onCustomToChange, onFiltersChange, onSituationChange,
}: BillingSituationSectionProps) {
  const [graphView, setGraphView] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const maxTotal = Math.max(...CARD_CONFIG.map(({ key }) => Number(data.categories[key]?.gross_amount || 0)), 0);

  return (
    <section className="space-y-4" aria-labelledby="billing-situation-title">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 id="billing-situation-title" className="text-xl font-bold text-foreground">Situação das cobranças</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {canViewValues ? `${money(data.total)} total no período` : 'Valores financeiros restritos'}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            variant={graphView ? 'default' : 'outline'}
            size="sm"
            className="justify-start gap-2"
            onClick={() => setGraphView((current) => !current)}
            aria-pressed={graphView}
          >
            {graphView ? <LayoutGrid className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
            {graphView ? 'Versão cartões' : 'Versão gráfico'}
          </Button>

          <Select value={period} onValueChange={(value) => onPeriodChange(value as BillingPeriod)}>
            <SelectTrigger className="h-9 w-full bg-background sm:w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIOD_LABELS) as BillingPeriod[]).map((key) => (
                <SelectItem key={key} value={key}>{PERIOD_LABELS[key]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => setFiltersOpen(true)}>
            <Filter className="h-4 w-4" /> Filtros
            {activeFilters > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{activeFilters}</span>}
          </Button>
        </div>
      </div>

      {period === 'custom' && (
        <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="billing-period-from">Início</Label>
            <Input id="billing-period-from" type="date" value={customFrom} onChange={(event) => onCustomFromChange(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="billing-period-to">Fim</Label>
            <Input id="billing-period-to" type="date" value={customTo} onChange={(event) => onCustomToChange(event.target.value)} />
          </div>
        </div>
      )}

      {graphView ? (
        <Card className="border-border/60">
          <CardContent className="h-[330px] p-4 sm:p-6">
            {data.series.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Nenhuma movimentação no período</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    {CARD_CONFIG.map((item) => (
                      <linearGradient key={item.key} id={`billing-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={item.chart} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={item.chart} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
                  <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(8, 10) + '/' + String(value).slice(5, 7)} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { notation: 'compact' })}`} tickLine={false} axisLine={false} width={72} />
                  <Tooltip formatter={(value: number) => money(value)} labelFormatter={(value) => new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')} />
                  <Legend />
                  {CARD_CONFIG.map((item) => (
                    <Area key={item.key} type="monotone" dataKey={item.key} name={item.title} stroke={item.chart} fill={`url(#billing-${item.key})`} strokeWidth={2} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {CARD_CONFIG.map((config) => {
            const category = data.categories[config.key];
            const selected = activeSituation === config.key;
            const barWidth = maxTotal > 0 ? Math.max((category.gross_amount / maxTotal) * 100, category.gross_amount > 0 ? 4 : 0) : 0;
            const compositionTotal = category.composition.reduce((sum, item) => sum + Number(item.amount || 0), 0);

            return (
              <Card
                key={config.key}
                className={cn('group overflow-hidden border transition-all hover:-translate-y-0.5 hover:shadow-lg', config.border, config.surface, selected && 'ring-2 ring-primary')}
              >
                <CardContent className="p-5">
                  <button type="button" className="w-full text-left" onClick={() => onSituationChange(config.key)} aria-pressed={selected}>
                    <div className="flex min-h-6 items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-semibold text-foreground">{config.title}</h3>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" aria-label={`Informações sobre ${config.title}`} />
                      </div>
                      <ChevronRight className={cn('h-4 w-4 transition-transform group-hover:translate-x-0.5', config.tone)} />
                    </div>

                    <div className="mt-5 min-h-[68px]">
                      <p className={cn('text-2xl font-bold tabular-nums', config.tone)}>
                        {loading ? '—' : canViewValues ? money(category.gross_amount) : 'Restrito'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Valor líquido indisponível</p>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                      {category.composition.length > 1 && compositionTotal > 0 ? (
                        <div className="flex h-full" style={{ width: `${barWidth}%` }}>
                          {category.composition.map((item, index) => (
                            <span
                              key={item.key}
                              className={cn('h-full', config.bar, index % 3 === 1 && 'opacity-70', index % 3 === 2 && 'opacity-45')}
                              style={{ width: `${(Number(item.amount || 0) / compositionTotal) * 100}%` }}
                              title={`${item.label}: ${money(item.amount)}`}
                            />
                          ))}
                        </div>
                      ) : (
                        <span className={cn('block h-full rounded-full', config.bar)} style={{ width: `${barWidth}%` }} />
                      )}
                    </div>
                  </button>

                  <div className="mt-4 grid grid-cols-2 divide-x divide-border/70 border-t border-border/70 pt-4">
                    <button type="button" className="pr-3 text-left" onClick={() => onSituationChange(config.key)}>
                      <span className="block text-lg font-bold tabular-nums text-foreground">{category.clients_count}</span>
                      <span className="text-xs text-muted-foreground">Clientes</span>
                    </button>
                    <button type="button" className="pl-3 text-left" onClick={() => onSituationChange(config.key)}>
                      <span className="block text-lg font-bold tabular-nums text-foreground">{category.invoices_count}</span>
                      <span className="text-xs text-muted-foreground">Cobranças</span>
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {activeSituation !== 'all' && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Filtro ativo:</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 font-medium text-primary">
            {CARD_CONFIG.find((item) => item.key === activeSituation)?.title}
            <button type="button" onClick={() => onSituationChange('all')} aria-label="Limpar filtro de situação"><X className="h-3.5 w-3.5" /></button>
          </span>
        </div>
      )}

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Filtros das cobranças</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Status</Label><Select value={activeSituation} onValueChange={(value) => onSituationChange(value as BillingSituationKey | 'all')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{CARD_CONFIG.map((item) => <SelectItem key={item.key} value={item.key}>{item.title}</SelectItem>)}<SelectItem value="inativas">Canceladas e inativas</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Conta Asaas</Label><Select value={filters.account || 'all'} onValueChange={(value) => onFiltersChange({ ...filters, account: value === 'all' ? '' : value })}><SelectTrigger><SelectValue placeholder="Todas as contas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as contas</SelectItem>{accounts.map((account) => <SelectItem key={account.asaas_customer_id} value={account.asaas_customer_id}>{account.cliente_nome} ({account.cobrancas})</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Forma de pagamento</Label><Select value={filters.paymentMethod || 'all'} onValueChange={(value) => onFiltersChange({ ...filters, paymentMethod: value === 'all' ? '' : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="pix">Pix</SelectItem><SelectItem value="boleto">Boleto</SelectItem><SelectItem value="credit_card">Cartão</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Cliente</Label><Select value={filters.client || 'all'} onValueChange={(value) => onFiltersChange({ ...filters, client: value === 'all' ? '' : value })}><SelectTrigger><SelectValue placeholder="Todos os clientes" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os clientes</SelectItem>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.full_name || client.email}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Origem da cobrança</Label><Select value={filters.origin || 'all'} onValueChange={(value) => onFiltersChange({ ...filters, origin: value === 'all' ? '' : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="asaas">Asaas</SelectItem><SelectItem value="interna">Fatura interna</SelectItem><SelectItem value="acordo">Acordo</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Vencimento inicial</Label><Input type="date" value={filters.dueFrom} onChange={(event) => onFiltersChange({ ...filters, dueFrom: event.target.value })} /></div>
            <div className="space-y-1.5"><Label>Vencimento final</Label><Input type="date" value={filters.dueTo} onChange={(event) => onFiltersChange({ ...filters, dueTo: event.target.value })} /></div>
            <div className="space-y-1.5"><Label>Pagamento inicial</Label><Input type="date" value={filters.paymentFrom} onChange={(event) => onFiltersChange({ ...filters, paymentFrom: event.target.value })} /></div>
            <div className="space-y-1.5"><Label>Pagamento final</Label><Input type="date" value={filters.paymentTo} onChange={(event) => onFiltersChange({ ...filters, paymentTo: event.target.value })} /></div>
          </div>
          <div className="flex justify-between gap-2 pt-2">
            <Button variant="ghost" onClick={() => onFiltersChange(EMPTY_FILTERS)} disabled={activeFilters === 0}>Limpar filtros</Button>
            <Button onClick={() => setFiltersOpen(false)}>Aplicar filtros</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}