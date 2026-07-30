/** Explorer: um nó, suas relações, sua vizinhança e sua profundidade. */
import type { EdgeFilter, GraphEdgeRepository } from "../../ports/graph";
import {
  EDGE_TYPE_LABEL,
  isOperational,
  type EdgeType,
  type GraphEdge,
} from "../../../domain/graph/GraphEdge";
import type { GraphNode, NodeId } from "../../../domain/graph/GraphNode";
import { isEdgeExpired } from "../../../domain/graph/health";
import { dependents, incidences, traverse, type DepthEntry } from "../../../domain/graph/traversal";
import { evaluateEdgeGates, type GraphGate } from "../../../domain/graph/validation";
import { err, ok, type Result } from "../../../domain/shared/primitives";
import type { GraphUniverseView, makeLoadGraph } from "./loadGraph";

export interface RelationRow {
  readonly edge: GraphEdge;
  readonly sentido: "saida" | "entrada";
  readonly outro: GraphNode | null;
  readonly rotuloRelacao: string;
  readonly vencida: boolean;
  readonly portoes: readonly GraphGate[];
  readonly valida: boolean;
}

export interface NodeExploration {
  readonly no: GraphNode;
  readonly relacoes: readonly RelationRow[];
  readonly vizinhanca: readonly { readonly no: GraphNode | null; readonly entry: DepthEntry }[];
  readonly dependentes: readonly { readonly no: GraphNode | null; readonly entry: DepthEntry }[];
  readonly totalAtivas: number;
  readonly profundidadeMaxima: number;
}

export const matchesEdge = (
  e: GraphEdge,
  q: EdgeFilter,
  nodes: readonly GraphNode[],
): boolean => {
  const termo = (q.texto ?? "").trim().toLowerCase();
  if (termo) {
    const o = nodes.find((n) => n.id === e.origem);
    const d = nodes.find((n) => n.id === e.destino);
    const hay = `${e.origem} ${e.destino} ${o?.rotulo ?? ""} ${d?.rotulo ?? ""} ${e.justificativa}`.toLowerCase();
    if (!hay.includes(termo)) return false;
  }
  if (q.tipo && e.tipo !== q.tipo) return false;
  if (q.status && e.status !== q.status) return false;
  if (q.no && e.origem !== q.no && e.destino !== q.no) return false;
  if (q.entidade) {
    const o = nodes.find((n) => n.id === e.origem);
    const d = nodes.find((n) => n.id === e.destino);
    if (o?.entidade !== q.entidade && d?.entidade !== q.entidade) return false;
  }
  if (q.semFonte && e.fonte?.titulo?.trim()) return false;
  if (q.vencidas && !isEdgeExpired(e)) return false;
  return true;
};

export const makeListEdges =
  (loadGraph: ReturnType<typeof makeLoadGraph>) =>
  async (filter: EdgeFilter): Promise<Result<{ readonly items: readonly RelationRow[]; readonly nodes: readonly GraphNode[] }>> => {
    const g = await loadGraph();
    if (!g.ok) return err(g.error as string);
    const { nodes, edges } = g.value as GraphUniverseView;
    const items = edges
      .filter((e) => matchesEdge(e, filter, nodes))
      .map((edge) => {
        const portoes = evaluateEdgeGates(edge, { nodes, edges });
        return {
          edge,
          sentido: "saida" as const,
          outro: nodes.find((n) => n.id === edge.destino) ?? null,
          rotuloRelacao: EDGE_TYPE_LABEL[edge.tipo as EdgeType] ?? edge.tipo,
          vencida: isEdgeExpired(edge),
          portoes,
          valida: !portoes.some((p) => !p.ok && p.severidade === "bloqueio"),
        };
      })
      .sort((a, b) => (a.edge.atualizadoEm < b.edge.atualizadoEm ? 1 : -1));
    return ok({ items, nodes });
  };

export const makeExploreNode =
  (loadGraph: ReturnType<typeof makeLoadGraph>, _edges: GraphEdgeRepository) =>
  async (
    id: NodeId,
    opcoes: { readonly tipos?: readonly EdgeType[]; readonly profundidade?: number } = {},
  ): Promise<Result<NodeExploration>> => {
    const g = await loadGraph();
    if (!g.ok) return err<NodeExploration>(g.error as string);
    const { nodes, edges } = g.value as GraphUniverseView;

    const no = nodes.find((n) => n.id === id);
    if (!no) return err<NodeExploration>("Nó não encontrado no grafo.");

    const profundidade = Math.max(1, Math.min(5, opcoes.profundidade ?? 2));
    const filtradas = opcoes.tipos?.length
      ? edges.filter((e) => opcoes.tipos.includes(e.tipo))
      : edges;

    const relacoes = incidences(id, filtradas).map(({ edge, sentido, outro }) => {
      const portoes = evaluateEdgeGates(edge, { nodes, edges });
      return {
        edge,
        sentido,
        outro: nodes.find((n) => n.id === outro) ?? null,
        rotuloRelacao: EDGE_TYPE_LABEL[edge.tipo as EdgeType] ?? edge.tipo,
        vencida: isEdgeExpired(edge),
        portoes,
        valida: !portoes.some((p) => !p.ok && p.severidade === "bloqueio"),
      };
    });

    const alcance = traverse(id, filtradas, profundidade);
    const deps = dependents(id, filtradas, profundidade);

    return ok({
      no,
      relacoes,
      vizinhanca: alcance.map((entry) => ({ entry, no: nodes.find((n) => n.id === entry.id) ?? null })),
      dependentes: deps.map((entry) => ({ entry, no: nodes.find((n) => n.id === entry.id) ?? null })),
      totalAtivas: relacoes.filter((r) => isOperational(r.edge.status)).length,
      profundidadeMaxima: alcance.reduce((mx, a) => Math.max(mx, a.profundidade), 0),
    });
  };