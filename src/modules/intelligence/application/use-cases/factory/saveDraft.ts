/**
 * Save a draft (create or update) and ALWAYS append a version record.
 * FASE 03, Artigo 4: nothing is overwritten silently.
 */
import { diffDrafts } from "../../../domain/factory/diff";
import type { KnowledgeDraft } from "../../../domain/factory/KnowledgeDraft";
import { slugify } from "../../../domain/factory/KnowledgeDraft";
import type { ChangeReason } from "../../../domain/memory/KnowledgeVersion";
import {
  asIsoDateTime,
  asKnowledgeObjectId,
  asVersionId,
  err,
  ok,
  type Result,
} from "../../../domain/shared/primitives";
import type { DraftHistoryRepository, DraftRepository } from "../../ports/factory";

export interface SaveDraftInput {
  readonly draft: Omit<KnowledgeDraft, "id" | "criadoEm" | "atualizadoEm" | "versao"> & {
    readonly id?: string;
  };
  readonly motivo: ChangeReason;
  readonly resumoMudanca: string;
}

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `ko_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const makeSaveDraft =
  (repo: DraftRepository, history: DraftHistoryRepository) =>
  async (input: SaveDraftInput): Promise<Result<KnowledgeDraft>> => {
    const { draft, motivo, resumoMudanca } = input;

    if (!draft.titulo?.trim()) return err<KnowledgeDraft>("O título é obrigatório.");
    if (!draft.autorId?.trim()) return err<KnowledgeDraft>("O autor é obrigatório.");

    const id = asKnowledgeObjectId(draft.id ?? newId());
    const existing = draft.id ? await repo.findById(id) : null;
    const anterior = existing && existing.ok ? existing.value : null;
    const agora = asIsoDateTime(new Date());

    const next: KnowledgeDraft = {
      ...(draft as Omit<KnowledgeDraft, "id" | "criadoEm" | "atualizadoEm" | "versao">),
      slug: draft.slug?.trim() ? slugify(draft.slug) : slugify(draft.titulo),
      id,
      criadoEm: anterior ? anterior.criadoEm : agora,
      atualizadoEm: agora,
      versao: anterior ? anterior.versao + 1 : 1,
    };

    const diffs = diffDrafts(anterior, next);
    if (anterior && diffs.length === 0) return ok(anterior);

    const saved = await repo.save(next);
    if (!saved.ok) return saved;

    await history.append({
      id: asVersionId(newId()),
      objetoId: id,
      versao: next.versao,
      versaoAnterior: anterior ? anterior.versao : null,
      registradoEm: agora,
      autorId: next.autorId,
      motivo,
      resumoMudanca: resumoMudanca?.trim() || "Alteração editorial.",
      diffs,
      objetosAfetados: [],
      entidadesAfetadas: next.entidadePrincipal ? [next.entidadePrincipal] : [],
    });

    return ok(next);
  };