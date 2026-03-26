import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, DollarSign, Users, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, subYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Period = 'mensal' | 'semestral' | 'anual';

interface RevenueData {
  period: string;
  receita: number;
  leads: number;
  clientes: number;
}

export function RevenueChart() {
  const [period, setPeriod] = useState<Period>('mensal');
  const [data, setData] = useState<RevenueData[]>([]);
  const [totals, setTotals] = useState({ receita: 0, leads: 0, clientes: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchData(); }, [period]);

  const fetchData = async () => {
    setIsLoading(true);
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'mensal': startDate = subMonths(now, 12); break;
      case 'semestral': startDate = subYears(now, 2); break;
      case 'anual': startDate = subYears(now, 5); break;
    }

    const [invoicesRes, leadsRes, clientsRes] = await Promise.all([
      supabase.from('invoices').select('amount, status, created_at').gte('created_at', startDate.toISOString()).eq('status', 'paid'),
      supabase.from('leads').select('created_at, status').gte('created_at', startDate.toISOString()),
      supabase.from('profiles').select('created_at').gte('created_at', startDate.toISOString()),
    ]);

    const groupedData: Record<string, RevenueData> = {};
    
    const getPeriodKey = (date: Date) => {
      switch (period) {
        case 'mensal': return format(date, 'MMM/yy', { locale: ptBR });
        case 'semestral':
          const semester = date.getMonth() < 6 ? '1º Sem' : '2º Sem';
          return `${semester}/${format(date, 'yy')}`;
        case 'anual': return format(date, 'yyyy');
      }
    };

    const periods: string[] = [];
    for (let i = period === 'anual' ? 5 : period === 'semestral' ? 4 : 12; i >= 0; i--) {
      let date: Date;
      switch (period) {
        case 'mensal': date = subMonths(now, i); break;
        case 'semestral': date = subMonths(now, i * 6); break;
        case 'anual': date = subYears(now, i); break;
      }
      const key = getPeriodKey(date);
      if (!periods.includes(key)) {
        periods.push(key);
        groupedData[key] = { period: key, receita: 0, leads: 0, clientes: 0 };
      }
    }

    invoicesRes.data?.forEach(inv => {
      const key = getPeriodKey(new Date(inv.created_at));
      if (groupedData[key]) groupedData[key].receita += Number(inv.amount);
    });
    leadsRes.data?.forEach(lead => {
      const key = getPeriodKey(new Date(lead.created_at));
      if (groupedData[key]) groupedData[key].leads += 1;
    });
    clientsRes.data?.forEach(client => {
      const key = getPeriodKey(new Date(client.created_at));
      if (groupedData[key]) groupedData[key].clientes += 1;
    });

    const chartData = periods.map(p => groupedData[p]);
    setData(chartData);
    setTotals({
      receita: chartData.reduce((sum, d) => sum + d.receita, 0),
      leads: chartData.reduce((sum, d) => sum + d.leads, 0),
      clientes: chartData.reduce((sum, d) => sum + d.clientes, 0),
    });
    setIsLoading(false);
  };

  const summaryCards = [
    { label: 'Receita Total', value: `R$ ${totals.receita.toLocaleString('pt-BR')}`, icon: DollarSign, gradient: 'from-emerald-500 to-teal-400' },
    { label: 'Total Leads', value: totals.leads.toString(), icon: Target, gradient: 'from-blue-500 to-cyan-400' },
    { label: 'Novos Clientes', value: totals.clientes.toString(), icon: Users, gradient: 'from-violet-500 to-purple-400' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 shadow-lg">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Evolução da Receita</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Comparativo {period === 'mensal' ? 'mês a mês' : period === 'semestral' ? 'semestral' : 'anual'}
              </p>
            </div>
          </div>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList className="grid grid-cols-3 w-[260px] h-9">
              <TabsTrigger value="mensal" className="text-xs">Mensal</TabsTrigger>
              <TabsTrigger value="semestral" className="text-xs">Semestral</TabsTrigger>
              <TabsTrigger value="anual" className="text-xs">Anual</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {summaryCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <motion.div 
                  key={card.label}
                  className="relative overflow-hidden p-4 rounded-xl border border-border/50 bg-card"
                  whileHover={{ scale: 1.02 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                >
                  <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${card.gradient}`} />
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br ${card.gradient}`}>
                      <Icon className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
                  </div>
                  <p className="text-xl font-bold tracking-tight">{card.value}</p>
                </motion.div>
              );
            })}
          </div>

          {/* Chart */}
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false}
                  tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))', 
                    borderRadius: '12px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                    fontSize: '12px'
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'receita') return [`R$ ${value.toLocaleString('pt-BR')}`, 'Receita'];
                    return [value, name === 'leads' ? 'Leads' : 'Clientes'];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area type="monotone" dataKey="receita" stroke="hsl(var(--primary))" strokeWidth={2.5}
                  fillOpacity={1} fill="url(#colorReceita)" name="receita" animationDuration={1500} />
                <Area type="monotone" dataKey="leads" stroke="#8b5cf6" strokeWidth={2}
                  fillOpacity={1} fill="url(#colorLeads)" name="leads" animationDuration={1500} animationBegin={300} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
