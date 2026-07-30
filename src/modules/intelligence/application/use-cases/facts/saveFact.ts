/**
 * Gravação de fatos com versionamento imutável.
 *
 * Mudou o SENTIDO (enunciado, valor, vigência, jurisdição)?
 *   → nasce uma NOVA versão; a anterior vira "substituido" e aponta para a nova.
 * Mudou só metadado (fonte, relacionamentos, observações)?
 *   → atualiza no lugar, sem inflar a cadeia.
 */
import type { FactRepository } from "../../ports/facts";
import {
  changesMeaning,
  emptyFact,
  type Fact,
} from "../../../domain/facts/Fact";
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

export interface SaveFactInput {
  readonly id?: string;
  readonly patch: Partial<Fact>;
  readonly autorId: string;
}

export interface SaveFactOutput {
  readonly fato: Fact;
  readonly novaVersao: boolean;
}

export const makeSaveFact =
  (repo: FactRepository) =>
  async (input: SaveFactInput): Promise<Result<SaveFactOutput>> => {
    const agora = asIsoDateTime(new Date());
    const autor = input.autorId.trim();
    if (!autor) return err<SaveFactOutput>("Informe o autor da alteração.");

    // Criação.
    if (!input.id) {
      const id = asFactId(newId());
      const fato: Fact = {
        ...emptyFact(),
        ...input.patch,
        id,
        raizId: id,
        versao: 1,
        status: "rascunho",
        autorId: autor,
        validacoes: [],
        criadoEm: agora,
        atualizadoEm: agora,
      } as Fact;
      const saved = await repo.save(fato);
      return saved.ok
        ? ok({ fato: saved.value as Fact, novaVersao: true })
        : err<SaveFactOutput>(saved.error as string);
    }

    const atual = await repo.findById(asFactId(input.id));
    if (!atual.ok) return err<SaveFactOutput>(atual.error as string);
    const anterior = atual.value as Fact;

    if (anterior.status === "substituido") {
      return err<SaveFactOutput>(
        "Esta versão foi substituída e é imutável. Edite a versão vigente da cadeia.",
      );
    }

    // Alteração de metadados: atualização direta.
    if (!changesMeaning(anterior, input.patch)) {
      const atualizado: Fact = {
        ...anterior,
        ...input.patch,
        id: anterior.id,
        raizId: anterior.raizId,
        versao: anterior.versao,
        atualizadoEm: agora,
      };
      const saved = await repo.save(atualizado);
      return saved.ok
        ? ok({ fato: saved.value as Fact, novaVersao: false })
        : err<SaveFactOutput>(saved.error as string);
    }

    // Alteração de sentido: nova versão, anterior preservada.
    const novoId = asFactId(newId());
    const nova: Fact = {
      ...anterior,
      ...input.patch,
      id: novoId,
      raizId: anterior.raizId,
      versao: anterior.versao + 1,
      substituiFatoId: anterior.id,
      substituidoPorId: undefined,
      status: "rascunho",
      // Uma afirmação nova precisa de nova conferência humana.
      ultimaValidacaoEm: undefined,
      validacoes: [],
      autorId: autor,
      criadoEm: agora,
      atualizadoEm: agora,
    };

    const congelada: Fact = {
      ...anterior,
      status: "substituido",
      substituidoPorId: novoId,
      vigenciaFim: anterior.vigenciaFim || (input.patch.vigenciaInicio ?? anterior.vigenciaFim),
      atualizadoEm: agora,
    };

    const a = await repo.save(congelada);
    if (!a.ok) return err<SaveFactOutput>(a.error as string);
    const b = await repo.save(nova);
    return b.ok
      ? ok({ fato: b.value as Fact, novaVersao: true })
      : err<SaveFactOutput>(b.error as string);
  };