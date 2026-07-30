/**
 * Import a file → CANDIDATE. Never a Knowledge Object, never published.
 */
import { detectDuplicates } from "../../../domain/ingestion/duplicates";
import {
  defaultChoices,
  detectFormat,
  type IngestionCandidate,
} from "../../../domain/ingestion/SourceDocument";
import { asIsoDateTime, err, ok, type Result } from "../../../domain/shared/primitives";
import type { DraftRepository } from "../../ports/factory";
import type {
  CandidateRepository,
  IngestionLogRepository,
  ParserRegistry,
} from "../../ports/ingestion";

export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export interface ImportDocumentInput {
  readonly file: File;
  readonly importadoPor: string;
  readonly origem?: string;
}

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `ing_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const makeImportDocument =
  (
    registry: ParserRegistry,
    candidates: CandidateRepository,
    log: IngestionLogRepository,
    drafts: DraftRepository,
  ) =>
  async (input: ImportDocumentInput): Promise<Result<IngestionCandidate>> => {
    const { file, importadoPor } = input;

    if (!importadoPor?.trim()) {
      return err<IngestionCandidate>("Informe quem está importando: a ingestão é auditável.");
    }
    if (file.size === 0) return err<IngestionCandidate>("Arquivo vazio.");
    if (file.size > MAX_FILE_BYTES) {
      return err<IngestionCandidate>("Arquivo acima de 15 MB. Divida o documento antes de importar.");
    }

    const formato = detectFormat(file.name);
    if (!formato) {
      return err<IngestionCandidate>(
        "Formato não suportado. Use .txt, .md, .html, .pdf, .docx, .json ou .csv.",
      );
    }
    const parser = registry.parserFor(formato);
    if (!parser) return err<IngestionCandidate>(`Nenhum importador registrado para ${formato}.`);

    const parsed = await parser.parse(file);
    if (!parsed.ok) return err<IngestionCandidate>(parsed.error);
    if (!parsed.value.texto.trim()) {
      return err<IngestionCandidate>(
        "Nenhum texto extraído do arquivo. Nada é criado sem conteúdo legível.",
      );
    }

    const escolhas = defaultChoices(parsed.value.estrutura.tituloSugerido);
    const existentes = await drafts.list({});
    const duplicidades = detectDuplicates(
      escolhas,
      parsed.value.estrutura,
      existentes.ok ? existentes.value.items : [],
    );

    const agora = asIsoDateTime(new Date());
    const candidato: IngestionCandidate = {
      id: newId(),
      arquivoNome: file.name,
      formato,
      tamanhoBytes: file.size,
      origem: input.origem?.trim() || "upload manual",
      importadoPor: importadoPor.trim(),
      importadoEm: agora,
      texto: parsed.value.texto,
      estrutura: parsed.value.estrutura,
      avisos: parsed.value.avisos,
      escolhas: { ...escolhas, autorId: importadoPor.trim() },
      status: "pendente",
      duplicidades,
    };

    const saved = await candidates.save(candidato);
    if (!saved.ok) return saved;

    await log.append({
      id: newId(),
      candidatoId: candidato.id,
      evento: "importado",
      arquivoNome: candidato.arquivoNome,
      formato,
      origem: candidato.origem,
      usuario: candidato.importadoPor,
      ocorridoEm: agora,
      destino: "Fila de candidatos",
      observacao: duplicidades.length
        ? `${duplicidades.length} possível(is) duplicidade(s) detectada(s).`
        : undefined,
    });

    return ok(saved.value);
  };