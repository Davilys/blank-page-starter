// Cálculos determinísticos do Dashboard. Sem acesso a rede, sem JSX.

export type Variation =
  | { kind: 'pct'; value: number }
  | { kind: 'new' }        // período anterior = 0 e atual > 0
  | { kind: 'none' };      // sem base de comparação

export function variation(current: number, previous: number): Variation {
  if (previous > 0) {
    return { kind: 'pct', value: Math.round(((current - previous) / previous) * 1000) / 10 };
  }
  if (current > 0) return { kind: 'new' };
  return { kind: 'none' };
}

export function variationLabel(v: Variation): string {
  if (v.kind === 'pct') return `${v.value > 0 ? '+' : ''}${v.value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  if (v.kind === 'new') return 'Novo';
  return 'Sem dados';
}

export function variationTone(v: Variation): 'up' | 'down' | 'flat' {
  if (v.kind !== 'pct') return 'flat';
  if (v.value > 0) return 'up';
  if (v.value < 0) return 'down';
  return 'flat';
}

/** Taxa segura: retorna null quando não há denominador (≠ de zero real) */
export function rate(numerator: number, denominator: number): number | null {
  if (!denominator || denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function formatRate(value: number | null): string {
  return value === null ? '—' : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

export function formatBRL(value: number, opts: { compact?: boolean } = {}): string {
  if (opts.compact && Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
  }
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export function formatInt(value: number): string {
  return value.toLocaleString('pt-BR');
}

// ── Qualidade de dados ────────────────────────────────
export interface QualityItem {
  label: string;
  filled: number;
  total: number;
  /** percentual de completude, null quando não há registros */
  pct: number | null;
  hint?: string;
}

export function quality(label: string, filled: number, total: number, hint?: string): QualityItem {
  return { label, filled, total, pct: rate(filled, total), hint };
}

// ── Alertas executivos ────────────────────────────────
export type AlertLevel = 'critical' | 'warning' | 'attention' | 'positive';

export interface ExecutiveAlert {
  id: string;
  level: AlertLevel;
  title: string;
  detail: string;
}

export interface AlertInput {
  pendingInvoices: number;
  overdueInvoices: number;
  paidInvoices: number;
  conversion: number | null;
  conversionPrev: number | null;
  revenue: number;
  revenuePrev: number;
  leadsPeriod: number;
  missingOriginPct: number | null;
  missingSectorPct: number | null;
  missingStatePct: number | null;
}

export function buildAlerts(input: AlertInput): ExecutiveAlert[] {
  const alerts: ExecutiveAlert[] = [];

  const openTotal = input.pendingInvoices + input.overdueInvoices;
  if (input.overdueInvoices > 0 && openTotal > 0) {
    const share = rate(input.overdueInvoices, openTotal + input.paidInvoices);
    if (input.overdueInvoices >= 50 || (share !== null && share >= 25)) {
      alerts.push({
        id: 'faturas-vencidas',
        level: 'critical',
        title: `${formatInt(input.overdueInvoices)} faturas vencidas`,
        detail: `Além delas há ${formatInt(input.pendingInvoices)} faturas em aberto aguardando pagamento.`,
      });
    }
  }

  if (input.conversion !== null && input.conversionPrev !== null && input.conversionPrev > 0) {
    const delta = input.conversion - input.conversionPrev;
    if (delta <= -5) {
      alerts.push({
        id: 'conversao-queda',
        level: 'warning',
        title: `Conversão caiu ${Math.abs(Math.round(delta * 10) / 10).toLocaleString('pt-BR')} pontos`,
        detail: `Passou de ${formatRate(input.conversionPrev)} para ${formatRate(input.conversion)} na etapa lead → cliente.`,
      });
    } else if (delta >= 5) {
      alerts.push({
        id: 'conversao-alta',
        level: 'positive',
        title: `Conversão subiu ${(Math.round(delta * 10) / 10).toLocaleString('pt-BR')} pontos`,
        detail: `De ${formatRate(input.conversionPrev)} para ${formatRate(input.conversion)} na etapa lead → cliente.`,
      });
    }
  }

  if (input.leadsPeriod === 0) {
    alerts.push({
      id: 'sem-leads',
      level: 'warning',
      title: 'Nenhum lead recebido no período',
      detail: 'Sem entrada de leads não há base para calcular conversão comercial deste período.',
    });
  }

  if (input.missingOriginPct !== null && input.missingOriginPct >= 20) {
    alerts.push({
      id: 'origem-vazia',
      level: 'attention',
      title: `${formatRate(input.missingOriginPct)} dos leads sem origem informada`,
      detail: 'Preencher a origem permite medir o retorno de cada canal.',
    });
  }

  if (input.missingSectorPct !== null && input.missingSectorPct >= 20) {
    alerts.push({
      id: 'ramo-vazio',
      level: 'attention',
      title: `${formatRate(input.missingSectorPct)} dos processos sem ramo de atividade`,
      detail: 'É uma lacuna de cadastro, não um segmento de mercado.',
    });
  }

  if (input.missingStatePct !== null && input.missingStatePct >= 20) {
    alerts.push({
      id: 'uf-vazia',
      level: 'attention',
      title: `${formatRate(input.missingStatePct)} dos cadastros sem estado`,
      detail: 'A distribuição geográfica fica incompleta enquanto o campo não for preenchido.',
    });
  }

  if (input.revenuePrev > 0 && input.revenue > input.revenuePrev) {
    alerts.push({
      id: 'receita-cresceu',
      level: 'positive',
      title: 'Receita acima do período anterior',
      detail: `${formatBRL(input.revenue)} contra ${formatBRL(input.revenuePrev)} no período anterior.`,
    });
  }

  return alerts;
}

// ── Insight do funil, baseado em dados ────────────────
export function funnelInsight(args: {
  leads: number;
  clients: number;
  conversion: number | null;
  conversionPrev: number | null;
  contracts: number;
}): string {
  if (args.leads === 0) {
    return 'Nenhum lead entrou neste período, então não há conversão a analisar. Selecione outro período para comparar.';
  }
  if (args.conversion === null) {
    return 'Ainda não há dados suficientes para gerar uma conclusão confiável sobre a conversão.';
  }
  if (args.conversionPrev !== null && args.conversionPrev > 0) {
    const delta = Math.round((args.conversion - args.conversionPrev) * 10) / 10;
    if (delta <= -1) {
      return `Conversão caiu ${Math.abs(delta).toLocaleString('pt-BR')} pontos frente ao período anterior (${formatRate(args.conversionPrev)} → ${formatRate(args.conversion)}). O ponto de atenção está na passagem de lead para cliente.`;
    }
    if (delta >= 1) {
      return `Conversão subiu ${delta.toLocaleString('pt-BR')} pontos frente ao período anterior (${formatRate(args.conversionPrev)} → ${formatRate(args.conversion)}), com crescimento na etapa lead → cliente.`;
    }
    return `Conversão estável em ${formatRate(args.conversion)}, praticamente no mesmo patamar do período anterior.`;
  }
  return `${args.clients} de ${args.leads} leads viraram cliente neste período (${formatRate(args.conversion)}). Ainda não há período anterior comparável.`;
}

/** Divide uma lista de ids em lotes, para consultas .in() seguras */
export function chunk<T>(items: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
