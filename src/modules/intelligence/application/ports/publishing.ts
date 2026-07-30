/**
 * FASE 11 — Portas do Knowledge Publishing Engine.
 *
 * CQRS: leituras (`list*`, `find*`) e escritas (`append`, `setActive`) são
 * contratos distintos. Publicações e auditoria são APPEND-ONLY: nenhuma
 * implementação pode atualizar conteúdo já publicado nem apagar registros.
 */
import type {
  PublicationAuditRecord,
  PublishedVersion,
} from "../../domain/publishing/Publication";
import type { Page, Result } from "../../domain/shared/primitives";

export interface PublicationRepository {
  /** Grava uma nova versão publicada. Nunca sobrescreve versões anteriores. */
  append(version: PublishedVersion): Promise<Result<PublishedVersion>>;
  /** Define qual versão está no ar (rollback usa este comando). */
  setActive(objetoId: string, versao: number): Promise<Result<PublishedVersion>>;
  /** Retira o objeto do ar sem apagar histórico. */
  deactivate(objetoId: string): Promise<Result<true>>;
  listByObject(objetoId: string): Promise<Result<Page<PublishedVersion>>>;
  listActive(): Promise<Result<Page<PublishedVersion>>>;
  listAll(): Promise<Result<Page<PublishedVersion>>>;
}

/** Append-only estrito: sem update, sem delete. */
export interface PublicationAuditRepository {
  append(record: PublicationAuditRecord): Promise<Result<PublicationAuditRecord>>;
  list(limit?: number): Promise<Result<Page<PublicationAuditRecord>>>;
}