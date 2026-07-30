/** Editor choices + duplicate re-check. Pure orchestration, no generation. */
import { detectDuplicates } from "../../../domain/ingestion/duplicates";
import type { CandidateChoices, IngestionCandidate } from "../../../domain/ingestion/SourceDocument";
import { err, ok, type Result } from "../../../domain/shared/primitives";
import type { DraftRepository } from "../../ports/factory";
import type { CandidateRepository } from "../../ports/ingestion";

export interface UpdateCandidateInput {
  readonly id: string;
  readonly escolhas: CandidateChoices;
}

export const makeUpdateCandidate =
  (candidates: CandidateRepository, drafts: DraftRepository) =>
  async (input: UpdateCandidateInput): Promise<Result<IngestionCandidate>> => {
    const atual = await candidates.findById(input.id);
    if (!atual.ok) return atual;
    if (atual.value.status !== "pendente") {
      return err<IngestionCandidate>("Candidato já decidido: reabra antes de editar.");
    }
    if (input.escolhas.estadoInicial === "publicado") {
      return err<IngestionCandidate>(
        "Publicação direta é proibida. O objeto deve percorrer o workflow editorial.",
      );
    }

    const existentes = await drafts.list({});
    const duplicidades = detectDuplicates(
      input.escolhas,
      atual.value.estrutura,
      existentes.ok ? existentes.value.items : [],
    );

    return candidates.save({ ...atual.value, escolhas: input.escolhas, duplicidades });
  };