/**
 * FASE 09 — Portas do Knowledge Graph (arquitetura hexagonal).
 *
 * A aplicação só conhece estas interfaces. Trocar localStorage por Supabase
 * na Fase 10 exige apenas novos adaptadores em infrastructure/.
 */
import type { GraphAuditEntry } from "../../domain/graph/audit";
import type { EdgeStatus, EdgeType, GraphEdge } from "../../domain/graph/GraphEdge";
import type { GraphNode, ManualNodeInput, NodeKind, NodeStatus } from "../../domain/graph/GraphNode";
import type { Page, Result } from "../../domain/shared/primitives";

export interface NodeFilter {
  readonly texto?: string;
  readonly kind?: NodeKind;
  readonly status?: NodeStatus;
  readonly entidade?: string;
  readonly origem?: string;
  readonly apenasOrfaos?: boolean;
}

export interface EdgeFilter {
  readonly texto?: string;
  readonly tipo?: EdgeType;
  readonly status?: EdgeStatus;
  readonly no?: string;
  readonly entidade?: string;
  readonly semFonte?: boolean;
  readonly vencidas?: boolean;
}

/** Fonte de nós somente-leitura (Fact Ledger, Knowledge Factory, ...). */
export interface GraphNodeSource {
  readonly nome: string;
  load(): Promise<Result<readonly GraphNode[]>>;
}

/** Nós criados manualmente dentro do Graph Engine (leis, NICE, glossário...). */
export interface ManualNodeRepository {
  list(): Promise<Result<readonly GraphNode[]>>;
  save(input: ManualNodeInput, autorId: string): Promise<Result<GraphNode>>;
  remove(id: string): Promise<Result<true>>;
}

export interface GraphEdgeRepository {
  list(): Promise<Result<Page<GraphEdge>>>;
  findById(id: string): Promise<Result<GraphEdge>>;
  save(edge: GraphEdge): Promise<Result<GraphEdge>>;
  remove(id: string): Promise<Result<true>>;
}

/** Append-only. Implementações NÃO podem atualizar nem apagar registros. */
export interface GraphAuditRepository {
  append(entry: GraphAuditEntry): Promise<Result<GraphAuditEntry>>;
  list(limit?: number): Promise<Result<Page<GraphAuditEntry>>>;
}