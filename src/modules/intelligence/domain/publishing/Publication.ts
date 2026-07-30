/**
 * FASE 11 — KNOWLEDGE PUBLISHING ENGINE.
 *
 * O domínio da publicação. A partir daqui o sistema deixa de CONSTRUIR
 * conhecimento e passa a DISTRIBUIR conhecimento já validado.
 *
 * Regras inegociáveis:
 *  - Nenhuma IA generativa: toda saída é projeção determinística do objeto.
 *  - Nenhuma publicação automática: exige aprovação humana explícita.
 *  - Auditoria imutável: registros são append-only, jamais editados.
 *
 * Camada pura: zero React, zero Supabase, zero rede.
 */
import type { IsoDateTime } from "../shared/primitives";

/* ── Estados de publicação ────────────────────────────────────────────────── */
export const PUBLICATION_STATES = [
  "publicavel",
  "pendente",
  "publicado",
  "arquivado",
] as const;
export type PublicationState = (typeof PUBLICATION_STATES)[number];

export const PUBLICATION_STATE_LABEL: Readonly<Record<PublicationState, string>> = {
  publicavel: "Publicável",
  pendente: "Pendente",
  publicado: "Publicado",
  arquivado: "Arquivado",
};

/* ── Ações auditáveis ─────────────────────────────────────────────────────── */
export const PUBLICATION_ACTIONS = [
  "checklist",
  "preview",
  "publicacao",
  "republicacao",
  "rollback",
  "despublicacao",
] as const;
export type PublicationAction = (typeof PUBLICATION_ACTIONS)[number];

export const PUBLICATION_ACTION_LABEL: Readonly<Record<PublicationAction, string>> = {
  checklist: "Checklist",
  preview: "Preview",
  publicacao: "Publicação",
  republicacao: "Republicação",
  rollback: "Rollback",
  despublicacao: "Despublicação",
};

/** Fonte utilizada e congelada no momento da publicação. */
export interface PublishedSourceRef {
  readonly id: string;
  readonly titulo: string;
  readonly url?: string;
  readonly tier: string;
}

/**
 * Uma VERSÃO PUBLICADA. É um snapshot imutável: o conteúdo servido não muda
 * quando o rascunho muda — só uma nova publicação altera o que está no ar.
 */
export interface PublishedVersion {
  readonly id: string;
  readonly objetoId: string;
  readonly slug: string;
  readonly versao: number;
  readonly hash: string;
  readonly publicadoEm: IsoDateTime;
  readonly autorId: string;
  readonly origem: PublicationAction;
  /** Versão de origem quando `origem === "rollback"`. */
  readonly restauradaDe?: number;
  readonly titulo: string;
  readonly descricao: string;
  readonly canonical: string;
  readonly html: string;
  readonly jsonLd: string;
  readonly metaTags: readonly MetaTag[];
  readonly fatos: readonly PublishedSourceRef[];
  readonly entidadePrincipal: string;
  readonly ativa: boolean;
}

export interface MetaTag {
  readonly chave: string;
  readonly valor: string;
  /** `name` (meta padrão/twitter) ou `property` (open graph). */
  readonly atributo: "name" | "property";
}

/** Registro append-only de auditoria. Nada aqui pode ser apagado. */
export interface PublicationAuditRecord {
  readonly id: string;
  readonly objetoId: string;
  readonly slug: string;
  readonly acao: PublicationAction;
  readonly autorId: string;
  readonly registradoEm: IsoDateTime;
  readonly versao: number | null;
  readonly hash: string;
  readonly sucesso: boolean;
  readonly duracaoMs: number;
  readonly mensagem: string;
  readonly itensBloqueantes: readonly string[];
}

/** Faixa de saúde da publicação — determinística, nunca cosmética. */
export const healthBand = (score: number): "critico" | "atencao" | "saudavel" =>
  score >= 80 ? "saudavel" : score >= 50 ? "atencao" : "critico";

export const nextVersion = (versoes: readonly PublishedVersion[]): number =>
  versoes.reduce((max, v) => Math.max(max, v.versao), 0) + 1;

export const activeVersion = (
  versoes: readonly PublishedVersion[],
): PublishedVersion | null => versoes.find((v) => v.ativa) ?? null;