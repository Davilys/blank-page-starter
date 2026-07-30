/** Search + filters restricted to Knowledge Objects (FASE 06 §7). */
import type { KnowledgeDraft } from "../../../domain/factory/KnowledgeDraft";
import type { Page, Result } from "../../../domain/shared/primitives";
import type { DraftFilter, DraftRepository } from "../../ports/factory";

export const makeListDrafts =
  (repo: DraftRepository) =>
  (filter: DraftFilter = {}): Promise<Result<Page<KnowledgeDraft>>> =>
    repo.list(filter);

export const makeGetDraft =
  (repo: DraftRepository) =>
  (id: string): Promise<Result<KnowledgeDraft>> =>
    repo.findById(id as KnowledgeDraft["id"]);