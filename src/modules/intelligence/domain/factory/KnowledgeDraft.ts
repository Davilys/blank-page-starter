/**
 * FASE 06 — Knowledge Factory.
 *
 * The DRAFT is the editorial artefact humans manipulate. It is NOT the
 * Knowledge Object: the object (FASE 03) is lean and derived-free, while the
 * draft carries the editorial slots the newsroom needs. A published draft is
 * projected into a KnowledgeObject by `toKnowledgeObject` — this keeps the
 * FASE 03 anatomy untouched while giving editors a practical workspace.
 *
 * No AI, no embeddings, no generation. Pure data + pure rules.
 */
import type {
  EntityId,
  IsoDateTime,
  KnowledgeObjectId,
} from "../shared/primitives";
import type {
  KnowledgeObjectType,
  RelationshipType,
} from "../shared/taxonomy";

/* ── Editorial workflow states (FASE 06 §3) ───────────────────────────────
 * Mapped onto the FASE 03 lifecycle:
 *   rascunho → rascunho | em-revisao → em-revisao
 *   aprovado → (still em-revisao for the public layer: not servable)
 *   publicado → publicado | arquivado → arquivado
 */
export const EDITORIAL_STATES = [
  "rascunho",
  "em-revisao",
  "aprovado",
  "publicado",
  "arquivado",
] as const;
export type EditorialState = (typeof EDITORIAL_STATES)[number];

export const EDITORIAL_STATE_LABEL: Readonly<Record<EditorialState, string>> = {
  rascunho: "Rascunho",
  "em-revisao": "Em Revisão",
  aprovado: "Aprovado",
  publicado: "Publicado",
  arquivado: "Arquivado",
};

export const PRIORITIES = ["baixa", "media", "alta", "critica"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** A source as captured by the editor. Tier drives Trust (FASE 02). */
export interface DraftSource {
  readonly id: string;
  readonly titulo: string;
  readonly url?: string;
  readonly tier: "oficial" | "jurisprudencia" | "doutrina" | "secundaria";
  readonly acessadoEm?: string;
}

export interface DraftRelationship {
  readonly tipo: RelationshipType;
  readonly alvoSlug: string;
  readonly motivo?: string;
}

export interface DraftFaqItem {
  readonly pergunta: string;
  readonly resposta: string;
}

/** Everything an editor can fill in (FASE 06 §2). */
export interface KnowledgeDraft {
  readonly id: KnowledgeObjectId;
  readonly slug: string;
  readonly titulo: string;
  readonly descricao: string;
  readonly tipo: KnowledgeObjectType;
  readonly categoria: string;
  readonly entidadePrincipal: EntityId;
  readonly relacionamentos: readonly DraftRelationship[];
  readonly fontes: readonly DraftSource[];
  readonly estado: EditorialState;
  readonly prioridade: Priority;
  readonly idioma: string;
  readonly jurisdicao: string;
  readonly palavrasChave: readonly string[];
  readonly resumoCurto: string;
  readonly resumoTecnico: string;
  readonly explicacaoCompleta: string;
  readonly checklist: readonly string[];
  readonly fluxograma: string;
  readonly faq: readonly DraftFaqItem[];
  readonly linksInternos: readonly string[];
  readonly linksExternos: readonly string[];
  readonly dataRevisao?: string;
  readonly observacoes: string;
  readonly autorId: string;
  readonly revisorId?: string;
  readonly criadoEm: IsoDateTime;
  readonly atualizadoEm: IsoDateTime;
  readonly versao: number;
}

/** Slug helper — deterministic, accent-free, no external dependency. */
export const slugify = (v: string): string =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

/** Empty draft factory — single source of truth for defaults. */
export const emptyDraft = (): Omit<
  KnowledgeDraft,
  "id" | "criadoEm" | "atualizadoEm" | "versao"
> => ({
  slug: "",
  titulo: "",
  descricao: "",
  tipo: "conceito",
  categoria: "",
  entidadePrincipal: "" as EntityId,
  relacionamentos: [],
  fontes: [],
  estado: "rascunho",
  prioridade: "media",
  idioma: "pt-BR",
  jurisdicao: "BR/LPI",
  palavrasChave: [],
  resumoCurto: "",
  resumoTecnico: "",
  explicacaoCompleta: "",
  checklist: [],
  fluxograma: "",
  faq: [],
  linksInternos: [],
  linksExternos: [],
  observacoes: "",
  autorId: "",
});