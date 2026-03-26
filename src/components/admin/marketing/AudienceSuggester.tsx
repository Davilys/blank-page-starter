import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Users, Loader2, Sparkles, Target, CheckCircle2 } from 'lucide-react';

interface AudienceSuggestion {
  name: string;
  description: string;
  interests?: string[];
  estimated_reach?: string;
  confidence: number;
}

export default function AudienceSuggester() {
  const [suggestions, setSuggestions] = useState<AudienceSuggestion[]>([]);
  const [generating, setGenerating] = useState(false);

  const { data: campaigns = [] } = useQuery({
    queryKey: ['marketing-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .order('spend', { ascending: false })
        .limit(20);
      if (error) return [];
      return data || [];
    },
  });

  const { data: savedSuggestions = [] } = useQuery({
    queryKey: ['audience-suggestions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_audience_suggestions')
        .select('*')
        .order('confidence_score', { ascending: false });
      if (error) return [];
      return data || [];
    },
  });

  const generateSuggestions = async () => {
    setGenerating(true);
    try {
      const campaignsData = campaigns.map(c => ({
        name: c.campaign_name,
        leads: c.leads_count,
        spend: c.spend,
        cpl: c.cpl,
      }));

      const { data, error } = await supabase.functions.invoke('marketing-ai-agent', {
        body: {
          action: 'suggest_audiences',
          campaigns_data: campaignsData,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const result = data?.data;
      if (result?.audiences) {
        setSuggestions(result.audiences);

        // Save to DB
        for (const a of result.audiences) {
          await supabase.from('marketing_audience_suggestions').insert({
            name: a.name,
            description: a.description,
            estimated_reach: a.estimated_reach || null,
            confidence_score: a.confidence || 0,
            suggestion_type: 'ai_generated',
          } as any);
        }

        toast.success(`${result.audiences.length} sugestões geradas!`);
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const displaySuggestions = suggestions.length > 0 ? suggestions : savedSuggestions.map((s: any) => ({
    name: s.name,
    description: s.description,
    estimated_reach: s.estimated_reach,
    confidence: Number(s.confidence_score || 0),
  }));

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Motor de Sugestão de Público
              </CardTitle>
              <CardDescription>
                IA analisa suas campanhas e sugere novos segmentos de público-alvo para expandir alcance
              </CardDescription>
            </div>
            <Button onClick={generateSuggestions} disabled={generating}>
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {generating ? 'Analisando...' : 'Gerar Sugestões'}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {displaySuggestions.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Target className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="font-medium">Nenhuma sugestão de público gerada</p>
              <p className="text-sm mt-1">Clique em "Gerar Sugestões" para a IA analisar seus dados</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displaySuggestions.map((s, i) => (
            <Card key={i} className="border-border/50 hover:border-primary/30 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <p className="font-semibold text-sm">{s.name}</p>
                  </div>
                  <Badge
                    variant={s.confidence >= 80 ? 'default' : s.confidence >= 50 ? 'secondary' : 'outline'}
                    className="text-[10px]"
                  >
                    {s.confidence}% confiança
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{s.description}</p>

                {s.interests && s.interests.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {s.interests.map((interest, j) => (
                      <Badge key={j} variant="outline" className="text-[10px]">{interest}</Badge>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  {s.estimated_reach && (
                    <span className="text-xs text-muted-foreground">Alcance: {s.estimated_reach}</span>
                  )}
                  <Progress value={s.confidence} className="w-24 h-1.5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
