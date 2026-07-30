/**
 * FASE 09 — Projeção somente-leitura dos módulos existentes em nós do grafo.
 *
 * IMPORTANTE: nada aqui escreve no Fact Ledger nem na Knowledge Factory.
 * O grafo apenas OBSERVA e REFERENCIA. Se um módulo mudar, o nó reflete.
 */
import type { GraphNodeSource } from "../application/ports/graph";
import type { DraftRepository } from "../application/ports/factory";
import type { FactRepository } from "../application/ports/facts";
import type { Fact } from "../domain/facts/Fact";
import type { KnowledgeDraft } from "../domain/factory/KnowledgeDraft";
import {
  makeNodeId,
  normalizeRef,
  type GraphNode,
  type NodeStatus,
} from "../domain/graph/GraphNode";
import { ok, type Page } from "../domain/shared/primitives";

const draftStatus = (estado: string): NodeStatus =>
  estado === "publicado" ? "ativo" : estado === "arquivado" ? "arquivado" : "rascunho";

const factStatus = (s: string): NodeStatus =>
  s === "vigente" ? "ativo" : s === "vencido" ? "vencido" : s === "rascunho" ? "rascunho" : "arquivado";

/** Knowledge Objects, suas categorias e suas perguntas de FAQ. */
export const createFactoryNodeSource = (drafts: DraftRepository): GraphNodeSource => ({
  nome: "factory",
  async load() {
    const r = await drafts.list({});
    if (!r.ok) return ok([] as readonly GraphNode[]);
    const items = (r.value as Page<KnowledgeDraft>).items;
    const nodes: GraphNode[] = [];

    for (const d of items) {
      const ref = d.slug || String(d.id);
      nodes.push({
        id: makeNodeId("knowledge-object", ref),
        kind: "knowledge-object",
        ref,
        rotulo: d.titulo || ref,
        descricao: d.descricao || d.resumoCurto,
        status: draftStatus(d.estado),
        origem: "factory",
        entidade: String(d.entidadePrincipal || "") || undefined,
        rota: `/intelligence/admin/factory/objetos/${d.id}`,
        criadoEm: d.criadoEm,
      });

      if (d.categoria) {
        nodes.push({
          id: makeNodeId("category", normalizeRef(d.categoria)),
          kind: "category",
          ref: normalizeRef(d.categoria),
          rotulo: d.categoria,
          status: "ativo",
          origem: "factory",
          entidade: String(d.entidadePrincipal || "") || undefined,
        });
      }

      if (d.entidadePrincipal) {
        const e = String(d.entidadePrincipal);
        nodes.push({
          id: makeNodeId("entity", normalizeRef(e)),
          kind: "entity",
          ref: normalizeRef(e),
          rotulo: e,
          status: "ativo",
          origem: "factory",
          entidade: e,
        });
      }

      d.faq.forEach((f, i) => {
        if (!f.pergunta?.trim()) return;
        const qref = `${ref}-q${i + 1}`;
        nodes.push({
          id: makeNodeId("question", qref),
          kind: "question",
          ref: qref,
          rotulo: f.pergunta.trim(),
          descricao: f.resposta?.slice(0, 160),
          status: draftStatus(d.estado),
          origem: "factory",
          entidade: String(d.entidadePrincipal || "") || undefined,
          rota: `/intelligence/admin/factory/objetos/${d.id}`,
        });
      });
    }
    return ok(nodes as readonly GraphNode[]);
  },
});

/** Fatos verificáveis, suas fontes e suas entidades. */
export const createFactsNodeSource = (facts: FactRepository): GraphNodeSource => ({
  nome: "facts",
  async load() {
    const r = await facts.list({});
    if (!r.ok) return ok([] as readonly GraphNode[]);
    const items = (r.value as Page<Fact>).items;
    const nodes: GraphNode[] = [];

    for (const f of items) {
      nodes.push({
        id: makeNodeId("fact", String(f.id)),
        kind: "fact",
        ref: String(f.id),
        rotulo: f.enunciado || String(f.id),
        descricao: `${f.fonte.titulo} — ${f.fonte.dispositivo}`,
        status: factStatus(f.status),
        origem: "facts",
        entidade: String(f.entidadePrincipal || "") || undefined,
        rota: `/intelligence/admin/fatos/${f.id}`,
        criadoEm: f.criadoEm,
      });

      if (f.fonte?.titulo) {
        const sref = normalizeRef(`${f.fonte.titulo}`);
        const kind =
          f.fonte.tier === "lei"
            ? "law"
            : f.fonte.tier === "manual-inpi"
              ? "manual"
              : f.fonte.tier === "ato-normativo"
                ? "inpi-act"
                : "source";
        nodes.push({
          id: makeNodeId(kind as never, sref),
          kind: kind as never,
          ref: sref,
          rotulo: f.fonte.titulo,
          descricao: f.fonte.dispositivo,
          status: "ativo",
          origem: "facts",
          entidade: String(f.entidadePrincipal || "") || undefined,
        });
      }

      if (f.entidadePrincipal) {
        const e = String(f.entidadePrincipal);
        nodes.push({
          id: makeNodeId("entity", normalizeRef(e)),
          kind: "entity",
          ref: normalizeRef(e),
          rotulo: e,
          status: "ativo",
          origem: "facts",
          entidade: e,
        });
      }
    }
    return ok(nodes as readonly GraphNode[]);
  },
});