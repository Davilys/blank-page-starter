import { useTrademarkSearchContext } from './TrademarkSearchProvider';
import type { ViabilityResult } from '@/lib/api/viability';
import type { TrademarkSearchJob } from './types';

/** Hook único do buscador — mesmo estado nos três locais (home, /registrar, área do cliente). */
export function useTrademarkSearch() {
  return useTrademarkSearchContext();
}

/**
 * Adapta o job real para o formato `ViabilityResult` que o checkout (passos 2-6) já consome.
 * Só `classes`/`classDescriptions` são lidos pelo checkout; ficam vazios porque a API não os retorna
 * (o BrandDataStep já trata esse caso). `level` é preenchido apenas por compatibilidade de tipo.
 */
export function toViabilityResult(job: TrademarkSearchJob): ViabilityResult {
  const conclusion = job.result?.conclusion;
  const hasOccurrences = conclusion === 'requires_legal_review';
  return {
    success: true,
    level: hasOccurrences ? 'low' : 'medium',
    title: hasOccurrences
      ? 'Foram encontradas ocorrências que exigem análise técnica antes do pedido.'
      : 'Nenhuma ocorrência foi encontrada nos termos pesquisados.',
    description: 'Resultado preliminar. A consulta não substitui análise técnica completa.',
    classes: [],
    classDescriptions: [],
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
