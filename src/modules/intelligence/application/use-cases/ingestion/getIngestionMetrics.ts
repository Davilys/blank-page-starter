/** Dashboard metrics (FASE 07 §8) — counted from real records only. */
import type {
  CandidateStatus,
  IngestionCandidate,
  IngestionLogEntry,
  SourceFormat,
} from "../../../domain/ingestion/SourceDocument";
import { ok, type Result } from "../../../domain/shared/primitives";
import type { CandidateRepository, IngestionLogRepository } from "../../ports/ingestion";

export interface IngestionMetrics {
  readonly arquivosImportados: number;
  readonly candidatosGerados: number;
  readonly porStatus: Record<CandidateStatus, number>;
  readonly porFormato: Partial<Record<SourceFormat, number>>;
  readonly comDuplicidade: number;
  readonly objetosGerados: number;
  readonly pendentes: readonly IngestionCandidate[];
  readonly historico: readonly IngestionLogEntry[];
}

export const makeGetIngestionMetrics =
  (candidates: CandidateRepository, log: IngestionLogRepository) =>
  async (): Promise<Result<IngestionMetrics>> => {
    const lista = await candidates.list({});
    const itens = lista.ok ? lista.value.items : [];
    const historico = await log.listRecent(25);

    const porStatus: Record<CandidateStatus, number> = {
      pendente: 0,
      aprovado: 0,
      rejeitado: 0,
    };
    const porFormato: Partial<Record<SourceFormat, number>> = {};
    for (const c of itens) {
      porStatus[c.status] += 1;
      porFormato[c.formato] = (porFormato[c.formato] ?? 0) + 1;
    }

    return ok({
      arquivosImportados: itens.length,
      candidatosGerados: itens.length,
      porStatus,
      porFormato,
      comDuplicidade: itens.filter((c) => c.duplicidades.length > 0).length,
      objetosGerados: itens.filter((c) => Boolean(c.draftId)).length,
      pendentes: itens.filter((c) => c.status === "pendente").slice(0, 10),
      historico: historico.ok ? historico.value.items : [],
    });
  };