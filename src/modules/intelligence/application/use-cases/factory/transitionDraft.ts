/**
 * Editorial transition (FASE 06 §3 + §4).
 * Publication is only possible from "aprovado" AND with every gate green.
 */
import type { EditorialState, KnowledgeDraft } from "../../../domain/factory/KnowledgeDraft";
import { blockingIssues } from "../../../domain/factory/validation";
import { canTransition } from "../../../domain/factory/workflow";
import {
  asIsoDateTime,
  asVersionId,
  err,
  ok,
  type KnowledgeObjectId,
  type Result,
} from "../../../domain/shared/primitives";
import type { DraftHistoryRepository, DraftRepository } from "../../ports/factory";

export interface TransitionInput {
  readonly id: KnowledgeObjectId;
  readonly para: EditorialState;
  readonly atorId: string;
  readonly justificativa?: string;
}

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const makeTransitionDraft =
  (repo: DraftRepository, history: DraftHistoryRepository) =>
  async (input: TransitionInput): Promise<Result<KnowledgeDraft>> => {
    const found = await repo.findById(input.id);
    if (!found.ok) return found;

    const atual = found.value;
    if (!canTransition(atual.estado, input.para)) {
      return err<KnowledgeDraft>(
        `Transição inválida: ${atual.estado} → ${input.para}. Publicação direta não é permitida.`,
      );
    }

    if (input.para === "publicado") {
      const issues = blockingIssues(atual);
      if (issues.length > 0) {
        return err<KnowledgeDraft>(
          `Publicação bloqueada — pendências: ${issues.map((i) => i.rotulo).join("; ")}.`,
        );
      }
    }

    const agora = asIsoDateTime(new Date());
    const next: KnowledgeDraft = {
      ...atual,
      estado: input.para,
      revisorId: input.para === "aprovado" ? input.atorId : atual.revisorId,
      dataRevisao:
        input.para === "aprovado" ? new Date().toISOString().slice(0, 10) : atual.dataRevisao,
      atualizadoEm: agora,
      versao: atual.versao + 1,
    };

    const saved = await repo.save(next);
    if (!saved.ok) return saved;

    await history.append({
      id: asVersionId(newId()),
      objetoId: atual.id,
      versao: next.versao,
      versaoAnterior: atual.versao,
      registradoEm: agora,
      autorId: input.atorId,
      motivo: input.para === "arquivado" ? "depreciacao" : "melhoria-editorial",
      resumoMudanca:
        input.justificativa?.trim() ||
        `Estado alterado de "${atual.estado}" para "${input.para}".`,
      diffs: [{ campo: "estado", antes: atual.estado, depois: input.para }],
      objetosAfetados: [],
      entidadesAfetadas: next.entidadePrincipal ? [next.entidadePrincipal] : [],
    });

    return ok(next);
  };