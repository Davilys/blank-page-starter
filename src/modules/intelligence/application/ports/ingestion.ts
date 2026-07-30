/**
 * Knowledge Ingestion ports (FASE 07). The application layer depends only on
 * these interfaces — the localStorage adapters can be replaced by Supabase
 * without touching use cases or UI.
 */
import type {
  CandidateStatus,
  IngestionCandidate,
  IngestionLogEntry,
  ParsedDocument,
  SourceFormat,
} from "../../domain/ingestion/SourceDocument";
import type { Page, Result } from "../../domain/shared/primitives";

/** One implementation per supported format (Open/Closed principle). */
export interface DocumentParser {
  readonly formato: SourceFormat;
  parse(file: File): Promise<Result<ParsedDocument>>;
}

export interface ParserRegistry {
  supports(formato: SourceFormat): boolean;
  parserFor(formato: SourceFormat): DocumentParser | null;
}

export interface CandidateFilter {
  readonly texto?: string;
  readonly status?: CandidateStatus;
  readonly formato?: SourceFormat;
  readonly importadoPor?: string;
  readonly apenasComDuplicidade?: boolean;
}

export interface CandidateRepository {
  list(filter: CandidateFilter): Promise<Result<Page<IngestionCandidate>>>;
  findById(id: string): Promise<Result<IngestionCandidate>>;
  save(candidate: IngestionCandidate): Promise<Result<IngestionCandidate>>;
  remove(id: string): Promise<Result<true>>;
}

/** Append-only. Implementations MUST NOT update or delete entries. */
export interface IngestionLogRepository {
  append(entry: IngestionLogEntry): Promise<Result<IngestionLogEntry>>;
  listRecent(limit: number): Promise<Result<Page<IngestionLogEntry>>>;
  listByCandidate(candidatoId: string): Promise<Result<Page<IngestionLogEntry>>>;
}