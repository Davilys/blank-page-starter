/**
 * Use case: assemble everything the Intelligence home needs, in one call.
 *
 * The page never talks to repositories directly — it consumes this output.
 * Keeps the presentation layer free of orchestration logic.
 */
import type { KnowledgeObject } from "../../domain/knowledge-object/KnowledgeObject";
import type { KnowledgeVersion } from "../../domain/memory/KnowledgeVersion";
import { emptyPage, ok, type Page, type Result } from "../../domain/shared/primitives";
import type { KnowledgeObjectRepository, MemoryRepository } from "../ports/repositories";

export interface KnowledgeTheme {
  readonly slug: string;
  readonly titulo: string;
  readonly descricao: string;
  /** Objects published under this theme. Zero is shown honestly as "em construção". */
  readonly objetos: number;
}

export interface HomeOverview {
  readonly temas: readonly KnowledgeTheme[];
  readonly perguntasDestaque: readonly string[];
  readonly atualizacoesRecentes: Page<KnowledgeVersion>;
  readonly objetosRecentes: Page<KnowledgeObject>;
}

export const makeGetHomeOverview =
  (
    repo: KnowledgeObjectRepository,
    memory: MemoryRepository,
    temas: readonly KnowledgeTheme[],
    perguntas: readonly string[],
  ) =>
  async (): Promise<Result<HomeOverview>> => {
    const [recentes, mudancas] = await Promise.all([
      repo.listRecentlyUpdated(6),
      memory.listRecentChanges(6),
    ]);

    return ok({
      temas,
      perguntasDestaque: perguntas,
      atualizacoesRecentes: mudancas.ok ? mudancas.value : emptyPage<KnowledgeVersion>(),
      objetosRecentes: recentes.ok ? recentes.value : emptyPage<KnowledgeObject>(),
    });
  };

export type GetHomeOverview = ReturnType<typeof makeGetHomeOverview>;