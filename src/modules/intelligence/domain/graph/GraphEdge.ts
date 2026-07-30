/**
 * FASE 09 — Aresta (relacionamento explícito).
 *
 * Nenhuma relação é inferida. Nenhuma relação é gerada por IA.
 * Toda aresta é criada ou aprovada por um editor humano e carrega,
 * obrigatoriamente: origem, destino, tipo, direção, peso, confiança,
 * fonte da relação, justificativa, autor, datas, validação e status.
 */
import type { IsoDateTime } from "../shared/primitives";
import type { NodeId } from "./GraphNode";

/* ── Tipos de relação (expansíveis) ───────────────────────────────────────── */
export const EDGE_TYPES = [
  "depende_de",
  "complementa",
  "contradiz",
  "substitui",
  "e_exemplo_de",
  "e_causa_de",
  "e_consequencia_de",
  "e_etapa_de",
  "e_requisito_para",
  "esta_relacionado_a",
  "possui_fonte",
  "cita",
  "explica",
  "responde",
  "utiliza",
  "e_derivado_de",
  "e_atualizado_por",
  "e_excecao_de",
] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];

export const EDGE_TYPE_LABEL: Readonly<Record<EdgeType, string>> = {
  depende_de: "depende de",
  complementa: "complementa",
  contradiz: "contradiz",
  substitui: "substitui",
  e_exemplo_de: "é exemplo de",
  e_causa_de: "é causa de",
  e_consequencia_de: "é consequência de",
  e_etapa_de: "é etapa de",
  e_requisito_para: "é requisito para",
  esta_relacionado_a: "está relacionado a",
  possui_fonte: "possui fonte",
  cita: "cita",
  explica: "explica",
  responde: "responde",
  utiliza: "utiliza",
  e_derivado_de: "é derivado de",
  e_atualizado_por: "é atualizado por",
  e_excecao_de: "é exceção de",
};

/** Inverso semântico — usado na leitura reversa do explorer. */
export const EDGE_TYPE_INVERSE: Readonly<Partial<Record<EdgeType, EdgeType>>> = {
  e_causa_de: "e_consequencia_de",
  e_consequencia_de: "e_causa_de",
  depende_de: "e_requisito_para",
  e_requisito_para: "depende_de",
};

/**
 * Relações hierárquicas: ciclos são PROIBIDOS (A depende de B que depende de A
 * é uma contradição estrutural, não uma opinião).
 */
export const ACYCLIC_EDGE_TYPES: readonly EdgeType[] = [
  "depende_de",
  "e_etapa_de",
  "e_requisito_para",
  "e_derivado_de",
  "substitui",
  "e_exemplo_de",
  "e_excecao_de",
];

/** Relações simétricas: só fazem sentido em ambas as direções. */
export const SYMMETRIC_EDGE_TYPES: readonly EdgeType[] = [
  "esta_relacionado_a",
  "complementa",
  "contradiz",
];

/** Relações que exigem fonte declarada (não basta "achismo do editor"). */
export const SOURCE_REQUIRED_EDGE_TYPES: readonly EdgeType[] = [
  "depende_de",
  "contradiz",
  "substitui",
  "e_requisito_para",
  "possui_fonte",
  "e_atualizado_por",
  "e_excecao_de",
];

export const EDGE_DIRECTIONS = ["dirigida", "bidirecional"] as const;
export type EdgeDirection = (typeof EDGE_DIRECTIONS)[number];

export const EDGE_STATUSES = [
  "proposta",
  "ativa",
  "suspensa",
  "invalida",
  "arquivada",
] as const;
export type EdgeStatus = (typeof EDGE_STATUSES)[number];

export const EDGE_STATUS_LABEL: Readonly<Record<EdgeStatus, string>> = {
  proposta: "Proposta",
  ativa: "Ativa",
  suspensa: "Suspensa",
  invalida: "Inválida",
  arquivada: "Arquivada",
};

/** Só arestas ativas propagam impacto e contam como conhecimento operacional. */
export const isOperational = (s: EdgeStatus) => s === "ativa";

/** Procedência da própria relação (não do conteúdo). */
export const EDGE_SOURCE_KINDS = [
  "lei",
  "manual-inpi",
  "ato-normativo",
  "jurisprudencia",
  "documento-interno",
  "decisao-editorial",
] as const;
export type EdgeSourceKind = (typeof EDGE_SOURCE_KINDS)[number];

export const EDGE_SOURCE_KIND_LABEL: Readonly<Record<EdgeSourceKind, string>> = {
  lei: "Lei",
  "manual-inpi": "Manual INPI",
  "ato-normativo": "Ato normativo / RPI",
  jurisprudencia: "Jurisprudência",
  "documento-interno": "Documento interno",
  "decisao-editorial": "Decisão editorial",
};

export interface EdgeSource {
  readonly tipo: EdgeSourceKind;
  readonly titulo: string;
  readonly dispositivo?: string;
  readonly url?: string;
}

export interface GraphEdge {
  readonly id: string;
  readonly origem: NodeId;
  readonly destino: NodeId;
  readonly tipo: EdgeType;
  readonly direcao: EdgeDirection;
  /** Força da relação, 0..100. Peso alto = romper esta relação quebra sentido. */
  readonly peso: number;
  /** Confiança do editor na relação, 0..100. */
  readonly confianca: number;
  readonly fonte?: EdgeSource;
  readonly justificativa: string;
  readonly criadoPor: string;
  readonly criadoEm: IsoDateTime;
  readonly atualizadoEm: IsoDateTime;
  readonly ultimaValidacaoEm?: IsoDateTime;
  readonly revisorId?: string;
  readonly periodicidadeDias: number;
  readonly status: EdgeStatus;
  readonly versao: number;
  readonly observacoes?: string;
}

export const DEFAULT_EDGE_REVALIDATION_DAYS = 180;

export const emptyEdge = () => ({
  origem: "",
  destino: "",
  tipo: "esta_relacionado_a" as EdgeType,
  direcao: "dirigida" as EdgeDirection,
  peso: 60,
  confianca: 70,
  justificativa: "",
  criadoPor: "",
  periodicidadeDias: DEFAULT_EDGE_REVALIDATION_DAYS,
  status: "proposta" as EdgeStatus,
  observacoes: "",
});

/** Chave canônica de duplicidade (respeita simetria). */
export const edgeKey = (
  origem: string,
  destino: string,
  tipo: EdgeType,
  direcao: EdgeDirection,
): string => {
  const simetrica = direcao === "bidirecional" || SYMMETRIC_EDGE_TYPES.includes(tipo);
  const [a, b] = simetrica ? [origem, destino].sort() : [origem, destino];
  return `${tipo}::${a}->${b}`;
};