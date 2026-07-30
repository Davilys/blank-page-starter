/**
 * FASE 11 §SEO técnico — projeções determinísticas de metadados.
 * Nada é inventado: todo valor deriva de campos preenchidos por humanos.
 */
import type { KnowledgeDraft } from "../factory/KnowledgeDraft";
import type { MetaTag } from "./Publication";

export const SITE_NAME = "WebMarcas Intelligence";
export const SITE_URL = "https://page-creation-pro.lovable.app";
export const PUBLIC_BASE_PATH = "/conhecimento";

const clamp = (v: string, max: number) => {
  const t = v.trim().replace(/\s+/g, " ");
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
};

export interface SeoMetadata {
  readonly title: string;
  readonly description: string;
  readonly slug: string;
  readonly canonical: string;
  readonly robots: string;
  readonly idioma: string;
  readonly lastModified: string;
  readonly keywords: readonly string[];
  readonly breadcrumb: readonly { readonly nome: string; readonly url: string }[];
}

export const canonicalUrl = (slug: string): string =>
  `${SITE_URL}${PUBLIC_BASE_PATH}/${slug}`;

export const buildSeo = (d: KnowledgeDraft): SeoMetadata => {
  const categoriaSlug = d.categoria
    ? d.categoria
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    : "";

  return {
    title: clamp(`${d.titulo} | ${SITE_NAME}`, 65),
    description: clamp(d.descricao || d.resumoCurto, 158),
    slug: d.slug,
    canonical: canonicalUrl(d.slug),
    robots: "index, follow, max-snippet:-1, max-image-preview:large",
    idioma: d.idioma || "pt-BR",
    lastModified: d.atualizadoEm,
    keywords: d.palavrasChave,
    breadcrumb: [
      { nome: "Início", url: SITE_URL },
      { nome: "Conhecimento", url: `${SITE_URL}${PUBLIC_BASE_PATH}` },
      ...(categoriaSlug
        ? [{ nome: d.categoria, url: `${SITE_URL}${PUBLIC_BASE_PATH}?categoria=${categoriaSlug}` }]
        : []),
      { nome: d.titulo, url: canonicalUrl(d.slug) },
    ],
  };
};

export const buildMetaTags = (d: KnowledgeDraft): readonly MetaTag[] => {
  const seo = buildSeo(d);
  return [
    { chave: "description", valor: seo.description, atributo: "name" },
    { chave: "robots", valor: seo.robots, atributo: "name" },
    { chave: "author", valor: d.autorId || SITE_NAME, atributo: "name" },
    ...(seo.keywords.length
      ? [{ chave: "keywords", valor: seo.keywords.join(", "), atributo: "name" as const }]
      : []),
    { chave: "og:type", valor: "article", atributo: "property" },
    { chave: "og:title", valor: seo.title, atributo: "property" },
    { chave: "og:description", valor: seo.description, atributo: "property" },
    { chave: "og:url", valor: seo.canonical, atributo: "property" },
    { chave: "og:site_name", valor: SITE_NAME, atributo: "property" },
    { chave: "og:locale", valor: seo.idioma.replace("-", "_"), atributo: "property" },
    { chave: "article:modified_time", valor: seo.lastModified, atributo: "property" },
    { chave: "twitter:card", valor: "summary_large_image", atributo: "name" },
    { chave: "twitter:title", valor: seo.title, atributo: "name" },
    { chave: "twitter:description", valor: seo.description, atributo: "name" },
  ];
};

export const renderMetaTags = (tags: readonly MetaTag[]): string =>
  tags
    .map((t) => `<meta ${t.atributo}="${t.chave}" content="${escapeAttr(t.valor)}" />`)
    .join("\n");

export interface SitemapEntry {
  readonly loc: string;
  readonly lastmod: string;
  readonly changefreq: string;
  readonly priority: string;
}

export const buildSitemapEntry = (d: KnowledgeDraft): SitemapEntry => ({
  loc: canonicalUrl(d.slug),
  lastmod: (d.atualizadoEm as unknown as string).slice(0, 10),
  changefreq: "monthly",
  priority: d.prioridade === "critica" ? "0.9" : d.prioridade === "alta" ? "0.8" : "0.6",
});

export const renderSitemapEntry = (e: SitemapEntry): string =>
  [
    "<url>",
    `  <loc>${e.loc}</loc>`,
    `  <lastmod>${e.lastmod}</lastmod>`,
    `  <changefreq>${e.changefreq}</changefreq>`,
    `  <priority>${e.priority}</priority>`,
    "</url>",
  ].join("\n");

export const escapeAttr = (v: string): string =>
  v
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");