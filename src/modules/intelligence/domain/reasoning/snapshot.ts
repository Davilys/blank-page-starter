/**
 * FASE 10 — Snapshot imutável do conhecimento + índices.
 *
 * Todo motor de raciocínio opera sobre ESTE snapshot em memória. Ele é
 * carregado UMA vez por execução e indexado — o que elimina N+1 e mantém
 * as análises O(V+E) em vez de O(V*E).
 */
import type { Fact } from "../facts/Fact";
import type { KnowledgeDraft } from "../factory/KnowledgeDraft";
import { isOperational, type GraphEdge } from "../graph/GraphEdge";
import type { GraphNode, NodeId } from "../graph/GraphNode";
import type { IsoDateTime } from "../shared/primitives";

export interface ReasoningSnapshot {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly facts: readonly Fact[];
  readonly drafts: readonly KnowledgeDraft[];
  readonly geradoEm: IsoDateTime;
}

export interface SnapshotIndex {
  readonly nodeById: ReadonlyMap<NodeId, GraphNode>;
  /** Arestas onde o nó é ORIGEM. */
  readonly saidas: ReadonlyMap<NodeId, readonly GraphEdge[]>;
  /** Arestas onde o nó é DESTINO. */
  readonly entradas: ReadonlyMap<NodeId, readonly GraphEdge[]>;
  /** Apenas arestas que propagam conhecimento (ativas e propostas). */
  readonly vigentes: readonly GraphEdge[];
  readonly grau: ReadonlyMap<NodeId, number>;
  readonly factById: ReadonlyMap<string, Fact>;
  readonly draftById: ReadonlyMap<string, KnowledgeDraft>;
  readonly draftBySlug: ReadonlyMap<string, KnowledgeDraft>;
}

const push = (m: Map<NodeId, GraphEdge[]>, k: NodeId, e: GraphEdge) => {
  const cur = m.get(k);
  if (cur) cur.push(e);
  else m.set(k, [e]);
};

/** Considera-se propagável tudo que não foi invalidado nem arquivado. */
export const propagates = (e: GraphEdge): boolean =>
  isOperational(e.status) || e.status === "proposta";

export const buildIndex = (s: ReasoningSnapshot): SnapshotIndex => {
  const nodeById = new Map<NodeId, GraphNode>();
  for (const n of s.nodes) nodeById.set(n.id, n);

  const saidas = new Map<NodeId, GraphEdge[]>();
  const entradas = new Map<NodeId, GraphEdge[]>();
  const grau = new Map<NodeId, number>();
  const vigentes: GraphEdge[] = [];

  for (const e of s.edges) {
    push(saidas, e.origem, e);
    push(entradas, e.destino, e);
    if (propagates(e)) {
      vigentes.push(e);
      grau.set(e.origem, (grau.get(e.origem) ?? 0) + 1);
      grau.set(e.destino, (grau.get(e.destino) ?? 0) + 1);
    }
  }

  const factById = new Map<string, Fact>();
  for (const f of s.facts) factById.set(String(f.id), f);

  const draftById = new Map<string, KnowledgeDraft>();
  const draftBySlug = new Map<string, KnowledgeDraft>();
  for (const d of s.drafts) {
    draftById.set(String(d.id), d);
    if (d.slug) draftBySlug.set(d.slug, d);
  }

  return { nodeById, saidas, entradas, vigentes, grau, factById, draftById, draftBySlug };
};

export const outEdges = (ix: SnapshotIndex, id: NodeId): readonly GraphEdge[] =>
  ix.saidas.get(id) ?? [];

export const inEdges = (ix: SnapshotIndex, id: NodeId): readonly GraphEdge[] =>
  ix.entradas.get(id) ?? [];

export const incidentEdges = (ix: SnapshotIndex, id: NodeId): readonly GraphEdge[] => [
  ...outEdges(ix, id),
  ...inEdges(ix, id),
];

export const degreeOf = (ix: SnapshotIndex, id: NodeId): number => ix.grau.get(id) ?? 0;

export const emptySnapshot = (geradoEm: IsoDateTime): ReasoningSnapshot => ({
  nodes: [],
  edges: [],
  facts: [],
  drafts: [],
  geradoEm,
});