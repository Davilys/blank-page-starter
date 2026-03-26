import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Loader2, TrendingUp, Users, DollarSign, Target } from 'lucide-react';

interface Prediction {
  estimatedLeads: number;
  estimatedClients: number;
  estimatedRevenue: number;
  estimatedROI: number;
  confidence: string;
}

export default function CampaignPrediction() {
  const [budget, setBudget] = useState('2000');
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: campaigns = [] } = useQuery({
    queryKey: ['prediction-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .gt('spend', 0);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: historicalData } = useQuery({
    queryKey: ['prediction-historical'],
    queryFn: async () => {
      const [leadsRes, contractsRes, invoicesRes] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }),
        supabase.from('contracts').select('id, contract_value', { count: 'exact' }).eq('signature_status', 'signed'),
        supabase.from('invoices').select('id, amount').eq('status', 'paid'),
      ]);
      const totalLeads = leadsRes.count || 0;
      const totalClients = contractsRes.count || 0;
      const totalRevenue = (invoicesRes.data || []).reduce((s, i) => s + Number(i.amount || 0), 0);
      const avgContractValue = contractsRes.data && contractsRes.data.length > 0
        ? contractsRes.data.reduce((s, c) => s + Number(c.contract_value || 0), 0) / contractsRes.data.length
        : 699;
      return { totalLeads, totalClients, totalRevenue, avgContractValue };
    },
  });

  const predict = () => {
    setLoading(true);
    setTimeout(() => {
      const budgetNum = parseFloat(budget) || 0;
      
      // Calculate metrics from campaign data or use industry averages
      let avgCPL = 25;
      let conversionRate = 0.15;
      
      if (campaigns.length > 0) {
        const totalSpend = campaigns.reduce((s, c) => s + Number(c.spend || 0), 0);
        const totalLeads = campaigns.reduce((s, c) => s + Number(c.leads_count || 0), 0);
        if (totalLeads > 0 && totalSpend > 0) {
          avgCPL = totalSpend / totalLeads;
        }
      }
      
      if (historicalData && historicalData.totalLeads > 0) {
        conversionRate = historicalData.totalClients / historicalData.totalLeads;
      }

      const avgTicket = historicalData?.avgContractValue || 699;
      const estimatedLeads = Math.round(budgetNum / avgCPL);
      const estimatedClients = Math.max(1, Math.round(estimatedLeads * conversionRate));
      const estimatedRevenue = estimatedClients * avgTicket;
      const estimatedROI = budgetNum > 0 ? ((estimatedRevenue - budgetNum) / budgetNum) * 100 : 0;

      const confidence = campaigns.length >= 5 ? 'Alta' : campaigns.length >= 2 ? 'Média' : 'Baixa (poucos dados)';

      setPrediction({ estimatedLeads, estimatedClients, estimatedRevenue, estimatedROI, confidence });
      setLoading(false);
    }, 800);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Previsão de Campanha (IA)
          </CardTitle>
          <CardDescription>
            Simule o retorno estimado de uma campanha com base nos dados históricos do CRM
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="space-y-2 flex-1 max-w-xs">
              <Label htmlFor="budget">Investimento Planejado (R$)</Label>
              <Input
                id="budget"
                type="number"
                value={budget}
                onChange={e => setBudget(e.target.value)}
                placeholder="2000"
              />
            </div>
            <Button onClick={predict} disabled={loading || !budget}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {loading ? 'Calculando...' : 'Prever Resultados'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {prediction && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30 w-fit mx-auto mb-2">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <p className="text-xs text-muted-foreground">Leads Estimados</p>
              <p className="text-2xl font-bold text-foreground">{prediction.estimatedLeads}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30 w-fit mx-auto mb-2">
                <Target className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="text-xs text-muted-foreground">Clientes Estimados</p>
              <p className="text-2xl font-bold text-foreground">{prediction.estimatedClients}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30 w-fit mx-auto mb-2">
                <DollarSign className="h-5 w-5 text-amber-500" />
              </div>
              <p className="text-xs text-muted-foreground">Receita Estimada</p>
              <p className="text-2xl font-bold text-foreground">
                R$ {prediction.estimatedRevenue.toLocaleString('pt-BR')}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <div className={`p-2 rounded-full ${prediction.estimatedROI >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'} w-fit mx-auto mb-2`}>
                <TrendingUp className={`h-5 w-5 ${prediction.estimatedROI >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
              </div>
              <p className="text-xs text-muted-foreground">ROI Estimado</p>
              <p className={`text-2xl font-bold ${prediction.estimatedROI >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {prediction.estimatedROI.toFixed(0)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {prediction && (
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              📊 <strong>Confiança da previsão:</strong> {prediction.confidence}
              {' — '}
              Baseado em {campaigns.length} campanhas e {historicalData?.totalLeads || 0} leads históricos.
              Quanto mais dados, mais precisa a previsão.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
