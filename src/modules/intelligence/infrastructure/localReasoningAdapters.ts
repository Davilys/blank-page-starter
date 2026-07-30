/**
 * FASE 10 — Adaptadores do Reasoning Engine.
 *
 * 1. Snapshot provider: lê Facts, Drafts e o Grafo. NUNCA escreve.
 * 2. Auditoria: append-only em localStorage; não expõe update nem delete.
 */
import type {
  KnowledgeSnapshotProvider,
  ReasoningAuditRepository,
} from "../application/ports/reasoning";
import type { DraftRepository } from "../application/ports/factory";
import type { FactRepository } from "../application/ports/facts";
import type { makeLoadGraph, GraphUniverseView } from "../application/use-cases/graph/loadGraph";
import type { Fact } from "../domain/facts/Fact";
import type { KnowledgeDraft } from "../domain/factory/KnowledgeDraft";
import type { ReasoningRun } from "../domain/reasoning/Reasoning";
import type { ReasoningSnapshot } from "../domain/reasoning/snapshot";
import { asIsoDateTime, err, ok, type Page } from "../domain/shared/primitives";

const AUDIT_KEY = "wm.intelligence.reasoning.audit.v1";
const CACHE_TTL_MS = 30_000;

/* ── Snapshot provider com cache curto (evita recarga a cada engine) ─────── */
export const createSnapshotProvider = (
  loadGraph: ReturnType<typeof makeLoadGraph>,
  facts: FactRepository,
  drafts: DraftRepository,
): KnowledgeSnapshotProvider => {
  let cache: ReasoningSnapshot | null = null;
  let carregadoEm = 0;

  return {
    async load(force = false) {
      const fresco = cache && Date.now() - carregadoEm < CACHE_TTL_MS;
      if (!force && fresco) return ok(cache as ReasoningSnapshot);

      const g = await loadGraph();
      if (!g.ok) return err<ReasoningSnapshot>(g.error as string);
      const universe = g.value as GraphUniverseView;

      const f = await facts.list({});
      const d = await drafts.list({});

      cache = {
        nodes: universe.nodes,
        edges: universe.edges,
        facts: f.ok ? (f.value as Page<Fact>).items : [],
        drafts: d.ok ? (d.value as Page<KnowledgeDraft>).items : [],
        geradoEm: asIsoDateTime(new Date()),
      };
      carregadoEm = Date.now();
      return ok(cache);
    },
    invalidate() {
      cache = null;
      carregadoEm = 0;
    },
  };
};

/* ── Auditoria append-only ────────────────────────────────────────────────── */
const readRuns = (): ReasoningRun[] => {
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const createLocalReasoningAuditRepository = (): ReasoningAuditRepository => ({
  async append(run) {
    try {
      // Append puro: nada é substituído, nada é removido.
      const all = [run, ...readRuns()];
      localStorage.setItem(AUDIT_KEY, JSON.stringify(all));
      return ok(run);
    } catch {
      return err<ReasoningRun>("Falha ao registrar a execução na auditoria.");
    }
  },
  async list(limit = 100) {
    const all = readRuns();
    return ok({ items: all.slice(0, Math.max(1, limit)), total: all.length });
  },
});