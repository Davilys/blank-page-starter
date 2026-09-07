import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gauge } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatRate, quality, type QualityItem } from './lib/metrics';
import { BlockError, BlockSkeleton, InfoTip, type BlockStatus } from './DashboardStates';

type Table = 'leads' | 'profiles' | 'brand_processes';

// Cast evita explosão de tipos genéricos do PostgREST ao parametrizar tabela/coluna.
type LooseClient = {
  from: (table: string) => {
    select: (cols: string, opts: { count: 'exact'; head: true }) => {
      not: (col: string, op: string, val: null) => { neq: (col: string, val: string) => Promise<{ count: number | null; error: unknown }> };
    } & Promise<{ count: number | null; error: unknown }>;
  };
};
const db = supabase as unknown as LooseClient;

const countAll = (table: Table): Promise<{ count: number | null; error: unknown }> =>
  db.from(table).select('id', { count: 'exact', head: true });

const countFilled = (table: Table, column: string): Promise<{ count: number | null; error: unknown }> =>
  db.from(table).select('id', { count: 'exact', head: true }).not(column, 'is', null).neq(column, '');

export interface QualitySummary {
  missingOriginPct: number | null;
  missingSectorPct: number | null;
  missingStatePct: number | null;
}

export function DataQualityPanel({ onSummary }: { onSummary?: (s: QualitySummary) => void }) {
  const [status, setStatus] = useState<BlockStatus>('loading');
  const [items, setItems] = useState<QualityItem[]>([]);

  const fetchData = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await Promise.all([
        countAll('leads'),
        countFilled('leads', 'origin'),
        countFilled('leads', 'phone'),
        countAll('brand_processes'),
        countFilled('brand_processes', 'business_area'),
        countAll('profiles'),
        countFilled('profiles', 'state'),
        countFilled('profiles', 'cpf_cnpj'),
      ]);

      const errored = res.find((r) => r.error);
      if (errored?.error) throw errored.error;

      const c = res.map((r) => r.count || 0);
      const [leads, leadsOrigin, leadsPhone, processes, processesArea, profiles, profilesState, profilesDoc] = c;

      setItems([
        quality('Leads com origem informada', leadsOrigin, leads, 'Permite medir o retorno por canal.'),
        quality('Leads com telefone', leadsPhone, leads, 'Essencial para o contato comercial.'),
        quality('Processos com ramo de atividade', processesArea, processes, 'Base para análise por segmento.'),
        quality('Clientes com estado', profilesState, profiles, 'Base para a distribuição geográfica.'),
        quality('Clientes com CPF/CNPJ', profilesDoc, profiles, 'Necessário para contratos e cobranças.'),
      ]);

      onSummary?.({
        missingOriginPct: leads > 0 ? Math.round(((leads - leadsOrigin) / leads) * 1000) / 10 : null,
        missingSectorPct: processes > 0 ? Math.round(((processes - processesArea) / processes) * 1000) / 10 : null,
        missingStatePct: profiles > 0 ? Math.round(((profiles - profilesState) / profiles) * 1000) / 10 : null,
      });

      setStatus('ready');
    } catch (err) {
      console.warn('[Qualidade dos dados] erro:', err);
      setStatus('error');
    }
    // onSummary intencionalmente fora das dependências: evita refetch por identidade de função
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const barColor = (pct: number | null) => {
    if (pct === null) return '#94a3b8';
    if (pct >= 80) return '#10b981';
    if (pct >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <Card className="border border-border/50 bg-card/60 backdrop-blur-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/25">
            <Gauge className="h-4 w-4 text-sky-500" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">Qualidade dos Dados</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Completude do cadastro — base inteira</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {status === 'loading' && <BlockSkeleton height={200} rows={5} />}
        {status === 'error' && <BlockError onRetry={fetchData} height={200} />}
        {status === 'ready' && (
          <ul className="space-y-3">
            {items.map((item, index) => (
              <motion.li
                key={item.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <InfoTip text={item.hint || item.label}>
                    <span className="text-xs font-medium truncate">{item.label}</span>
                  </InfoTip>
                  <span className="text-xs font-bold tabular-nums" style={{ color: barColor(item.pct) }}>
                    {formatRate(item.pct)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: barColor(item.pct) }}
                    initial={{ width: 0 }}
                    animate={{ width: `${item.pct ?? 0}%` }}
                    transition={{ duration: 0.8, delay: 0.1 + index * 0.05 }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  {item.filled.toLocaleString('pt-BR')} de {item.total.toLocaleString('pt-BR')} registros
                </p>
              </motion.li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
