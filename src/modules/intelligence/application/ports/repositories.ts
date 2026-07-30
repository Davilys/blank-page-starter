/**
 * Application ports (hexagonal boundary).
 *
 * The application layer depends ONLY on these interfaces. Infrastructure
 * implements them. Swapping the in-memory adapter for a real backend in a
 * later phase requires zero changes above this line — that is the whole point
 * of shipping the foundation this way.
 */
import type { KnowledgeEntity } from "../../domain/entity/Entity";
import type { KnowledgeObject } from "../../domain/knowledge-object/KnowledgeObject";
import type { KnowledgeVersion } from "../../domain/memory/KnowledgeVersion";
import type {
  EntityId,
  KnowledgeObjectId,
  Page,
  Result,
} from "../../domain/shared/primitives";
import type { Audience, Intent, KnowledgeContext } from "../../domain/shared/taxonomy";

export interface KnowledgeObjectQuery {
  readonly texto?: string;
  readonly categoria?: string;
  readonly entidadeId?: EntityId;
  readonly intent?: Intent;
  readonly limite?: number;
}

/** Read side of the Knowledge Object store. */
export interface KnowledgeObjectRepository {
  findById(id: KnowledgeObjectId): Promise<Result<KnowledgeObject>>;
  findBySlug(slug: string): Promise<Result<KnowledgeObject>>;
  search(query: KnowledgeObjectQuery): Promise<Result<Page<KnowledgeObject>>>;
  listRecentlyUpdated(limit: number): Promise<Result<Page<KnowledgeObject>>>;
}

/** Entity Engine port (FASE 02 §2). */
export interface EntityRepository {
  findById(id: EntityId): Promise<Result<KnowledgeEntity>>;
  listByKind(limit: number): Promise<Result<Page<KnowledgeEntity>>>;
}

/** Knowledge Memory port (FASE 03, Artigo 4) — append-only by contract. */
export interface MemoryRepository {
  listVersions(objetoId: KnowledgeObjectId): Promise<Result<Page<KnowledgeVersion>>>;
  listRecentChanges(limit: number): Promise<Result<Page<KnowledgeVersion>>>;
}

/**
 * Knowledge Fabric port — resolves references between objects (FASE 03 §3).
 * FASE 05 only declares it; traversal logic lands with the Fabric phase.
 */
export interface FabricPort {
  relatedObjects(id: KnowledgeObjectId, limit: number): Promise<Result<Page<KnowledgeObject>>>;
  dependentsOf(id: KnowledgeObjectId): Promise<Result<Page<KnowledgeObject>>>;
}

/**
 * Intelligence Layer port (FASE 04). Declared now so the UI can already speak
 * in terms of intent/audience/context. The FASE 05 adapter returns neutral
 * defaults — it never guesses, per the "no invention" rule.
 */
export interface IntelligencePort {
  classifyIntent(pergunta: string): Promise<Result<{ intent: Intent; certeza: number }>>;
  resolveContext(input: Partial<KnowledgeContext>): Promise<Result<KnowledgeContext>>;
  resolveAudience(hint?: string): Promise<Result<Audience>>;
}