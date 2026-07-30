/**
 * FASE 06 persistence adapter — browser localStorage.
 *
 * Chosen deliberately: the constitution forbids touching the existing
 * database in this phase. The port contract is identical to what a Supabase
 * adapter will implement in FASE 07, so nothing above this file changes.
 */
import type {
  DraftFilter,
  DraftHistoryRepository,
  DraftRepository,
} from "../application/ports/factory";
import type { KnowledgeDraft } from "../domain/factory/KnowledgeDraft";
import type { KnowledgeVersion } from "../domain/memory/KnowledgeVersion";
import { err, ok } from "../domain/shared/primitives";

const DRAFTS_KEY = "wm.intelligence.factory.drafts.v1";
const HISTORY_KEY = "wm.intelligence.factory.history.v1";

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

const matches = (d: KnowledgeDraft, f: DraftFilter): boolean => {
  const termo = (f.texto ?? "").trim().toLowerCase();
  if (termo) {
    const haystack = [d.titulo, d.descricao, d.resumoCurto, d.categoria, ...d.palavrasChave]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(termo)) return false;
  }
  if (f.estado && d.estado !== f.estado) return false;
  if (f.categoria && d.categoria !== f.categoria) return false;
  if (f.tipo && d.tipo !== f.tipo) return false;
  if (f.autorId && d.autorId !== f.autorId) return false;
  if (f.prioridade && d.prioridade !== f.prioridade) return false;
  if (f.idioma && d.idioma !== f.idioma) return false;
  if (f.entidadePrincipal && String(d.entidadePrincipal) !== f.entidadePrincipal) return false;
  return true;
};

export const createLocalDraftRepository = (): DraftRepository => ({
  async list(filter) {
    const all = read<KnowledgeDraft>(DRAFTS_KEY)
      .filter((d) => matches(d, filter))
      .sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? 1 : -1));
    return ok({ items: all, total: all.length });
  },
  async findById(id) {
    const found = read<KnowledgeDraft>(DRAFTS_KEY).find((d) => d.id === id);
    return found ? ok(found) : err<KnowledgeDraft>("Objeto não encontrado.");
  },
  async save(draft) {
    const all = read<KnowledgeDraft>(DRAFTS_KEY);
    const idx = all.findIndex((d) => d.id === draft.id);
    if (idx >= 0) all[idx] = draft;
    else all.push(draft);
    return write(DRAFTS_KEY, all)
      ? ok(draft)
      : err<KnowledgeDraft>("Falha ao gravar o objeto no armazenamento local.");
  },
  async remove(id) {
    const all = read<KnowledgeDraft>(DRAFTS_KEY).filter((d) => d.id !== id);
    return write(DRAFTS_KEY, all) ? ok(true as const) : err<true>("Falha ao remover.");
  },
});

export const createLocalHistoryRepository = (): DraftHistoryRepository => ({
  async append(version) {
    const all = read<KnowledgeVersion>(HISTORY_KEY);
    all.push(version);
    return write(HISTORY_KEY, all)
      ? ok(version)
      : err<KnowledgeVersion>("Falha ao registrar a versão.");
  },
  async listByObject(id) {
    const items = read<KnowledgeVersion>(HISTORY_KEY)
      .filter((v) => v.objetoId === id)
      .sort((a, b) => b.versao - a.versao);
    return ok({ items, total: items.length });
  },
  async listRecent(limit) {
    const all = read<KnowledgeVersion>(HISTORY_KEY).sort((a, b) =>
      a.registradoEm < b.registradoEm ? 1 : -1,
    );
    return ok({ items: all.slice(0, limit), total: all.length });
  },
});