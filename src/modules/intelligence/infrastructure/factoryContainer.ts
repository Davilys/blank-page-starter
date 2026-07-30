/**
 * Composition root of the Knowledge Factory (FASE 06).
 * The ONLY place where concrete adapters are chosen.
 */
import { makeGetFactoryMetrics } from "../application/use-cases/factory/getFactoryMetrics";
import { makeGetDraft, makeListDrafts } from "../application/use-cases/factory/listDrafts";
import { makeSaveDraft } from "../application/use-cases/factory/saveDraft";
import { makeTransitionDraft } from "../application/use-cases/factory/transitionDraft";
import {
  createLocalDraftRepository,
  createLocalHistoryRepository,
} from "./localDraftAdapters";

const drafts = createLocalDraftRepository();
const history = createLocalHistoryRepository();

export const factoryContainer = {
  listDrafts: makeListDrafts(drafts),
  getDraft: makeGetDraft(drafts),
  saveDraft: makeSaveDraft(drafts, history),
  transitionDraft: makeTransitionDraft(drafts, history),
  getMetrics: makeGetFactoryMetrics(drafts, history),
  listVersions: (id: string) => history.listByObject(id as never),
};

export type FactoryContainer = typeof factoryContainer;