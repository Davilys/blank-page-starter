/** Criação e remoção de relações entre fatos, com validação estrutural. */
import type { VaultEventRepository, VaultFactRepository } from "../../ports/vault";
import type { VaultFact } from "../../../domain/vault/VaultFact";
import { checkRelation, RELATION_LABEL, type VaultRelationType } from "../../../domain/vault/relations";
import { asIsoDateTime, err, ok, type Result } from "../../../domain/shared/primitives";
import { newId } from "./saveVaultFact";

export interface RelateInput {
  readonly origemId: string;
  readonly alvoId: string;
  readonly tipo: VaultRelationType;
  readonly justificativa: string;
  readonly autorId: string;
}

export const makeRelateVaultFacts =
  (repo: VaultFactRepository, events: VaultEventRepository) =>
  async (input: RelateInput): Promise<Result<VaultFact>> => {
    const todos = await repo.list({});
    if (!todos.ok) return err<VaultFact>(todos.error as string);
    const facts = todos.value.items as VaultFact[];

    const check = checkRelation(
      facts,
      input.origemId,
      input.alvoId,
      input.tipo,
      input.justificativa,
    );
    if (!check.ok) return err<VaultFact>(check.motivo as string);

    const origem = facts.find((f) => String(f.id) === input.origemId);
    if (!origem) return err<VaultFact>("Fato de origem inexistente.");

    const agora = asIsoDateTime(new Date());
    const atualizado: VaultFact = {
      ...origem,
      relacoes: [
        ...origem.relacoes,
        {
          id: newId(),
          tipo: input.tipo,
          alvoId: input.alvoId,
          justificativa: input.justificativa.trim(),
          criadoEm: agora,
          autorId: input.autorId.trim() || "—",
        },
      ],
      atualizadoEm: agora,
    };

    const saved = await repo.save(atualizado);
    if (!saved.ok) return err<VaultFact>(saved.error as string);

    await events.append({
      id: newId(),
      fatoId: String(origem.id),
      tipo: "relacionamento",
      em: agora,
      autorId: input.autorId.trim() || "—",
      motivo: input.justificativa.trim(),
      mudancas: [`relação ${RELATION_LABEL[input.tipo]} → ${input.alvoId}`],
    });
    return ok(saved.value as VaultFact);
  };

export const makeRemoveRelation =
  (repo: VaultFactRepository, events: VaultEventRepository) =>
  async (input: {
    origemId: string;
    relacaoId: string;
    autorId: string;
    motivo: string;
  }): Promise<Result<VaultFact>> => {
    const found = await repo.findById(input.origemId);
    if (!found.ok) return err<VaultFact>(found.error as string);
    const origem = found.value as VaultFact;
    const agora = asIsoDateTime(new Date());

    const saved = await repo.save({
      ...origem,
      relacoes: origem.relacoes.filter((r) => r.id !== input.relacaoId),
      atualizadoEm: agora,
    });
    if (!saved.ok) return err<VaultFact>(saved.error as string);

    await events.append({
      id: newId(),
      fatoId: String(origem.id),
      tipo: "relacionamento",
      em: agora,
      autorId: input.autorId.trim() || "—",
      motivo: input.motivo.trim() || "Relação removida.",
      mudancas: ["relação removida"],
    });
    return ok(saved.value as VaultFact);
  };

/** Vincula/desvincula Knowledge Objects consumidores. Sem duplicar conteúdo. */
export const makeLinkKnowledgeObject =
  (repo: VaultFactRepository, events: VaultEventRepository) =>
  async (input: {
    fatoId: string;
    objetoId: string;
    autorId: string;
    vincular: boolean;
  }): Promise<Result<VaultFact>> => {
    const found = await repo.findById(input.fatoId);
    if (!found.ok) return err<VaultFact>(found.error as string);
    const fato = found.value as VaultFact;
    const agora = asIsoDateTime(new Date());

    const atuais = new Set(fato.objetosConsumidores);
    if (input.vincular) atuais.add(input.objetoId);
    else atuais.delete(input.objetoId);

    const saved = await repo.save({
      ...fato,
      objetosConsumidores: [...atuais],
      atualizadoEm: agora,
    });
    if (!saved.ok) return err<VaultFact>(saved.error as string);

    await events.append({
      id: newId(),
      fatoId: String(fato.id),
      tipo: "vinculo",
      em: agora,
      autorId: input.autorId.trim() || "—",
      motivo: input.vincular
        ? "Knowledge Object passou a consumir este fato."
        : "Vínculo removido.",
      mudancas: [`objeto ${input.objetoId}: ${input.vincular ? "vinculado" : "desvinculado"}`],
    });
    return ok(saved.value as VaultFact);
  };