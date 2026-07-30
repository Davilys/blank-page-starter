/** Composition root do Knowledge Vault (FASE 08). */
import {
  makeGetVaultFact,
  makeGetVaultMetrics,
  makeListVaultFacts,
} from "../application/use-cases/vault/listVaultFacts";
import { makeSaveVaultFact } from "../application/use-cases/vault/saveVaultFact";
import {
  makeObsoleteVaultFact,
  makeReviewVaultFact,
  makeValidateVaultFact,
} from "../application/use-cases/vault/validateVaultFact";
import {
  makeLinkKnowledgeObject,
  makeRelateVaultFacts,
  makeRemoveRelation,
} from "../application/use-cases/vault/relateVaultFacts";
import { createLocalDraftRepository } from "./localDraftAdapters";
import {
  createLocalVaultEventRepository,
  createLocalVaultRepository,
} from "./localVaultAdapters";

const facts = createLocalVaultRepository();
const events = createLocalVaultEventRepository();
const drafts = createLocalDraftRepository();

export const vaultContainer = {
  listFacts: makeListVaultFacts(facts),
  getFact: makeGetVaultFact(facts, events),
  getMetrics: makeGetVaultMetrics(facts, events),
  saveFact: makeSaveVaultFact(facts, events),
  validateFact: makeValidateVaultFact(facts, events),
  reviewFact: makeReviewVaultFact(facts, events),
  obsoleteFact: makeObsoleteVaultFact(facts, events),
  relate: makeRelateVaultFacts(facts, events),
  removeRelation: makeRemoveRelation(facts, events),
  linkObject: makeLinkKnowledgeObject(facts, events),
  listKnowledgeObjects: () => drafts.list({}),
};

export type VaultContainer = typeof vaultContainer;