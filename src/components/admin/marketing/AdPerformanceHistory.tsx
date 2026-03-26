import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BarChart3, TrendingUp } from 'lucide-react';
import { format, subDays, startOfWeek, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AdPerformanceHistory() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [metric, setMetric] = useState<'spend' | 'leads_count' | 'ctr' | 'cpc'>('spend');

  const { data: performance = [] } = useQuery({
    queryKey: ['ad-performance-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_ad_performance')
        .select('*')
        .order('date', { ascending: true })
        .limit(500);
      if (error) return [];
      return data || [];
    },
  });

  // Aggregate by period
  const aggregated = performance.reduce((acc: Record<string, any>, p) => {
    let key: string;
    const d = new Date(p.date);
    if (period === 'daily') {
      key = format(d, 'dd/MM', { locale: ptBR });
    } else if (period === 'weekly') {
      key = `Sem ${format(startOfWeek(d), 'dd/MM', { locale: ptBR })}`;
    } else {
      key = format(startOfMonth(d), 'MMM/yy', { locale: ptBR });
    }

    if (!acc[key]) {
      acc[key] = { name: key, spend: 0, impressions: 0, clicks: 0, leads_count: 0, conversions: 0, ctr: 0, cpc: 0, count: 0 };
    }
    acc[key].spend += Number(p.spend || 0);
    acc[key].impressions += Number(p.impressions || 0);
    acc[key].clicks += Number(p.clicks || 0);
    acc[key].leads_count += Number(p.leads_count || 0);
    acc[key].conversions += Number(p.conversions || 0);
    acc[key].count += 1;
    return acc;
  }, {});

  // Calculate averages for rate metrics
  const chartData = Object.values(aggregated).map((d: any) => ({
    ...d,
    ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
    cpc: d.clicks > 0 ? d.spend / d.clicks : 0,
  }));

  const metricLabels: Record<string, string> = {
    spend: 'Investimento (R$)',
    leads_count: 'Leads Gerados',
    ctr: 'CTR (%)',
    cpc: 'CPC (R$)',
  };

  const metricColors: Record<string, string> = {
    spend: 'hsl(var(--destructive))',
    leads_count: 'hsl(var(--primary))',
    ctr: '#8b5cf6',
    cpc: '#f59e0b',
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Diário</SelectItem>
            <SelectItem value="weekly">Semanal</SelectItem>
            <SelectItem value="monthly">Mensal</SelectItem>
          </SelectContent>
        </Select>
        <Select value={metric} onValueChange={(v: any) => setMetric(v)}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="spend">Investimento</SelectItem>
            <SelectItem value="leads_count">Leads</SelectItem>
            <SelectItem value="ctr">CTR</SelectItem>
            <SelectItem value="cpc">CPC</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Histórico de Performance — {metricLabels[metric]}
          </CardTitle>
          <CardDescription>Evolução {period === 'daily' ? 'diária' : period === 'weekly' ? 'semanal' : 'mensal'} das campanhas</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>Nenhum dado de performance disponível</p>
                <p className="text-xs mt-1">Os dados são coletados automaticamente durante a sincronização</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number) =>
                    metric === 'spend' || metric === 'cpc' ? `R$ ${v.toFixed(2)}` : metric === 'ctr' ? `${v.toFixed(2)}%` : v
                  }
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey={metric}
                  stroke={metricColors[metric]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name={metricLabels[metric]}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
