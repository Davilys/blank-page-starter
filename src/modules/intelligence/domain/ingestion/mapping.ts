/**
 * Candidate → Knowledge Draft projection (FASE 07 §6).
 *
 * Every field below is a VERBATIM copy or a deterministic re-serialisation of
 * the source document. Nothing is summarised, rewritten or inferred. Fields
 * that require editorial judgement (resumo curto/técnico, fontes, FAQ,
 * fluxograma, relacionamentos) are left EMPTY on purpose: they are the
 * editor's job in the FASE 06 workflow.
 */
import type { KnowledgeDraft } from "../factory/KnowledgeDraft";
import { emptyDraft, slugify } from "../factory/KnowledgeDraft";
import type { EntityId } from "../shared/primitives";
import type { DocumentTable, IngestionCandidate, StructuredDocument } from "./SourceDocument";

const tableToMarkdown = (t: DocumentTable): string => {
  const head = `| ${t.cabecalho.join(" | ")} |`;
  const sep = `| ${t.cabecalho.map(() => "---").join(" | ")} |`;
  const body = t.linhas.map((l) => `| ${l.join(" | ")} |`).join("\n");
  return [head, sep, body].filter(Boolean).join("\n");
};

/** Body text rebuilt from the captured structure, in original order. */
export const structureToBody = (e: StructuredDocument): string => {
  const blocos: string[] = [];
  if (e.paragrafos.length) blocos.push(e.paragrafos.join("\n\n"));
  for (const l of e.listas) {
    blocos.push(l.itens.map((i, idx) => (l.ordenada ? `${idx + 1}. ${i}` : `- ${i}`)).join("\n"));
  }
  for (const t of e.tabelas) blocos.push(tableToMarkdown(t));
  return blocos.join("\n\n").trim();
};

const isInternal = (url: string) =>
  /webmarcas|webpatentes/i.test(url);

export type DraftPayload = Omit<
  KnowledgeDraft,
  "id" | "criadoEm" | "atualizadoEm" | "versao"
>;

export const candidateToDraft = (c: IngestionCandidate): DraftPayload => {
  const { escolhas: esc, estrutura: est } = c;
  const links = est.links;

  return {
    ...emptyDraft(),
    slug: slugify(esc.titulo || est.tituloSugerido),
    titulo: esc.titulo || est.tituloSugerido,
    // First paragraph, copied verbatim — not a generated summary.
    descricao: (est.paragrafos[0] ?? "").slice(0, 400),
    tipo: esc.tipo,
    categoria: esc.categoria,
    entidadePrincipal: esc.entidadePrincipal as EntityId,
    estado: esc.estadoInicial,
    prioridade: esc.prioridade,
    idioma: esc.idioma,
    jurisdicao: esc.jurisdicao,
    palavrasChave: est.palavrasChave,
    explicacaoCompleta: structureToBody(est),
    checklist: est.listas.flatMap((l) => l.itens).slice(0, 100),
    linksInternos: links.filter(isInternal),
    linksExternos: links.filter((l) => !isInternal(l)),
    observacoes: [
      `Importado de "${c.arquivoNome}" (${c.formato}) em ${new Date(c.importadoEm).toLocaleString("pt-BR")}.`,
      est.subtitulos.length ? `Subtítulos do original: ${est.subtitulos.join(" · ")}` : "",
      est.datas.length ? `Datas encontradas: ${est.datas.join(", ")}` : "",
      "Resumos, fontes e FAQ devem ser preenchidos manualmente pelo editor.",
    ]
      .filter(Boolean)
      .join("\n"),
    autorId: esc.autorId,
    revisorId: esc.revisorId || undefined,
  };
};

/** What the preview shows as "aproveitado" vs "descartado". */
export interface MappingReport {
  readonly aproveitado: readonly { campo: string; origem: string; amostra: string }[];
  readonly manual: readonly string[];
}

export const mappingReport = (c: IngestionCandidate): MappingReport => {
  const d = candidateToDraft(c);
  const amostra = (v: string) => (v.length > 120 ? `${v.slice(0, 120)}…` : v);
  const linhas = [
    { campo: "Título", origem: "Título sugerido / escolha do editor", amostra: amostra(d.titulo) },
    { campo: "Descrição", origem: "1º parágrafo (verbatim)", amostra: amostra(d.descricao) },
    {
      campo: "Explicação completa",
      origem: "Parágrafos + listas + tabelas",
      amostra: amostra(d.explicacaoCompleta),
    },
    { campo: "Checklist", origem: "Itens de lista", amostra: amostra(d.checklist.join(" · ")) },
    {
      campo: "Palavras-chave",
      origem: "Frequência de termos",
      amostra: amostra(d.palavrasChave.join(", ")),
    },
    {
      campo: "Links",
      origem: "URLs encontradas",
      amostra: amostra([...d.linksInternos, ...d.linksExternos].join(" ")),
    },
    { campo: "Observações", origem: "Metadados da importação", amostra: amostra(d.observacoes) },
  ].filter((l) => l.amostra.trim().length > 0);

  return {
    aproveitado: linhas,
    manual: [
      "Resumo curto",
      "Resumo técnico",
      "Fontes",
      "FAQ",
      "Fluxograma",
      "Relacionamentos",
      "Data de revisão",
    ],
  };
};