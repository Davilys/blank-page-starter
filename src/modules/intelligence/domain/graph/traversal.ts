/**
 * FASE 09 — Travessia pura do grafo (sem infraestrutura).
 * Usada pelo Explorer, pelo Impact Analysis e pelo Graph Health.
 */
import { isOperational, type EdgeType, type GraphEdge } from "./GraphEdge";
import type { GraphNode, NodeId } from "./GraphNode";

export interface Incidence {
  readonly edge: GraphEdge;
  /** "saida" = o nó é origem; "entrada" = o nó é destino. */
  readonly sentido: "saida" | "entrada";
  readonly outro: NodeId;
}

export const incidences = (
  id: NodeId,
  edges: readonly GraphEdge[],
): readonly Incidence[] => {
  const out: Incidence[] = [];
  for (const e of edges) {
    if (e.origem === id) out.push({ edge: e, sentido: "saida", outro: e.destino });
    if (e.destino === id) out.push({ edge: e, sentido: "entrada", outro: e.origem });
  }
  return out;
};

/** Vizinhos alcançáveis respeitando direção. */
const neighbours = (id: NodeId, edges: readonly GraphEdge[]): NodeId[] => {
  const r: NodeId[] = [];
  for (const e of edges) {
    if (e.origem === id) r.push(e.destino);
    else if (e.destino === id && e.direcao === "bidirecional") r.push(e.origem);
  }
  return r;
};

export interface DepthEntry {
  readonly id: NodeId;
  readonly profundidade: number;
  readonly viaTipo?: EdgeType;
}

/** BFS a partir de um nó, limitado a `maxDepth`. */
export const traverse = (
  raiz: NodeId,
  edges: readonly GraphEdge[],
  maxDepth: number,
  tipos?: readonly EdgeType[],
): readonly DepthEntry[] => {
  const usadas = tipos?.length ? edges.filter((e) => tipos.includes(e.tipo)) : edges;
  const visto = new Map<NodeId, DepthEntry>([[raiz, { id: raiz, profundidade: 0 }]]);
  let fronteira: NodeId[] = [raiz];

  for (let d = 1; d <= Math.max(0, maxDepth); d += 1) {
    const proxima: NodeId[] = [];
    for (const atual of fronteira) {
      for (const e of usadas) {
        const alcanca =
          e.origem === atual ? e.destino : e.destino === atual && e.direcao === "bidirecional" ? e.origem : null;
        if (!alcanca || visto.has(alcanca)) continue;
        visto.set(alcanca, { id: alcanca, profundidade: d, viaTipo: e.tipo });
        proxima.push(alcanca);
      }
    }
    if (!proxima.length) break;
    fronteira = proxima;
  }

  return [...visto.values()].filter((v) => v.id !== raiz);
};

/** Quem aponta para este nó (dependentes diretos e transitivos). */
export const dependents = (
  alvo: NodeId,
  edges: readonly GraphEdge[],
  maxDepth = 3,
): readonly DepthEntry[] => {
  const visto = new Map<NodeId, DepthEntry>([[alvo, { id: alvo, profundidade: 0 }]]);
  let fronteira: NodeId[] = [alvo];

  for (let d = 1; d <= maxDepth; d += 1) {
    const proxima: NodeId[] = [];
    for (const atual of fronteira) {
      for (const e of edges) {
        const quemDepende =
          e.destino === atual ? e.origem : e.origem === atual && e.direcao === "bidirecional" ? e.destino : null;
        if (!quemDepende || visto.has(quemDepende)) continue;
        visto.set(quemDepende, { id: quemDepende, profundidade: d, viaTipo: e.tipo });
        proxima.push(quemDepende);
      }
    }
    if (!proxima.length) break;
    fronteira = proxima;
  }

  return [...visto.values()].filter((v) => v.id !== alvo);
};

/** Grau (número de conexões operacionais) por nó. */
export const degreeMap = (
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): ReadonlyMap<NodeId, number> => {
  const m = new Map<NodeId, number>(nodes.map((n) => [n.id, 0]));
  for (const e of edges) {
    if (!isOperational(e.status)) continue;
    m.set(e.origem, (m.get(e.origem) ?? 0) + 1);
    m.set(e.destino, (m.get(e.destino) ?? 0) + 1);
  }
  return m;
};

/** Profundidade média real: média das maiores distâncias alcançadas por nó. */
export const averageDepth = (
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  maxDepth = 4,
): number => {
  const conectados = nodes.filter((n) => edges.some((e) => e.origem === n.id || e.destino === n.id));
  if (!conectados.length) return 0;
  const total = conectados.reduce((acc, n) => {
    const alcance = traverse(n.id, edges, maxDepth);
    const maior = alcance.reduce((mx, a) => Math.max(mx, a.profundidade), 0);
    return acc + maior;
  }, 0);
  return Number((total / conectados.length).toFixed(2));
};