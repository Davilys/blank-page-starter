/**
 * FASE 11 — Adaptadores de persistência (localStorage).
 *
 * Mesma decisão das fases anteriores: o contrato das portas é idêntico ao que
 * um adaptador Supabase (com RLS restrita a `admin`) implementará, então nada
 * acima desta camada muda na migração.
 *
 * Garantia de imutabilidade: `append` nunca altera registros existentes e a
 * auditoria não expõe update nem delete.
 */
import type {
  PublicationAuditRepository,
  PublicationRepository,
} from "../application/ports/publishing";
import type {
  PublicationAuditRecord,
  PublishedVersion,
} from "../domain/publishing/Publication";
import { err, ok } from "../domain/shared/primitives";

const VERSIONS_KEY = "wm.intelligence.publishing.versions.v1";
const AUDIT_KEY = "wm.intelligence.publishing.audit.v1";

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

const byRecent = (a: PublishedVersion, b: PublishedVersion) =>
  a.publicadoEm < b.publicadoEm ? 1 : -1;

export const createLocalPublicationRepository = (): PublicationRepository => ({
  async append(version) {
    const all = read<PublishedVersion>(VERSIONS_KEY).map((v) =>
      v.objetoId === version.objetoId ? { ...v, ativa: false } : v,
    );
    all.push(version);
    return write(VERSIONS_KEY, all)
      ? ok(version)
      : err<PublishedVersion>("Falha ao gravar a versão publicada.");
  },

  async setActive(objetoId, versao) {
    const all = read<PublishedVersion>(VERSIONS_KEY);
    const alvo = all.find((v) => v.objetoId === objetoId && v.versao === versao);
    if (!alvo) return err<PublishedVersion>("Versão inexistente.");
    const atualizado = all.map((v) =>
      v.objetoId === objetoId ? { ...v, ativa: v.versao === versao } : v,
    );
    return write(VERSIONS_KEY, atualizado)
      ? ok({ ...alvo, ativa: true })
      : err<PublishedVersion>("Falha ao ativar a versão.");
  },

  async deactivate(objetoId) {
    const all = read<PublishedVersion>(VERSIONS_KEY).map((v) =>
      v.objetoId === objetoId ? { ...v, ativa: false } : v,
    );
    return write(VERSIONS_KEY, all) ? ok(true as const) : err<true>("Falha ao despublicar.");
  },

  async listByObject(objetoId) {
    const items = read<PublishedVersion>(VERSIONS_KEY)
      .filter((v) => v.objetoId === objetoId)
      .sort((a, b) => b.versao - a.versao);
    return ok({ items, total: items.length });
  },

  async listActive() {
    const items = read<PublishedVersion>(VERSIONS_KEY).filter((v) => v.ativa).sort(byRecent);
    return ok({ items, total: items.length });
  },

  async listAll() {
    const items = read<PublishedVersion>(VERSIONS_KEY).sort(byRecent);
    return ok({ items, total: items.length });
  },
});

export const createLocalPublicationAuditRepository = (): PublicationAuditRepository => ({
  async append(record) {
    const all = read<PublicationAuditRecord>(AUDIT_KEY);
    all.push(record);
    return write(AUDIT_KEY, all)
      ? ok(record)
      : err<PublicationAuditRecord>("Falha ao registrar a auditoria.");
  },
  async list(limit = 200) {
    const all = read<PublicationAuditRecord>(AUDIT_KEY).sort((a, b) =>
      a.registradoEm < b.registradoEm ? 1 : -1,
    );
    return ok({ items: all.slice(0, limit), total: all.length });
  },
});