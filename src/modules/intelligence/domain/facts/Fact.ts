/**
 * FASE 08 — FACT LEDGER (Fatos Verificáveis).
 *
 * Um Knowledge Object EXPLICA. Um Fato AFIRMA.
 * "Oposição pode ser apresentada em até 60 dias" não é conteúdo: é uma
 * afirmação verificável, com fonte, vigência, versão, confiabilidade,
 * relacionamentos, objetos afetados, validação e revisor.
 *
 * Regras constitucionais desta camada:
 *  1. Nenhum fato existe sem fonte.
 *  2. Nenhum fato é editado no lugar — mudança de sentido gera nova versão
 *     e a anterior é preservada como "substituído" (memória permanente).
 *  3. Confiabilidade nunca é digitada: é sempre calculada.
 *  4. Fato sem revalidação dentro da periodicidade vira "vencido" sozinho.
 *
 * Zero IA. Zero embeddings. Determinístico e auditável.
 */
import type { EntityId, FactId, IsoDateTime } from "../shared/primitives";
import type { RelationshipType } from "../shared/taxonomy";

/* ── Fonte ────────────────────────────────────────────────────────────────
 * O tier é o principal insumo de confiabilidade. Lei > Manual > Jurisprudência.
 */
export const SOURCE_TIERS = [
  "lei",
  "manual-inpi",
  "ato-normativo",
  "jurisprudencia",
  "doutrina",
  "secundaria",
] as const;
export type SourceTier = (typeof SOURCE_TIERS)[number];

export const SOURCE_TIER_LABEL: Readonly<Record<SourceTier, string>> = {
  lei: "Lei",
  "manual-inpi": "Manual INPI",
  "ato-normativo": "Ato normativo / RPI",
  jurisprudencia: "Jurisprudência",
  doutrina: "Doutrina",
  secundaria: "Fonte secundária",
};

/** Peso base de confiabilidade por tier (0..100). */
export const SOURCE_TIER_WEIGHT: Readonly<Record<SourceTier, number>> = {
  lei: 100,
  "manual-inpi": 92,
  "ato-normativo": 88,
  jurisprudencia: 76,
  doutrina: 58,
  secundaria: 32,
};

export interface FactSource {
  readonly tier: SourceTier;
  /** Ex.: "Lei 9.279/96 (LPI)". */
  readonly titulo: string;
  /** Localizador exato dentro da fonte. Ex.: "art. 158, caput". */
  readonly dispositivo: string;
  readonly url?: string;
  /** Data de publicação/vigência da própria fonte. */
  readonly publicadoEm?: string;
  /** Quando um humano conferiu o dispositivo na fonte. */
  readonly acessadoEm?: string;
}

/* ── Estado do fato ───────────────────────────────────────────────────────── */
export const FACT_STATUSES = [
  "rascunho",
  "vigente",
  "contestado",
  "vencido",
  "revogado",
  "substituido",
] as const;
export type FactStatus = (typeof FACT_STATUSES)[number];

export const FACT_STATUS_LABEL: Readonly<Record<FactStatus, string>> = {
  rascunho: "Rascunho",
  vigente: "Vigente",
  contestado: "Contestado",
  vencido: "Vencido",
  revogado: "Revogado",
  substituido: "Substituído",
};

/** Só fatos vigentes podem sustentar conteúdo público. */
export const isCitable = (s: FactStatus) => s === "vigente";

/* ── Relacionamento entre fatos ───────────────────────────────────────────── */
export interface FactRelationship {
  readonly tipo: RelationshipType;
  readonly alvoFatoId: FactId;
  readonly motivo?: string;
}

/** Registro imutável de cada revalidação humana. */
export interface FactValidation {
  readonly id: string;
  readonly validadoEm: IsoDateTime;
  readonly revisorId: string;
  readonly resultado: "confirmado" | "ajustado" | "contestado" | "revogado";
  readonly observacao?: string;
}

/* ── O Fato ───────────────────────────────────────────────────────────────── */
export interface Fact {
  readonly id: FactId;
  /** A afirmação, em uma frase verificável. */
  readonly enunciado: string;
  /** Valor normalizado quando o fato é numérico (60) + unidade ("dias"). */
  readonly valor?: string;
  readonly unidade?: string;
  readonly entidadePrincipal: EntityId;
  readonly jurisdicao: string;
  readonly idioma: string;

  readonly fonte: FactSource;

  /** Vigência do FATO (não da fonte). */
  readonly vigenciaInicio: string;
  readonly vigenciaFim?: string;

  readonly status: FactStatus;

  /** Cadeia imutável de versões. */
  readonly versao: number;
  readonly raizId: FactId;
  readonly substituiFatoId?: FactId;
  readonly substituidoPorId?: FactId;

  readonly relacionamentos: readonly FactRelationship[];
  /** Slugs/ids dos Knowledge Objects que citam este fato. */
  readonly objetosAfetados: readonly string[];

  /** Governança de revalidação. */
  readonly periodicidadeDias: number;
  readonly ultimaValidacaoEm?: IsoDateTime;
  readonly revisorId?: string;
  readonly validacoes: readonly FactValidation[];

  readonly autorId: string;
  readonly criadoEm: IsoDateTime;
  readonly atualizadoEm: IsoDateTime;
  readonly observacoes: string;
}

export const DEFAULT_REVALIDATION_DAYS = 180;

export const emptyFact = (): Omit<
  Fact,
  "id" | "raizId" | "versao" | "criadoEm" | "atualizadoEm" | "validacoes"
> => ({
  enunciado: "",
  valor: "",
  unidade: "",
  entidadePrincipal: "" as EntityId,
  jurisdicao: "BR/LPI",
  idioma: "pt-BR",
  fonte: { tier: "lei", titulo: "", dispositivo: "" },
  vigenciaInicio: "",
  status: "rascunho",
  relacionamentos: [],
  objetosAfetados: [],
  periodicidadeDias: DEFAULT_REVALIDATION_DAYS,
  autorId: "",
  observacoes: "",
});

/** Campos cuja alteração muda o SENTIDO → exigem nova versão, nunca edição. */
export const SEMANTIC_FIELDS: readonly (keyof Fact)[] = [
  "enunciado",
  "valor",
  "unidade",
  "vigenciaInicio",
  "vigenciaFim",
  "jurisdicao",
];

export const changesMeaning = (antes: Fact, depois: Partial<Fact>): boolean =>
  SEMANTIC_FIELDS.some(
    (f) => depois[f] !== undefined && String(depois[f] ?? "") !== String(antes[f] ?? ""),
  );