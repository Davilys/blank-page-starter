import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import { useMemo } from 'react';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function HeatmapModule() {
  const { data: leads = [] } = useQuery({
    queryKey: ['heatmap-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['heatmap-contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('signed_at')
        .not('signed_at', 'is', null)
        .order('signed_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const heatmapData = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    
    for (const lead of leads) {
      if (!lead.created_at) continue;
      const d = new Date(lead.created_at);
      grid[d.getDay()][d.getHours()]++;
    }
    for (const c of contracts) {
      if (!c.signed_at) continue;
      const d = new Date(c.signed_at);
      grid[d.getDay()][d.getHours()]++;
    }

    return grid;
  }, [leads, contracts]);

  const maxVal = useMemo(() => {
    let max = 0;
    for (const row of heatmapData) {
      for (const v of row) {
        if (v > max) max = v;
      }
    }
    return max || 1;
  }, [heatmapData]);

  const getColor = (val: number) => {
    if (val === 0) return 'bg-muted/20';
    const intensity = val / maxVal;
    if (intensity > 0.75) return 'bg-emerald-500';
    if (intensity > 0.5) return 'bg-emerald-400';
    if (intensity > 0.25) return 'bg-emerald-300 dark:bg-emerald-600';
    return 'bg-emerald-200 dark:bg-emerald-800';
  };

  // Find best hours
  const bestSlots = useMemo(() => {
    const slots: { day: number; hour: number; count: number }[] = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (heatmapData[d][h] > 0) {
          slots.push({ day: d, hour: h, count: heatmapData[d][h] });
        }
      }
    }
    return slots.sort((a, b) => b.count - a.count).slice(0, 5);
  }, [heatmapData]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Heatmap de Horários — Leads e Assinaturas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {leads.length === 0 && contracts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Dados insuficientes</p>
            <p className="text-sm mt-1">O heatmap será preenchido conforme leads e assinaturas forem registrados</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Header with hours */}
                <div className="flex items-center gap-0.5 mb-1 pl-10">
                  {HOURS.map(h => (
                    <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground font-mono">
                      {h.toString().padStart(2, '0')}
                    </div>
                  ))}
                </div>

                {/* Grid rows */}
                {DAYS.map((day, di) => (
                  <div key={day} className="flex items-center gap-0.5 mb-0.5">
                    <div className="w-10 text-xs text-muted-foreground font-medium text-right pr-2">{day}</div>
                    {HOURS.map(h => (
                      <div
                        key={h}
                        className={`flex-1 aspect-square rounded-sm ${getColor(heatmapData[di][h])} transition-colors cursor-default`}
                        title={`${day} ${h}h: ${heatmapData[di][h]} eventos`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 mt-4 justify-center text-xs text-muted-foreground">
              <span>Menos</span>
              <div className="flex gap-0.5">
                <div className="w-3 h-3 rounded-sm bg-muted/20" />
                <div className="w-3 h-3 rounded-sm bg-emerald-200 dark:bg-emerald-800" />
                <div className="w-3 h-3 rounded-sm bg-emerald-300 dark:bg-emerald-600" />
                <div className="w-3 h-3 rounded-sm bg-emerald-400" />
                <div className="w-3 h-3 rounded-sm bg-emerald-500" />
              </div>
              <span>Mais</span>
            </div>

            {/* Best time slots */}
            {bestSlots.length > 0 && (
              <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                <p className="text-xs font-semibold text-foreground mb-2">🏆 Melhores Horários para Anúncios</p>
                <div className="flex flex-wrap gap-2">
                  {bestSlots.map((s, i) => (
                    <span key={i} className="text-xs px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full font-medium">
                      {DAYS[s.day]} {s.hour}h ({s.count} eventos)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
