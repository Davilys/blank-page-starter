/** Composition root do Knowledge Graph Engine (FASE 09). */
import { makeAnalyzeImpact } from "../application/use-cases/graph/analyzeImpact";
import { makeExploreNode, makeListEdges } from "../application/use-cases/graph/exploreNode";
import { makeGetGraphHealth, makeListGraphAudit } from "../application/use-cases/graph/getGraphHealth";
import { makeListNodes, makeLoadGraph } from "../application/use-cases/graph/loadGraph";
import {
  makeRemoveEdge,
  makeSaveEdge,
  makeSaveManualNode,
  makeTransitionEdge,
} from "../application/use-cases/graph/saveEdge";
import { createFactsNodeSource, createFactoryNodeSource } from "./graphNodeSources";
import { createLocalDraftRepository } from "./localDraftAdapters";
import { createLocalFactRepository } from "./localFactAdapters";
import {
  createLocalEdgeRepository,
  createLocalGraphAuditRepository,
  createLocalManualNodeRepository,
} from "./localGraphAdapters";

const drafts = createLocalDraftRepository();
const facts = createLocalFactRepository();

const sources = [createFactoryNodeSource(drafts), createFactsNodeSource(facts)];
const manualNodes = createLocalManualNodeRepository();
const edges = createLocalEdgeRepository();
const audit = createLocalGraphAuditRepository();

const loadGraph = makeLoadGraph(sources, manualNodes, edges);

export const graphContainer = {
  loadGraph,
  listNodes: makeListNodes(loadGraph),
  listEdges: makeListEdges(loadGraph),
  exploreNode: makeExploreNode(loadGraph, edges),
  analyzeImpact: makeAnalyzeImpact(loadGraph),
  saveEdge: makeSaveEdge(loadGraph, edges, audit),
  transitionEdge: makeTransitionEdge(edges, audit),
  removeEdge: makeRemoveEdge(edges, audit),
  saveManualNode: makeSaveManualNode(manualNodes, audit),
  getHealth: makeGetGraphHealth(loadGraph),
  listAudit: makeListGraphAudit(audit),
};

export type GraphContainer = typeof graphContainer;