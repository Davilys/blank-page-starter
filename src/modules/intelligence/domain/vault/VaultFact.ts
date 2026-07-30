/**
 * FASE 08 — Knowledge Vault.
 *
 * Um Fact é uma AFIRMAÇÃO verificável, não um documento.
 * Knowledge Objects consomem Facts; nunca o contrário.
 * Camada de domínio pura: sem React, sem rede, sem banco.
 */
import type { EntityId, FactId, IsoDateTime } from "../shared/primitives";

export const FACT_KINDS = [
  "legal",
  "processual",
  "estatistico",
  "operacional",
  "tecnico",
] as const;
export type VaultFactKind = (typeof FACT_KINDS)[number];

export const FACT_KIND_LABEL: Readonly<Record<VaultFactKind, string>> = {
  legal: "Legal",
  processual: "Processual",
  estatistico: "Estatístico",
  operacional: "Operacional",
  tecnico: "Técnico",
};

export const VAULT_STATUSES = ["rascunho", "validado", "obsoleto"] as const;
export type VaultFactStatus = (typeof VAULT_STATUSES)[number];

export const VAULT_STATUS_LABEL: Readonly<Record<VaultFactStatus, string>> = {
  rascunho: "Rascunho",
  validado: "Validado",
  obsoleto: "Obsoleto",
};

/** Grau de confiança declarado pelo revisor humano. Nunca calculado por IA. */
export const CONFIDENCE_LEVELS = ["baixa", "media", "alta", "maxima"] as const;
export type VaultConfidence = (typeof CONFIDENCE_LEVELS)[number];

export const CONFIDENCE_LABEL: Readonly<Record<VaultConfidence, string>> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  maxima: "Máxima",
};

export interface VaultSource {
  readonly titulo: string;
  /** Artigo, inciso, seção, tabela — o ponto exato conferível. */
  readonly dispositivo: string;
  readonly url: string;
  readonly publicadoEm: string;
}

export const emptySource = (): VaultSource => ({
  titulo: "",
  dispositivo: "",
  url: "",
  publicadoEm: "",
});

export const hasSource = (s?: VaultSource) =>
  Boolean(s && s.titulo.trim().length > 0);

export type VaultEventKind =
  | "criacao"
  | "alteracao"
  | "revisao"
  | "validacao"
  | "obsolescencia"
  | "relacionamento"
  | "vinculo";

export const VAULT_EVENT_LABEL: Readonly<Record<VaultEventKind, string>> = {
  criacao: "Criação",
  alteracao: "Alteração",
  revisao: "Revisão",
  validacao: "Validação",
  obsolescencia: "Obsolescência",
  relacionamento: "Relacionamento",
  vinculo: "Vínculo com Knowledge Object",
};

/** Registro imutável: quem, quando, o que mudou e por quê. */
export interface VaultEvent {
  readonly id: string;
  readonly fatoId: string;
  readonly tipo: VaultEventKind;
  readonly em: IsoDateTime;
  readonly autorId: string;
  readonly motivo: string;
  /** Campos alterados, em texto legível ("status: rascunho → validado"). */
  readonly mudancas: readonly string[];
}

export interface VaultRelation {
  readonly id: string;
  readonly tipo: import("./relations").VaultRelationType;
  readonly alvoId: string;
  readonly justificativa: string;
  readonly criadoEm: IsoDateTime;
  readonly autorId: string;
}

export interface VaultFact {
  readonly id: FactId;
  readonly titulo: string;
  /** A declaração objetiva. É isto que o Knowledge Object consome. */
  readonly declaracao: string;
  readonly tipo: VaultFactKind;
  readonly fontePrimaria: VaultSource;
  readonly fonteSecundaria?: VaultSource;
  readonly confianca?: VaultConfidence;
  readonly vigenciaInicio: string;
  readonly vigenciaFim?: string;
  readonly ultimaValidacaoEm?: IsoDateTime;
  readonly revisorId?: string;
  readonly status: VaultFactStatus;
  readonly jurisdicao: string;
  readonly tags: readonly string[];
  readonly entidadesRelacionadas: readonly EntityId[];
  /** Knowledge Objects que consomem este fato (slug/id do draft). */
  readonly objetosConsumidores: readonly string[];
  readonly relacoes: readonly VaultRelation[];
  readonly motivoUltimaAlteracao: string;
  readonly observacoes: string;
  readonly autorId: string;
  readonly criadoEm: IsoDateTime;
  readonly atualizadoEm: IsoDateTime;
}

export const emptyVaultFact = (): VaultFact =>
  ({
    id: "" as FactId,
    titulo: "",
    declaracao: "",
    tipo: "legal",
    fontePrimaria: emptySource(),
    fonteSecundaria: undefined,
    confianca: undefined,
    vigenciaInicio: "",
    vigenciaFim: undefined,
    ultimaValidacaoEm: undefined,
    revisorId: undefined,
    status: "rascunho",
    jurisdicao: "BR",
    tags: [],
    entidadesRelacionadas: [],
    objetosConsumidores: [],
    relacoes: [],
    motivoUltimaAlteracao: "",
    observacoes: "",
    autorId: "",
    criadoEm: "" as IsoDateTime,
    atualizadoEm: "" as IsoDateTime,
  }) as VaultFact;

/** Campos cuja mudança exige novo motivo declarado e nova revisão humana. */
const MATERIAL_FIELDS: readonly (keyof VaultFact)[] = [
  "declaracao",
  "tipo",
  "vigenciaInicio",
  "vigenciaFim",
  "jurisdicao",
  "fontePrimaria",
];

const norm = (v: unknown) => JSON.stringify(v ?? null);

/** Lista legível das diferenças entre duas versões. Base da auditoria. */
export const diffFacts = (
  antes: VaultFact,
  depois: Partial<VaultFact>,
): readonly string[] =>
  (Object.keys(depois) as (keyof VaultFact)[])
    .filter((k) => norm(antes[k]) !== norm(depois[k]))
    .map((k) => String(k));

export const changesMeaning = (antes: VaultFact, patch: Partial<VaultFact>) =>
  MATERIAL_FIELDS.some(
    (k) => k in patch && norm(antes[k]) !== norm(patch[k as keyof VaultFact]),
  );