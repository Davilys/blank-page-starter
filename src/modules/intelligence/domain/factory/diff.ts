/**
 * Field-level diffing for the append-only history (FASE 03, Artigo 4).
 * Text-level diffs are deliberately avoided — they are noise.
 */
import type { FieldDiff } from "../memory/KnowledgeVersion";
import type { KnowledgeDraft } from "./KnowledgeDraft";

const IGNORED: readonly string[] = ["id", "criadoEm", "atualizadoEm", "versao"];

const stringify = (v: unknown): string | null => {
  if (v === undefined || v === null || v === "") return null;
  if (Array.isArray(v)) return v.length ? JSON.stringify(v) : null;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

export const FIELD_LABELS: Readonly<Record<string, string>> = {
  slug: "Slug",
  titulo: "Título",
  descricao: "Descrição",
  tipo: "Tipo",
  categoria: "Categoria",
  entidadePrincipal: "Entidade principal",
  relacionamentos: "Relacionamentos",
  fontes: "Fontes",
  estado: "Estado editorial",
  prioridade: "Prioridade",
  idioma: "Idioma",
  jurisdicao: "Jurisdição",
  palavrasChave: "Palavras-chave",
  resumoCurto: "Resumo curto",
  resumoTecnico: "Resumo técnico",
  explicacaoCompleta: "Explicação completa",
  checklist: "Checklist",
  fluxograma: "Fluxograma",
  faq: "FAQ",
  linksInternos: "Links internos",
  linksExternos: "Links externos",
  dataRevisao: "Data de revisão",
  observacoes: "Observações",
  autorId: "Autor",
  revisorId: "Revisor",
};

export const diffDrafts = (
  antes: KnowledgeDraft | null,
  depois: KnowledgeDraft,
): readonly FieldDiff[] => {
  const diffs: FieldDiff[] = [];
  const keys = Object.keys(depois).filter((k) => !IGNORED.includes(k));

  for (const key of keys) {
    const a = antes ? stringify((antes as unknown as Record<string, unknown>)[key]) : null;
    const b = stringify((depois as unknown as Record<string, unknown>)[key]);
    if (a !== b) diffs.push({ campo: key, antes: a, depois: b });
  }
  return diffs;
};