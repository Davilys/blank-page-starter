/**
 * Knowledge Memory — append-only history (FASE 03, Artigo 4).
 *
 * Nothing is ever deleted or overwritten. Every approved change produces a
 * change record so the system can answer "what did we state on date X?".
 */
import type { EntityId, IsoDateTime, KnowledgeObjectId, VersionId } from "../shared/primitives";

export const CHANGE_REASONS = [
  "correcao-factual",
  "atualizacao-normativa",
  "melhoria-editorial",
  "expansao",
  "depreciacao",
] as const;
export type ChangeReason = (typeof CHANGE_REASONS)[number];

/** Field-level diff. Text-level diffs are noise and are deliberately avoided. */
export interface FieldDiff {
  readonly campo: string;
  readonly antes: string | null;
  readonly depois: string | null;
}

export interface KnowledgeVersion {
  readonly id: VersionId;
  readonly objetoId: KnowledgeObjectId;
  readonly versao: number;
  readonly versaoAnterior: number | null;
  readonly registradoEm: IsoDateTime;
  readonly autorId: string;
  readonly motivo: ChangeReason;
  readonly resumoMudanca: string;
  readonly diffs: readonly FieldDiff[];
  /** Impact resolved through the dependency graph BEFORE publication. */
  readonly objetosAfetados: readonly KnowledgeObjectId[];
  readonly entidadesAfetadas: readonly EntityId[];
}

/** Versioning is semantic: meaning change = major (affects anyone citing it). */
export const isBreakingChange = (v: KnowledgeVersion): boolean =>
  v.motivo === "correcao-factual" || v.motivo === "atualizacao-normativa";
