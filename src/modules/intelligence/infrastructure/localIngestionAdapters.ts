/**
 * FASE 07 persistence adapters — browser localStorage, exactly like FASE 06.
 * The existing Supabase database is NOT touched. The port contract is what a
 * future Supabase adapter will implement.
 */
import type {
  CandidateFilter,
  CandidateRepository,
  IngestionLogRepository,
} from "../application/ports/ingestion";
import type { IngestionCandidate, IngestionLogEntry } from "../domain/ingestion/SourceDocument";
import { err, ok } from "../domain/shared/primitives";

const CANDIDATES_KEY = "wm.intelligence.ingestion.candidates.v1";
const LOG_KEY = "wm.intelligence.ingestion.log.v1";

/** Keeps localStorage usable: the full text is trimmed, structure is kept. */
export const MAX_TEXT_CHARS = 200_000;

const read = <T>(key: string): T[] => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const write = <T>(key: string, items: T[]): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
};

const matches = (c: IngestionCandidate, f: CandidateFilter): boolean => {
  const termo = (f.texto ?? "").trim().toLowerCase();
  if (termo) {
    const haystack = [c.arquivoNome, c.escolhas.titulo, c.estrutura.tituloSugerido, c.escolhas.categoria]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(termo)) return false;
  }
  if (f.status && c.status !== f.status) return false;
  if (f.formato && c.formato !== f.formato) return false;
  if (f.importadoPor && c.importadoPor !== f.importadoPor) return false;
  if (f.apenasComDuplicidade && c.duplicidades.length === 0) return false;
  return true;
};

export const createLocalCandidateRepository = (): CandidateRepository => ({
  async list(filter) {
    const items = read<IngestionCandidate>(CANDIDATES_KEY)
      .filter((c) => matches(c, filter))
      .sort((a, b) => (a.importadoEm < b.importadoEm ? 1 : -1));
    return ok({ items, total: items.length });
  },
  async findById(id) {
    const found = read<IngestionCandidate>(CANDIDATES_KEY).find((c) => c.id === id);
    return found ? ok(found) : err<IngestionCandidate>("Candidato não encontrado.");
  },
  async save(candidate) {
    const enxuto: IngestionCandidate = {
      ...candidate,
      texto: candidate.texto.slice(0, MAX_TEXT_CHARS),
    };
    const all = read<IngestionCandidate>(CANDIDATES_KEY);
    const idx = all.findIndex((c) => c.id === enxuto.id);
    if (idx >= 0) all[idx] = enxuto;
    else all.push(enxuto);
    return write(CANDIDATES_KEY, all)
      ? ok(enxuto)
      : err<IngestionCandidate>(
          "Falha ao gravar o candidato: o armazenamento local do navegador está cheio.",
        );
  },
  async remove(id) {
    const all = read<IngestionCandidate>(CANDIDATES_KEY).filter((c) => c.id !== id);
    return write(CANDIDATES_KEY, all) ? ok(true as const) : err<true>("Falha ao remover.");
  },
});

export const createLocalIngestionLogRepository = (): IngestionLogRepository => ({
  async append(entry) {
    const all = read<IngestionLogEntry>(LOG_KEY);
    all.push(entry);
    return write(LOG_KEY, all)
      ? ok(entry)
      : err<IngestionLogEntry>("Falha ao registrar o histórico de ingestão.");
  },
  async listRecent(limit) {
    const all = read<IngestionLogEntry>(LOG_KEY).sort((a, b) =>
      a.ocorridoEm < b.ocorridoEm ? 1 : -1,
    );
    return ok({ items: all.slice(0, limit), total: all.length });
  },
  async listByCandidate(candidatoId) {
    const items = read<IngestionLogEntry>(LOG_KEY)
      .filter((e) => e.candidatoId === candidatoId)
      .sort((a, b) => (a.ocorridoEm < b.ocorridoEm ? 1 : -1));
    return ok({ items, total: items.length });
  },
});