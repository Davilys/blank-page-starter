/**
 * Text-based parsers (FASE 07 §2): txt, md, html, json, csv.
 * Each one only converts bytes into plain text and delegates the structural
 * pass to the domain. No interpretation happens in infrastructure.
 */
import Papa from "papaparse";
import type { DocumentParser } from "../../application/ports/ingestion";
import type { ParsedDocument, StructuredDocument } from "../../domain/ingestion/SourceDocument";
import { structureFromText, extractDates, extractKeywords, extractLinks } from "../../domain/ingestion/structure";
import { err, ok } from "../../domain/shared/primitives";

const baseName = (f: File) => f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();

const done = (texto: string, estrutura: StructuredDocument, avisos: string[] = []): ParsedDocument => ({
  texto,
  estrutura,
  avisos,
});

export const createTxtParser = (): DocumentParser => ({
  formato: "txt",
  async parse(file) {
    const texto = await file.text();
    return ok(done(texto, structureFromText(texto, baseName(file))));
  },
});

export const createMarkdownParser = (): DocumentParser => ({
  formato: "md",
  async parse(file) {
    const texto = await file.text();
    // Markdown already carries the structural marks the extractor understands.
    return ok(done(texto, structureFromText(texto, baseName(file))));
  },
});

/** HTML → text using the browser parser, preserving block boundaries. */
export const createHtmlParser = (): DocumentParser => ({
  formato: "html",
  async parse(file) {
    const html = await file.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script,style,noscript,svg").forEach((n) => n.remove());

    const linhas: string[] = [];
    const walk = (node: Element) => {
      for (const child of Array.from(node.children)) {
        const tag = child.tagName.toLowerCase();
        if (/^h[1-6]$/.test(tag)) {
          linhas.push("", `${"#".repeat(Number(tag[1]))} ${child.textContent?.trim() ?? ""}`, "");
        } else if (tag === "li") {
          linhas.push(`- ${child.textContent?.trim() ?? ""}`);
        } else if (tag === "tr") {
          const celulas = Array.from(child.children).map((c) => c.textContent?.trim() ?? "");
          linhas.push(`| ${celulas.join(" | ")} |`);
        } else if (["p", "blockquote", "pre", "div", "section", "article", "main", "td", "th"].includes(tag)) {
          if (child.children.length === 0) {
            const t = child.textContent?.trim();
            if (t) linhas.push("", t, "");
          } else walk(child);
        } else {
          walk(child);
        }
      }
    };
    walk(doc.body ?? doc.documentElement);

    const texto = linhas.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    const titulo = doc.querySelector("title")?.textContent?.trim() || baseName(file);
    const estrutura = structureFromText(texto, titulo);
    const links = Array.from(new Set(
      Array.from(doc.querySelectorAll("a[href^='http']")).map((a) => a.getAttribute("href") ?? ""),
    )).filter(Boolean);

    return ok(
      done(texto, {
        ...estrutura,
        tituloSugerido: estrutura.tituloSugerido || titulo,
        links: Array.from(new Set([...estrutura.links, ...links])).slice(0, 200),
      }),
    );
  },
});

/** JSON → flattened key/value lines. Arrays of objects become a table. */
export const createJsonParser = (): DocumentParser => ({
  formato: "json",
  async parse(file) {
    const bruto = await file.text();
    let dados: unknown;
    try {
      dados = JSON.parse(bruto);
    } catch {
      return err<ParsedDocument>("JSON inválido: não foi possível interpretar o arquivo.");
    }

    const linhas: string[] = [];
    const emit = (valor: unknown, caminho: string) => {
      if (valor === null || valor === undefined) return;
      if (Array.isArray(valor)) {
        valor.forEach((v, i) => emit(v, `${caminho}[${i}]`));
      } else if (typeof valor === "object") {
        for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
          emit(v, caminho ? `${caminho}.${k}` : k);
        }
      } else {
        const texto = String(valor).trim();
        if (!texto) return;
        linhas.push(caminho ? `${caminho}: ${texto}` : texto);
      }
    };
    emit(dados, "");

    const texto = linhas.join("\n");
    const registro = dados as Record<string, unknown>;
    const titulo =
      typeof registro?.title === "string"
        ? registro.title
        : typeof registro?.titulo === "string"
          ? registro.titulo
          : baseName(file);

    return ok(
      done(texto, {
        ...structureFromText(texto, titulo),
        tituloSugerido: titulo,
        links: extractLinks(texto),
        datas: extractDates(texto),
        palavrasChave: extractKeywords(texto),
      }, [
        "JSON é convertido em pares chave/valor. Nenhum campo é interpretado semanticamente.",
      ]),
    );
  },
});

/** CSV → a single table, header row preserved verbatim. */
export const createCsvParser = (): DocumentParser => ({
  formato: "csv",
  async parse(file) {
    const bruto = await file.text();
    const parsed = Papa.parse<string[]>(bruto.trim(), { skipEmptyLines: true });
    const linhas = (parsed.data ?? []).filter((l) => Array.isArray(l) && l.some((c) => String(c).trim()));
    if (linhas.length === 0) return err<ParsedDocument>("CSV vazio ou ilegível.");

    const [cabecalho, ...corpo] = linhas.map((l) => l.map((c) => String(c).trim()));
    const texto = linhas.map((l) => `| ${l.join(" | ")} |`).join("\n");
    const base = structureFromText(texto, baseName(file));

    return ok(
      done(
        texto,
        {
          ...base,
          tituloSugerido: baseName(file),
          paragrafos: [],
          tabelas: [{ cabecalho, linhas: corpo }],
        },
        parsed.errors?.length
          ? [`${parsed.errors.length} linha(s) com formatação irregular foram mantidas como estão.`]
          : [],
      ),
    );
  },
});