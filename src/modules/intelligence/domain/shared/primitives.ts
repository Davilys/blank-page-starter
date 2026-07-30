/**
 * WebMarcas Knowledge OS — Domain primitives.
 *
 * FASE 05 (Foundation). Pure domain layer: zero dependencies on React,
 * Supabase, network or any framework. Everything here is a type or a pure
 * function so it can be unit-tested in isolation.
 *
 * Constitution reference: FASE 03, Artigo 2 (anatomy of a Knowledge Object).
 */

/** Branded identifier — prevents passing a raw string where an ID is required. */
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type KnowledgeObjectId = Brand<string, "KnowledgeObjectId">;
export type EntityId = Brand<string, "EntityId">;
export type FactId = Brand<string, "FactId">;
export type SourceId = Brand<string, "SourceId">;
export type VersionId = Brand<string, "VersionId">;

export const asKnowledgeObjectId = (v: string) => v as KnowledgeObjectId;
export const asEntityId = (v: string) => v as EntityId;
export const asFactId = (v: string) => v as FactId;
export const asSourceId = (v: string) => v as SourceId;
export const asVersionId = (v: string) => v as VersionId;

/** ISO-8601 timestamp. Stored as string to stay serialisable end-to-end. */
export type IsoDateTime = Brand<string, "IsoDateTime">;
export const asIsoDateTime = (v: string | Date) =>
  (typeof v === "string" ? v : v.toISOString()) as IsoDateTime;

/** Score constrained to 0..100. Never assigned by hand — always computed. */
export type Score = Brand<number, "Score">;
export const asScore = (v: number) =>
  Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0)) as Score;

/**
 * Result type. The domain never throws for expected failures — callers must
 * handle both branches explicitly (FASE 04: "não inventar, declarar o que não se sabe").
 */
export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Read-only paginated envelope used by every query port. */
export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
}

export const emptyPage = <T>(): Page<T> => ({ items: [], total: 0 });