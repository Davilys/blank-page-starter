/** Reject / reopen a candidate. Both events are audited. */
import type { IngestionCandidate } from "../../../domain/ingestion/SourceDocument";
import { asIsoDateTime, err, type Result } from "../../../domain/shared/primitives";
import type { CandidateRepository, IngestionLogRepository } from "../../ports/ingestion";

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export interface RejectCandidateInput {
  readonly id: string;
  readonly usuario: string;
  readonly motivo: string;
}

export const makeRejectCandidate =
  (candidates: CandidateRepository, log: IngestionLogRepository) =>
  async (input: RejectCandidateInput): Promise<Result<IngestionCandidate>> => {
    if (!input.motivo?.trim()) {
      return err<IngestionCandidate>("Informe o motivo da rejeição: a decisão é auditável.");
    }
    const found = await candidates.findById(input.id);
    if (!found.ok) return found;

    const agora = asIsoDateTime(new Date());
    const saved = await candidates.save({
      ...found.value,
      status: "rejeitado",
      motivoRejeicao: input.motivo.trim(),
      decididoEm: agora,
    });
    if (!saved.ok) return saved;

    await log.append({
      id: newId(),
      candidatoId: found.value.id,
      evento: "rejeitado",
      arquivoNome: found.value.arquivoNome,
      formato: found.value.formato,
      origem: found.value.origem,
      usuario: input.usuario || "—",
      ocorridoEm: agora,
      destino: "Descartado",
      observacao: input.motivo.trim(),
    });
    return saved;
  };

export const makeReopenCandidate =
  (candidates: CandidateRepository, log: IngestionLogRepository) =>
  async (id: string, usuario: string): Promise<Result<IngestionCandidate>> => {
    const found = await candidates.findById(id);
    if (!found.ok) return found;
    if (found.value.status === "aprovado") {
      return err<IngestionCandidate>(
        "Candidato aprovado não pode ser reaberto: edite o Knowledge Object gerado.",
      );
    }

    const agora = asIsoDateTime(new Date());
    const saved = await candidates.save({
      ...found.value,
      status: "pendente",
      motivoRejeicao: undefined,
      decididoEm: undefined,
    });
    if (!saved.ok) return saved;

    await log.append({
      id: newId(),
      candidatoId: id,
      evento: "reaberto",
      arquivoNome: found.value.arquivoNome,
      formato: found.value.formato,
      origem: found.value.origem,
      usuario: usuario || "—",
      ocorridoEm: agora,
      destino: "Fila de candidatos",
    });
    return saved;
  };