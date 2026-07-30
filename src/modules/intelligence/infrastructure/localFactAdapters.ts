/** Persistência local do Fact Ledger (isolada do banco do CRM). */
import type { FactFilter, FactRepository } from "../application/ports/facts";
import type { Fact } from "../domain/facts/Fact";
import { daysSince } from "../domain/facts/confidence";
import { err, ok } from "../domain/shared/primitives";

const FACTS_KEY = "wm.intelligence.facts.v1";

const read = (): Fact[] => {
  try {
    const raw = localStorage.getItem(FACTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const write = (items: Fact[]): boolean => {
  try {
    localStorage.setItem(FACTS_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
};

const matches = (f: Fact, q: FactFilter): boolean => {
  const termo = (q.texto ?? "").trim().toLowerCase();
  if (termo) {
    const hay = [f.enunciado, f.valor, f.unidade, f.fonte.titulo, f.fonte.dispositivo]
      .join(" ")
      .toLowerCase();
    if (!hay.includes(termo)) return false;
  }
  if (q.status && f.status !== q.status) return false;
  if (q.tier && f.fonte.tier !== q.tier) return false;
  if (q.entidadePrincipal && String(f.entidadePrincipal) !== q.entidadePrincipal) return false;
  if (q.jurisdicao && f.jurisdicao !== q.jurisdicao) return false;
  if (q.revisorId && f.revisorId !== q.revisorId) return false;
  if (q.objetoAfetado && !f.objetosAfetados.includes(q.objetoAfetado)) return false;
  if (q.apenasContradicoes && !f.relacionamentos.some((r) => r.tipo === "contradiz")) return false;
  if (q.apenasVencidos) {
    const dias = daysSince(f.ultimaValidacaoEm);
    const limite = Math.max(30, f.periodicidadeDias || 180);
    if (dias !== null && dias <= limite) return false;
  }
  return true;
};

export const createLocalFactRepository = (): FactRepository => ({
  async list(filter) {
    const items = read()
      .filter((f) => matches(f, filter))
      .sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? 1 : -1));
    return ok({ items, total: items.length });
  },
  async findById(id) {
    const found = read().find((f) => f.id === id);
    return found ? ok(found) : err<Fact>("Fato não encontrado.");
  },
  async listChain(raizId) {
    const items = read()
      .filter((f) => f.raizId === raizId)
      .sort((a, b) => b.versao - a.versao);
    return ok({ items, total: items.length });
  },
  async save(fact) {
    const all = read();
    const idx = all.findIndex((f) => f.id === fact.id);
    if (idx >= 0) all[idx] = fact;
    else all.push(fact);
    return write(all) ? ok(fact) : err<Fact>("Falha ao gravar o fato.");
  },
});