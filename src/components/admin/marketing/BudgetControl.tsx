import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DollarSign, AlertTriangle, TrendingUp, Calendar, BarChart3 } from 'lucide-react';

export default function BudgetControl() {
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

  const totalSpend = campaigns.reduce((s, c) => s + Number(c.spend || 0), 0);
  const totalRevenue = campaigns.reduce((s, c) => s + Number(c.revenue || 0), 0);
  const activeCampaigns = campaigns.filter(c => c.status === 'active');
  const avgDailySpend = totalSpend / 30;

  const projectedMonthly = avgDailySpend * 30;
  const projectedWeekly = avgDailySpend * 7;

  const budgetItems = [
    { label: 'Gasto Diário (média)', value: avgDailySpend, icon: Calendar, color: 'text-blue-500' },
    { label: 'Gasto Semanal (projeção)', value: projectedWeekly, icon: BarChart3, color: 'text-violet-500' },
    { label: 'Gasto Mensal (projeção)', value: projectedMonthly, icon: TrendingUp, color: 'text-amber-500' },
    { label: 'Gasto Total Acumulado', value: totalSpend, icon: DollarSign, color: 'text-red-500' },
  ];

  // Budget alerts
  const alerts: { campaign: string; message: string; severity: 'high' | 'medium' }[] = [];
  for (const c of campaigns) {
    const spend = Number(c.spend || 0);
    const monthlyLimit = Number((c as any).monthly_budget_limit || 0);
    if (monthlyLimit > 0 && spend > monthlyLimit * 0.8) {
      alerts.push({
        campaign: c.campaign_name || 'Sem nome',
        message: spend >= monthlyLimit
          ? `Orçamento mensal excedido: R$ ${spend.toFixed(2)} / R$ ${monthlyLimit.toFixed(2)}`
          : `80% do orçamento mensal atingido: R$ ${spend.toFixed(2)} / R$ ${monthlyLimit.toFixed(2)}`,
        severity: spend >= monthlyLimit ? 'high' : 'medium',
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Budget Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {budgetItems.map((item) => (
          <Card key={item.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <item.icon className={`h-4 w-4 ${item.color}`} />
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
              <p className="text-lg font-bold text-foreground">
                R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ROI Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Resumo de Rentabilidade
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Investido vs Receita</span>
            <span className="text-sm font-medium">
              R$ {totalSpend.toFixed(2)} → R$ {totalRevenue.toFixed(2)}
            </span>
          </div>
          <Progress value={totalRevenue > 0 ? Math.min((totalRevenue / Math.max(totalSpend, 1)) * 50, 100) : 0} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Campanhas ativas: {activeCampaigns.length}</span>
            <span>ROI: {totalSpend > 0 ? (((totalRevenue - totalSpend) / totalSpend) * 100).toFixed(1) : '0'}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Budget per Campaign */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Orçamento por Campanha</CardTitle>
          <CardDescription>Monitoramento de gastos por campanha ativa</CardDescription>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma campanha sincronizada</p>
          ) : (
            <div className="space-y-4">
              {campaigns.slice(0, 10).map((c) => {
                const spend = Number(c.spend || 0);
                const limit = Number((c as any).monthly_budget_limit || 0);
                const pct = limit > 0 ? (spend / limit) * 100 : 0;
                return (
                  <div key={c.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate max-w-[200px]">{c.campaign_name}</span>
                      <span className="text-muted-foreground">
                        R$ {spend.toFixed(2)}
                        {limit > 0 && <span> / R$ {limit.toFixed(2)}</span>}
                      </span>
                    </div>
                    {limit > 0 && (
                      <Progress value={Math.min(pct, 100)} className={`h-1.5 ${pct > 90 ? '[&>div]:bg-red-500' : pct > 70 ? '[&>div]:bg-amber-500' : ''}`} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Budget Alerts */}
      {alerts.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              Alertas de Orçamento
              <Badge variant="destructive">{alerts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map((a, i) => (
              <div key={i} className={`p-3 rounded-lg border ${a.severity === 'high' ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'}`}>
                <p className="font-medium text-sm">{a.campaign}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
