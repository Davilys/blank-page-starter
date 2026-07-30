/**
 * Factory dashboard metrics (FASE 06 §8). Only REAL counters — every number
 * is derived from stored drafts and stored versions. No estimates, no mocks.
 */
import type { EditorialState, KnowledgeDraft } from "../../../domain/factory/KnowledgeDraft";
import { blockingIssues } from "../../../domain/factory/validation";
import type { KnowledgeVersion } from "../../../domain/memory/KnowledgeVersion";
import { ok, type Result } from "../../../domain/shared/primitives";
import type { DraftHistoryRepository, DraftRepository } from "../../ports/factory";

export interface FactoryMetrics {
  readonly total: number;
  readonly porEstado: Readonly<Record<EditorialState, number>>;
  readonly aguardandoRevisao: readonly KnowledgeDraft[];
  readonly bloqueadosParaPublicar: number;
  readonly ultimasAlteracoes: readonly KnowledgeVersion[];
}

export const makeGetFactoryMetrics =
  (repo: DraftRepository, history: DraftHistoryRepository) =>
  async (): Promise<Result<FactoryMetrics>> => {
    const listed = await repo.list({});
    const drafts = listed.ok ? listed.value.items : [];
    const recent = await history.listRecent(10);

    const porEstado: Record<EditorialState, number> = {
      rascunho: 0,
      "em-revisao": 0,
      aprovado: 0,
      publicado: 0,
      arquivado: 0,
    };
    for (const d of drafts) porEstado[d.estado] = (porEstado[d.estado] ?? 0) + 1;

    return ok({
      total: drafts.length,
      porEstado,
      aguardandoRevisao: drafts.filter((d) => d.estado === "em-revisao"),
      bloqueadosParaPublicar: drafts.filter(
        (d) => d.estado === "aprovado" && blockingIssues(d).length > 0,
      ).length,
      ultimasAlteracoes: recent.ok ? recent.value.items : [],
    });
  };