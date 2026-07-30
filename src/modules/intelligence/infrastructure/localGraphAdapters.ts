/**
 * Persistência local do Knowledge Graph (FASE 09).
 * Isolada do banco do CRM. Substituível por Supabase na Fase 10 sem tocar
 * em domínio nem em aplicação.
 */
import type {
  GraphAuditRepository,
  GraphEdgeRepository,
  ManualNodeRepository,
} from "../application/ports/graph";
import type { GraphAuditEntry } from "../domain/graph/audit";
import type { GraphEdge } from "../domain/graph/GraphEdge";
import { makeNodeId, normalizeRef, type GraphNode, type ManualNodeInput } from "../domain/graph/GraphNode";
import { asIsoDateTime, err, ok } from "../domain/shared/primitives";

const EDGES_KEY = "wm.intelligence.graph.edges.v1";
const NODES_KEY = "wm.intelligence.graph.nodes.v1";
const AUDIT_KEY = "wm.intelligence.graph.audit.v1";

const read = <T>(key: string): T[] => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const write = <T>(key: string, items: T[]): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
};

export const createLocalEdgeRepository = (): GraphEdgeRepository => ({
  async list() {
    const items = read<GraphEdge>(EDGES_KEY).sort((a, b) =>
      a.atualizadoEm < b.atualizadoEm ? 1 : -1,
    );
    return ok({ items, total: items.length });
  },
  async findById(id) {
    const found = read<GraphEdge>(EDGES_KEY).find((e) => e.id === id);
    return found ? ok(found) : err<GraphEdge>("Relação não encontrada.");
  },
  async save(edge) {
    const items = read<GraphEdge>(EDGES_KEY);
    const i = items.findIndex((e) => e.id === edge.id);
    if (i >= 0) items[i] = edge;
    else items.push(edge);
    return write(EDGES_KEY, items) ? ok(edge) : err<GraphEdge>("Falha ao gravar a relação.");
  },
  async remove(id) {
    const items = read<GraphEdge>(EDGES_KEY).filter((e) => e.id !== id);
    return write(EDGES_KEY, items) ? ok(true as const) : err<true>("Falha ao remover a relação.");
  },
});

export const createLocalManualNodeRepository = (): ManualNodeRepository => ({
  async list() {
    return ok(read<GraphNode>(NODES_KEY) as readonly GraphNode[]);
  },
  async save(input: ManualNodeInput, autorId: string) {
    const ref = normalizeRef(input.ref || input.rotulo);
    if (!ref) return err<GraphNode>("Referência inválida para o nó.");
    const node: GraphNode = {
      id: makeNodeId(input.kind, ref),
      kind: input.kind,
      ref,
      rotulo: input.rotulo.trim(),
      descricao: input.descricao?.trim(),
      status: input.status ?? "ativo",
      origem: `manual:${autorId}`,
      entidade: input.entidade?.trim() || undefined,
      criadoEm: asIsoDateTime(new Date()),
    };
    const items = read<GraphNode>(NODES_KEY);
    const i = items.findIndex((n) => n.id === node.id);
    if (i >= 0) items[i] = { ...items[i], ...node, criadoEm: items[i].criadoEm };
    else items.push(node);
    return write(NODES_KEY, items) ? ok(node) : err<GraphNode>("Falha ao gravar o nó.");
  },
  async remove(id) {
    const items = read<GraphNode>(NODES_KEY).filter((n) => n.id !== id);
    return write(NODES_KEY, items) ? ok(true as const) : err<true>("Falha ao remover o nó.");
  },
});

/** Append-only por contrato: nunca sobrescreve nem apaga. */
export const createLocalGraphAuditRepository = (): GraphAuditRepository => ({
  async append(entry) {
    const items = read<GraphAuditEntry>(AUDIT_KEY);
    items.push(entry);
    return write(AUDIT_KEY, items) ? ok(entry) : err<GraphAuditEntry>("Falha ao registrar auditoria.");
  },
  async list(limit = 100) {
    const items = read<GraphAuditEntry>(AUDIT_KEY)
      .sort((a, b) => (a.em < b.em ? 1 : -1))
      .slice(0, limit);
    return ok({ items, total: items.length });
  },
});