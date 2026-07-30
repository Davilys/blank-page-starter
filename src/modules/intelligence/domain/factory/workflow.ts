/**
 * Editorial state machine (FASE 06 §3).
 *
 * Direct publication is IMPOSSIBLE by construction: `publicado` is reachable
 * only from `aprovado`, and `aprovado` only from `em-revisao`.
 */
import type { EditorialState } from "./KnowledgeDraft";

export const ALLOWED_TRANSITIONS: Readonly<Record<EditorialState, readonly EditorialState[]>> = {
  rascunho: ["em-revisao", "arquivado"],
  "em-revisao": ["rascunho", "aprovado", "arquivado"],
  aprovado: ["em-revisao", "publicado", "arquivado"],
  publicado: ["em-revisao", "arquivado"],
  arquivado: ["rascunho"],
};

export const canTransition = (from: EditorialState, to: EditorialState): boolean =>
  ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;

export const nextStates = (from: EditorialState): readonly EditorialState[] =>
  ALLOWED_TRANSITIONS[from] ?? [];

/** Only a published draft may ever be served publicly (FASE 03, Artigo 8). */
export const isServable = (state: EditorialState): boolean => state === "publicado";