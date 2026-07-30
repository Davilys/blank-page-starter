/**
 * The Knowledge Object — the atomic unit of the Knowledge OS (FASE 03).
 *
 * CRITICAL modelling decision (FASE 03, Artigo 10 critique):
 * Derivations (short/medium/long answers, summaries, checklists, JSON-LD,
 * OpenGraph, WhatsApp text, embeddings…) are NOT stored on the object.
 * They are OUTPUTS computed by the derivation layer. Storing them as inputs
 * was explicitly identified as the gravest conceptual error to avoid.
 *
 * The object therefore carries a lean, ~12-field mandatory core plus optional
 * slots. Everything else is derived or referenced.
 */
import type {
  EntityId,
  FactId,
  IsoDateTime,
  KnowledgeObjectId,
  Score,
  SourceId,
} from "../shared/primitives";
import type {
  Audience,
  Intent,
  KnowledgeContext,
  KnowledgeObjectType,
  LifecycleStatus,
  RelationshipType,
} from "../shared/taxonomy";

/** A source is a first-class object: hashed and monitored (FASE 03, Artigo 3). */
export interface Source {
  readonly id: SourceId;
  readonly titulo: string;
  readonly url?: string;
  /** oficial > jurisprudencia > doutrina > secundaria (drives Trust tiers). */
  readonly tier: "oficial" | "jurisprudencia" | "doutrina" | "secundaria";
  readonly acessadoEm: IsoDateTime;
}

/**
 * An atomic assertion. Facts live in a shared pool and are referenced, never
 * copied — this is what makes maintenance cost grow sublinearly (FASE 03 §3).
 */
export interface Fact {
  readonly id: FactId;
  readonly afirmacao: string;
  readonly fontes: readonly SourceId[];
  readonly vigenteDesde?: IsoDateTime;
  readonly vigenteAte?: IsoDateTime;
}

/** A typed, directed, sourced edge between two objects (FASE 03, Artigo 7). */
export interface Relationship {
  readonly tipo: RelationshipType;
  readonly alvo: KnowledgeObjectId;
  readonly motivo?: string;
}

/**
 * Aptitude profile: how well this object can serve each intent.
 * Declaring what an object CANNOT answer is what prevents forced answers —
 * identified in FASE 04 as the single most valuable idea of that phase.
 */
export type AptitudeProfile = Partial<Record<Intent, number>>;

/** Governance metadata — human accountability is non-negotiable. */
export interface Governance {
  readonly autorId: string;
  readonly revisorId?: string;
  readonly criadoEm: IsoDateTime;
  readonly revisadoEm?: IsoDateTime;
  /** Time-to-live in days, by object type. Drives automatic expiry. */
  readonly ttlDias: number;
  readonly criticidade: "baixa" | "media" | "alta";
}

/** Optional content slots. Presence per type is validated by the policy layer. */
export interface KnowledgeSlots {
  readonly definicao?: string;
  readonly etapas?: readonly string[];
  readonly requisitos?: readonly string[];
  readonly exemplos?: readonly string[];
  readonly perguntasRelacionadas?: readonly string[];
  readonly sinonimos?: readonly string[];
  readonly palavrasChave?: readonly string[];
}

/** The Knowledge Object itself. Immutable — changes produce a new version. */
export interface KnowledgeObject {
  readonly id: KnowledgeObjectId;
  readonly slug: string;
  readonly titulo: string;
  readonly tipo: KnowledgeObjectType;
  readonly entidadePrincipal: EntityId;
  readonly categoria: string;
  readonly subcategoria?: string;
  readonly contexto: KnowledgeContext;
  readonly fatos: readonly Fact[];
  readonly relacionamentos: readonly Relationship[];
  readonly aptidao: AptitudeProfile;
  readonly slots: KnowledgeSlots;
  readonly governanca: Governance;
  readonly status: LifecycleStatus;
  /** Computed by the Authority Engine — never written by hand. */
  readonly confianca: Score;
  readonly versao: number;
}

/* ── Pure domain rules (unit-testable, no I/O) ────────────────────────────── */

/** An object with no sourced fact is opinion, not knowledge. */
export const hasSourcedFacts = (ko: KnowledgeObject): boolean =>
  ko.fatos.length > 0 && ko.fatos.every((f) => f.fontes.length > 0);

/** Contradiction edges block publication until a human resolves them. */
export const hasBlockingContradiction = (ko: KnowledgeObject): boolean =>
  ko.relacionamentos.some((r) => r.tipo === "contradiz");

/** Expiry is honest: stale objects are withdrawn, not silently served. */
export const isExpired = (ko: KnowledgeObject, now: Date = new Date()): boolean => {
  const base = ko.governanca.revisadoEm ?? ko.governanca.criadoEm;
  const ageDays = (now.getTime() - new Date(base).getTime()) / 86_400_000;
  return ageDays > ko.governanca.ttlDias;
};

/** How well this object serves a given intent (0..1). Absent = cannot serve. */
export const aptitudeFor = (ko: KnowledgeObject, intent: Intent): number =>
  ko.aptidao[intent] ?? 0;

/** Audience never changes facts — only presentation (FASE 04 §2). */
export const factsFor = (ko: KnowledgeObject, _audience: Audience): readonly Fact[] =>
  ko.fatos;