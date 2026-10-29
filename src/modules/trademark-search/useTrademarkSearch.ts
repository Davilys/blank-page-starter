import { useTrademarkSearchContext } from './TrademarkSearchProvider';
import type { ViabilityResult } from '@/lib/api/viability';
import type { TrademarkSearchJob } from './types';
import { guidance } from '../../../supabase/functions/webmarcas-inpi-search/orientationPort';

/** Hook único do buscador — mesmo estado nos três locais (home, /registrar, área do cliente). */
export function useTrademarkSearch() {
  return useTrademarkSearchContext();
}

/**
 * Adapta o job real para o formato `ViabilityResult` que o checkout (passos 2-6) já consome.
 * Usa a mesma orientação por atividade do laudo, nunca as classes das anterioridades.
 * Uma atividade genérica continua sem prioridade inventada.
 */
export function toViabilityResult(job: TrademarkSearchJob): ViabilityResult {
  const orientation = guidance(job.result?.activity ?? '');
  const suggestions = orientation.steps.filter(step => Number.isInteger(step.class) && step.class! >= 1 && step.class! <= 45);
  const conclusion = job.result?.conclusion;
  const hasOccurrences = conclusion === 'requires_legal_review';
  return {
    success: true,
    level: hasOccurrences ? 'low' : 'medium',
    title: hasOccurrences
      ? 'Foram encontradas ocorrências que exigem análise técnica antes do pedido.'
      : 'Nenhuma ocorrência foi encontrada nos termos pesquisados.',
    description: 'Resultado preliminar. A consulta não substitui análise técnica completa.',
    classes: suggestions.map(step => step.class!),
    classDescriptions: suggestions.map(step => `${step.scope}. ${step.text}`),
    primaryClass: orientation.primary_class,
    searchDate: job.result?.queried_at ?? undefined,
    inpiData: {
      totalResultados: job.result?.records.length ?? 0,
      resultados: (job.result?.records ?? []).map((r) => ({
        processo: r.process,
        marca: r.brand,
        situacao: r.status,
        classe: r.nice ?? '',
        titular: r.holder ?? '',
      })),
      consultadoEm: job.result?.queried_at ?? '',
    },
  };
}
