/**
 * FASE 11 §AI Readiness — HTML semântico legível por humanos e por IAs.
 *
 * Prioridades: hierarquia de headings correta, entidades explícitas, fatos
 * com fonte, datas, versões e relacionamentos declarados em `<dl>`/`<ul>`.
 * Sem divs decorativas, sem classes visuais, sem JavaScript.
 */
import type { KnowledgeDraft } from "../factory/KnowledgeDraft";
import { buildSeo } from "./seo";

export const escapeHtml = (v: string): string =>
  v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const paragraphs = (texto: string): string =>
  texto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `    <p>${escapeHtml(p)}</p>`)
    .join("\n");

const section = (id: string, titulo: string, corpo: string): string =>
  corpo.trim()
    ? [`  <section id="${id}">`, `    <h2>${escapeHtml(titulo)}</h2>`, corpo, "  </section>"].join(
        "\n",
      )
    : "";

/** Renderiza o corpo semântico do objeto (sem <head>, sem layout). */
export const renderSemanticHtml = (d: KnowledgeDraft, versao = 1): string => {
  const seo = buildSeo(d);

  const blocos = [
    `<article lang="${seo.idioma}" itemscope itemtype="https://schema.org/Article">`,
    "  <header>",
    `    <h1 itemprop="headline">${escapeHtml(d.titulo)}</h1>`,
    d.resumoCurto ? `    <p itemprop="description">${escapeHtml(d.resumoCurto)}</p>` : "",
    "    <dl>",
    `      <dt>Entidade principal</dt><dd>${escapeHtml(String(d.entidadePrincipal))}</dd>`,
    `      <dt>Categoria</dt><dd>${escapeHtml(d.categoria)}</dd>`,
    `      <dt>Jurisdição</dt><dd>${escapeHtml(d.jurisdicao)}</dd>`,
    `      <dt>Versão publicada</dt><dd>${versao}</dd>`,
    `      <dt>Atualizado em</dt><dd><time itemprop="dateModified" datetime="${escapeHtml(
      String(d.atualizadoEm),
    )}">${escapeHtml(String(d.atualizadoEm).slice(0, 10))}</time></dd>`,
    "    </dl>",
    "  </header>",
    section("explicacao", "Explicação completa", paragraphs(d.explicacaoCompleta)),
    section("resumo-tecnico", "Resumo técnico", paragraphs(d.resumoTecnico)),
    section(
      "etapas",
      "Etapas",
      d.checklist.length
        ? `    <ol>\n${d.checklist.map((c) => `      <li>${escapeHtml(c)}</li>`).join("\n")}\n    </ol>`
        : "",
    ),
    section(
      "faq",
      "Perguntas frequentes",
      d.faq.length
        ? d.faq
            .map(
              (f) =>
                `    <section itemscope itemtype="https://schema.org/Question">\n      <h3 itemprop="name">${escapeHtml(
                  f.pergunta,
                )}</h3>\n      <div itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer"><p itemprop="text">${escapeHtml(
                  f.resposta,
                )}</p></div>\n    </section>`,
            )
            .join("\n")
        : "",
    ),
    section(
      "relacionamentos",
      "Conhecimento relacionado",
      d.relacionamentos.length
        ? `    <ul>\n${d.relacionamentos
            .map(
              (r) =>
                `      <li><a href="/conhecimento/${escapeHtml(r.alvoSlug)}" rel="related">${escapeHtml(
                  r.alvoSlug,
                )}</a> — ${escapeHtml(r.tipo)}</li>`,
            )
            .join("\n")}\n    </ul>`
        : "",
    ),
    section(
      "fontes",
      "Fontes",
      d.fontes.length
        ? `    <ul>\n${d.fontes
            .map(
              (f) =>
                `      <li>${
                  f.url
                    ? `<a href="${escapeHtml(f.url)}" rel="nofollow noopener">${escapeHtml(f.titulo)}</a>`
                    : escapeHtml(f.titulo)
                } <small>(${escapeHtml(f.tier)})</small></li>`,
            )
            .join("\n")}\n    </ul>`
        : "",
    ),
    "</article>",
  ];

  return blocos.filter((b) => b !== "").join("\n");
};

/** Métrica de legibilidade para IA (0..100) — estrutural, nunca estética. */
export const aiReadinessScore = (d: KnowledgeDraft): number => {
  const sinais = [
    Boolean(d.titulo.trim()),
    d.resumoCurto.trim().length >= 40,
    d.explicacaoCompleta.trim().length >= 300,
    d.faq.length > 0,
    d.checklist.length > 0,
    d.fontes.length > 0,
    d.relacionamentos.length > 0,
    d.palavrasChave.length >= 3,
    Boolean(String(d.entidadePrincipal).trim()),
    Boolean(d.jurisdicao.trim()),
  ];
  return Math.round((sinais.filter(Boolean).length / sinais.length) * 100);
};