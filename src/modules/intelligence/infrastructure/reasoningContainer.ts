/** Composition root do Knowledge Reasoning Engine (FASE 10). Somente leitura. */
import { makeGetReasoningMetrics } from "../application/use-cases/reasoning/getReasoningMetrics";
import { makeReasoningUseCases } from "../application/use-cases/reasoning/runAnalysis";
import { makeLoadGraph } from "../application/use-cases/graph/loadGraph";
import { createFactsNodeSource, createFactoryNodeSource } from "./graphNodeSources";
import { createLocalDraftRepository } from "./localDraftAdapters";
import { createLocalFactRepository } from "./localFactAdapters";
import {
  createLocalEdgeRepository,
  createLocalManualNodeRepository,
} from "./localGraphAdapters";
import {
  createLocalReasoningAuditRepository,
  createSnapshotProvider,
} from "./localReasoningAdapters";

const drafts = createLocalDraftRepository();
const facts = createLocalFactRepository();
const manualNodes = createLocalManualNodeRepository();
const edges = createLocalEdgeRepository();

const loadGraph = makeLoadGraph(
  [createFactoryNodeSource(drafts), createFactsNodeSource(facts)],
  manualNodes,
  edges,
);

const provider = createSnapshotProvider(loadGraph, facts, drafts);
const audit = createLocalReasoningAuditRepository();

export const reasoningContainer = {
  ...makeReasoningUseCases(provider, audit),
  getMetrics: makeGetReasoningMetrics(provider, audit),
  loadSnapshot: (force?: boolean) => provider.load(force),
  invalidate: () => provider.invalidate(),
};

export type ReasoningContainer = typeof reasoningContainer;