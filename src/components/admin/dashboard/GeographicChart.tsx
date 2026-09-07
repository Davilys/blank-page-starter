import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { DateRange } from './lib/period';
import { formatRate, rate } from './lib/metrics';
import { BlockEmpty, BlockError, BlockSkeleton, DataGapNote, type BlockStatus } from './DashboardStates';

const BRAZIL_STATES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas',
  BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo',
  GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
  PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina',
  SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16', '#ef4444', '#6366f1', '#f97316'];

type ViewType = 'estados' | 'cidades';

interface GeoRow { name: string; value: number; share: number }

export function GeographicChart({ range }: { range: DateRange }) {
  const [view, setView] = useState<ViewType>('estados');
  const [status, setStatus] = useState<BlockStatus>('loading');
  const [rows, setRows] = useState<GeoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [missing, setMissing] = useState(0);

  const fetchData = useCallback(async () => {
    setStatus('loading');
    try {
      const windowed = <T extends 'leads' | 'profiles'>(table: T) => {
        let q = supabase.from(table).select('state, city');
        if (range.start) q = q.gte('created_at', range.start.toISOString());
        if (range.end) q = q.lt('created_at', range.end.toISOString());
        return q.limit(5000);
      };

      const [leadsRes, profilesRes] = await Promise.all([windowed('leads'), windowed('profiles')]);
      if (leadsRes.error) throw leadsRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const all = [...(leadsRes.data || []), ...(profilesRes.data || [])];
      const counts: Record<string, number> = {};
      let empty = 0;

      all.forEach((item) => {
        const raw = (view === 'estados' ? item.state : item.city) || '';
        const value = raw.trim();
        if (!value) { empty += 1; return; }
        const key = view === 'estados' && value.length === 2
          ? (BRAZIL_STATES[value.toUpperCase()] || value.toUpperCase())
          : value;
        counts[key] = (counts[key] || 0) + 1;
      });

      const informed = all.length - empty;
      const list = Object.entries(counts)
        .map(([name, value]) => ({ name, value, share: rate(value, informed) ?? 0 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      setRows(list);
      setTotal(all.length);
      setMissing(empty);
      setStatus(all.length === 0 ? 'empty' : 'ready');
    } catch (err) {
      console.warn('[Distribuição geográfica] erro:', err);
      setStatus('error');
    }
  }, [range.start, range.end, view]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const missingPct = rate(missing, total);

  return (
    <Card className="border-0 bg-transparent shadow-none h-full">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/25">
              <MapPin className="h-4 w-4 text-blue-500" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Distribuição Geográfica</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{range.label} · leads e clientes</p>
            </div>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as ViewType)}>
            <TabsList className="h-8">
              <TabsTrigger value="estados" className="text-xs gap-1">
                <Building2 className="h-3.5 w-3.5" aria-hidden="true" />Estados
              </TabsTrigger>
              <TabsTrigger value="cidades" className="text-xs gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />Cidades
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent>
        {status === 'loading' && <BlockSkeleton height={260} />}
        {status === 'error' && <BlockError onRetry={fetchData} height={260} />}
        {status === 'empty' && (
          <BlockEmpty height={260} message="Nenhum cadastro neste período" hint="Não há leads nem clientes criados no intervalo selecionado." />
        )}

        {status === 'ready' && (
          <>
            {rows.length === 0 ? (
              <BlockEmpty
                height={200}
                message={view === 'estados' ? 'Nenhum estado informado' : 'Nenhuma cidade informada'}
                hint="Todos os cadastros do período estão sem essa informação."
              />
            ) : (
              <ol className="space-y-2.5" aria-label="Ranking geográfico">
                {rows.map((row, index) => (
                  <motion.li
                    key={row.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">
                        <span className="text-muted-foreground mr-1.5 tabular-nums">{index + 1}.</span>{row.name}
                      </span>
                      <div className="flex items-baseline gap-2 shrink-0">
                        <span className="text-sm font-bold tabular-nums">{row.value.toLocaleString('pt-BR')}</span>
                        <span className="text-[10px] text-muted-foreground">{formatRate(row.share)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: COLORS[index % COLORS.length] }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(row.share, 2)}%` }}
                        transition={{ duration: 0.8, delay: 0.08 + index * 0.04 }}
                      />
                    </div>
                  </motion.li>
                ))}
              </ol>
            )}

            {missingPct !== null && missingPct > 0 && (
              <DataGapNote text={`${formatRate(missingPct)} dos cadastros do período estão sem ${view === 'estados' ? 'estado' : 'cidade'} (${missing.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}).`} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
