/**
 * FASE 11 §Checklist — portão automático de publicação.
 *
 * Puro e determinístico. Se QUALQUER item obrigatório falhar, a publicação é
 * BLOQUEADA — não existe "publicar mesmo assim".
 */
import type { KnowledgeDraft } from "../factory/KnowledgeDraft";
import { completeness } from "../factory/validation";

export interface PublicationContext {
  /** Slugs de todos os objetos conhecidos (para resolver referências). */
  readonly slugsConhecidos: ReadonlySet<string>;
  /** Entidades canônicas conhecidas (para detectar entidade órfã). */
  readonly entidadesConhecidas: ReadonlySet<string>;
  /** Limite mínimo de confiança estrutural aceito (0..100). */
  readonly limiteConfianca: number;
}

export const DEFAULT_PUBLICATION_CONTEXT: PublicationContext = {
  slugsConhecidos: new Set<string>(),
  entidadesConhecidas: new Set<string>(),
  limiteConfianca: 70,
};

export interface ChecklistItem {
  readonly chave: string;
  readonly rotulo: string;
  readonly ok: boolean;
  readonly detalhe: string;
  /** Itens não bloqueantes informam, mas não impedem a publicação. */
  readonly bloqueante: boolean;
}

const filled = (v?: string) => Boolean(v && v.trim().length > 0);

/** Confiança estrutural: completude editorial ponderada pela qualidade das fontes. */
export const structuralConfidence = (d: KnowledgeDraft): number => {
  const base = completeness(d);
  const oficiais = d.fontes.filter((f) => f.tier === "oficial" || f.tier === "jurisprudencia");
  const bonus = d.fontes.length ? Math.round((oficiais.length / d.fontes.length) * 10) : 0;
  return Math.max(0, Math.min(100, base - 10 + bonus));
};

/** Cobertura pública: o objeto responde sozinho a uma consulta real? */
export const publicCoverage = (d: KnowledgeDraft): number => {
  const sinais = [
    filled(d.resumoCurto),
    d.explicacaoCompleta.trim().length >= 300,
    d.faq.length > 0,
    d.checklist.length > 0,
    d.palavrasChave.length >= 3,
    d.fontes.length > 0,
    filled(d.categoria),
    d.relacionamentos.length > 0,
  ];
  return Math.round((sinais.filter(Boolean).length / sinais.length) * 100);
};

export const runChecklist = (
  d: KnowledgeDraft,
  ctx: PublicationContext = DEFAULT_PUBLICATION_CONTEXT,
): readonly ChecklistItem[] => {
  const relacoesQuebradas = d.relacionamentos.filter(
    (r) => !ctx.slugsConhecidos.has(r.alvoSlug),
  );
  const linksQuebrados = d.linksInternos.filter((l) => !ctx.slugsConhecidos.has(l));
  const confianca = structuralConfidence(d);
  const cobertura = publicCoverage(d);

  return [
    {
      chave: "aprovado",
      rotulo: "Objeto aprovado",
      ok: d.estado === "aprovado" || d.estado === "publicado",
      detalhe: "Somente objetos aprovados pelo fluxo editorial podem ir ao ar.",
      bloqueante: true,
    },
    {
      chave: "fatos",
      rotulo: "Facts válidos",
      ok: d.fontes.length > 0 && d.fontes.every((f) => filled(f.titulo)),
      detalhe: "Todo fato publicado precisa de fonte identificada.",
      bloqueante: true,
    },
    {
      chave: "relacionamentos",
      rotulo: "Relacionamentos válidos",
      ok: relacoesQuebradas.length === 0,
      detalhe: relacoesQuebradas.length
        ? `Alvos inexistentes: ${relacoesQuebradas.map((r) => r.alvoSlug).join(", ")}`
        : "Todos os alvos das relações existem na base.",
      bloqueante: true,
    },
    {
      chave: "conflitos",
      rotulo: "Sem conflitos",
      ok: !d.relacionamentos.some((r) => r.tipo === "contradiz"),
      detalhe: "Relações do tipo 'contradiz' precisam ser resolvidas por um humano.",
      bloqueante: true,
    },
    {
      chave: "referencias",
      rotulo: "Sem referências quebradas",
      ok: linksQuebrados.length === 0,
      detalhe: linksQuebrados.length
        ? `Links internos sem destino: ${linksQuebrados.join(", ")}`
        : "Nenhum link interno aponta para o vazio.",
      bloqueante: true,
    },
    {
      chave: "entidade",
      rotulo: "Sem entidades órfãs",
      ok:
        filled(d.entidadePrincipal as unknown as string) &&
        (ctx.entidadesConhecidas.size === 0 ||
          ctx.entidadesConhecidas.has(String(d.entidadePrincipal))),
      detalhe: "A entidade principal precisa existir e estar ancorada no grafo.",
      bloqueante: true,
    },
    {
      chave: "confianca",
      rotulo: `Confidence acima do limite (${ctx.limiteConfianca})`,
      ok: confianca >= ctx.limiteConfianca,
      detalhe: `Confiança estrutural calculada: ${confianca}.`,
      bloqueante: true,
    },
    {
      chave: "cobertura",
      rotulo: "Cobertura suficiente",
      ok: cobertura >= 60,
      detalhe: `Cobertura pública calculada: ${cobertura}%. Mínimo exigido: 60%.`,
      bloqueante: true,
    },
    {
      chave: "seo",
      rotulo: "Metadados SEO completos",
      ok: filled(d.slug) && filled(d.titulo) && d.descricao.trim().length >= 50,
      detalhe: "Slug, título e descrição (mín. 50 caracteres) alimentam title/description.",
      bloqueante: true,
    },
  ];
};

export const blockingFailures = (items: readonly ChecklistItem[]): readonly ChecklistItem[] =>
  items.filter((i) => i.bloqueante && !i.ok);

export const canPublish = (
  d: KnowledgeDraft,
  ctx?: PublicationContext,
): boolean => blockingFailures(runChecklist(d, ctx)).length === 0;

export const checklistScore = (items: readonly ChecklistItem[]): number =>
  items.length ? Math.round((items.filter((i) => i.ok).length / items.length) * 100) : 0;