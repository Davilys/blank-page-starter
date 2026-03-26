import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Users, Target, BarChart3, Percent, MousePointerClick, Brain, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useMemo } from 'react';
const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function MarketingOverview() {
  const { data: campaigns = [] } = useQuery({
    queryKey: ['marketing-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .order('spend', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: attributions = [] } = useQuery({
    queryKey: ['marketing-attributions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_attribution')
        .select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const totalSpend = campaigns.reduce((s, c) => s + Number(c.spend || 0), 0);
  const totalLeads = campaigns.reduce((s, c) => s + Number(c.leads_count || 0), 0);
  const totalRevenue = campaigns.reduce((s, c) => s + Number(c.revenue || 0), 0);
  const totalClicks = campaigns.reduce((s, c) => s + Number(c.clicks || 0), 0);
  const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;
  const conversionRate = totalClicks > 0 ? (totalLeads / totalClicks) * 100 : 0;

  const kpis = [
    { label: 'Investimento Total', value: `R$ ${totalSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
    { label: 'Leads Gerados', value: totalLeads.toString(), icon: Users, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    { label: 'Receita Total', value: `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { label: 'Custo por Lead', value: `R$ ${avgCPL.toFixed(2)}`, icon: Target, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    { label: 'ROI', value: `${roi.toFixed(1)}%`, icon: roi >= 0 ? TrendingUp : TrendingDown, color: roi >= 0 ? 'text-emerald-500' : 'text-red-500', bg: roi >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30' },
    { label: 'Taxa de Conversão', value: `${conversionRate.toFixed(1)}%`, icon: Percent, color: 'text-violet-500', bg: 'bg-violet-100 dark:bg-violet-900/30' },
  ];

  const chartData = campaigns.slice(0, 8).map(c => ({
    name: (c.campaign_name || '').substring(0, 20),
    investimento: Number(c.spend || 0),
    receita: Number(c.revenue || 0),
    leads: Number(c.leads_count || 0),
  }));

  const sourceData = attributions.reduce((acc: Record<string, number>, a) => {
    const source = a.utm_source || 'Direto';
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.entries(sourceData).map(([name, value]) => ({ name, value }));

  // AI Executive Summary
  const aiSummary = useMemo(() => {
    const alerts: { text: string; type: 'success' | 'warning' | 'danger' }[] = [];
    if (campaigns.length === 0) return null;
    
    if (roi > 50) alerts.push({ text: `ROI de ${roi.toFixed(0)}% — campanhas performando acima da média`, type: 'success' });
    else if (roi < 0) alerts.push({ text: `ROI negativo (${roi.toFixed(0)}%) — revise campanhas com baixo desempenho`, type: 'danger' });
    
    const lowPerformers = campaigns.filter(c => {
      const s = Number(c.spend || 0), r = Number(c.revenue || 0);
      return s > 50 && r < s * 0.3;
    });
    if (lowPerformers.length > 0) alerts.push({ text: `${lowPerformers.length} campanha(s) com gasto alto e baixo retorno`, type: 'warning' });
    
    if (avgCPL > 0 && avgCPL < 30) alerts.push({ text: `CPL de R$ ${avgCPL.toFixed(2)} — custo por lead saudável`, type: 'success' });
    else if (avgCPL > 80) alerts.push({ text: `CPL alto (R$ ${avgCPL.toFixed(2)}) — otimize segmentação`, type: 'warning' });
    
    return alerts.length > 0 ? alerts : null;
  }, [campaigns, roi, avgCPL]);

  return (
    <div className="space-y-6">
      {/* AI Executive Summary */}
      {aiSummary && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Resumo Inteligente</span>
            </div>
            <div className="space-y-1.5">
              {aiSummary.map((alert, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {alert.type === 'success' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                  {alert.type === 'warning' && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                  {alert.type === 'danger' && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                  <span className="text-muted-foreground">{alert.text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${kpi.bg}`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-lg font-bold text-foreground">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Campaign Performance Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Performance por Campanha
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                  <Bar dataKey="investimento" fill="hsl(var(--destructive))" name="Investimento" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="receita" fill="hsl(var(--primary))" name="Receita" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>Nenhuma campanha sincronizada</p>
                  <p className="text-xs mt-1">Configure a integração Meta Ads para ver dados aqui</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Source Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MousePointerClick className="h-4 w-4" />
              Origem dos Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                <div className="text-center">
                  <MousePointerClick className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>Nenhuma atribuição registrada</p>
                  <p className="text-xs mt-1">Leads com UTM aparecerão aqui</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
