/**
 * ENGINE 1 — IMPACT ANALYSIS.
 *
 * "Se este fato mudar, o que deixa de ser verdade?"
 * Percorre o grafo em BFS reverso (quem depende de quem), classificando
 * cada nó atingido por profundidade, tipo e força do caminho.
 */
import { EDGE_TYPE_LABEL, type GraphEdge } from "../graph/GraphEdge";
import type { GraphNode, NodeId } from "../graph/GraphNode";
import { SEVERITY_ORDER, type Severity } from "./Reasoning";
import { inEdges, incidentEdges, outEdges, propagates, type SnapshotIndex } from "./snapshot";

export interface ImpactHit {
  readonly no: GraphNode;
  readonly profundidade: number;
  readonly viaRelacao: string;
  readonly peso: number;
  readonly paiId?: NodeId;
}

export interface ImpactTreeNode {
  readonly no: GraphNode;
  readonly profundidade: number;
  readonly viaRelacao: string;
  readonly peso: number;
  readonly filhos: readonly ImpactTreeNode[];
}

export interface ImpactAnalysis {
  readonly alvo: GraphNode;
  readonly atingidos: readonly ImpactHit[];
  readonly arvore: readonly ImpactTreeNode[];
  readonly objetos: readonly ImpactHit[];
  readonly faqs: readonly ImpactHit[];
  readonly guias: readonly ImpactHit[];
  readonly artigos: readonly ImpactHit[];
  readonly entidades: readonly string[];
  readonly relacoesDependentes: readonly GraphEdge[];
  readonly pais: readonly GraphNode[];
  readonly filhos: readonly GraphNode[];
  readonly profundidadeMaxima: number;
  readonly conexoes: number;
  readonly severidade: Severity;
}

const KIND_TO_BUCKET: Readonly<Record<string, "guia" | "artigo">> = {
  guia: "guia",
  procedimento: "guia",
  checklist: "guia",
  artigo: "artigo",
  conceito: "artigo",
};

const severity = (diretos: number, peso: number, profundidade: number): Severity => {
  if (diretos >= 8 || peso >= 500) return "critica";
  if (diretos >= 4 || peso >= 240 || profundidade >= 3) return "alta";
  if (diretos >= 1) return "media";
  return "baixa";
};

/** Nós que dependem de `id` (BFS reverso limitado por profundidade). */
export const dependentsOf = (
  ix: SnapshotIndex,
  id: NodeId,
  maxDepth: number,
): readonly ImpactHit[] => {
  const visto = new Set<NodeId>([id]);
  const hits: ImpactHit[] = [];
  let fronteira: NodeId[] = [id];

  for (let d = 1; d <= Math.max(0, maxDepth); d += 1) {
    const proxima: NodeId[] = [];
    for (const atual of fronteira) {
      const candidatos: { readonly outro: NodeId; readonly edge: GraphEdge }[] = [];
      for (const e of inEdges(ix, atual)) {
        if (propagates(e)) candidatos.push({ outro: e.origem, edge: e });
      }
      for (const e of outEdges(ix, atual)) {
        if (propagates(e) && e.direcao === "bidirecional") {
          candidatos.push({ outro: e.destino, edge: e });
        }
      }
      for (const { outro, edge } of candidatos) {
        if (visto.has(outro)) continue;
        const no = ix.nodeById.get(outro);
        if (!no) continue;
        visto.add(outro);
        hits.push({
          no,
          profundidade: d,
          viaRelacao: EDGE_TYPE_LABEL[edge.tipo] ?? edge.tipo,
          peso: edge.peso,
          paiId: atual,
        });
        proxima.push(outro);
      }
    }
    if (!proxima.length) break;
    fronteira = proxima;
  }

  return hits;
};

const toTree = (raiz: NodeId, hits: readonly ImpactHit[]): readonly ImpactTreeNode[] => {
  const porPai = new Map<NodeId, ImpactHit[]>();
  for (const h of hits) {
    const pai = h.paiId ?? raiz;
    const cur = porPai.get(pai);
    if (cur) cur.push(h);
    else porPai.set(pai, [h]);
  }
  const build = (id: NodeId): readonly ImpactTreeNode[] =>
    (porPai.get(id) ?? []).map((h) => ({
      no: h.no,
      profundidade: h.profundidade,
      viaRelacao: h.viaRelacao,
      peso: h.peso,
      filhos: build(h.no.id),
    }));
  return build(raiz);
};

export const analyzeImpactOn = (
  ix: SnapshotIndex,
  id: NodeId,
  maxDepth = 4,
): ImpactAnalysis | null => {
  const alvo = ix.nodeById.get(id);
  if (!alvo) return null;

  const atingidos = dependentsOf(ix, id, maxDepth);
  const diretos = atingidos.filter((h) => h.profundidade === 1);
  const pesoDireto = diretos.reduce((s, h) => s + h.peso, 0);
  const profundidadeMaxima = atingidos.reduce((m, h) => Math.max(m, h.profundidade), 0);

  const objetos = atingidos.filter((h) => h.no.kind === "knowledge-object");
  const bucketOf = (h: ImpactHit) => KIND_TO_BUCKET[h.no.kind] ?? null;

  const pais = inEdges(ix, id)
    .filter(propagates)
    .map((e) => ix.nodeById.get(e.origem))
    .filter(Boolean) as GraphNode[];
  const filhos = outEdges(ix, id)
    .filter(propagates)
    .map((e) => ix.nodeById.get(e.destino))
    .filter(Boolean) as GraphNode[];

  return {
    alvo,
    atingidos,
    arvore: toTree(id, atingidos),
    objetos,
    faqs: atingidos.filter((h) => h.no.kind === "question" || h.no.kind === "answer"),
    guias: atingidos.filter((h) => bucketOf(h) === "guia"),
    artigos: atingidos.filter((h) => bucketOf(h) === "artigo"),
    entidades: [...new Set(atingidos.map((h) => h.no.entidade).filter(Boolean))] as string[],
    relacoesDependentes: incidentEdges(ix, id).filter(propagates),
    pais,
    filhos,
    profundidadeMaxima,
    conexoes: incidentEdges(ix, id).length,
    severidade: severity(diretos.length, pesoDireto, profundidadeMaxima),
  };
};

export const bySeverity = (a: Severity, b: Severity) => SEVERITY_ORDER[a] - SEVERITY_ORDER[b];