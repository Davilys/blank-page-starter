/**
 * FASE 09 — Auditoria do grafo. Append-only: nada é editado ou apagado.
 */
import type { IsoDateTime } from "../shared/primitives";
import type { EdgeType, GraphEdge } from "./GraphEdge";

export const GRAPH_AUDIT_ACTIONS = [
  "criou",
  "editou",
  "validou",
  "suspendeu",
  "invalidou",
  "arquivou",
  "removeu",
  "criou-no",
  "removeu-no",
] as const;
export type GraphAuditAction = (typeof GRAPH_AUDIT_ACTIONS)[number];

export const GRAPH_AUDIT_ACTION_LABEL: Readonly<Record<GraphAuditAction, string>> = {
  criou: "Criou relação",
  editou: "Editou relação",
  validou: "Validou relação",
  suspendeu: "Suspendeu relação",
  invalidou: "Invalidou relação",
  arquivou: "Arquivou relação",
  removeu: "Removeu relação",
  "criou-no": "Criou nó manual",
  "removeu-no": "Removeu nó manual",
};

export interface GraphAuditEntry {
  readonly id: string;
  readonly acao: GraphAuditAction;
  readonly autorId: string;
  readonly em: IsoDateTime;
  readonly alvoId: string;
  /** Descrição legível da relação no momento da ação. */
  readonly relacao: string;
  readonly motivo: string;
  readonly versao: number;
  /** Campos alterados, quando aplicável. */
  readonly alteracoes?: readonly string[];
}

export const describeEdge = (e: Pick<GraphEdge, "origem" | "destino" | "tipo">): string =>
  `${e.origem} —[${e.tipo as EdgeType}]→ ${e.destino}`;

/** Diff superficial e determinístico entre duas versões da aresta. */
export const diffEdges = (antes: GraphEdge, depois: GraphEdge): readonly string[] => {
  const campos: (keyof GraphEdge)[] = [
    "origem",
    "destino",
    "tipo",
    "direcao",
    "peso",
    "confianca",
    "justificativa",
    "status",
    "periodicidadeDias",
    "observacoes",
  ];
  const mudou = campos.filter((c) => String(antes[c] ?? "") !== String(depois[c] ?? ""));
  if (JSON.stringify(antes.fonte ?? null) !== JSON.stringify(depois.fonte ?? null)) {
    mudou.push("fonte" as keyof GraphEdge);
  }
  return mudou.map(String);
};