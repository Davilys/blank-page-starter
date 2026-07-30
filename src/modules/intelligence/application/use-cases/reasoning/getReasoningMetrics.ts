/** Painel executivo do Reasoning Engine — todos os números são calculados. */
import type {
  KnowledgeSnapshotProvider,
  ReasoningAuditRepository,
} from "../../ports/reasoning";
import { detectBrokenKnowledge } from "../../../domain/reasoning/broken";
import { computeConfidence } from "../../../domain/reasoning/confidence";
import { analyzeCoverage } from "../../../domain/reasoning/coverage";
import type { ReasoningRun } from "../../../domain/reasoning/Reasoning";
import { buildIndex, type ReasoningSnapshot } from "../../../domain/reasoning/snapshot";
import { err, ok, type Page, type Result } from "../../../domain/shared/primitives";

export interface ReasoningMetrics {
  readonly analisesDisponiveis: number;
  readonly analisesExecutadas: number;
  readonly impactosEncontrados: number;
  readonly inconsistencias: number;
  readonly conhecimentosAfetados: number;
  readonly fatosCriticos: number;
  readonly relacoesInvalidas: number;
  readonly objetosOrfaos: number;
  readonly tempoMedioMs: number;
  readonly ultimaExecucao?: ReasoningRun;
  readonly healthScore: number;
  readonly confiancaMedia: number;
  readonly coberturaMedia: number;
  readonly totalNos: number;
  readonly totalRelacoes: number;
  readonly recentes: readonly ReasoningRun[];
}

const ENGINES = 7;

export const makeGetReasoningMetrics =
  (provider: KnowledgeSnapshotProvider, audit: ReasoningAuditRepository) =>
  async (): Promise<Result<ReasoningMetrics>> => {
    const s = await provider.load();
    if (!s.ok) return err<ReasoningMetrics>(s.error as string);
    const snapshot = s.value as ReasoningSnapshot;
    const index = buildIndex(snapshot);

    const broken = detectBrokenKnowledge(snapshot, index);
    const confidence = computeConfidence(snapshot, index);
    const coverage = analyzeCoverage(snapshot, index);

    const a = await audit.list(200);
    const runs = a.ok ? (a.value as Page<ReasoningRun>).items : [];

    const fatosCriticos = snapshot.facts.filter(
      (f) => f.status === "contestado" || f.status === "vencido" || !f.ultimaValidacaoEm,
    ).length;

    const relacoesInvalidas = snapshot.edges.filter((e) => e.status === "invalida").length;
    const objetosOrfaos = broken.porTipo["objeto-sem-fato"] ?? 0;

    const penalidade =
      broken.criticas * 4 +
      (broken.total - broken.criticas) * 1.2 +
      relacoesInvalidas * 2;
    const base = (confidence.media + coverage.coberturaMedia) / 2;
    const healthScore = Math.max(0, Math.min(100, Math.round(base - penalidade)));

    return ok({
      analisesDisponiveis: ENGINES,
      analisesExecutadas: runs.length,
      impactosEncontrados: runs.reduce((sum, r) => sum + r.impactos, 0),
      inconsistencias: broken.total,
      conhecimentosAfetados: new Set(runs.map((r) => r.alvo).filter(Boolean)).size,
      fatosCriticos,
      relacoesInvalidas,
      objetosOrfaos,
      tempoMedioMs: runs.length
        ? Math.round(runs.reduce((sum, r) => sum + r.duracaoMs, 0) / runs.length)
        : 0,
      ultimaExecucao: runs[0],
      healthScore,
      confiancaMedia: confidence.media,
      coberturaMedia: coverage.coberturaMedia,
      totalNos: snapshot.nodes.length,
      totalRelacoes: snapshot.edges.length,
      recentes: runs.slice(0, 8),
    });
  };