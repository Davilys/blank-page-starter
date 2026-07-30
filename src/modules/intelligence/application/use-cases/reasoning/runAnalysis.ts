/**
 * FASE 10 — Casos de uso do Reasoning Engine (CQRS: só queries).
 *
 * Toda execução é cronometrada, hasheada e registrada na auditoria imutável.
 * Nenhum caso de uso escreve no conhecimento — apenas no log de execução.
 */
import type {
  KnowledgeSnapshotProvider,
  ReasoningAuditRepository,
} from "../../ports/reasoning";
import type { NodeId } from "../../../domain/graph/GraphNode";
import {
  detectBrokenKnowledge,
  type BrokenReport,
} from "../../../domain/reasoning/broken";
import {
  computeConfidence,
  type ConfidenceReportSummary,
} from "../../../domain/reasoning/confidence";
import { analyzeCoverage, type CoverageReport } from "../../../domain/reasoning/coverage";
import { analyzeImpactOn, type ImpactAnalysis } from "../../../domain/reasoning/impact";
import {
  simulateChange,
  type CascadeReport,
  type SimulationKind,
} from "../../../domain/reasoning/cascade";
import {
  generateSuggestions,
  type KnowledgeSuggestion,
} from "../../../domain/reasoning/suggestions";
import { stableHash } from "../../../domain/reasoning/hash";
import type { AnalysisKind, ReasoningRun } from "../../../domain/reasoning/Reasoning";
import { buildIndex, type ReasoningSnapshot, type SnapshotIndex } from "../../../domain/reasoning/snapshot";
import { asIsoDateTime, err, ok, type Page, type Result } from "../../../domain/shared/primitives";

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export interface AnalysisEnvelope<T> {
  readonly resultado: T;
  readonly execucao: ReasoningRun;
}

interface RunContext {
  readonly snapshot: ReasoningSnapshot;
  readonly index: SnapshotIndex;
}

/** Executa uma análise medindo tempo, selando hash e auditando. */
const makeRunner =
  (provider: KnowledgeSnapshotProvider, audit: ReasoningAuditRepository) =>
  async <T>(
    tipo: AnalysisKind,
    executadoPor: string,
    compute: (ctx: RunContext) => T | null,
    meta: (r: T) => {
      readonly impactos: number;
      readonly inconsistencias: number;
      readonly resumo: string;
      readonly alvo?: string;
      readonly alvoRotulo?: string;
    },
  ): Promise<Result<AnalysisEnvelope<T>>> => {
    const autor = (executadoPor ?? "").trim() || "sistema";
    const inicio = now();

    const s = await provider.load();
    if (!s.ok) return err<AnalysisEnvelope<T>>(s.error as string);
    const snapshot = s.value as ReasoningSnapshot;
    const index = buildIndex(snapshot);

    const resultado = compute({ snapshot, index });
    if (resultado === null || resultado === undefined) {
      return err<AnalysisEnvelope<T>>("Alvo não encontrado no grafo de conhecimento.");
    }

    const m = meta(resultado);
    const execucao: ReasoningRun = {
      id: newId(),
      tipo,
      alvo: m.alvo,
      alvoRotulo: m.alvoRotulo,
      executadoPor: autor,
      executadoEm: asIsoDateTime(new Date()),
      duracaoMs: Math.max(0, Math.round(now() - inicio)),
      impactos: m.impactos,
      inconsistencias: m.inconsistencias,
      resumo: m.resumo,
      hash: stableHash({ tipo, alvo: m.alvo ?? null, resultado }),
    };

    await audit.append(execucao);
    return ok({ resultado, execucao });
  };

export const makeReasoningUseCases = (
  provider: KnowledgeSnapshotProvider,
  audit: ReasoningAuditRepository,
) => {
  const run = makeRunner(provider, audit);

  const analyzeImpact = (id: string, executadoPor: string, profundidade = 4) =>
    run<ImpactAnalysis>(
      "impact",
      executadoPor,
      ({ index }) => analyzeImpactOn(index, id as NodeId, profundidade),
      (r) => ({
        impactos: r.atingidos.length,
        inconsistencias: r.relacoesDependentes.filter((e) => e.status === "invalida").length,
        resumo: `${r.atingidos.length} nó(s) atingido(s) até profundidade ${r.profundidadeMaxima}.`,
        alvo: String(r.alvo.id),
        alvoRotulo: r.alvo.rotulo,
      }),
    );

  const simulate = (
    id: string,
    executadoPor: string,
    tipo: SimulationKind = "alteracao",
  ) =>
    run<CascadeReport>(
      tipo === "alteracao" ? "cascade" : "simulation",
      executadoPor,
      ({ index }) => simulateChange(index, id as NodeId, tipo),
      (r) => ({
        impactos: r.totalAfetados,
        inconsistencias: 0,
        resumo: `Simulação (${r.tipo}): ${r.ondas.length} onda(s), ${r.totalAfetados} afetado(s).`,
        alvo: String(r.alvo.id),
        alvoRotulo: r.alvo.rotulo,
      }),
    );

  const detectBroken = (executadoPor: string) =>
    run<BrokenReport>(
      "broken",
      executadoPor,
      ({ snapshot, index }) => detectBrokenKnowledge(snapshot, index),
      (r) => ({
        impactos: 0,
        inconsistencias: r.total,
        resumo: `${r.total} inconsistência(s), ${r.criticas} crítica(s).`,
      }),
    );

  const confidence = (executadoPor: string) =>
    run<ConfidenceReportSummary>(
      "confidence",
      executadoPor,
      ({ snapshot, index }) => computeConfidence(snapshot, index),
      (r) => ({
        impactos: r.objetos.length,
        inconsistencias: r.criticos,
        resumo: `Confiança média ${r.media}% em ${r.objetos.length} objeto(s).`,
      }),
    );

  const coverage = (executadoPor: string) =>
    run<CoverageReport>(
      "coverage",
      executadoPor,
      ({ snapshot, index }) => analyzeCoverage(snapshot, index),
      (r) => ({
        impactos: r.entidades.length,
        inconsistencias: r.comLacunas,
        resumo: `Cobertura média ${r.coberturaMedia}% · ${r.comLacunas} entidade(s) com lacuna.`,
      }),
    );

  const suggestions = (executadoPor: string) =>
    run<readonly KnowledgeSuggestion[]>(
      "suggestions",
      executadoPor,
      ({ snapshot, index }) => {
        const broken = detectBrokenKnowledge(snapshot, index);
        const conf = computeConfidence(snapshot, index);
        const cov = analyzeCoverage(snapshot, index);
        return generateSuggestions(snapshot, broken, conf, cov);
      },
      (r) => ({
        impactos: r.length,
        inconsistencias: r.filter((s) => s.prioridade === "critica").length,
        resumo: `${r.length} sugestão(ões) estrutural(is) gerada(s).`,
      }),
    );

  const listAudit = async (limit = 100): Promise<Result<Page<ReasoningRun>>> =>
    audit.list(limit);

  return {
    analyzeImpact,
    simulate,
    detectBroken,
    confidence,
    coverage,
    suggestions,
    listAudit,
  };
};

export type ReasoningUseCases = ReturnType<typeof makeReasoningUseCases>;