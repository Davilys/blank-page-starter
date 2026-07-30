/** Parser registry — adding a format means adding a parser, never editing use cases. */
import type { DocumentParser, ParserRegistry } from "../../application/ports/ingestion";
import type { SourceFormat } from "../../domain/ingestion/SourceDocument";
import { createDocxParser, createPdfParser } from "./binaryParsers";
import {
  createCsvParser,
  createHtmlParser,
  createJsonParser,
  createMarkdownParser,
  createTxtParser,
} from "./textParsers";

export const createParserRegistry = (
  parsers: readonly DocumentParser[] = [
    createTxtParser(),
    createMarkdownParser(),
    createHtmlParser(),
    createJsonParser(),
    createCsvParser(),
    createPdfParser(),
    createDocxParser(),
  ],
): ParserRegistry => {
  const map = new Map<SourceFormat, DocumentParser>(parsers.map((p) => [p.formato, p]));
  return {
    supports: (formato) => map.has(formato),
    parserFor: (formato) => map.get(formato) ?? null,
  };
};