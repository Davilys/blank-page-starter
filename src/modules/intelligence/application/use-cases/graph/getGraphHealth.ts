/** Indicadores reais do grafo + trilha de auditoria. */
import type { GraphAuditRepository } from "../../ports/graph";
import type { GraphAuditEntry } from "../../../domain/graph/audit";
import { computeGraphHealth, type GraphHealth } from "../../../domain/graph/health";
import { err, ok, type Page, type Result } from "../../../domain/shared/primitives";
import type { GraphUniverseView, makeLoadGraph } from "./loadGraph";

export const makeGetGraphHealth =
  (loadGraph: ReturnType<typeof makeLoadGraph>) =>
  async (): Promise<Result<GraphHealth>> => {
    const g = await loadGraph();
    if (!g.ok) return err<GraphHealth>(g.error as string);
    const { nodes, edges } = g.value as GraphUniverseView;
    return ok(computeGraphHealth(nodes, edges));
  };

export const makeListGraphAudit =
  (audit: GraphAuditRepository) =>
  async (limit = 100): Promise<Result<Page<GraphAuditEntry>>> => audit.list(limit);