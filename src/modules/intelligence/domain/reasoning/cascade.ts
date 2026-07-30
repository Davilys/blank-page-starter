/**
 * ENGINE 2 e ENGINE 6 — CASCADE ANALYSIS e CHANGE SIMULATION.
 *
 * Simulação PURA: recebe o snapshot, devolve ondas de impacto. Não grava,
 * não muta o snapshot, não toca o banco. O resultado só existe em memória.
 */
import type { GraphEdge } from "../graph/GraphEdge";
import type { GraphNode, NodeId } from "../graph/GraphNode";
import type { Severity } from "./Reasoning";
import { analyzeImpactOn, type ImpactHit } from "./impact";
import { incidentEdges, propagates, type SnapshotIndex } from "./snapshot";

export interface CascadeWave {
  readonly ordem: number;
  readonly rotulo: string;
  readonly nos: readonly ImpactHit[];
}

export type SimulationKind = "alteracao" | "revogacao" | "remocao";

export const SIMULATION_LABEL: Readonly<Record<SimulationKind, string>> = {
  alteracao: "Alteração de sentido",
  revogacao: "Revogação do fato",
  remocao: "Remoção do nó",
};

export interface CascadeReport {
  readonly alvo: GraphNode;
  readonly tipo: SimulationKind;
  readonly ondas: readonly CascadeWave[];
  readonly objetosAfetados: readonly GraphNode[];
  readonly fatosAfetados: readonly GraphNode[];
  readonly entidadesAfetadas: readonly string[];
  readonly relacoesAfetadas: readonly GraphEdge[];
  readonly totalAfetados: number;
  readonly severidade: Severity;
  /** Confirmação explícita: nenhuma escrita ocorreu. */
  readonly somenteLeitura: true;
}

const WAVE_LABEL = ["Primeiro impacto", "Segundo impacto", "Terceiro impacto"];

/** Profundidade simulada por tipo: remoção propaga mais longe que alteração. */
const DEPTH: Readonly<Record<SimulationKind, number>> = {
  alteracao: 3,
  revogacao: 3,
  remocao: 4,
};

export const simulateChange = (
  ix: SnapshotIndex,
  id: NodeId,
  tipo: SimulationKind = "alteracao",
): CascadeReport | null => {
  const analise = analyzeImpactOn(ix, id, DEPTH[tipo]);
  if (!analise) return null;

  const maxOndas = tipo === "remocao" ? 4 : 3;
  const ondas: CascadeWave[] = [];
  for (let d = 1; d <= maxOndas; d += 1) {
    const nos = analise.atingidos.filter((h) => h.profundidade === d);
    if (!nos.length) continue;
    ondas.push({
      ordem: d,
      rotulo: WAVE_LABEL[d - 1] ?? `Impacto de nível ${d}`,
      nos,
    });
  }

  const relacoes =
    tipo === "remocao"
      ? incidentEdges(ix, id)
      : incidentEdges(ix, id).filter(propagates);

  return {
    alvo: analise.alvo,
    tipo,
    ondas,
    objetosAfetados: analise.atingidos
      .filter((h) => h.no.kind === "knowledge-object")
      .map((h) => h.no),
    fatosAfetados: analise.atingidos.filter((h) => h.no.kind === "fact").map((h) => h.no),
    entidadesAfetadas: analise.entidades,
    relacoesAfetadas: relacoes,
    totalAfetados: analise.atingidos.length,
    severidade: analise.severidade,
    somenteLeitura: true,
  };
};