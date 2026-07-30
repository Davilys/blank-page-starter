/**
 * Promote a candidate into the FASE 06 Knowledge Factory.
 *
 * The generated draft ALWAYS enters the editorial workflow in a non-public
 * state. Publication remains impossible from here by construction.
 */
import { candidateToDraft } from "../../../domain/ingestion/mapping";
import type { IngestionCandidate } from "../../../domain/ingestion/SourceDocument";
import { asIsoDateTime, err, ok, type Result } from "../../../domain/shared/primitives";
import type { makeSaveDraft } from "../factory/saveDraft";
import type { CandidateRepository, IngestionLogRepository } from "../../ports/ingestion";

export interface PromoteCandidateInput {
  readonly id: string;
  readonly usuario: string;
}

export interface PromoteResult {
  readonly candidato: IngestionCandidate;
  readonly draftId: string;
}

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const makePromoteCandidate =
  (
    candidates: CandidateRepository,
    log: IngestionLogRepository,
    saveDraft: ReturnType<typeof makeSaveDraft>,
  ) =>
  async (input: PromoteCandidateInput): Promise<Result<PromoteResult>> => {
    const found = await candidates.findById(input.id);
    if (!found.ok) return err<PromoteResult>(found.error);

    const c = found.value;
    if (c.status === "aprovado") return err<PromoteResult>("Candidato já aprovado.");
    if (!c.escolhas.titulo.trim()) return err<PromoteResult>("Defina o título antes de aprovar.");
    if (!c.escolhas.autorId.trim()) return err<PromoteResult>("Defina o autor antes de aprovar.");
    if (c.escolhas.estadoInicial === "publicado" || c.escolhas.estadoInicial === "arquivado") {
      return err<PromoteResult>("Estado inicial inválido: use Rascunho ou Em Revisão.");
    }

    const saved = await saveDraft({
      draft: candidateToDraft(c),
      motivo: "expansao",
      resumoMudanca: `Criado por ingestão do arquivo "${c.arquivoNome}".`,
    });
    if (!saved.ok) return err<PromoteResult>(saved.error);

    const agora = asIsoDateTime(new Date());
    const atualizado: IngestionCandidate = {
      ...c,
      status: "aprovado",
      draftId: saved.value.id,
      decididoEm: agora,
    };
    const persisted = await candidates.save(atualizado);
    if (!persisted.ok) return err<PromoteResult>(persisted.error);

    await log.append({
      id: newId(),
      candidatoId: c.id,
      evento: "aprovado",
      arquivoNome: c.arquivoNome,
      formato: c.formato,
      origem: c.origem,
      usuario: input.usuario || c.escolhas.autorId,
      ocorridoEm: agora,
      destino: "Knowledge Factory",
      draftId: saved.value.id,
      observacao: `Objeto criado em "${c.escolhas.estadoInicial}". Publicação continua sujeita ao workflow editorial.`,
    });

    return ok({ candidato: persisted.value, draftId: saved.value.id });
  };