/**
 * Entity model — anchors Knowledge Objects in the graph (FASE 01 + FASE 02 §2).
 *
 * Entities are referenced by ID, never by free-text mention. This guarantees
 * terminological consistency and lets any entity page be assembled
 * automatically from the objects that reference it.
 */
import type { EntityId, Score } from "../shared/primitives";

export const ENTITY_KINDS = [
  "organizacao",
  "pessoa",
  "instituicao",
  "conceito",
  "classificacao",
  "procedimento",
  "norma",
  "decisao",
] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export interface KnowledgeEntity {
  readonly id: EntityId;
  readonly slug: string;
  readonly nome: string;
  readonly kind: EntityKind;
  readonly descricaoCurta?: string;
  /** External anchors (Wikidata, official registries) that ground the entity. */
  readonly sameAs?: readonly string[];
  /** Computed by the Authority Engine. */
  readonly autoridade: Score;
}

/** An entity with no defining object and no inbound links is orphaned. */
export const isOrphan = (
  entity: KnowledgeEntity,
  inboundObjectCount: number,
): boolean => inboundObjectCount === 0 && !entity.descricaoCurta;
