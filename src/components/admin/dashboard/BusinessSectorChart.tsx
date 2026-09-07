import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { DateRange } from './lib/period';
import { formatRate, rate } from './lib/metrics';
import { BlockEmpty, BlockError, BlockSkeleton, DataGapNote, type BlockStatus } from './DashboardStates';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16', '#ec4899'];

interface SectorRow {
  name: string;
  value: number;
  share: number;
}

export function BusinessSectorChart({ range }: { range: DateRange }) {
  const [status, setStatus] = useState<BlockStatus>('loading');
  const [rows, setRows] = useState<SectorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [missing, setMissing] = useState(0);

  const fetchData = useCallback(async () => {
    setStatus('loading');
    try {
      let q = supabase.from('brand_processes').select('business_area');
      if (range.start) q = q.gte('created_at', range.start.toISOString());
      if (range.end) q = q.lt('created_at', range.end.toISOString());
      const { data, error } = await q.limit(5000);
      if (error) throw error;

      const processes = data || [];
      const counts: Record<string, number> = {};
      let empty = 0;

      processes.forEach((p) => {
        const area = (p.business_area || '').trim();
        if (!area) { empty += 1; return; }
        counts[area] = (counts[area] || 0) + 1;
      });

      const informed = processes.length - empty;
      const list = Object.entries(counts)
        .map(([name, value]) => ({ name, value, share: rate(value, informed) ?? 0 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

      setRows(list);
      setTotal(processes.length);
      setMissing(empty);
      setStatus(processes.length === 0 ? 'empty' : 'ready');
    } catch (err) {
      console.warn('[Ramos de atividade] erro:', err);
      setStatus('error');
    }
  }, [range.start, range.end]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const missingPct = rate(missing, total);
  const informed = total - missing;

  return (
    <Card className="border-0 bg-transparent shadow-none h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/25">
            <Briefcase className="h-4 w-4 text-violet-500" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">Ramos de Atividade</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {range.label} · {informed.toLocaleString('pt-BR')} processos com ramo informado
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {status === 'loading' && <BlockSkeleton height={260} />}
        {status === 'error' && <BlockError onRetry={fetchData} height={260} />}
        {status === 'empty' && (
          <BlockEmpty height={260} message="Nenhum processo neste período" hint="Selecione outro período para ver a distribuição por ramo." />
        )}

        {status === 'ready' && (
          <>
            {rows.length === 0 ? (
              <BlockEmpty
                height={200}
                message="Nenhum ramo informado"
                hint={`Os ${total.toLocaleString('pt-BR')} processos do período estão sem ramo de atividade cadastrado.`}
              />
            ) : (
              <ul className="space-y-3" aria-label="Ranking de ramos de atividade">
                {rows.map((row, index) => (
                  <motion.li
                    key={row.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate" title={row.name}>{row.name}</span>
                      <div className="flex items-baseline gap-2 shrink-0">
                        <span className="text-sm font-bold tabular-nums">{row.value.toLocaleString('pt-BR')}</span>
                        <span className="text-[10px] text-muted-foreground">{formatRate(row.share)}</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: COLORS[index % COLORS.length] }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(row.share, 3)}%` }}
                        transition={{ duration: 0.8, delay: 0.1 + index * 0.05 }}
                      />
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}

            {missingPct !== null && missingPct > 0 && (
              <DataGapNote text={`${formatRate(missingPct)} dos processos do período não têm ramo informado (${missing.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}). Isso é lacuna de cadastro, não um segmento.`} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
