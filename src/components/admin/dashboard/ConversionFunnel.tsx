import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, Users, FileCheck, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { DateRange } from './lib/period';
import { chunk, formatRate, funnelInsight, rate } from './lib/metrics';
import { BlockEmpty, BlockError, BlockSkeleton, InfoTip, type BlockStatus } from './DashboardStates';

const DONE_STATUSES = ['registrada', 'certificado', 'certificados', 'deferimento'];

interface Cohort {
  leads: number;
  clients: number;
  contracts: number;
  completed: number;
}

const EMPTY: Cohort = { leads: 0, clients: 0, contracts: 0, completed: 0 };

async function loadCohort(start: Date | null, end: Date | null): Promise<Cohort> {
  let q = supabase.from('leads').select('id, converted_to_client_id');
  if (start) q = q.gte('created_at', start.toISOString());
  if (end) q = q.lt('created_at', end.toISOString());
  const { data: leads, error } = await q.limit(5000);
  if (error) throw error;

  const rows = leads || [];
  const leadIds = rows.map((l) => l.id);
  const clientIds = Array.from(
    new Set(rows.map((l) => l.converted_to_client_id).filter((v): v is string => !!v)),
  );

  let contracts = 0;
  for (const part of chunk(leadIds)) {
    const { count, error: e } = await supabase
      .from('contracts')
      .select('id', { count: 'exact', head: true })
      .in('lead_id', part);
    if (e) throw e;
    contracts += count || 0;
  }

  let completed = 0;
  for (const part of chunk(clientIds)) {
    const { count, error: e } = await supabase
      .from('brand_processes')
      .select('id', { count: 'exact', head: true })
      .in('user_id', part)
      .in('status', DONE_STATUSES);
    if (e) throw e;
    completed += count || 0;
  }

  return { leads: rows.length, clients: clientIds.length, contracts, completed };
}

export function ConversionFunnel({ range }: { range: DateRange }) {
  const [status, setStatus] = useState<BlockStatus>('loading');
  const [cohort, setCohort] = useState<Cohort>(EMPTY);
  const [prevConversion, setPrevConversion] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setStatus('loading');
    try {
      const current = await loadCohort(range.start, range.end);
      setCohort(current);

      if (range.prevStart) {
        const prev = await loadCohort(range.prevStart, range.prevEnd);
        setPrevConversion(rate(prev.clients, prev.leads));
      } else {
        setPrevConversion(null);
      }

      setStatus(current.leads === 0 ? 'empty' : 'ready');
    } catch (err) {
      console.warn('[Funil] erro ao carregar coorte:', err);
      setStatus('error');
    }
  }, [range.start, range.end, range.prevStart, range.prevEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const conversion = rate(cohort.clients, cohort.leads);

  const steps = [
    {
      name: 'Leads do período', value: cohort.leads, icon: Target,
      color: '#3b82f6', pct: 100, stepRate: null as number | null, stepLabel: '',
      tip: 'Leads criados dentro do período selecionado.',
    },
    {
      name: 'Convertidos em cliente', value: cohort.clients, icon: Users,
      color: '#8b5cf6', pct: rate(cohort.clients, cohort.leads) ?? 0,
      stepRate: rate(cohort.clients, cohort.leads), stepLabel: 'Lead → Cliente',
      tip: 'Leads deste período que possuem um cliente vinculado no cadastro.',
    },
    {
      name: 'Com contrato', value: cohort.contracts, icon: FileCheck,
      color: '#f59e0b', pct: rate(cohort.contracts, cohort.leads) ?? 0,
      stepRate: rate(cohort.contracts, cohort.clients), stepLabel: 'Cliente → Contrato',
      tip: 'Contratos ligados diretamente a estes leads.',
    },
    {
      name: 'Processos concluídos', value: cohort.completed, icon: CheckCircle,
      color: '#10b981', pct: rate(cohort.completed, cohort.leads) ?? 0,
      stepRate: rate(cohort.completed, cohort.contracts), stepLabel: 'Contrato → Concluído',
      tip: 'Processos destes clientes já registrados ou deferidos.',
    },
  ];

  return (
    <Card className="border-0 bg-transparent shadow-none h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold">Funil de Conversão</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Coorte de {range.label.toLowerCase()}</p>
          </div>
          <div className="text-right shrink-0">
            <InfoTip text="Clientes convertidos ÷ leads recebidos no período. Só considera leads com cliente vinculado.">
              <p className={cn('text-2xl font-black tabular-nums', conversion === null ? 'text-muted-foreground' : 'text-emerald-500')}>
                {formatRate(conversion)}
              </p>
            </InfoTip>
            <p className="text-[10px] text-muted-foreground font-medium">Conversão</p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {status === 'loading' && <BlockSkeleton height={300} rows={4} />}

        {status === 'error' && <BlockError onRetry={fetchData} height={300} />}

        {status === 'empty' && (
          <BlockEmpty
            height={300}
            message="Sem leads neste período"
            hint="Sem entrada de leads não é possível calcular uma conversão real. Escolha outro período para comparar."
          />
        )}

        {status === 'ready' && (
          <>
            <div className="space-y-4">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const width = Math.max(step.pct, 4);
                return (
                  <motion.div
                    key={step.name}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.08 }}
                  >
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
                          style={{ background: `${step.color}1f`, border: `1px solid ${step.color}33` }}
                        >
                          <Icon className="h-3.5 w-3.5" style={{ color: step.color }} aria-hidden="true" />
                        </div>
                        <InfoTip text={step.tip}>
                          <span className="text-sm font-medium truncate">{step.name}</span>
                        </InfoTip>
                      </div>
                      <div className="flex items-baseline gap-2 shrink-0">
                        <span className="text-sm font-bold tabular-nums">{step.value.toLocaleString('pt-BR')}</span>
                        {index > 0 && (
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {step.stepLabel}: {formatRate(step.stepRate)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="relative h-2.5 bg-muted/60 rounded-full overflow-hidden">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ background: step.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{ duration: 0.9, delay: 0.15 + index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-5 p-3 rounded-xl border border-border/60 bg-muted/30">
              <p className="text-xs font-semibold mb-1 text-foreground">Leitura do período</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {funnelInsight({
                  leads: cohort.leads,
                  clients: cohort.clients,
                  conversion,
                  conversionPrev: prevConversion,
                  contracts: cohort.contracts,
                })}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
