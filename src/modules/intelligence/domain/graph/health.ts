/**
 * FASE 09 — Graph Health. Todos os indicadores são CALCULADOS a partir do
 * grafo real. Nenhum número fictício, nenhuma estimativa.
 */
import {
  SOURCE_REQUIRED_EDGE_TYPES,
  edgeKey,
  isOperational,
  type GraphEdge,
} from "./GraphEdge";
import type { GraphNode, NodeKind } from "./GraphNode";
import { averageDepth, degreeMap } from "./traversal";

const DAY = 86_400_000;

export const daysSince = (iso?: string, agora: Date = new Date()): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((agora.getTime() - t) / DAY));
};

export const isEdgeExpired = (e: GraphEdge, agora: Date = new Date()): boolean => {
  const limite = Math.max(30, e.periodicidadeDias || 180);
  const d = daysSince(e.ultimaValidacaoEm, agora);
  return d === null ? false : d > limite;
};

export interface CoverageRow {
  readonly entidade: string;
  readonly nos: number;
  readonly conectados: number;
  readonly cobertura: number;
}

export interface GraphHealth {
  readonly totalNos: number;
  readonly totalEdges: number;
  readonly edgesAtivas: number;
  /** Nós que não participam de nenhuma aresta (nem inválida). */
  readonly nosOrfaos: readonly GraphNode[];
  /** Nós existentes, porém sem nenhuma conexão OPERACIONAL (ativa). */
  readonly nosSemConexaoAtiva: readonly GraphNode[];
  /** Arestas apontando para nós inexistentes ou marcadas como inválidas. */
  readonly edgesInvalidas: readonly GraphEdge[];
  readonly edgesSemFonte: readonly GraphEdge[];
  readonly edgesVencidas: readonly GraphEdge[];
  readonly edgesSemRevisao: readonly GraphEdge[];
  readonly edgesDuplicadas: readonly GraphEdge[];
  readonly profundidadeMedia: number;
  readonly cobertura: readonly CoverageRow[];
  readonly porTipoDeNo: readonly { readonly kind: NodeKind; readonly total: number }[];
}

export const computeGraphHealth = (
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  agora: Date = new Date(),
): GraphHealth => {
  const ids = new Set(nodes.map((n) => n.id));
  const grau = degreeMap(nodes, edges);

  const nosOrfaos = nodes.filter(
    (n) => !edges.some((e) => e.origem === n.id || e.destino === n.id),
  );
  const nosSemConexaoAtiva = nodes.filter((n) => (grau.get(n.id) ?? 0) === 0);

  const edgesInvalidas = edges.filter(
    (e) => e.status === "invalida" || !ids.has(e.origem) || !ids.has(e.destino) || e.origem === e.destino,
  );

  const edgesSemFonte = edges.filter(
    (e) => SOURCE_REQUIRED_EDGE_TYPES.includes(e.tipo) && !e.fonte?.titulo?.trim(),
  );

  const edgesVencidas = edges.filter((e) => isEdgeExpired(e, agora));
  const edgesSemRevisao = edges.filter((e) => !e.ultimaValidacaoEm || !e.revisorId);

  const vistos = new Map<string, GraphEdge>();
  const edgesDuplicadas: GraphEdge[] = [];
  for (const e of edges) {
    if (e.status === "arquivada") continue;
    const k = edgeKey(e.origem, e.destino, e.tipo, e.direcao);
    if (vistos.has(k)) edgesDuplicadas.push(e);
    else vistos.set(k, e);
  }

  const entidades = [...new Set(nodes.map((n) => n.entidade).filter(Boolean))] as string[];
  const cobertura: CoverageRow[] = entidades
    .map((entidade) => {
      const doGrupo = nodes.filter((n) => n.entidade === entidade);
      const conectados = doGrupo.filter((n) => (grau.get(n.id) ?? 0) > 0).length;
      return {
        entidade,
        nos: doGrupo.length,
        conectados,
        cobertura: doGrupo.length ? Math.round((conectados / doGrupo.length) * 100) : 0,
      };
    })
    .sort((a, b) => b.nos - a.nos);

  const contagem = new Map<NodeKind, number>();
  for (const n of nodes) contagem.set(n.kind, (contagem.get(n.kind) ?? 0) + 1);

  return {
    totalNos: nodes.length,
    totalEdges: edges.length,
    edgesAtivas: edges.filter((e) => isOperational(e.status)).length,
    nosOrfaos,
    nosSemConexaoAtiva,
    edgesInvalidas,
    edgesSemFonte,
    edgesVencidas,
    edgesSemRevisao,
    edgesDuplicadas,
    profundidadeMedia: averageDepth(nodes, edges),
    cobertura,
    porTipoDeNo: [...contagem.entries()]
      .map(([kind, total]) => ({ kind, total }))
      .sort((a, b) => b.total - a.total),
  };
};