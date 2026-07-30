/**
 * FASE 12 — Portas do Knowledge Observatory.
 *
 * CQRS estrito: o Observatory só possui QUERIES sobre o restante do sistema.
 * A única escrita permitida é o append na auditoria — que nunca atualiza nem
 * remove registros.
 */
import type {
  ObservatoryAuditRecord,
  ObservatorySnapshot,
} from "../../domain/observatory/Observatory";
import type { Page, Result } from "../../domain/shared/primitives";

/** Leitura consolidada e somente-leitura do estado do Knowledge OS. */
export interface ObservatorySnapshotReader {
  load(): Promise<Result<ObservatorySnapshot>>;
}

/** Append-only estrito: sem update, sem delete. */
export interface ObservatoryAuditRepository {
  append(record: ObservatoryAuditRecord): Promise<Result<ObservatoryAuditRecord>>;
  list(limit?: number): Promise<Result<Page<ObservatoryAuditRecord>>>;
}