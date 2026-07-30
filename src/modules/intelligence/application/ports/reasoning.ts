/**
 * FASE 10 — Portas do Knowledge Reasoning Engine.
 *
 * O motor é SOMENTE LEITURA sobre o conhecimento: a única escrita permitida
 * é o log append-only de auditoria das execuções.
 */
import type { ReasoningRun } from "../../domain/reasoning/Reasoning";
import type { ReasoningSnapshot } from "../../domain/reasoning/snapshot";
import type { Page, Result } from "../../domain/shared/primitives";

/** Carrega o universo do conhecimento em memória. Nunca escreve. */
export interface KnowledgeSnapshotProvider {
  load(force?: boolean): Promise<Result<ReasoningSnapshot>>;
  invalidate(): void;
}

/** Append-only. Implementações NÃO podem atualizar nem apagar registros. */
export interface ReasoningAuditRepository {
  append(run: ReasoningRun): Promise<Result<ReasoningRun>>;
  list(limit?: number): Promise<Result<Page<ReasoningRun>>>;
}