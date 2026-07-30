/**
 * FASE 10 — KNOWLEDGE REASONING ENGINE.
 *
 * Este domínio RACIOCINA sobre a estrutura do conhecimento já existente
 * (Facts, Knowledge Objects, Graph). Ele nunca escreve, nunca infere com IA
 * e nunca inventa: todo número aqui é derivado de dados reais em memória.
 *
 * Camada pura: zero React, zero Supabase, zero rede.
 */
import type { IsoDateTime } from "../shared/primitives";

/* ── Tipos de análise ─────────────────────────────────────────────────────── */
export const ANALYSIS_KINDS = [
  "impact",
  "cascade",
  "broken",
  "confidence",
  "coverage",
  "simulation",
  "suggestions",
] as const;
export type AnalysisKind = (typeof ANALYSIS_KINDS)[number];

export const ANALYSIS_KIND_LABEL: Readonly<Record<AnalysisKind, string>> = {
  impact: "Impact Analysis",
  cascade: "Cascade Analysis",
  broken: "Broken Knowledge Detector",
  confidence: "Confidence Engine",
  coverage: "Coverage Analysis",
  simulation: "Change Simulation",
  suggestions: "Knowledge Suggestions",
};

/* ── Severidade compartilhada ─────────────────────────────────────────────── */
export const SEVERITIES = ["critica", "alta", "media", "baixa"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_LABEL: Readonly<Record<Severity, string>> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const SEVERITY_ORDER: Readonly<Record<Severity, number>> = {
  critica: 0,
  alta: 1,
  media: 2,
  baixa: 3,
};

/* ── Registro imutável de execução ────────────────────────────────────────── */
export interface ReasoningRun {
  readonly id: string;
  readonly tipo: AnalysisKind;
  /** Nó/fato analisado, quando a análise tem alvo. */
  readonly alvo?: string;
  readonly alvoRotulo?: string;
  readonly executadoPor: string;
  readonly executadoEm: IsoDateTime;
  /** Duração medida da execução, em milissegundos. */
  readonly duracaoMs: number;
  readonly impactos: number;
  readonly inconsistencias: number;
  readonly resumo: string;
  /** Hash determinístico do resultado — prova de integridade da execução. */
  readonly hash: string;
}

/** Faixa de confiança usada em badges e heatmaps. */
export const confidenceBand = (score: number): Severity =>
  score >= 85 ? "baixa" : score >= 70 ? "media" : score >= 50 ? "alta" : "critica";

export const CONFIDENCE_BAND_LABEL: Readonly<Record<Severity, string>> = {
  baixa: "Sólido",
  media: "Aceitável",
  alta: "Frágil",
  critica: "Crítico",
};