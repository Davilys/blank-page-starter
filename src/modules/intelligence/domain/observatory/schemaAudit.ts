/**
 * ENGINE 5 — Schema Validator.
 * Revalida, fora do pipeline de publicação, tudo que é servido a crawlers:
 * JSON-LD, meta tags, canonical, Open Graph, robots e sitemap.
 */
import { buildJsonLd, validateJsonLd, applicableSchemas } from "../publishing/schema";
import { buildMetaTags, buildSeo, buildSitemapEntry, canonicalUrl } from "../publishing/seo";
import {
  penaltyScore,
  ratioScore,
  type ObservatoryFinding,
  type ObservatorySnapshot,
} from "./Observatory";

export interface SchemaRow {
  readonly objetoId: string;
  readonly slug: string;
  readonly titulo: string;
  readonly schemas: readonly string[];
  readonly erros: readonly string[];
  readonly avisos: readonly string[];
  readonly canonicalOk: boolean;
  readonly ogOk: boolean;
  readonly robotsOk: boolean;
  readonly sitemapOk: boolean;
  readonly valido: boolean;
}

export interface SchemaReport {
  readonly score: number;
  readonly linhas: readonly SchemaRow[];
  readonly totalErros: number;
  readonly totalAvisos: number;
  readonly achados: readonly ObservatoryFinding[];
}

export const analyzeSchema = (s: ObservatorySnapshot): SchemaReport => {
  const achados: ObservatoryFinding[] = [];

  const linhas: SchemaRow[] = s.rascunhos.map((d) => {
    const seo = buildSeo(d);
    const jsonLd = buildJsonLd(d);
    const erros = [...validateJsonLd(jsonLd)];
    const avisos: string[] = [];
    const metas = buildMetaTags(d);

    const canonicalOk = seo.canonical === canonicalUrl(d.slug) && Boolean(d.slug);
    const ogOk = metas.some((m) => m.chave === "og:title") && metas.some((m) => m.chave === "og:description");
    const robotsOk = metas.some((m) => m.chave === "robots");
    const sitemap = buildSitemapEntry(d);
    const sitemapOk = Boolean(sitemap.loc) && Boolean(sitemap.lastmod);

    if (!canonicalOk) erros.push("Canonical ausente ou divergente do slug.");
    if (!ogOk) erros.push("Open Graph incompleto (título ou descrição ausente).");
    if (!robotsOk) avisos.push("Meta robots não declarada.");
    if (!sitemapOk) avisos.push("Entrada de sitemap incompleta.");
    if (seo.title.length > 65) avisos.push("Title acima de 65 caracteres.");
    if (seo.description.length > 165) avisos.push("Description acima de 165 caracteres.");
    if (d.faq.length === 0) avisos.push("Sem FAQ: a página perde elegibilidade a FAQPage.");

    const linha: SchemaRow = {
      objetoId: d.id,
      slug: d.slug,
      titulo: d.titulo || "(sem título)",
      schemas: applicableSchemas(d),
      erros,
      avisos,
      canonicalOk,
      ogOk,
      robotsOk,
      sitemapOk,
      valido: erros.length === 0,
    };

    for (const e of erros) {
      achados.push({
        id: `schema:erro:${d.id}:${e}`,
        dimensao: "schema",
        severidade: "critico",
        titulo: "Erro de dados estruturados",
        detalhe: e,
        objetoId: d.id,
        slug: d.slug,
      });
    }
    for (const a of avisos) {
      achados.push({
        id: `schema:aviso:${d.id}:${a}`,
        dimensao: "schema",
        severidade: "informativo",
        titulo: "Aviso de dados estruturados",
        detalhe: a,
        objetoId: d.id,
        slug: d.slug,
      });
    }

    return linha;
  });

  const validos = linhas.filter((l) => l.valido).length;
  const score = linhas.length === 0
    ? 0
    : Math.round(
        (ratioScore(validos, linhas.length) + penaltyScore(achados, linhas.length)) / 2,
      );

  return {
    score,
    linhas,
    totalErros: linhas.reduce((a, l) => a + l.erros.length, 0),
    totalAvisos: linhas.reduce((a, l) => a + l.avisos.length, 0),
    achados,
  };
};