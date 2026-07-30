/**
 * Orquestrador do Observatory. Executa os sete engines sobre um snapshot
 * imutável, mede o tempo e sela o resultado com hash determinístico.
 * Somente leitura: nada aqui escreve no snapshot.
 */
import { stableHash } from "../reasoning/hash";
import type { IsoDateTime } from "../shared/primitives";
import {
  averageDuration,
  type ObservatoryAuditRecord,
  type ObservatoryFinding,
  type ObservatorySnapshot,
} from "./Observatory";
import { analyzeConsistency, type ConsistencyReport } from "./consistency";
import { analyzeCoverage, type CoverageReport } from "./coverage";
import { analyzeEntities, type EntityReport } from "./entities";
import { analyzeFreshness, type FreshnessReport } from "./freshness";
import { analyzeHealth, type HealthReport } from "./health";
import { analyzeSchema, type SchemaReport } from "./schemaAudit";
import { buildTimeline, type TimelineReport } from "./timeline";

export interface ObservatoryResult {
  readonly executadoEm: IsoDateTime;
  readonly duracaoMs: number;
  readonly hash: string;
  readonly health: HealthReport;
  readonly coverage: CoverageReport;
  readonly consistency: ConsistencyReport;
  readonly freshness: FreshnessReport;
  readonly schema: SchemaReport;
  readonly entity: EntityReport;
  readonly timeline: TimelineReport;
  readonly achados: readonly ObservatoryFinding[];
  readonly totais: {
    readonly objetos: number;
    readonly publicados: number;
    readonly criticos: number;
    readonly alertas: number;
    readonly informativos: number;
  };
}

const now = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

export const runObservatory = (s: ObservatorySnapshot): ObservatoryResult => {
  const inicio = now();

  const coverage = analyzeCoverage(s);
  const consistency = analyzeConsistency(s);
  const freshness = analyzeFreshness(s);
  const schema = analyzeSchema(s);
  const entity = analyzeEntities(s);
  const timeline = buildTimeline(s);
  const health = analyzeHealth(s, { coverage, consistency, freshness, schema, entity });

  const achados = [
    ...consistency.achados,
    ...coverage.achados,
    ...freshness.achados,
    ...schema.achados,
    ...entity.achados,
  ];

  const duracaoMs = Math.max(0, Math.round(now() - inicio));

  return {
    executadoEm: s.agora,
    duracaoMs,
    // O hash cobre apenas o conteúdo analisado — nunca o tempo de execução,
    // para que a mesma base sempre produza a mesma assinatura.
    hash: stableHash({
      health: health.score,
      dimensoes: health.dimensoes.map((d) => [d.dimensao, d.valor]),
      achados: achados.map((a) => a.id).sort(),
    }),
    health,
    coverage,
    consistency,
    freshness,
    schema,
    entity,
    timeline,
    achados,
    totais: {
      objetos: s.rascunhos.length,
      publicados: new Set(s.publicacoes.filter((p) => p.ativa).map((p) => p.objetoId)).size,
      criticos: achados.filter((a) => a.severidade === "critico").length,
      alertas: achados.filter((a) => a.severidade === "alerta").length,
      informativos: achados.filter((a) => a.severidade === "informativo").length,
    },
  };
};

/** Registro de auditoria derivado de um resultado. Append-only a montante. */
export const auditRecordFor = (
  r: ObservatoryResult,
  autorId: string,
  acao: ObservatoryAuditRecord["acao"] = "analise-completa",
  mensagem = "Análise completa executada em modo somente leitura.",
): ObservatoryAuditRecord => ({
  id: `obs-${r.executadoEm}-${r.hash}-${acao}`,
  acao,
  autorId: autorId || "desconhecido",
  registradoEm: r.executadoEm,
  duracaoMs: r.duracaoMs,
  hash: r.hash,
  healthScore: r.health.score,
  totalAchados: r.achados.length,
  criticos: r.totais.criticos,
  sucesso: true,
  mensagem,
});

export { averageDuration };