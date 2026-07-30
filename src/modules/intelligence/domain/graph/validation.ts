/**
 * FASE 09 — Validação estrutural do grafo.
 *
 * Regra: é MELHOR não ter a relação do que ter uma relação inválida.
 * Nada aqui depende de infraestrutura: recebe o universo de nós/arestas e
 * devolve portões determinísticos, explicáveis e testáveis.
 */
import {
  ACYCLIC_EDGE_TYPES,
  SOURCE_REQUIRED_EDGE_TYPES,
  edgeKey,
  type EdgeDirection,
  type EdgeType,
  type GraphEdge,
} from "./GraphEdge";
import { isConnectable, type GraphNode, type NodeId } from "./GraphNode";

export type GateSeverity = "bloqueio" | "alerta";

export interface GraphGate {
  readonly id: string;
  readonly rotulo: string;
  readonly ok: boolean;
  readonly severidade: GateSeverity;
  readonly detalhe: string;
}

export interface EdgeCandidate {
  readonly id?: string;
  readonly origem: NodeId;
  readonly destino: NodeId;
  readonly tipo: EdgeType;
  readonly direcao: EdgeDirection;
  readonly peso: number;
  readonly confianca: number;
  readonly justificativa: string;
  readonly criadoPor: string;
  readonly fonte?: GraphEdge["fonte"];
}

export interface GraphUniverse {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

const gate = (
  id: string,
  rotulo: string,
  ok: boolean,
  severidade: GateSeverity,
  detalhe: string,
): GraphGate => ({ id, rotulo, ok, severidade, detalhe });

/**
 * Detecta se ligar origem→destino fecha um ciclo em relações hierárquicas.
 * Busca em profundidade sobre arestas do MESMO tipo (não arquivadas/inválidas).
 */
export const createsCycle = (
  origem: NodeId,
  destino: NodeId,
  tipo: EdgeType,
  edges: readonly GraphEdge[],
  ignoreEdgeId?: string,
): boolean => {
  if (!ACYCLIC_EDGE_TYPES.includes(tipo)) return false;
  if (origem === destino) return true;

  const relevantes = edges.filter(
    (e) =>
      e.id !== ignoreEdgeId &&
      e.tipo === tipo &&
      e.status !== "arquivada" &&
      e.status !== "invalida",
  );

  // Existe caminho destino → ... → origem? Se sim, a nova aresta fecha o ciclo.
  const visitados = new Set<NodeId>();
  const pilha: NodeId[] = [destino];
  while (pilha.length) {
    const atual = pilha.pop() as NodeId;
    if (atual === origem) return true;
    if (visitados.has(atual)) continue;
    visitados.add(atual);
    for (const e of relevantes) {
      if (e.origem === atual) pilha.push(e.destino);
      else if (e.direcao === "bidirecional" && e.destino === atual) pilha.push(e.origem);
    }
  }
  return false;
};

/** Portões aplicados a uma aresta candidata. */
export const evaluateEdgeGates = (
  cand: EdgeCandidate,
  universo: GraphUniverse,
): readonly GraphGate[] => {
  const { nodes, edges } = universo;
  const origem = nodes.find((n) => n.id === cand.origem) ?? null;
  const destino = nodes.find((n) => n.id === cand.destino) ?? null;

  const chave = edgeKey(cand.origem, cand.destino, cand.tipo, cand.direcao);
  const duplicada = edges.some(
    (e) =>
      e.id !== cand.id &&
      e.status !== "arquivada" &&
      edgeKey(e.origem, e.destino, e.tipo, e.direcao) === chave,
  );

  const precisaFonte = SOURCE_REQUIRED_EDGE_TYPES.includes(cand.tipo);
  const temFonte = Boolean(cand.fonte?.titulo?.trim());

  return [
    gate(
      "referencias",
      "Origem e destino existem",
      Boolean(origem && destino),
      "bloqueio",
      !origem && !destino
        ? "Nenhum dos nós foi encontrado no grafo."
        : !origem
          ? "Nó de origem inexistente."
          : !destino
            ? "Nó de destino inexistente."
            : "Ambos os nós existem.",
    ),
    gate(
      "auto-relacionamento",
      "Sem auto-relacionamento",
      cand.origem !== cand.destino,
      "bloqueio",
      cand.origem === cand.destino
        ? "Um nó não pode se relacionar consigo mesmo."
        : "Origem e destino são distintos.",
    ),
    gate(
      "duplicidade",
      "Sem duplicidade",
      !duplicada,
      "bloqueio",
      duplicada
        ? "Já existe uma relação equivalente entre estes nós."
        : "Nenhuma relação equivalente encontrada.",
    ),
    gate(
      "ciclo",
      "Sem ciclo proibido",
      !createsCycle(cand.origem, cand.destino, cand.tipo, edges, cand.id),
      "bloqueio",
      ACYCLIC_EDGE_TYPES.includes(cand.tipo)
        ? "Relações hierárquicas não podem formar ciclos."
        : "Tipo de relação aceita ciclos.",
    ),
    gate(
      "justificativa",
      "Justificativa preenchida",
      cand.justificativa.trim().length >= 15,
      "bloqueio",
      "Toda relação precisa explicar POR QUE existe (mínimo 15 caracteres).",
    ),
    gate(
      "autor",
      "Autor identificado",
      cand.criadoPor.trim().length > 0,
      "bloqueio",
      "Relações são criadas por humanos identificáveis.",
    ),
    gate(
      "peso",
      "Peso e confiança válidos",
      cand.peso >= 0 && cand.peso <= 100 && cand.confianca >= 0 && cand.confianca <= 100,
      "bloqueio",
      "Peso e confiança devem estar entre 0 e 100.",
    ),
    gate(
      "fonte",
      "Fonte da relação",
      !precisaFonte || temFonte,
      precisaFonte ? "bloqueio" : "alerta",
      precisaFonte
        ? "Este tipo de relação exige fonte declarada."
        : temFonte
          ? "Fonte declarada."
          : "Relação sem fonte: aceitável, porém reduz a qualidade do grafo.",
    ),
    gate(
      "nos-conectaveis",
      "Nós em estado conectável",
      Boolean(origem && destino && isConnectable(origem.status) && isConnectable(destino.status)),
      "alerta",
      "Nós arquivados ou vencidos geram relações frágeis.",
    ),
  ];
};

export const hasBlockers = (gates: readonly GraphGate[]) =>
  gates.some((g) => !g.ok && g.severidade === "bloqueio");

export const blockers = (gates: readonly GraphGate[]) =>
  gates.filter((g) => !g.ok && g.severidade === "bloqueio");