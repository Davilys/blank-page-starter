import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Brain, Loader2, Sparkles, TrendingUp, TrendingDown, Pause, Zap,
  Users, Target, Lightbulb, BarChart3, AlertTriangle, FileText, DollarSign
} from 'lucide-react';

interface OptimizationReport {
  summary: string;
  winners: { campaign: string; reason: string; action: string }[];
  losers: { campaign: string; reason: string; action: string }[];
  budget_suggestions: { campaign: string; current: number; suggested: number; reason: string }[];
  audience_tips: string[];
  creative_tips: string[];
  predicted_improvement: string;
}

export default function OptimizationAgent() {
  const [report, setReport] = useState<OptimizationReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const { data: campaigns = [] } = useQuery({
    queryKey: ['marketing-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .order('spend', { ascending: false });
      if (error) return [];
      return data || [];
    },
  });

  const runOptimization = async () => {
    setAnalyzing(true);
    setReport(null);
    try {
      const campaignsData = campaigns.map(c => ({
        name: c.campaign_name,
        status: c.status,
        spend: c.spend,
        impressions: c.impressions,
        clicks: c.clicks,
        leads: c.leads_count,
        cpl: c.cpl,
        revenue: c.revenue,
        ctr: (c as any).ctr || 0,
      }));

      const { data, error } = await supabase.functions.invoke('marketing-ai-agent', {
        body: {
          action: 'optimize_report',
          campaigns_data: campaignsData,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.data) {
        setReport(data.data);
        toast.success('Relatório de otimização gerado!');
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Agent Header */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                ⚡ Agente de Otimização Completa
              </CardTitle>
              <CardDescription className="mt-1">
                IA analisa todas as campanhas e gera relatório executivo com ações concretas de otimização.
                Identifica vencedores, perdedores, sugere orçamento, públicos e criativos.
              </CardDescription>
            </div>
            <Button onClick={runOptimization} disabled={analyzing || campaigns.length === 0} size="lg">
              {analyzing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              {analyzing ? 'Otimizando...' : '⚡ Otimizar Campanhas'}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {!report && !analyzing && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Brain className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="font-medium">Clique em "Otimizar Campanhas" para gerar o relatório</p>
              <p className="text-sm mt-1">{campaigns.length} campanhas serão analisadas pela IA</p>
            </div>
          </CardContent>
        </Card>
      )}

      {report && (
        <div className="space-y-4">
          {/* Summary */}
          <Card className="border-primary/20">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Brain className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-foreground">Resumo Executivo</p>
                  <p className="text-sm text-muted-foreground mt-1">{report.summary}</p>
                  {report.predicted_improvement && (
                    <Badge className="mt-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Melhoria estimada: {report.predicted_improvement}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="winners" className="w-full">
            <TabsList className="grid grid-cols-5 h-auto">
              <TabsTrigger value="winners" className="text-xs gap-1">
                <TrendingUp className="h-3 w-3" /> Vencedores
              </TabsTrigger>
              <TabsTrigger value="losers" className="text-xs gap-1">
                <TrendingDown className="h-3 w-3" /> Perdedores
              </TabsTrigger>
              <TabsTrigger value="budget" className="text-xs gap-1">
                <DollarSign className="h-3 w-3" /> Orçamento
              </TabsTrigger>
              <TabsTrigger value="audience" className="text-xs gap-1">
                <Users className="h-3 w-3" /> Público
              </TabsTrigger>
              <TabsTrigger value="creative" className="text-xs gap-1">
                <Lightbulb className="h-3 w-3" /> Criativos
              </TabsTrigger>
            </TabsList>

            {/* Winners */}
            <TabsContent value="winners" className="space-y-3 mt-4">
              {(report.winners || []).length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-6">Nenhuma campanha vencedora identificada</p>
              ) : (
                report.winners.map((w, i) => (
                  <Card key={i} className="border-emerald-200/50 dark:border-emerald-800/30">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <TrendingUp className="h-4 w-4 text-emerald-500 mt-0.5" />
                        <div>
                          <p className="font-semibold text-sm">{w.campaign}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{w.reason}</p>
                          <div className="mt-2 p-2 rounded bg-emerald-50 dark:bg-emerald-950/20">
                            <p className="text-xs font-medium flex items-center gap-1"><Zap className="h-3 w-3" /> Ação:</p>
                            <p className="text-xs text-muted-foreground">{w.action}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Losers */}
            <TabsContent value="losers" className="space-y-3 mt-4">
              {(report.losers || []).length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-6">Nenhuma campanha com problema identificada</p>
              ) : (
                report.losers.map((l, i) => (
                  <Card key={i} className="border-red-200/50 dark:border-red-800/30">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                        <div>
                          <p className="font-semibold text-sm">{l.campaign}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{l.reason}</p>
                          <div className="mt-2 p-2 rounded bg-red-50 dark:bg-red-950/20">
                            <p className="text-xs font-medium flex items-center gap-1"><Zap className="h-3 w-3" /> Ação:</p>
                            <p className="text-xs text-muted-foreground">{l.action}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Budget */}
            <TabsContent value="budget" className="space-y-3 mt-4">
              {(report.budget_suggestions || []).length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-6">Nenhuma sugestão de orçamento</p>
              ) : (
                report.budget_suggestions.map((b, i) => (
                  <Card key={i} className="border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">{b.campaign}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{b.reason}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Atual → Sugerido</p>
                          <p className="text-sm font-medium">
                            R$ {Number(b.current || 0).toFixed(0)} → <span className="text-primary">R$ {Number(b.suggested || 0).toFixed(0)}</span>
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Audience */}
            <TabsContent value="audience" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  {(report.audience_tips || []).length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-4">Sem sugestões de público</p>
                  ) : (
                    <ul className="space-y-2">
                      {report.audience_tips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Target className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                          <span className="text-muted-foreground">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Creative */}
            <TabsContent value="creative" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  {(report.creative_tips || []).length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-4">Sem sugestões de criativos</p>
                  ) : (
                    <ul className="space-y-2">
                      {report.creative_tips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                          <span className="text-muted-foreground">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Disclaimer */}
      <Card className="border-border/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              O agente gera <strong>sugestões de otimização</strong> baseadas em dados reais. 
              Nenhuma alteração é feita automaticamente na plataforma de anúncios. 
              Execute as ações manualmente no Meta Ads Manager.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
