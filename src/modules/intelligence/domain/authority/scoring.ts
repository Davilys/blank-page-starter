/**
 * Authority & Trust scoring contracts (FASE 02 §1/§3, FASE 03 Artigo 9).
 *
 * FASE 05 ships the CONTRACT and the pure aggregation maths only. Real signal
 * collection (sources, crawlers, reasoning) arrives in later phases.
 * Weights live here so they are reviewed in one place, never scattered.
 */
import { asScore, type Score } from "../shared/primitives";

/** Explainable breakdown — every point must be traceable (FASE 02 §3). */
export interface ScoreComponent {
  readonly chave: string;
  readonly rotulo: string;
  readonly valor: number; // 0..1
  readonly peso: number; // 0..1
}

export interface ScoreBreakdown {
  readonly total: Score;
  readonly componentes: readonly ScoreComponent[];
}

/** Knowledge Authority Score weights (FASE 02, Artigo 3). Sum = 1. */
export const KAS_WEIGHTS = {
  frescor: 0.18,
  quantidadeFontes: 0.12,
  qualidadeFontes: 0.18,
  profundidade: 0.12,
  cobertura: 0.1,
  relacionamentos: 0.1,
  consistencia: 0.1,
  historico: 0.05,
  validacaoHumana: 0.05,
} as const;

/** Weighted aggregation. Pure — trivially unit-testable. */
export const aggregate = (componentes: readonly ScoreComponent[]): ScoreBreakdown => {
  const pesoTotal = componentes.reduce((acc, c) => acc + c.peso, 0);
  const bruto =
    pesoTotal === 0
      ? 0
      : componentes.reduce((acc, c) => acc + c.valor * c.peso, 0) / pesoTotal;
  return { total: asScore(bruto * 100), componentes };
};

/**
 * Weakest-link ceiling: an aggregate may never exceed a critical weak
 * component, so a good average can never hide a serious defect (FASE 02 §1).
 */
export const applyWeakestLink = (breakdown: ScoreBreakdown, teto: Score): ScoreBreakdown => ({
  ...breakdown,
  total: asScore(Math.min(breakdown.total, teto)),
});

/** Exponential freshness decay against the topic's half-life. */
export const freshness = (idadeDias: number, meiaVidaDias: number): number =>
  meiaVidaDias <= 0 ? 0 : Math.exp(-idadeDias / meiaVidaDias);

/** Log-saturated source count — saturates around six sources. */
export const sourceVolume = (n: number): number =>
  Math.min(1, Math.log(1 + Math.max(0, n)) / Math.log(7));