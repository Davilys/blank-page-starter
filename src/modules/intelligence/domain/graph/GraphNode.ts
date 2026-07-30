/**
 * FASE 09 — KNOWLEDGE GRAPH ENGINE.
 *
 * Um Nó é a projeção mínima e neutra de QUALQUER coisa que possa participar
 * de um relacionamento: um Knowledge Object, um Fato, uma Lei, uma Classe
 * NICE, uma Pergunta, um Termo de glossário...
 *
 * Regra constitucional: o grafo NÃO possui os dados. Ele referencia.
 * A verdade continua no Fact Ledger e na Knowledge Factory. Aqui existem
 * apenas identidade, rótulo, tipo e estado — o suficiente para relacionar.
 *
 * Camada de domínio pura: zero React, zero Supabase, zero rede.
 */
import type { IsoDateTime } from "../shared/primitives";

/* ── Tipos de nó ──────────────────────────────────────────────────────────── */
export const NODE_KINDS = [
  "knowledge-object",
  "fact",
  "entity",
  "source",
  "question",
  "answer",
  "category",
  "glossary-term",
  "law",
  "manual",
  "inpi-act",
  "nice-class",
  "organization",
  "service",
  "concept",
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export const NODE_KIND_LABEL: Readonly<Record<NodeKind, string>> = {
  "knowledge-object": "Knowledge Object",
  fact: "Fato",
  entity: "Entidade",
  source: "Fonte",
  question: "Pergunta",
  answer: "Resposta",
  category: "Categoria",
  "glossary-term": "Glossário",
  law: "Lei",
  manual: "Manual INPI",
  "inpi-act": "Ato normativo INPI",
  "nice-class": "Classe NICE",
  organization: "Organização",
  service: "Serviço",
  concept: "Conceito",
};

/** Nós derivados vêm de outro módulo; nós manuais são criados aqui. */
export const DERIVED_KINDS: readonly NodeKind[] = [
  "knowledge-object",
  "fact",
  "entity",
  "source",
  "category",
  "question",
];

export const isDerivedKind = (k: NodeKind) => DERIVED_KINDS.includes(k);

/* ── Identidade ───────────────────────────────────────────────────────────
 * O id é sempre "<kind>:<referência externa>" para que o grafo continue
 * resolvível mesmo quando a persistência migrar para o Supabase.
 */
export type NodeId = string;

export const makeNodeId = (kind: NodeKind, ref: string): NodeId =>
  `${kind}:${String(ref).trim()}`;

export const parseNodeId = (
  id: NodeId,
): { readonly kind: NodeKind | null; readonly ref: string } => {
  const i = String(id ?? "").indexOf(":");
  if (i <= 0) return { kind: null, ref: String(id ?? "") };
  const kind = id.slice(0, i) as NodeKind;
  return {
    kind: NODE_KINDS.includes(kind) ? kind : null,
    ref: id.slice(i + 1),
  };
};

/* ── Estado do nó ─────────────────────────────────────────────────────────── */
export const NODE_STATUSES = ["ativo", "rascunho", "vencido", "arquivado"] as const;
export type NodeStatus = (typeof NODE_STATUSES)[number];

export const NODE_STATUS_LABEL: Readonly<Record<NodeStatus, string>> = {
  ativo: "Ativo",
  rascunho: "Rascunho",
  vencido: "Vencido",
  arquivado: "Arquivado",
};

/** Só nós ativos podem sustentar relações operacionais. */
export const isConnectable = (s: NodeStatus) => s === "ativo" || s === "rascunho";

export interface GraphNode {
  readonly id: NodeId;
  readonly kind: NodeKind;
  /** Identificador dentro do módulo de origem (id do fato, slug do objeto...). */
  readonly ref: string;
  readonly rotulo: string;
  readonly descricao?: string;
  readonly status: NodeStatus;
  /** Módulo que produziu o nó: "facts", "factory", "manual". */
  readonly origem: string;
  /** Entidade canônica à qual o nó pertence (usado em cobertura por entidade). */
  readonly entidade?: string;
  /** Rota interna para abrir o registro original, quando existir. */
  readonly rota?: string;
  readonly criadoEm?: IsoDateTime;
}

/** Nó criado manualmente no Graph Engine (leis, NICE, glossário, conceitos). */
export interface ManualNodeInput {
  readonly kind: NodeKind;
  readonly ref: string;
  readonly rotulo: string;
  readonly descricao?: string;
  readonly entidade?: string;
  readonly status?: NodeStatus;
}

export const normalizeRef = (v: string): string =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");