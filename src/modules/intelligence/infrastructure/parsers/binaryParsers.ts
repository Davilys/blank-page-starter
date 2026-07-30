/**
 * Binary parsers (FASE 07 §2): PDF and DOCX — TEXT EXTRACTION ONLY.
 * No OCR, no layout reconstruction, no AI. Libraries already present in the
 * project are reused (pdfjs-dist, jszip); no new dependency is introduced.
 */
import JSZip from "jszip";
import type { DocumentParser } from "../../application/ports/ingestion";
import type { ParsedDocument } from "../../domain/ingestion/SourceDocument";
import { structureFromText } from "../../domain/ingestion/structure";
import { err, ok } from "../../domain/shared/primitives";

const baseName = (f: File) => f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();

export const createPdfParser = (): DocumentParser => ({
  formato: "pdf",
  async parse(file) {
    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const workerSrc = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjs.getDocument({ data: bytes }).promise;

      const paginas: string[] = [];
      for (let n = 1; n <= pdf.numPages; n += 1) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        // Rebuild lines from item positions so paragraphs survive.
        let linhaAtual = "";
        let ultimoY: number | null = null;
        const linhas: string[] = [];
        for (const item of content.items as { str: string; transform: number[] }[]) {
          const y = Math.round(item.transform[5]);
          if (ultimoY !== null && Math.abs(y - ultimoY) > 2) {
            linhas.push(linhaAtual.trim());
            linhaAtual = "";
          }
          linhaAtual += item.str;
          ultimoY = y;
        }
        if (linhaAtual.trim()) linhas.push(linhaAtual.trim());
        paginas.push(linhas.join("\n"));
        page.cleanup();
      }

      const texto = paginas.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
      const avisos = texto
        ? []
        : ["Nenhuma camada de texto encontrada. PDFs digitalizados exigem transcrição manual (não há OCR nesta fase)."];

      return ok({ texto, estrutura: structureFromText(texto, baseName(file)), avisos } as ParsedDocument);
    } catch (e) {
      return err<ParsedDocument>(
        `Falha ao ler o PDF: ${e instanceof Error ? e.message : "arquivo inválido"}.`,
      );
    }
  },
});

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

const decode = (v: string) => v.replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m] ?? m);

/** DOCX = ZIP + OOXML. Paragraph/table marks are converted to plain text. */
export const createDocxParser = (): DocumentParser => ({
  formato: "docx",
  async parse(file) {
    try {
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const entry = zip.file("word/document.xml");
      if (!entry) return err<ParsedDocument>("DOCX inválido: word/document.xml não encontrado.");

      const xml = await entry.async("string");
      const paragrafos: string[] = [];

      for (const bloco of xml.split(/<w:p[ >]/).slice(1)) {
        const isList = /<w:numPr[ >\/]/.test(bloco);
        const heading = bloco.match(/<w:pStyle[^>]*w:val="Heading(\d)"/);
        const texto = decode(
          (bloco.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) ?? [])
            .map((t) => t.replace(/<[^>]+>/g, ""))
            .join(""),
        ).trim();
        if (!texto) continue;
        if (heading) paragrafos.push(`${"#".repeat(Number(heading[1]))} ${texto}`);
        else if (isList) paragrafos.push(`- ${texto}`);
        else paragrafos.push(texto);
      }

      const texto = paragrafos.join("\n\n");
      return ok({
        texto,
        estrutura: structureFromText(texto, baseName(file)),
        avisos: ["Somente texto é extraído do DOCX: imagens, comentários e formatação são ignorados."],
      } as ParsedDocument);
    } catch (e) {
      return err<ParsedDocument>(
        `Falha ao ler o DOCX: ${e instanceof Error ? e.message : "arquivo inválido"}.`,
      );
    }
  },
});