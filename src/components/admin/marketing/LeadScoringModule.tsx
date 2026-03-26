import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, Thermometer, Snowflake, Activity } from 'lucide-react';
import { useMemo } from 'react';

interface ScoredLead {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  origin: string | null;
  lead_temperature: string | null;
  lead_score: number | null;
  created_at: string;
  status: string;
  score: number;
  factors: string[];
}

export default function LeadScoringModule() {
  const { data: leads = [] } = useQuery({
    queryKey: ['lead-scoring-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, full_name, email, phone, origin, lead_temperature, lead_score, created_at, status, tags')
        .neq('status', 'convertido')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: attributions = [] } = useQuery({
    queryKey: ['lead-scoring-attributions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_attribution')
        .select('lead_id, utm_source, fbclid, utm_campaign, utm_term');
      if (error) throw error;
      return data || [] as any[];
    },
  });

  const scoredLeads: ScoredLead[] = useMemo(() => {
    const attrMap = new Map(attributions.map(a => [a.lead_id, a]));

    return leads.map(lead => {
      let score = 0;
      const factors: string[] = [];

      // Origin scoring
      const attr = attrMap.get(lead.id);
      if (attr?.fbclid || attr?.utm_source?.includes('facebook')) {
        score += 20;
        factors.push('Meta Ads');
      } else if (attr?.utm_source) {
        score += 20;
        factors.push(attr.utm_source);
      } else if (lead.origin === 'site') {
        score += 15;
        factors.push('Site orgânico');
      } else if (lead.origin === 'indicacao') {
        score += 30;
        factors.push('Indicação');
      }

      // Contact completeness
      if (lead.email) { score += 10; factors.push('Email'); }
      if (lead.phone) { score += 10; factors.push('Telefone'); }

      // Recency (leads created in last 7 days score higher)
      const daysSinceCreation = (Date.now() - new Date(lead.created_at).getTime()) / 86400000;
      if (daysSinceCreation <= 1) { score += 25; factors.push('Hoje'); }
      else if (daysSinceCreation <= 3) { score += 20; factors.push('< 3 dias'); }
      else if (daysSinceCreation <= 7) { score += 15; factors.push('< 7 dias'); }
      else if (daysSinceCreation <= 14) { score += 10; factors.push('< 14 dias'); }

      // Temperature from CRM
      if (lead.lead_temperature === 'quente') { score += 15; }
      else if (lead.lead_temperature === 'morno') { score += 8; }

      // Campaign attribution bonus
      if (attr?.utm_campaign) { score += 5; factors.push('Campanha rastreada'); }

      score = Math.min(100, score);

      return {
        ...lead,
        score,
        factors,
      };
    }).sort((a, b) => b.score - a.score);
  }, [leads, attributions]);

  const getScoreColor = (score: number) => {
    if (score >= 70) return { label: 'Quente', icon: Flame, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30', badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    if (score >= 40) return { label: 'Morno', icon: Thermometer, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
    return { label: 'Frio', icon: Snowflake, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
  };

  const hot = scoredLeads.filter(l => l.score >= 70).length;
  const warm = scoredLeads.filter(l => l.score >= 40 && l.score < 70).length;
  const cold = scoredLeads.filter(l => l.score < 40).length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
              <Flame className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{hot}</p>
              <p className="text-xs text-muted-foreground">Leads Quentes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Thermometer className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{warm}</p>
              <p className="text-xs text-muted-foreground">Leads Mornos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Snowflake className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{cold}</p>
              <p className="text-xs text-muted-foreground">Leads Frios</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lead list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Scoring de Leads
          </CardTitle>
          <CardDescription>
            Classificação automática com base em origem, interação e tempo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scoredLeads.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum lead para classificar</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {scoredLeads.slice(0, 30).map(lead => {
                const sc = getScoreColor(lead.score);
                return (
                  <div key={lead.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/20 transition-colors">
                    <div className={`p-1.5 rounded-lg ${sc.bg}`}>
                      <sc.icon className={`h-4 w-4 ${sc.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{lead.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{lead.email || lead.phone || '—'}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {lead.factors.slice(0, 2).map(f => (
                        <Badge key={f} variant="outline" className="text-[10px] px-1.5 py-0">{f}</Badge>
                      ))}
                      <Badge className={`${sc.badge} text-xs font-bold min-w-[60px] justify-center`}>
                        {lead.score}pts — {sc.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
