/**
 * Revalidação humana e transições de estado do fato.
 * Nenhum fato entra em vigência sem passar por todos os portões.
 */
import type { FactRepository } from "../../ports/facts";
import type { Fact, FactValidation } from "../../../domain/facts/Fact";
import { blockingGates } from "../../../domain/facts/validation";
import {
  asFactId,
  asIsoDateTime,
  err,
  ok,
  type Result,
} from "../../../domain/shared/primitives";

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export interface ValidateFactInput {
  readonly id: string;
  readonly revisorId: string;
  readonly resultado: FactValidation["resultado"];
  readonly observacao?: string;
}

/** Estado resultante de cada tipo de conferência. */
const STATUS_BY_RESULT: Readonly<Record<FactValidation["resultado"], Fact["status"]>> = {
  confirmado: "vigente",
  ajustado: "vigente",
  contestado: "contestado",
  revogado: "revogado",
};

export const makeValidateFact =
  (repo: FactRepository) =>
  async (input: ValidateFactInput): Promise<Result<Fact>> => {
    const revisor = input.revisorId.trim();
    if (!revisor) return err<Fact>("Informe o revisor responsável pela validação.");

    const found = await repo.findById(asFactId(input.id));
    if (!found.ok) return err<Fact>(found.error as string);
    const fato = found.value as Fact;

    if (fato.status === "substituido") {
      return err<Fact>("Versão substituída não pode ser revalidada.");
    }
    if (fato.autorId.trim() && fato.autorId.trim() === revisor) {
      return err<Fact>("O revisor precisa ser diferente do autor do fato.");
    }

    const agora = asIsoDateTime(new Date());
    const registro: FactValidation = {
      id: newId(),
      validadoEm: agora,
      revisorId: revisor,
      resultado: input.resultado,
      observacao: input.observacao?.trim() || undefined,
    };

    const candidato: Fact = {
      ...fato,
      revisorId: revisor,
      ultimaValidacaoEm: agora,
      validacoes: [...fato.validacoes, registro],
      atualizadoEm: agora,
    };

    const alvo = STATUS_BY_RESULT[input.resultado];
    if (alvo === "vigente") {
      const faltando = blockingGates(candidato);
      if (faltando.length > 0) {
        return err<Fact>(
          `Fato não pode entrar em vigência. Pendências: ${faltando
            .map((g) => g.rotulo)
            .join(" · ")}`,
        );
      }
    }

    const saved = await repo.save({ ...candidato, status: alvo });
    return saved.ok ? ok(saved.value as Fact) : err<Fact>(saved.error as string);
  };