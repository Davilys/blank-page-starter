/**
 * FASE 11 §Preview — projeções exatas do que será servido.
 * O preview é o MESMO código usado na publicação: o que se vê é o que vai ao ar.
 */
import type { KnowledgeDraft } from "../factory/KnowledgeDraft";
import { stableHash } from "../reasoning/hash";
import { aiReadinessScore, renderSemanticHtml } from "./html";
import { publicCoverage, structuralConfidence } from "./checklist";
import { buildJsonLd, renderJsonLd, validateJsonLd } from "./schema";
import {
  buildMetaTags,
  buildSeo,
  buildSitemapEntry,
  renderMetaTags,
  renderSitemapEntry,
} from "./seo";
import type { MetaTag } from "./Publication";

export const PREVIEW_SURFACES = [
  "pagina",
  "faq",
  "artigo",
  "guia",
  "base",
  "schema",
  "meta",
  "sitemap",
] as const;
export type PreviewSurface = (typeof PREVIEW_SURFACES)[number];

export const PREVIEW_SURFACE_LABEL: Readonly<Record<PreviewSurface, string>> = {
  pagina: "Página Web",
  faq: "FAQ",
  artigo: "Artigo",
  guia: "Guia",
  base: "Base de Conhecimento",
  schema: "Schema / JSON-LD",
  meta: "Meta Tags & OG",
  sitemap: "Sitemap & Canonical",
};

export interface PublicationPreview {
  readonly slug: string;
  readonly html: string;
  readonly jsonLd: string;
  readonly metaTags: readonly MetaTag[];
  readonly metaHtml: string;
  readonly sitemap: string;
  readonly canonical: string;
  readonly breadcrumb: readonly { readonly nome: string; readonly url: string }[];
  readonly hash: string;
  readonly problemasSchema: readonly string[];
  readonly aiReadiness: number;
  readonly confianca: number;
  readonly cobertura: number;
}

export const buildPreview = (d: KnowledgeDraft, versao = 1): PublicationPreview => {
  const seo = buildSeo(d);
  const jsonLdObj = buildJsonLd(d);
  const html = renderSemanticHtml(d, versao);
  const metaTags = buildMetaTags(d);

  return {
    slug: d.slug,
    html,
    jsonLd: renderJsonLd(d),
    metaTags,
    metaHtml: renderMetaTags(metaTags),
    sitemap: renderSitemapEntry(buildSitemapEntry(d)),
    canonical: seo.canonical,
    breadcrumb: seo.breadcrumb,
    hash: stableHash({ html, jsonLd: jsonLdObj, metaTags, canonical: seo.canonical }),
    problemasSchema: validateJsonLd(jsonLdObj),
    aiReadiness: aiReadinessScore(d),
    confianca: structuralConfidence(d),
    cobertura: publicCoverage(d),
  };
};

/** Texto exibido em cada aba de preview. Determinístico, sem IA. */
export const previewSurface = (
  d: KnowledgeDraft,
  p: PublicationPreview,
  surface: PreviewSurface,
): string => {
  switch (surface) {
    case "pagina":
      return p.html;
    case "faq":
      return d.faq.length
        ? d.faq.map((f) => `P: ${f.pergunta}\nR: ${f.resposta}`).join("\n\n")
        : "— nenhuma pergunta cadastrada —";
    case "artigo":
      return [`# ${d.titulo}`, d.resumoCurto, d.explicacaoCompleta].filter(Boolean).join("\n\n");
    case "guia":
      return d.checklist.length
        ? d.checklist.map((c, i) => `${i + 1}. ${c}`).join("\n")
        : "— nenhuma etapa cadastrada —";
    case "base":
      return [
        `Título: ${d.titulo}`,
        `Slug: ${d.slug}`,
        `Categoria: ${d.categoria}`,
        `Entidade: ${String(d.entidadePrincipal)}`,
        `Jurisdição: ${d.jurisdicao}`,
        `Palavras-chave: ${d.palavrasChave.join(", ") || "—"}`,
        `Fontes: ${d.fontes.length}`,
        `Relações: ${d.relacionamentos.length}`,
      ].join("\n");
    case "schema":
      return p.jsonLd;
    case "meta":
      return p.metaHtml;
    case "sitemap":
      return [`<link rel="canonical" href="${p.canonical}" />`, "", p.sitemap].join("\n");
    default:
      return "";
  }
};