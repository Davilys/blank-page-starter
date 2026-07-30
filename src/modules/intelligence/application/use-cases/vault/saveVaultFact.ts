/** Criação e alteração de fatos, sempre com auditoria e motivo declarado. */
import type { VaultEventRepository, VaultFactRepository } from "../../ports/vault";
import {
  changesMeaning,
  diffFacts,
  emptyVaultFact,
  type VaultEvent,
  type VaultFact,
} from "../../../domain/vault/VaultFact";
import {
  asFactId,
  asIsoDateTime,
  err,
  ok,
  type Result,
} from "../../../domain/shared/primitives";

export const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export interface SaveVaultFactInput {
  readonly id?: string;
  readonly patch: Partial<VaultFact>;
  readonly autorId: string;
  readonly motivo: string;
}

export const makeSaveVaultFact =
  (repo: VaultFactRepository, events: VaultEventRepository) =>
  async (input: SaveVaultFactInput): Promise<Result<VaultFact>> => {
    const autor = input.autorId.trim();
    if (!autor) return err<VaultFact>("Informe o autor da alteração.");
    const agora = asIsoDateTime(new Date());

    if (!input.id) {
      const fato: VaultFact = {
        ...emptyVaultFact(),
        ...input.patch,
        id: asFactId(newId()),
        status: "rascunho",
        autorId: autor,
        motivoUltimaAlteracao: input.motivo.trim(),
        criadoEm: agora,
        atualizadoEm: agora,
      } as VaultFact;

      const saved = await repo.save(fato);
      if (!saved.ok) return err<VaultFact>(saved.error as string);
      await events.append({
        id: newId(),
        fatoId: String(fato.id),
        tipo: "criacao",
        em: agora,
        autorId: autor,
        motivo: input.motivo.trim() || "Criação do fato.",
        mudancas: ["fato criado"],
      } satisfies VaultEvent);
      return ok(saved.value as VaultFact);
    }

    const atual = await repo.findById(input.id);
    if (!atual.ok) return err<VaultFact>(atual.error as string);
    const anterior = atual.value as VaultFact;

    const material = changesMeaning(anterior, input.patch);
    if (material && input.motivo.trim().length < 5) {
      return err<VaultFact>(
        "Alteração de sentido exige motivo declarado (mínimo 5 caracteres).",
      );
    }

    const mudancas = diffFacts(anterior, input.patch);
    if (mudancas.length === 0) return ok(anterior);

    const atualizado: VaultFact = {
      ...anterior,
      ...input.patch,
      id: anterior.id,
      criadoEm: anterior.criadoEm,
      motivoUltimaAlteracao: input.motivo.trim() || anterior.motivoUltimaAlteracao,
      atualizadoEm: agora,
      // Mudou o sentido? A validação anterior não vale mais.
      ...(material && anterior.status === "validado"
        ? { status: "rascunho" as const, ultimaValidacaoEm: undefined }
        : {}),
    };

    const saved = await repo.save(atualizado);
    if (!saved.ok) return err<VaultFact>(saved.error as string);

    await events.append({
      id: newId(),
      fatoId: String(anterior.id),
      tipo: "alteracao",
      em: agora,
      autorId: autor,
      motivo: input.motivo.trim() || "Ajuste de metadados.",
      mudancas,
    });

    return ok(saved.value as VaultFact);
  };