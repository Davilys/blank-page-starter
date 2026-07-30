/**
 * Knowledge Factory ports (FASE 06). The application layer depends only on
 * these interfaces — swapping localStorage for Supabase later touches only
 * the infrastructure adapter.
 */
import type {
  EditorialState,
  KnowledgeDraft,
  Priority,
} from "../../domain/factory/KnowledgeDraft";
import type { KnowledgeVersion } from "../../domain/memory/KnowledgeVersion";
import type { KnowledgeObjectId, Page, Result } from "../../domain/shared/primitives";
import type { KnowledgeObjectType } from "../../domain/shared/taxonomy";

export interface DraftFilter {
  readonly texto?: string;
  readonly estado?: EditorialState;
  readonly categoria?: string;
  readonly tipo?: KnowledgeObjectType;
  readonly autorId?: string;
  readonly prioridade?: Priority;
  readonly idioma?: string;
  readonly entidadePrincipal?: string;
}

export interface DraftRepository {
  list(filter: DraftFilter): Promise<Result<Page<KnowledgeDraft>>>;
  findById(id: KnowledgeObjectId): Promise<Result<KnowledgeDraft>>;
  save(draft: KnowledgeDraft): Promise<Result<KnowledgeDraft>>;
  remove(id: KnowledgeObjectId): Promise<Result<true>>;
}

/** Append-only. Implementations MUST NOT update or delete versions. */
export interface DraftHistoryRepository {
  append(version: KnowledgeVersion): Promise<Result<KnowledgeVersion>>;
  listByObject(id: KnowledgeObjectId): Promise<Result<Page<KnowledgeVersion>>>;
  listRecent(limit: number): Promise<Result<Page<KnowledgeVersion>>>;
}