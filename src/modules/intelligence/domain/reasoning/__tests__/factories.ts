/** Fábricas de teste: snapshot mínimo e determinístico para os 7 motores. */
import type { GraphEdge, EdgeType } from "../../graph/GraphEdge";
import type { GraphNode, NodeKind } from "../../graph/GraphNode";
import type { ReasoningSnapshot } from "../snapshot";

const AGORA = "2026-01-15T12:00:00.000Z";

export const node = (
  id: string,
  kind: NodeKind,
  extra: Partial<GraphNode> = {},
): GraphNode => ({
  id: id as GraphNode["id"],
  kind,
  ref: id,
  rotulo: `Nó ${id}`,
  status: "ativo" as GraphNode["status"],
  origem: "manual",
  criadoEm: AGORA,
  ...extra,
});

export const edge = (
  id: string,
  origem: string,
  destino: string,
  tipo: EdgeType = "depende_de",
  extra: Partial<GraphEdge> = {},
): GraphEdge => ({
  id,
  origem: origem as GraphEdge["origem"],
  destino: destino as GraphEdge["destino"],
  tipo,
  direcao: "direcionada" as GraphEdge["direcao"],
  peso: 70,
  confianca: 80,
  justificativa: "relação de teste",
  criadoPor: "teste",
  criadoEm: AGORA,
  atualizadoEm: AGORA,
  periodicidadeDias: 180,
  status: "ativa" as GraphEdge["status"],
  versao: 1,
  ...extra,
});

export const snapshot = (p: Partial<ReasoningSnapshot> = {}): ReasoningSnapshot => ({
  nodes: [],
  edges: [],
  facts: [],
  drafts: [],
  geradoEm: AGORA,
  ...p,
});