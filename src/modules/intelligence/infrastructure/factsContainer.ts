/** Composition root do Fact Ledger (FASE 08). */
import { makeGetFactMetrics } from "../application/use-cases/facts/getFactMetrics";
import { makeGetFact, makeListFacts } from "../application/use-cases/facts/listFacts";
import { makeSaveFact } from "../application/use-cases/facts/saveFact";
import { makeValidateFact } from "../application/use-cases/facts/validateFact";
import { createLocalDraftRepository } from "./localDraftAdapters";
import { createLocalFactRepository } from "./localFactAdapters";

const facts = createLocalFactRepository();
const drafts = createLocalDraftRepository();

export const factsContainer = {
  listFacts: makeListFacts(facts),
  getFact: makeGetFact(facts, drafts),
  saveFact: makeSaveFact(facts),
  validateFact: makeValidateFact(facts),
  getMetrics: makeGetFactMetrics(facts),
  listDraftsForLinking: () => drafts.list({}),
};

export type FactsContainer = typeof factsContainer;