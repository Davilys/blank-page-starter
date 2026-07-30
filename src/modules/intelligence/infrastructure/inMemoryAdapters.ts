/**
 * FASE 05 infrastructure adapters — deliberately in-memory and EMPTY.
 *
 * The constitution forbids publishing unreviewed knowledge, so the foundation
 * ships with NO seeded content: an empty corpus is the honest starting state.
 * These adapters exist to prove the ports are wired end-to-end and to be
 * replaced by a real persistence adapter in a later phase WITHOUT touching
 * the application or presentation layers.
 *
 * No database table, migration or existing API is touched by this module.
 */
import type {
  EntityRepository,
  FabricPort,
  IntelligencePort,
  KnowledgeObjectRepository,
  MemoryRepository,
} from "../application/ports/repositories";
import type { KnowledgeEntity } from "../domain/entity/Entity";
import type { KnowledgeObject } from "../domain/knowledge-object/KnowledgeObject";
import type { KnowledgeVersion } from "../domain/memory/KnowledgeVersion";
import { emptyPage, err, ok } from "../domain/shared/primitives";
import {
  DEFAULT_AUDIENCE,
  DEFAULT_CONTEXT,
  type Intent,
} from "../domain/shared/taxonomy";

const NOT_FOUND = "Nenhum objeto de conhecimento encontrado.";

export const createInMemoryKnowledgeObjectRepository = (
  seed: readonly KnowledgeObject[] = [],
): KnowledgeObjectRepository => {
  const items = [...seed];

  return {
    async findById(id) {
      const found = items.find((o) => o.id === id);
      return found ? ok(found) : err<KnowledgeObject>(NOT_FOUND);
    },
    async findBySlug(slug) {
      const found = items.find((o) => o.slug === slug);
      return found ? ok(found) : err<KnowledgeObject>(NOT_FOUND);
    },
    async search(query) {
      const termo = (query.texto ?? "").toLowerCase();
      const filtered = items.filter((o) =>
        termo ? o.titulo.toLowerCase().includes(termo) : true,
      );
      const limited = filtered.slice(0, query.limite ?? 10);
      return ok({ items: limited, total: filtered.length });
    },
    async listRecentlyUpdated(limit) {
      return ok({ items: items.slice(0, limit), total: items.length });
    },
  };
};

export const createInMemoryEntityRepository = (
  seed: readonly KnowledgeEntity[] = [],
): EntityRepository => ({
  async findById(id) {
    const found = seed.find((e) => e.id === id);
    return found ? ok(found) : err<KnowledgeEntity>("Entidade não encontrada.");
  },
  async listByKind(limit) {
    return ok({ items: seed.slice(0, limit), total: seed.length });
  },
});

export const createInMemoryMemoryRepository = (
  seed: readonly KnowledgeVersion[] = [],
): MemoryRepository => ({
  async listVersions(objetoId) {
    const versions = seed.filter((v) => v.objetoId === objetoId);
    return ok({ items: versions, total: versions.length });
  },
  async listRecentChanges(limit) {
    return ok({ items: seed.slice(0, limit), total: seed.length });
  },
});

export const createNoopFabricPort = (): FabricPort => ({
  async relatedObjects() {
    return ok(emptyPage<KnowledgeObject>());
  },
  async dependentsOf() {
    return ok(emptyPage<KnowledgeObject>());
  },
});

/**
 * FASE 05 intelligence adapter: deterministic keyword rules only.
 * No AI, no model call. It returns LOW certainty by design so the UI shows
 * a neutral experience until the real Intent Engine ships in FASE 04's build.
 */
const INTENT_HINTS: ReadonlyArray<readonly [Intent, readonly string[]]> = [
  ["urgente", ["prazo", "vence", "notificação", "notificacao", "urgente"]],
  ["procedimental", ["como fazer", "como faço", "passo a passo", "como registrar"]],
  ["comercial", ["quanto custa", "preço", "preco", "valor", "custo"]],
  ["comparativa", ["diferença", "diferenca", " ou ", "versus", "melhor"]],
  ["juridica", ["lei", "artigo", "posso", "é legal", "e legal", "base legal"]],
];

export const createRuleBasedIntelligencePort = (): IntelligencePort => ({
  async classifyIntent(pergunta) {
    const texto = ` ${pergunta.toLowerCase()} `;
    for (const [intent, hints] of INTENT_HINTS) {
      if (hints.some((h) => texto.includes(h))) {
        return ok({ intent, certeza: 0.6 });
      }
    }
    return ok({ intent: "informacional" as Intent, certeza: 0.3 });
  },
  async resolveContext(input) {
    return ok({ ...DEFAULT_CONTEXT, ...input });
  },
  async resolveAudience() {
    // Never inferred silently in FASE 05 — always the neutral lens.
    return ok(DEFAULT_AUDIENCE);
  },
});
