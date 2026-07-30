/**
 * FASE 12 — KNOWLEDGE OBSERVATORY ENGINE.
 *
 * Mede continuamente qualidade, cobertura, consistência e autoridade do
 * conhecimento publicado.
 *
 * Regras inegociáveis:
 *  - Somente leitura: nenhuma análise altera rascunho, publicação ou fato.
 *  - Sem IA generativa e sem scraping: apenas sinais internos e verificações
 *    estruturais determinísticas.
 *  - Auditoria imutável: cada execução gera um registro append-only selado
 *    por hash.
 *
 * Camada pura: zero React, zero Supabase, zero rede.
 */
import type { KnowledgeDraft } from "../factory/KnowledgeDraft";
import type { KnowledgeVersion } from "../memory/KnowledgeVersion";
import type {
  PublicationAuditRecord,
  PublishedVersion,
} from "../publishing/Publication";
import type { IsoDateTime } from "../shared/primitives";

/* ── Entrada única de todos os engines ────────────────────────────────────── */

/**
 * Fotografia somente-leitura do estado do Knowledge OS. Todos os engines
 * recebem exatamente este objeto — nenhum deles acessa I/O.
 */
export interface ObservatorySnapshot {
  readonly rascunhos: readonly KnowledgeDraft[];
  readonly publicacoes: readonly PublishedVersion[];
  readonly auditoriaPublicacao: readonly PublicationAuditRecord[];
  readonly historico: readonly KnowledgeVersion[];
  readonly agora: IsoDateTime;
}

export const emptySnapshot = (agora: IsoDateTime): ObservatorySnapshot => ({
  rascunhos: [],
  publicacoes: [],
  auditoriaPublicacao: [],
  historico: [],
  agora,
});

/* ── Severidade e faixas ──────────────────────────────────────────────────── */

export const SEVERITIES = ["critico", "alerta", "informativo"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_LABEL: Readonly<Record<Severity, string>> = {
  critico: "Crítico",
  alerta: "Alerta",
  informativo: "Informativo",
};

export const SEVERITY_WEIGHT: Readonly<Record<Severity, number>> = {
  critico: 8,
  alerta: 3,
  informativo: 1,
};

export type ScoreBand = "critico" | "atencao" | "saudavel";

export const scoreBand = (score: number): ScoreBand =>
  score >= 80 ? "saudavel" : score >= 50 ? "atencao" : "critico";

export const SCORE_BAND_LABEL: Readonly<Record<ScoreBand, string>> = {
  saudavel: "Saudável",
  atencao: "Atenção",
  critico: "Crítico",
};

/** Normaliza para inteiro 0..100. Nenhum score é atribuído à mão. */
export const clampScore = (v: number): number =>
  Math.max(0, Math.min(100, Number.isFinite(v) ? Math.round(v) : 0));

/** Razão segura (0 quando não há denominador) já em escala 0..100. */
export const ratioScore = (parte: number, total: number): number =>
  total <= 0 ? 0 : clampScore((parte / total) * 100);

/** Média aritmética de scores, arredondada. */
export const averageScore = (valores: readonly number[]): number =>
  valores.length === 0
    ? 0
    : clampScore(valores.reduce((a, b) => a + b, 0) / valores.length);

/** Média ponderada — usada pelo Knowledge Health Score. */
export const weightedScore = (
  partes: readonly { readonly valor: number; readonly peso: number }[],
): number => {
  const pesoTotal = partes.reduce((a, p) => a + p.peso, 0);
  if (pesoTotal <= 0) return 0;
  return clampScore(
    partes.reduce((a, p) => a + clampScore(p.valor) * p.peso, 0) / pesoTotal,
  );
};

/* ── Dimensões medidas ────────────────────────────────────────────────────── */

export const OBSERVATORY_DIMENSIONS = [
  "coverage",
  "consistency",
  "freshness",
  "publication",
  "linking",
  "schema",
  "entity",
  "fact",
  "graph",
] as const;
export type ObservatoryDimension = (typeof OBSERVATORY_DIMENSIONS)[number];

export const DIMENSION_LABEL: Readonly<Record<ObservatoryDimension, string>> = {
  coverage: "Coverage Score",
  consistency: "Consistency Score",
  freshness: "Freshness Score",
  publication: "Publication Score",
  linking: "Internal Linking Score",
  schema: "Schema Score",
  entity: "Entity Score",
  fact: "Fact Score",
  graph: "Graph Score",
};

/** Pesos do índice geral. Somam 100 e são explícitos por governança. */
export const DIMENSION_WEIGHT: Readonly<Record<ObservatoryDimension, number>> = {
  coverage: 15,
  consistency: 20,
  freshness: 12,
  publication: 15,
  linking: 8,
  schema: 10,
  entity: 8,
  fact: 8,
  graph: 4,
};

/* ── Achados ──────────────────────────────────────────────────────────────── */

export interface ObservatoryFinding {
  readonly id: string;
  readonly dimensao: ObservatoryDimension;
  readonly severidade: Severity;
  readonly titulo: string;
  readonly detalhe: string;
  readonly objetoId?: string;
  readonly slug?: string;
  readonly entidadeId?: string;
}

/** Penalidade estrutural (0..100) derivada dos achados sobre uma população. */
export const penaltyScore = (
  achados: readonly ObservatoryFinding[],
  universo: number,
): number => {
  if (universo <= 0) return 0;
  const peso = achados.reduce((a, f) => a + SEVERITY_WEIGHT[f.severidade], 0);
  return clampScore(100 - (peso / (universo * SEVERITY_WEIGHT.critico)) * 100);
};

/* ── Auditoria imutável ───────────────────────────────────────────────────── */

export const OBSERVATORY_ACTIONS = [
  "analise-completa",
  "relatorio",
  "exportacao",
] as const;
export type ObservatoryAction = (typeof OBSERVATORY_ACTIONS)[number];

export const OBSERVATORY_ACTION_LABEL: Readonly<Record<ObservatoryAction, string>> = {
  "analise-completa": "Análise completa",
  relatorio: "Relatório",
  exportacao: "Exportação",
};

export interface ObservatoryAuditRecord {
  readonly id: string;
  readonly acao: ObservatoryAction;
  readonly autorId: string;
  readonly registradoEm: IsoDateTime;
  readonly duracaoMs: number;
  readonly hash: string;
  readonly healthScore: number;
  readonly totalAchados: number;
  readonly criticos: number;
  readonly sucesso: boolean;
  readonly mensagem: string;
}

/** Tempo médio de execução, em ms, a partir da auditoria. */
export const averageDuration = (
  registros: readonly ObservatoryAuditRecord[],
): number =>
  registros.length === 0
    ? 0
    : Math.round(registros.reduce((a, r) => a + r.duracaoMs, 0) / registros.length);

/* ── Utilitários de tempo (puros) ─────────────────────────────────────────── */

export const daysBetween = (de: string, ate: string): number => {
  const a = new Date(de).getTime();
  const b = new Date(ate).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.floor((b - a) / 86_400_000));
};