/**
 * Derivation preview (FASE 06 §5 / FASE 03 Artigo 6).
 *
 * Deterministic projections of an existing draft. NOTHING is invented here:
 * every output is a rearrangement of fields the human already wrote. No AI,
 * no model call, no network. Preview only — nothing is persisted or served.
 */
import type { KnowledgeDraft } from "./KnowledgeDraft";

export const DERIVATION_KINDS = [
  "resposta-curta",
  "resposta-longa",
  "faq",
  "resumo",
  "schema",
  "json",
  "api",
  "markdown",
] as const;
export type DerivationKind = (typeof DERIVATION_KINDS)[number];

export const DERIVATION_LABEL: Readonly<Record<DerivationKind, string>> = {
  "resposta-curta": "Resposta curta",
  "resposta-longa": "Resposta longa",
  faq: "FAQ",
  resumo: "Resumo",
  schema: "Schema",
  json: "JSON",
  api: "API",
  markdown: "Markdown",
};

const EMPTY = "— campo ainda não preenchido —";

const sourcesBlock = (d: KnowledgeDraft) =>
  d.fontes.length
    ? d.fontes.map((f) => `- ${f.titulo}${f.url ? ` (${f.url})` : ""} [${f.tier}]`).join("\n")
    : "- nenhuma fonte cadastrada";

export const derive = (d: KnowledgeDraft, kind: DerivationKind): string => {
  switch (kind) {
    case "resposta-curta":
      return d.resumoCurto || EMPTY;

    case "resposta-longa":
      return [d.resumoCurto, d.explicacaoCompleta].filter(Boolean).join("\n\n") || EMPTY;

    case "resumo":
      return [d.resumoCurto, d.resumoTecnico].filter(Boolean).join("\n\n") || EMPTY;

    case "faq":
      return d.faq.length
        ? d.faq.map((f) => `P: ${f.pergunta}\nR: ${f.resposta}`).join("\n\n")
        : EMPTY;

    case "markdown":
      return [
        `# ${d.titulo || EMPTY}`,
        d.resumoCurto,
        d.explicacaoCompleta,
        d.checklist.length ? `## Checklist\n${d.checklist.map((c) => `- [ ] ${c}`).join("\n")}` : "",
        d.fluxograma ? `## Fluxo\n\`\`\`text\n${d.fluxograma}\n\`\`\`` : "",
        d.faq.length ? `## FAQ\n${d.faq.map((f) => `**${f.pergunta}**\n\n${f.resposta}`).join("\n\n")}` : "",
        `## Fontes\n${sourcesBlock(d)}`,
      ]
        .filter(Boolean)
        .join("\n\n");

    case "schema":
      return JSON.stringify(
        {
          "@context": "https://schema.org",
          "@type": d.faq.length ? "FAQPage" : "Article",
          headline: d.titulo || undefined,
          description: d.resumoCurto || d.descricao || undefined,
          inLanguage: d.idioma,
          keywords: d.palavrasChave.length ? d.palavrasChave.join(", ") : undefined,
          dateModified: d.atualizadoEm,
          citation: d.fontes.map((f) => f.url || f.titulo),
          mainEntity: d.faq.length
            ? d.faq.map((f) => ({
                "@type": "Question",
                name: f.pergunta,
                acceptedAnswer: { "@type": "Answer", text: f.resposta },
              }))
            : undefined,
        },
        null,
        2,
      );

    case "json":
      return JSON.stringify(d, null, 2);

    case "api":
      return JSON.stringify(
        {
          endpoint: `GET /intelligence/api/objects/${d.slug || "{slug}"}`,
          status: d.estado,
          servable: d.estado === "publicado",
          payload: {
            id: d.id,
            slug: d.slug,
            titulo: d.titulo,
            tipo: d.tipo,
            contexto: { idioma: d.idioma, jurisdicao: d.jurisdicao },
            resumo: d.resumoCurto,
            versao: d.versao,
            fontes: d.fontes.length,
          },
          observacao: "Simulação — nenhum endpoint público existe nesta fase.",
        },
        null,
        2,
      );

    default:
      return EMPTY;
  }
};