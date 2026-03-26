import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, DollarSign, Target, CheckCircle } from 'lucide-react';

interface Alert {
  type: 'danger' | 'warning' | 'info';
  title: string;
  description: string;
  campaign?: string;
}

export default function MarketingAlerts() {
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

  const alerts: Alert[] = [];

  for (const c of campaigns) {
    const spend = Number(c.spend || 0);
    const revenue = Number(c.revenue || 0);
    const leads = Number(c.leads_count || 0);
    const cpl = Number(c.cpl || 0);
    const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;

    if (roi < -50 && spend > 50) {
      alerts.push({
        type: 'danger',
        title: 'ROI Muito Negativo',
        description: `ROI de ${roi.toFixed(0)}% — R$ ${spend.toFixed(2)} investidos com retorno muito baixo`,
        campaign: c.campaign_name || undefined,
      });
    }

    if (spend > 100 && leads === 0) {
      alerts.push({
        type: 'danger',
        title: 'Campanha Sem Leads',
        description: `R$ ${spend.toFixed(2)} investidos sem gerar nenhum lead`,
        campaign: c.campaign_name || undefined,
      });
    }

    if (cpl > 100) {
      alerts.push({
        type: 'warning',
        title: 'CPL Elevado',
        description: `Custo por lead de R$ ${cpl.toFixed(2)} — acima da média ideal`,
        campaign: c.campaign_name || undefined,
      });
    }
  }

  const getAlertStyles = (type: string) => {
    switch (type) {
      case 'danger': return { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' };
      case 'warning': return { icon: TrendingDown, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800' };
      default: return { icon: Target, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' };
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Alertas de Performance
          {alerts.length > 0 && (
            <Badge variant="destructive" className="ml-2">{alerts.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-400 opacity-60" />
            <p className="font-medium">Tudo em ordem!</p>
            <p className="text-sm mt-1">Nenhum alerta de performance no momento</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert, i) => {
              const styles = getAlertStyles(alert.type);
              return (
                <div key={i} className={`p-3 rounded-lg border ${styles.bg}`}>
                  <div className="flex items-start gap-3">
                    <styles.icon className={`h-4 w-4 mt-0.5 ${styles.color}`} />
                    <div>
                      <p className="font-medium text-sm">{alert.title}</p>
                      {alert.campaign && (
                        <p className="text-xs text-muted-foreground">Campanha: {alert.campaign}</p>
                      )}
                      <p className="text-sm text-muted-foreground mt-0.5">{alert.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
