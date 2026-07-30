/**
 * Duplicate detection (FASE 07 §7) — deterministic string similarity only.
 * No embeddings, no vectors, no model. Advisory: it NEVER blocks the editor.
 */
import type { KnowledgeDraft } from "../factory/KnowledgeDraft";
import { slugify } from "../factory/KnowledgeDraft";
import type { CandidateChoices, DuplicateSuspicion, StructuredDocument } from "./SourceDocument";

const bigrams = (v: string): Set<string> => {
  const s = slugify(v).replace(/-/g, " ");
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i += 1) out.add(s.slice(i, i + 2));
  return out;
};

/** Sørensen–Dice coefficient over character bigrams (0..1). */
export const similarity = (a: string, b: string): number => {
  if (!a || !b) return 0;
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  A.forEach((g) => {
    if (B.has(g)) inter += 1;
  });
  return (2 * inter) / (A.size + B.size);
};

const overlap = (a: readonly string[], b: readonly string[]): number => {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b.map((v) => v.toLowerCase()));
  const hits = a.filter((v) => setB.has(v.toLowerCase())).length;
  return hits / Math.min(a.length, b.length);
};

export const SIMILARITY_THRESHOLD = 0.62;

export const detectDuplicates = (
  escolhas: CandidateChoices,
  estrutura: StructuredDocument,
  existentes: readonly KnowledgeDraft[],
): DuplicateSuspicion[] => {
  const titulo = escolhas.titulo || estrutura.tituloSugerido;
  const slug = slugify(titulo);
  const palavras = estrutura.palavrasChave;
  const corpo = estrutura.paragrafos.slice(0, 3).join(" ");

  const suspeitas: DuplicateSuspicion[] = [];

  for (const d of existentes) {
    const motivos: string[] = [];
    const simTitulo = similarity(titulo, d.titulo);
    const simCorpo = similarity(corpo, d.descricao || d.explicacaoCompleta.slice(0, 400));
    const simPalavras = overlap(palavras, d.palavrasChave);

    if (slug && slug === d.slug) motivos.push("Slug idêntico");
    if (simTitulo >= SIMILARITY_THRESHOLD) motivos.push(`Título similar (${Math.round(simTitulo * 100)}%)`);
    if (simPalavras >= 0.5) motivos.push(`Palavras-chave em comum (${Math.round(simPalavras * 100)}%)`);
    if (
      escolhas.entidadePrincipal &&
      escolhas.entidadePrincipal === String(d.entidadePrincipal) &&
      simTitulo >= 0.4
    ) {
      motivos.push("Mesma entidade principal");
    }
    if (simCorpo >= SIMILARITY_THRESHOLD) motivos.push(`Texto similar (${Math.round(simCorpo * 100)}%)`);

    if (motivos.length > 0) {
      suspeitas.push({
        draftId: d.id,
        titulo: d.titulo,
        motivos,
        similaridade: Math.max(simTitulo, simCorpo, simPalavras),
      });
    }
  }

  return suspeitas.sort((a, b) => b.similaridade - a.similaridade).slice(0, 10);
};