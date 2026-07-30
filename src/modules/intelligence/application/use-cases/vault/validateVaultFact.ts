/** Revisão, validação e obsolescência. Todas com auditoria imutável. */
import type { VaultEventRepository, VaultFactRepository } from "../../ports/vault";
import type { VaultConfidence, VaultFact } from "../../../domain/vault/VaultFact";
import { blockingVaultGates } from "../../../domain/vault/validation";
import { asIsoDateTime, err, ok, type Result } from "../../../domain/shared/primitives";
import { newId } from "./saveVaultFact";

export interface ValidateVaultFactInput {
  readonly id: string;
  readonly revisorId: string;
  readonly confianca: VaultConfidence;
  readonly motivo: string;
}

export const makeValidateVaultFact =
  (repo: VaultFactRepository, events: VaultEventRepository) =>
  async (input: ValidateVaultFactInput): Promise<Result<VaultFact>> => {
    const revisor = input.revisorId.trim();
    if (!revisor) return err<VaultFact>("Informe o revisor responsável.");

    const found = await repo.findById(input.id);
    if (!found.ok) return err<VaultFact>(found.error as string);
    const fato = found.value as VaultFact;

    if (fato.status === "obsoleto")
      return err<VaultFact>("Fato obsoleto não pode ser validado.");
    if (fato.autorId.trim() && fato.autorId.trim() === revisor)
      return err<VaultFact>("O revisor precisa ser diferente do autor do fato.");

    const agora = asIsoDateTime(new Date());
    const candidato: VaultFact = {
      ...fato,
      revisorId: revisor,
      confianca: input.confianca,
      ultimaValidacaoEm: agora,
    };

    const faltando = blockingVaultGates(candidato);
    if (faltando.length > 0) {
      return err<VaultFact>(
        `Fato não pode ser validado. Pendências: ${faltando.map((g) => g.rotulo).join(" · ")}`,
      );
    }

    const saved = await repo.save({ ...candidato, status: "validado", atualizadoEm: agora });
    if (!saved.ok) return err<VaultFact>(saved.error as string);

    await events.append({
      id: newId(),
      fatoId: String(fato.id),
      tipo: "validacao",
      em: agora,
      autorId: revisor,
      motivo: input.motivo.trim() || "Conferência humana da fonte primária.",
      mudancas: [
        `status: ${fato.status} → validado`,
        `confiança: ${fato.confianca ?? "—"} → ${input.confianca}`,
      ],
    });

    return ok(saved.value as VaultFact);
  };

export interface ReviewVaultFactInput {
  readonly id: string;
  readonly revisorId: string;
  readonly observacao: string;
}

/** Revisão sem validar: registra a passagem humana e devolve para rascunho. */
export const makeReviewVaultFact =
  (repo: VaultFactRepository, events: VaultEventRepository) =>
  async (input: ReviewVaultFactInput): Promise<Result<VaultFact>> => {
    const revisor = input.revisorId.trim();
    if (!revisor) return err<VaultFact>("Informe o revisor.");
    if (input.observacao.trim().length < 5)
      return err<VaultFact>("Descreva o resultado da revisão.");

    const found = await repo.findById(input.id);
    if (!found.ok) return err<VaultFact>(found.error as string);
    const fato = found.value as VaultFact;
    const agora = asIsoDateTime(new Date());

    const saved = await repo.save({ ...fato, revisorId: revisor, atualizadoEm: agora });
    if (!saved.ok) return err<VaultFact>(saved.error as string);

    await events.append({
      id: newId(),
      fatoId: String(fato.id),
      tipo: "revisao",
      em: agora,
      autorId: revisor,
      motivo: input.observacao.trim(),
      mudancas: ["revisão humana registrada"],
    });
    return ok(saved.value as VaultFact);
  };

export interface ObsoleteVaultFactInput {
  readonly id: string;
  readonly autorId: string;
  readonly motivo: string;
}

export const makeObsoleteVaultFact =
  (repo: VaultFactRepository, events: VaultEventRepository) =>
  async (input: ObsoleteVaultFactInput): Promise<Result<VaultFact>> => {
    if (input.motivo.trim().length < 5)
      return err<VaultFact>("Declare o motivo da obsolescência.");

    const found = await repo.findById(input.id);
    if (!found.ok) return err<VaultFact>(found.error as string);
    const fato = found.value as VaultFact;
    const agora = asIsoDateTime(new Date());

    const saved = await repo.save({
      ...fato,
      status: "obsoleto",
      vigenciaFim: fato.vigenciaFim || new Date().toISOString().slice(0, 10),
      atualizadoEm: agora,
    });
    if (!saved.ok) return err<VaultFact>(saved.error as string);

    await events.append({
      id: newId(),
      fatoId: String(fato.id),
      tipo: "obsolescencia",
      em: agora,
      autorId: input.autorId.trim() || "—",
      motivo: input.motivo.trim(),
      mudancas: [`status: ${fato.status} → obsoleto`],
    });
    return ok(saved.value as VaultFact);
  };