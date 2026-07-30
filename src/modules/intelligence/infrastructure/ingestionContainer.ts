/**
 * Composition root of the Knowledge Ingestion Engine (FASE 07).
 * Reuses the FASE 06 draft repository so promotion lands in the same Factory.
 */
import { makeSaveDraft } from "../application/use-cases/factory/saveDraft";
import {
  makeRejectCandidate,
  makeReopenCandidate,
} from "../application/use-cases/ingestion/decideCandidate";
import { makeGetIngestionMetrics } from "../application/use-cases/ingestion/getIngestionMetrics";
import { makeImportDocument } from "../application/use-cases/ingestion/importDocument";
import { makePromoteCandidate } from "../application/use-cases/ingestion/promoteCandidate";
import { makeUpdateCandidate } from "../application/use-cases/ingestion/updateCandidate";
import type { CandidateFilter } from "../application/ports/ingestion";
import {
  createLocalDraftRepository,
  createLocalHistoryRepository,
} from "./localDraftAdapters";
import {
  createLocalCandidateRepository,
  createLocalIngestionLogRepository,
} from "./localIngestionAdapters";
import { createParserRegistry } from "./parsers/registry";

const registry = createParserRegistry();
const candidates = createLocalCandidateRepository();
const log = createLocalIngestionLogRepository();
const drafts = createLocalDraftRepository();
const draftHistory = createLocalHistoryRepository();
const saveDraft = makeSaveDraft(drafts, draftHistory);

export const ingestionContainer = {
  importDocument: makeImportDocument(registry, candidates, log, drafts),
  updateCandidate: makeUpdateCandidate(candidates, drafts),
  promoteCandidate: makePromoteCandidate(candidates, log, saveDraft),
  rejectCandidate: makeRejectCandidate(candidates, log),
  reopenCandidate: makeReopenCandidate(candidates, log),
  getMetrics: makeGetIngestionMetrics(candidates, log),
  listCandidates: (filter: CandidateFilter) => candidates.list(filter),
  getCandidate: (id: string) => candidates.findById(id),
  removeCandidate: (id: string) => candidates.remove(id),
  listCandidateLog: (id: string) => log.listByCandidate(id),
};

export type IngestionContainer = typeof ingestionContainer;