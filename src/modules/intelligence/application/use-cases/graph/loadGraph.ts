/** Carrega o universo do grafo (nós de todas as fontes + arestas). */
import type { GraphEdgeRepository, GraphNodeSource, ManualNodeRepository, NodeFilter } from "../../ports/graph";
import type { GraphEdge } from "../../../domain/graph/GraphEdge";
import type { GraphNode } from "../../../domain/graph/GraphNode";
import { err, ok, type Page, type Result } from "../../../domain/shared/primitives";

export interface GraphUniverseView {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

export const makeLoadGraph =
  (sources: readonly GraphNodeSource[], manual: ManualNodeRepository, edgesRepo: GraphEdgeRepository) =>
  async (): Promise<Result<GraphUniverseView>> => {
    const nodes: GraphNode[] = [];
    for (const s of sources) {
      const r = await s.load();
      if (r.ok) nodes.push(...(r.value as readonly GraphNode[]));
    }
    const m = await manual.list();
    if (m.ok) nodes.push(...(m.value as readonly GraphNode[]));

    // Nós manuais têm precedência sobre derivados com o mesmo id.
    const porId = new Map<string, GraphNode>();
    for (const n of nodes) porId.set(n.id, n);

    const e = await edgesRepo.list();
    if (!e.ok) return err<GraphUniverseView>(e.error as string);

    return ok({
      nodes: [...porId.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo)),
      edges: (e.value as Page<GraphEdge>).items,
    });
  };

export const matchesNode = (
  n: GraphNode,
  q: NodeFilter,
  edges: readonly GraphEdge[],
): boolean => {
  const termo = (q.texto ?? "").trim().toLowerCase();
  if (termo && !`${n.rotulo} ${n.ref} ${n.descricao ?? ""}`.toLowerCase().includes(termo)) return false;
  if (q.kind && n.kind !== q.kind) return false;
  if (q.status && n.status !== q.status) return false;
  if (q.entidade && n.entidade !== q.entidade) return false;
  if (q.origem && n.origem !== q.origem) return false;
  if (q.apenasOrfaos && edges.some((e) => e.origem === n.id || e.destino === n.id)) return false;
  return true;
};

export const makeListNodes =
  (loadGraph: ReturnType<typeof makeLoadGraph>) =>
  async (filter: NodeFilter): Promise<Result<Page<GraphNode>>> => {
    const g = await loadGraph();
    if (!g.ok) return err<Page<GraphNode>>(g.error as string);
    const { nodes, edges } = g.value as GraphUniverseView;
    const items = nodes.filter((n) => matchesNode(n, filter, edges));
    return ok({ items, total: items.length });
  };