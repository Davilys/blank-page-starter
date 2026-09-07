import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, subYears, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatBRL } from './lib/metrics';
import { BlockError, BlockSkeleton, BlockEmpty, type BlockStatus } from './DashboardStates';

type Granularity = 'mensal' | 'semestral' | 'anual';

const PAID_STATUSES = ['paid', 'received', 'confirmed'];

interface Point {
  period: string;
  receita: number;
  leads: number;
  clientes: number;
}

export function RevenueChart() {
  const [granularity, setGranularity] = useState<Granularity>('mensal');
  const [status, setStatus] = useState<BlockStatus>('loading');
  const [data, setData] = useState<Point[]>([]);

  const fetchData = useCallback(async () => {
    setStatus('loading');
    try {
      const now = new Date();
      const steps = granularity === 'mensal' ? 12 : granularity === 'semestral' ? 5 : 5;
      const startDate = granularity === 'mensal'
        ? startOfMonth(subMonths(now, steps))
        : granularity === 'semestral'
          ? subYears(now, 3)
          : subYears(now, steps);

      const key = (date: Date) => {
        if (granularity === 'mensal') return format(date, 'MMM/yy', { locale: ptBR });
        if (granularity === 'semestral') return `${date.getMonth() < 6 ? '1º Sem' : '2º Sem'}/${format(date, 'yy')}`;
        return format(date, 'yyyy');
      };

      const [invoicesRes, leadsRes, clientsRes] = await Promise.all([
        supabase.from('invoices').select('amount, payment_date, created_at')
          .in('status', PAID_STATUSES).gte('created_at', subYears(startDate, 1).toISOString()).limit(5000),
        supabase.from('leads').select('created_at').gte('created_at', startDate.toISOString()).limit(5000),
        supabase.from('profiles').select('created_at').gte('created_at', startDate.toISOString()).limit(5000),
      ]);
      if (invoicesRes.error) throw invoicesRes.error;
      if (leadsRes.error) throw leadsRes.error;
      if (clientsRes.error) throw clientsRes.error;

      // Buckets sempre presentes — mês sem receita aparece como zero, não some do gráfico.
      const buckets: string[] = [];
      const map: Record<string, Point> = {};
      const total = granularity === 'mensal' ? 12 : granularity === 'semestral' ? 6 : 5;
      for (let i = total; i >= 0; i--) {
        const date = granularity === 'mensal'
          ? subMonths(now, i)
          : granularity === 'semestral'
            ? subMonths(now, i * 6)
            : subYears(now, i);
        const k = key(date);
        if (!map[k]) {
          map[k] = { period: k, receita: 0, leads: 0, clientes: 0 };
          buckets.push(k);
        }
      }

      (invoicesRes.data || []).forEach((inv) => {
        const ref = new Date(inv.payment_date || inv.created_at);
        if (Number.isNaN(ref.getTime())) return;
        const k = key(ref);
        if (map[k]) map[k].receita += Number(inv.amount || 0);
      });
      (leadsRes.data || []).forEach((l) => {
        const k = key(new Date(l.created_at));
        if (map[k]) map[k].leads += 1;
      });
      (clientsRes.data || []).forEach((c) => {
        if (!c.created_at) return;
        const k = key(new Date(c.created_at));
        if (map[k]) map[k].clientes += 1;
      });

      const points = buckets.map((b) => map[b]);
      setData(points);
      const hasAny = points.some((p) => p.receita > 0 || p.leads > 0 || p.clientes > 0);
      setStatus(hasAny ? 'ready' : 'empty');
    } catch (err) {
      console.warn('[Evolução da receita] erro:', err);
      setStatus('error');
    }
  }, [granularity]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25">
            <TrendingUp className="h-4 w-4 text-emerald-500" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">Evolução da Receita</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Receita recebida (R$) e volume de leads e clientes, em escalas separadas
            </p>
          </div>
        </div>
        <Tabs value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
          <TabsList className="h-8">
            <TabsTrigger value="mensal" className="text-xs">Mensal</TabsTrigger>
            <TabsTrigger value="semestral" className="text-xs">Semestral</TabsTrigger>
            <TabsTrigger value="anual" className="text-xs">Anual</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent>
        {status === 'loading' && <BlockSkeleton height={320} />}
        {status === 'error' && <BlockError onRetry={fetchData} height={320} />}
        {status === 'empty' && (
          <BlockEmpty height={320} message="Sem histórico suficiente" hint="Ainda não há receita nem cadastros registrados nesta janela de tempo." />
        )}

        {status === 'ready' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[320px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis
                  yAxisId="money" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={54}
                  tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <YAxis
                  yAxisId="count" orientation="right" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={38}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: 'hsl(var(--foreground))',
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'Receita') return [formatBRL(value), 'Receita recebida'];
                    return [value.toLocaleString('pt-BR'), name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Area yAxisId="money" type="monotone" dataKey="receita" name="Receita"
                  stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#dashReceita)" animationDuration={900} />
                <Line yAxisId="count" type="monotone" dataKey="leads" name="Leads"
                  stroke="#8b5cf6" strokeWidth={2} dot={false} animationDuration={900} />
                <Line yAxisId="count" type="monotone" dataKey="clientes" name="Clientes"
                  stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="4 3" animationDuration={900} />
              </ComposedChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
