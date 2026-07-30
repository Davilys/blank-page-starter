/**
 * Canonical taxonomies of the Knowledge OS.
 *
 * These are the ONLY allowed values across the whole module. Any engine added
 * in later phases must consume these constants instead of redeclaring strings.
 *
 * Constitution: FASE 03 Artigo 7 (relationships), FASE 03 Artigo 8 (lifecycle),
 * FASE 04 §1 (intent), §2 (audience), §3 (context), §4 (derivations).
 */

/* ── Knowledge Object types (FASE 03, Artigo 1) ───────────────────────────── */
export const KNOWLEDGE_OBJECT_TYPES = [
  "conceito",
  "fato-normativo",
  "procedimento",
  "prazo",
  "custo",
  "requisito",
  "excecao",
  "decisao",
  "classificacao",
  "pergunta-canonica",
  "caso-pratico",
  "comparacao",
  "alerta-mudanca",
] as const;
export type KnowledgeObjectType = (typeof KNOWLEDGE_OBJECT_TYPES)[number];

/* ── Lifecycle status (FASE 03, Artigo 8) ─────────────────────────────────── */
export const LIFECYCLE_STATUSES = [
  "rascunho",
  "em-revisao",
  "publicado",
  "vencido",
  "arquivado",
  "substituido",
] as const;
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

/** Only published objects may be derived, indexed or served publicly. */
export const isPubliclyServable = (status: LifecycleStatus) => status === "publicado";

/* ── Intent (FASE 04 §1 — reduced set per the FASE 04 critique) ───────────── */
export const INTENTS = [
  "informacional",
  "procedimental",
  "comercial",
  "urgente",
  "comparativa",
  "juridica",
] as const;
export type Intent = (typeof INTENTS)[number];

/* ── Audience lenses (FASE 04 §2 — three lenses, per the critique) ────────── */
export const AUDIENCES = ["leigo", "empresa", "profissional"] as const;
export type Audience = (typeof AUDIENCES)[number];

/** Neutral, most conservative lens used whenever the audience is unknown. */
export const DEFAULT_AUDIENCE: Audience = "empresa";

/* ── Context dimensions (FASE 04 §3 — declared, never inferred silently) ──── */
export interface KnowledgeContext {
  readonly jurisdicao: string;
  readonly pais: string;
  readonly idioma: string;
  readonly faseProcesso?: string;
}

export const DEFAULT_CONTEXT: KnowledgeContext = {
  jurisdicao: "BR/LPI",
  pais: "BR",
  idioma: "pt-BR",
};

/* ── Relationships (FASE 03, Artigo 7 — core five kept active) ────────────── */
export const RELATIONSHIP_TYPES = [
  "depende-de",
  "contradiz",
  "complementa",
  "substitui",
  "e-excecao-de",
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

/** Blocking relations prevent publication until a human resolves them. */
export const BLOCKING_RELATIONSHIPS: readonly RelationshipType[] = ["contradiz"];

/* ── Derivation formats (FASE 03 Artigo 6 / FASE 04 §4) ───────────────────── */
export const DERIVATION_FORMATS = [
  "resposta-curta",
  "resposta-media",
  "resposta-completa",
  "resumo-executivo",
  "checklist",
  "tabela",
  "fluxograma",
  "faq",
  "json-ld",
  "markdown",
] as const;
export type DerivationFormat = (typeof DERIVATION_FORMATS)[number];

/** Canonical format per intent — deterministic, auditable (FASE 04 §4). */
export const CANONICAL_FORMAT_BY_INTENT: Readonly<Record<Intent, DerivationFormat>> = {
  informacional: "resposta-curta",
  procedimental: "checklist",
  comercial: "tabela",
  urgente: "resposta-curta",
  comparativa: "tabela",
  juridica: "resposta-completa",
};