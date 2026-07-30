/**
 * FASE 07 — Knowledge Ingestion Engine.
 *
 * Pure domain model of an INGESTED DOCUMENT and of the CANDIDATE it produces.
 *
 * Hard constitutional rule of this phase: ingestion NEVER creates knowledge.
 * It only extracts STRUCTURE (headings, paragraphs, lists, tables, links,
 * dates, keyword frequency). No AI, no summarisation, no interpretation.
 * A candidate is an inbox item — it becomes a Knowledge Object only when a
 * human promotes it into the FASE 06 editorial workflow.
 */
import type { IsoDateTime } from "../shared/primitives";
import type { KnowledgeObjectType } from "../shared/taxonomy";
import type { EditorialState, Priority } from "../factory/KnowledgeDraft";

export const SOURCE_FORMATS = ["txt", "md", "html", "pdf", "docx", "json", "csv"] as const;
export type SourceFormat = (typeof SOURCE_FORMATS)[number];

export const SOURCE_FORMAT_LABEL: Readonly<Record<SourceFormat, string>> = {
  txt: "Texto simples",
  md: "Markdown",
  html: "HTML",
  pdf: "PDF (texto)",
  docx: "DOCX (texto)",
  json: "JSON",
  csv: "CSV",
};

export const EXTENSION_TO_FORMAT: Readonly<Record<string, SourceFormat>> = {
  txt: "txt",
  text: "txt",
  md: "md",
  markdown: "md",
  html: "html",
  htm: "html",
  pdf: "pdf",
  docx: "docx",
  json: "json",
  csv: "csv",
};

export const detectFormat = (fileName: string): SourceFormat | null => {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TO_FORMAT[ext] ?? null;
};

/* ── Structural extraction result ─────────────────────────────────────────── */

export interface DocumentList {
  readonly ordenada: boolean;
  readonly itens: readonly string[];
}

export interface DocumentTable {
  readonly cabecalho: readonly string[];
  readonly linhas: readonly (readonly string[])[];
}

/** Exactly the seven structural artefacts allowed by FASE 07 §5. */
export interface StructuredDocument {
  readonly tituloSugerido: string;
  readonly subtitulos: readonly string[];
  readonly paragrafos: readonly string[];
  readonly listas: readonly DocumentList[];
  readonly tabelas: readonly DocumentTable[];
  readonly links: readonly string[];
  readonly datas: readonly string[];
  readonly palavrasChave: readonly string[];
  readonly totalCaracteres: number;
}

export const emptyStructure = (): StructuredDocument => ({
  tituloSugerido: "",
  subtitulos: [],
  paragrafos: [],
  listas: [],
  tabelas: [],
  links: [],
  datas: [],
  palavrasChave: [],
  totalCaracteres: 0,
});

/** Raw parse output: verbatim text + structure. Never a summary. */
export interface ParsedDocument {
  readonly texto: string;
  readonly estrutura: StructuredDocument;
  /** Non-fatal notes from the parser (e.g. "PDF sem camada de texto"). */
  readonly avisos: readonly string[];
}

/* ── Candidate ────────────────────────────────────────────────────────────── */

export const CANDIDATE_STATUSES = ["pendente", "aprovado", "rejeitado"] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const CANDIDATE_STATUS_LABEL: Readonly<Record<CandidateStatus, string>> = {
  pendente: "Pendente de revisão",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

/** Editorial choices the human makes before promotion (FASE 07 §4). */
export interface CandidateChoices {
  readonly titulo: string;
  readonly categoria: string;
  readonly tipo: KnowledgeObjectType;
  readonly entidadePrincipal: string;
  readonly idioma: string;
  readonly jurisdicao: string;
  readonly prioridade: Priority;
  readonly autorId: string;
  readonly revisorId: string;
  /** Only non-published states may be chosen — enforced by the use case. */
  readonly estadoInicial: EditorialState;
}

export interface DuplicateSuspicion {
  readonly draftId: string;
  readonly titulo: string;
  readonly motivos: readonly string[];
  /** 0..1 textual similarity. Advisory only — never blocks (FASE 07 §7). */
  readonly similaridade: number;
}

export interface IngestionCandidate {
  readonly id: string;
  readonly arquivoNome: string;
  readonly formato: SourceFormat;
  readonly tamanhoBytes: number;
  readonly origem: string;
  readonly importadoPor: string;
  readonly importadoEm: IsoDateTime;
  readonly texto: string;
  readonly estrutura: StructuredDocument;
  readonly avisos: readonly string[];
  readonly escolhas: CandidateChoices;
  readonly status: CandidateStatus;
  readonly duplicidades: readonly DuplicateSuspicion[];
  readonly motivoRejeicao?: string;
  /** Knowledge Object (draft) generated on promotion. */
  readonly draftId?: string;
  readonly decididoEm?: IsoDateTime;
}

/** Append-only ingestion audit entry (FASE 07 §9). */
export const INGESTION_EVENTS = ["importado", "aprovado", "rejeitado", "reaberto"] as const;
export type IngestionEvent = (typeof INGESTION_EVENTS)[number];

export interface IngestionLogEntry {
  readonly id: string;
  readonly candidatoId: string;
  readonly evento: IngestionEvent;
  readonly arquivoNome: string;
  readonly formato: SourceFormat;
  readonly origem: string;
  readonly usuario: string;
  readonly ocorridoEm: IsoDateTime;
  readonly destino?: string;
  readonly draftId?: string;
  readonly observacao?: string;
}

export const defaultChoices = (tituloSugerido: string): CandidateChoices => ({
  titulo: tituloSugerido,
  categoria: "",
  tipo: "conceito",
  entidadePrincipal: "",
  idioma: "pt-BR",
  jurisdicao: "BR/LPI",
  prioridade: "media",
  autorId: "",
  revisorId: "",
  estadoInicial: "rascunho",
});