/**
 * Deterministic structural extraction (FASE 07 §5).
 *
 * Everything here is a pure function over text. It recognises shapes —
 * headings, bullets, pipe tables, URLs, dates, word frequency — and NEVER
 * rewrites, summarises or interprets the content. Any string returned is a
 * verbatim slice of the source document.
 */
import type { DocumentList, DocumentTable, StructuredDocument } from "./SourceDocument";

const URL_RE = /https?:\/\/[^\s<>")\]]+/g;

/** Dates in the formats actually used in Brazilian legal/marketing content. */
const DATE_RES: readonly RegExp[] = [
  /\b\d{2}\/\d{2}\/\d{4}\b/g,
  /\b\d{4}-\d{2}-\d{2}\b/g,
  /\b\d{1,2}\s+de\s+(janeiro|fevereiro|mar\u00e7o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{4}\b/gi,
];

/** Portuguese + English stopwords. Frequency only — not semantics. */
const STOPWORDS = new Set(
  ("a o as os um uma uns umas de do da dos das em no na nos nas por para per com sem sob sobre entre até ao aos à às e ou mas que quando como onde qual quais se sua seu suas seus este esta estes estas esse essa isso aquilo ser estar ter haver não sim mais menos muito pouco já também pode podem deve devem foi foram será serão the of and to in for on with is are was were be been this that it as at from or an").split(
    /\s+/,
  ),
);

const isHeading = (line: string): boolean => {
  const l = line.trim();
  if (!l) return false;
  if (/^#{1,6}\s+/.test(l)) return true;
  if (l.length > 90) return false;
  if (/[.;:]$/.test(l)) return false;
  // ALL CAPS or numbered section such as "3. Exigências"
  if (/^\d+(\.\d+)*[.)]?\s+\S/.test(l) && l.length <= 80) return true;
  const letters = l.replace(/[^A-Za-zÀ-ÿ]/g, "");
  return letters.length >= 4 && letters === letters.toUpperCase();
};

const stripHeadingMarks = (line: string) => line.replace(/^#{1,6}\s+/, "").trim();

const BULLET_RE = /^\s*([-*•–]|\d+[.)])\s+(.*)$/;

const isTableRow = (line: string) => line.trim().startsWith("|") && line.includes("|", 1);
const isTableSeparator = (line: string) => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes("-");

const splitRow = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

export const extractLinks = (texto: string): string[] =>
  Array.from(new Set(texto.match(URL_RE) ?? [])).slice(0, 200);

export const extractDates = (texto: string): string[] => {
  const found: string[] = [];
  for (const re of DATE_RES) found.push(...(texto.match(re) ?? []));
  return Array.from(new Set(found)).slice(0, 100);
};

/** Frequency-ranked terms. Statistical, not semantic. */
export const extractKeywords = (texto: string, limite = 15): string[] => {
  const counts = new Map<string, number>();
  const palavras = texto
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/);
  for (const p of palavras) {
    if (p.length < 4 || STOPWORDS.has(p) || /^\d+$/.test(p)) continue;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limite)
    .map(([w]) => w);
};

/**
 * Main entry point: text (already extracted from any format) → structure.
 * Line-based state machine, fully deterministic.
 */
export const structureFromText = (texto: string, tituloFallback = ""): StructuredDocument => {
  const linhas = texto.replace(/\r\n?/g, "\n").split("\n");

  const subtitulos: string[] = [];
  const paragrafos: string[] = [];
  const listas: DocumentList[] = [];
  const tabelas: DocumentTable[] = [];

  let tituloSugerido = "";
  let bufferParagrafo: string[] = [];
  let bufferLista: { ordenada: boolean; itens: string[] } | null = null;
  let bufferTabela: string[][] | null = null;

  const flushParagrafo = () => {
    const t = bufferParagrafo.join(" ").trim();
    if (t) paragrafos.push(t);
    bufferParagrafo = [];
  };
  const flushLista = () => {
    if (bufferLista && bufferLista.itens.length > 0) {
      listas.push({ ordenada: bufferLista.ordenada, itens: bufferLista.itens });
    }
    bufferLista = null;
  };
  const flushTabela = () => {
    if (bufferTabela && bufferTabela.length > 0) {
      const [cabecalho, ...linhasTabela] = bufferTabela;
      tabelas.push({ cabecalho, linhas: linhasTabela });
    }
    bufferTabela = null;
  };
  const flushAll = () => {
    flushParagrafo();
    flushLista();
    flushTabela();
  };

  for (const linhaBruta of linhas) {
    const linha = linhaBruta.trimEnd();

    if (!linha.trim()) {
      flushAll();
      continue;
    }

    if (isTableRow(linha)) {
      flushParagrafo();
      flushLista();
      if (isTableSeparator(linha)) continue;
      bufferTabela = bufferTabela ?? [];
      bufferTabela.push(splitRow(linha));
      continue;
    }
    flushTabela();

    const bullet = linha.match(BULLET_RE);
    // A numbered heading ("3. Título") is a heading, not a list item.
    if (bullet && !(isHeading(linha) && !/^\s*[-*•–]/.test(linha))) {
      flushParagrafo();
      const ordenada = /^\s*\d/.test(linha);
      if (!bufferLista || bufferLista.ordenada !== ordenada) {
        flushLista();
        bufferLista = { ordenada, itens: [] };
      }
      bufferLista.itens.push(bullet[2].trim());
      continue;
    }
    flushLista();

    if (isHeading(linha)) {
      flushParagrafo();
      const titulo = stripHeadingMarks(linha);
      if (!tituloSugerido) tituloSugerido = titulo;
      else subtitulos.push(titulo);
      continue;
    }

    bufferParagrafo.push(linha.trim());
  }
  flushAll();

  if (!tituloSugerido) {
    tituloSugerido = (tituloFallback || paragrafos[0] || "").slice(0, 120).trim();
  }

  return {
    tituloSugerido,
    subtitulos: subtitulos.slice(0, 200),
    paragrafos,
    listas,
    tabelas,
    links: extractLinks(texto),
    datas: extractDates(texto),
    palavrasChave: extractKeywords(texto),
    totalCaracteres: texto.length,
  };
};

/** Count of structural artefacts actually captured — used by the preview. */
export const structureCounts = (e: StructuredDocument) => ({
  subtitulos: e.subtitulos.length,
  paragrafos: e.paragrafos.length,
  listas: e.listas.length,
  itensDeLista: e.listas.reduce((n, l) => n + l.itens.length, 0),
  tabelas: e.tabelas.length,
  links: e.links.length,
  datas: e.datas.length,
  palavrasChave: e.palavrasChave.length,
});