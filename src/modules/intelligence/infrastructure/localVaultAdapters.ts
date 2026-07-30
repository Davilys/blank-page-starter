/** Persistência local do Knowledge Vault (isolada do banco do CRM). */
import type {
  VaultEventRepository,
  VaultFactRepository,
  VaultFilter,
} from "../application/ports/vault";
import type { VaultEvent, VaultFact } from "../domain/vault/VaultFact";
import { hasSource } from "../domain/vault/VaultFact";
import { err, ok } from "../domain/shared/primitives";

const FACTS_KEY = "wm.intelligence.vault.facts.v1";
const EVENTS_KEY = "wm.intelligence.vault.events.v1";

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

const matches = (f: VaultFact, q: VaultFilter): boolean => {
  const termo = (q.texto ?? "").trim().toLowerCase();
  if (termo) {
    const hay = [f.titulo, f.declaracao, f.fontePrimaria.titulo, ...f.tags]
      .join(" ")
      .toLowerCase();
    if (!hay.includes(termo)) return false;
  }
  if (q.tipo && f.tipo !== q.tipo) return false;
  if (q.status && f.status !== q.status) return false;
  if (q.confianca && f.confianca !== q.confianca) return false;
  if (q.jurisdicao && f.jurisdicao !== q.jurisdicao) return false;
  if (q.responsavelId && f.revisorId !== q.responsavelId) return false;
  if (q.tag && !f.tags.includes(q.tag)) return false;
  if (q.entidade && !f.entidadesRelacionadas.map(String).includes(q.entidade)) return false;
  if (q.objetoConsumidor && !f.objetosConsumidores.includes(q.objetoConsumidor)) return false;
  if (q.fonte) {
    const fonte = q.fonte.toLowerCase();
    const alvo = `${f.fontePrimaria.titulo} ${f.fonteSecundaria?.titulo ?? ""}`.toLowerCase();
    if (!alvo.includes(fonte)) return false;
  }
  if (q.semFontePrimaria && hasSource(f.fontePrimaria)) return false;
  if (q.semRevisao && Boolean(f.revisorId && f.ultimaValidacaoEm)) return false;
  return true;
};

export const createLocalVaultRepository = (): VaultFactRepository => ({
  async list(filter) {
    const items = read<VaultFact>(FACTS_KEY)
      .filter((f) => matches(f, filter))
      .sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? 1 : -1));
    return ok({ items, total: items.length });
  },
  async findById(id) {
    const found = read<VaultFact>(FACTS_KEY).find((f) => String(f.id) === id);
    return found ? ok(found) : err<VaultFact>("Fato não encontrado no Vault.");
  },
  async save(fact) {
    const all = read<VaultFact>(FACTS_KEY);
    const idx = all.findIndex((f) => f.id === fact.id);
    if (idx >= 0) all[idx] = fact;
    else all.push(fact);
    return write(FACTS_KEY, all) ? ok(fact) : err<VaultFact>("Falha ao gravar o fato.");
  },
});

export const createLocalVaultEventRepository = (): VaultEventRepository => ({
  async listByFact(fatoId) {
    const items = read<VaultEvent>(EVENTS_KEY)
      .filter((e) => e.fatoId === fatoId)
      .sort((a, b) => (a.em < b.em ? 1 : -1));
    return ok({ items, total: items.length });
  },
  async listRecent(limite) {
    const all = read<VaultEvent>(EVENTS_KEY).sort((a, b) => (a.em < b.em ? 1 : -1));
    return ok({ items: all.slice(0, limite), total: all.length });
  },
  async append(evento) {
    const all = read<VaultEvent>(EVENTS_KEY);
    all.push(evento);
    return write(EVENTS_KEY, all)
      ? ok(evento)
      : err<VaultEvent>("Falha ao registrar auditoria.");
  },
});