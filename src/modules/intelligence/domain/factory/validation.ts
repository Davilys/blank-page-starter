/**
 * Publication gates (FASE 06 §4). Pure, deterministic, unit-testable.
 * If any mandatory item is missing, publication is BLOCKED.
 */
import type { KnowledgeDraft } from "./KnowledgeDraft";

export interface ValidationItem {
  readonly chave: string;
  readonly rotulo: string;
  readonly ok: boolean;
  readonly detalhe: string;
}

const filled = (v?: string) => Boolean(v && v.trim().length > 0);

export const validateForPublication = (d: KnowledgeDraft): readonly ValidationItem[] => [
  {
    chave: "titulo",
    rotulo: "Título e descrição",
    ok: filled(d.titulo) && filled(d.descricao),
    detalhe: "Todo objeto precisa de título e descrição identificáveis.",
  },
  {
    chave: "fonte",
    rotulo: "Existe fonte?",
    ok: d.fontes.length > 0 && d.fontes.every((f) => filled(f.titulo)),
    detalhe: "Sem fonte é opinião, não conhecimento (FASE 03, Artigo 3).",
  },
  {
    chave: "entidade",
    rotulo: "Existe entidade principal?",
    ok: filled(d.entidadePrincipal as unknown as string),
    detalhe: "O objeto precisa estar ancorado em uma entidade canônica.",
  },
  {
    chave: "resumo",
    rotulo: "Existe resumo?",
    ok: filled(d.resumoCurto),
    detalhe: "O resumo curto alimenta respostas curtas e metadados.",
  },
  {
    chave: "explicacao",
    rotulo: "Existe explicação completa?",
    ok: filled(d.explicacaoCompleta) && d.explicacaoCompleta.trim().length >= 120,
    detalhe: "Explicação completa com no mínimo 120 caracteres.",
  },
  {
    chave: "contexto",
    rotulo: "Existe contexto?",
    ok: filled(d.idioma) && filled(d.jurisdicao) && filled(d.categoria),
    detalhe: "Idioma, jurisdição e categoria definem o contexto (FASE 04 §3).",
  },
  {
    chave: "revisao",
    rotulo: "Existe revisão?",
    ok: Boolean(d.revisorId && d.revisorId.trim()) && Boolean(d.dataRevisao),
    detalhe: "Revisor humano e data de revisão são obrigatórios.",
  },
  {
    chave: "autor",
    rotulo: "Existe autor?",
    ok: filled(d.autorId),
    detalhe: "Responsabilidade humana é inegociável (FASE 03, Governança).",
  },
  {
    chave: "contradicao",
    rotulo: "Sem contradição bloqueante",
    ok: !d.relacionamentos.some((r) => r.tipo === "contradiz"),
    detalhe: "Relações do tipo 'contradiz' bloqueiam a publicação.",
  },
];

export const blockingIssues = (d: KnowledgeDraft): readonly ValidationItem[] =>
  validateForPublication(d).filter((i) => !i.ok);

export const canPublish = (d: KnowledgeDraft): boolean => blockingIssues(d).length === 0;

/** Completeness 0..100 — a real metric, never cosmetic. */
export const completeness = (d: KnowledgeDraft): number => {
  const items = validateForPublication(d);
  return Math.round((items.filter((i) => i.ok).length / items.length) * 100);
};