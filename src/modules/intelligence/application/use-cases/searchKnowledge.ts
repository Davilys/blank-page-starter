/**
 * Use case: search the knowledge base.
 *
 * FASE 04 "no invention" rule is enforced here: when nothing matches, this
 * returns an explicit empty result the UI must render as "sem resposta
 * canônica" — never a fabricated answer.
 */
import type { KnowledgeObject } from "../../domain/knowledge-object/KnowledgeObject";
import { emptyPage, err, ok, type Page, type Result } from "../../domain/shared/primitives";
import type { Intent } from "../../domain/shared/taxonomy";
import type { IntelligencePort, KnowledgeObjectRepository } from "../ports/repositories";

export interface SearchKnowledgeInput {
  readonly termo: string;
  readonly limite?: number;
}

export interface SearchKnowledgeOutput {
  readonly resultados: Page<KnowledgeObject>;
  readonly intent: Intent | null;
  readonly certezaIntent: number;
  /** True when the query produced no canonical answer — feeds the Gap Engine. */
  readonly lacuna: boolean;
}

export const makeSearchKnowledge =
  (repo: KnowledgeObjectRepository, intelligence: IntelligencePort) =>
  async (input: SearchKnowledgeInput): Promise<Result<SearchKnowledgeOutput>> => {
    const termo = input.termo.trim();
    if (termo.length === 0) {
      return ok({
        resultados: emptyPage<KnowledgeObject>(),
        intent: null,
        certezaIntent: 0,
        lacuna: false,
      });
    }

    const classificacao = await intelligence.classifyIntent(termo);
    const intent = classificacao.ok ? classificacao.value.intent : null;
    const certeza = classificacao.ok ? classificacao.value.certeza : 0;

    const busca = await repo.search({
      texto: termo,
      intent: intent ?? undefined,
      limite: input.limite ?? 10,
    });
    if (!busca.ok) return err(busca.error);

    return ok({
      resultados: busca.value,
      intent,
      certezaIntent: certeza,
      lacuna: busca.value.total === 0,
    });
  };

export type SearchKnowledge = ReturnType<typeof makeSearchKnowledge>;
