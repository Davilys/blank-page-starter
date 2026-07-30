/**
 * FASE 11 §Schema.org — grafo JSON-LD determinístico.
 * Somente tipos aplicáveis são emitidos: nada de schema decorativo.
 */
import type { KnowledgeDraft } from "../factory/KnowledgeDraft";
import type { KnowledgeObjectType } from "../shared/taxonomy";
import { SITE_NAME, SITE_URL, buildSeo, canonicalUrl } from "./seo";

export type SchemaType =
  | "WebPage"
  | "Article"
  | "TechArticle"
  | "FAQPage"
  | "HowTo"
  | "DefinedTerm"
  | "BreadcrumbList"
  | "Organization";

/** Tipos de schema aplicáveis a um objeto — decisão explícita, por tipo. */
export const applicableSchemas = (d: KnowledgeDraft): readonly SchemaType[] => {
  const base: SchemaType[] = ["Organization", "WebPage", "BreadcrumbList"];
  const artigo: Record<string, SchemaType> = {
    conceito: "DefinedTerm",
    classificacao: "DefinedTerm",
    procedimento: "TechArticle",
    requisito: "TechArticle",
  };
  base.push(artigo[d.tipo as KnowledgeObjectType] ?? "Article");
  if (d.faq.length > 0) base.push("FAQPage");
  if (d.checklist.length > 1) base.push("HowTo");
  return base;
};

const organization = () => ({
  "@type": "Organization",
  "@id": `${SITE_URL}#organization`,
  name: SITE_NAME,
  url: SITE_URL,
});

/** Constrói o @graph JSON-LD completo. Pura projeção do rascunho. */
export const buildJsonLd = (d: KnowledgeDraft): Record<string, unknown> => {
  const seo = buildSeo(d);
  const url = canonicalUrl(d.slug);
  const tipos = applicableSchemas(d);
  const graph: Record<string, unknown>[] = [organization()];

  graph.push({
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: seo.title,
    description: seo.description,
    inLanguage: seo.idioma,
    dateModified: seo.lastModified,
    isPartOf: { "@id": `${SITE_URL}#organization` },
  });

  graph.push({
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumb`,
    itemListElement: seo.breadcrumb.map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: b.nome,
      item: b.url,
    })),
  });

  if (tipos.includes("DefinedTerm")) {
    graph.push({
      "@type": "DefinedTerm",
      "@id": `${url}#term`,
      name: d.titulo,
      description: d.resumoCurto || seo.description,
      inDefinedTermSet: { "@type": "DefinedTermSet", name: `${SITE_NAME} — ${d.categoria}` },
    });
  }

  if (tipos.includes("Article") || tipos.includes("TechArticle")) {
    graph.push({
      "@type": tipos.includes("TechArticle") ? "TechArticle" : "Article",
      "@id": `${url}#article`,
      headline: d.titulo,
      description: seo.description,
      articleSection: d.categoria,
      inLanguage: seo.idioma,
      dateModified: seo.lastModified,
      author: { "@type": "Organization", name: SITE_NAME },
      publisher: { "@id": `${SITE_URL}#organization` },
      mainEntityOfPage: { "@id": `${url}#webpage` },
      citation: d.fontes.map((f) => ({
        "@type": "CreativeWork",
        name: f.titulo,
        ...(f.url ? { url: f.url } : {}),
      })),
    });
  }

  if (tipos.includes("FAQPage")) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: d.faq.map((f) => ({
        "@type": "Question",
        name: f.pergunta,
        acceptedAnswer: { "@type": "Answer", text: f.resposta },
      })),
    });
  }

  if (tipos.includes("HowTo")) {
    graph.push({
      "@type": "HowTo",
      "@id": `${url}#howto`,
      name: d.titulo,
      description: seo.description,
      step: d.checklist.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s,
      })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
};

export const renderJsonLd = (d: KnowledgeDraft): string =>
  JSON.stringify(buildJsonLd(d), null, 2);

/** Validação estrutural mínima do JSON-LD gerado (usada nos testes e na UI). */
export const validateJsonLd = (json: Record<string, unknown>): readonly string[] => {
  const problemas: string[] = [];
  if (json["@context"] !== "https://schema.org") problemas.push("@context ausente ou inválido.");
  const grafo = json["@graph"];
  if (!Array.isArray(grafo) || grafo.length === 0) {
    problemas.push("@graph vazio.");
    return problemas;
  }
  grafo.forEach((n, i) => {
    const node = n as Record<string, unknown>;
    if (!node["@type"]) problemas.push(`Nó ${i} sem @type.`);
    if (!node["@id"] && node["@type"] !== "Organization") problemas.push(`Nó ${i} sem @id.`);
  });
  return problemas;
};