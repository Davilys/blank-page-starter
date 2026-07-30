/**
 * ENGINE 3 — BROKEN KNOWLEDGE DETECTOR.
 *
 * Encontra o que está estruturalmente quebrado. Cada achado é declarado com
 * evidência (ids reais) — nada é "provável", tudo é verificável.
 */
import { ACYCLIC_EDGE_TYPES, edgeKey, type GraphEdge } from "../graph/GraphEdge";
import type { GraphNode, NodeId } from "../graph/GraphNode";
import type { Severity } from "./Reasoning";
import { SEVERITY_ORDER } from "./Reasoning";
import {
  incidentEdges,
  propagates,
  type ReasoningSnapshot,
  type SnapshotIndex,
} from "./snapshot";

export const ISSUE_KINDS = [
  "objeto-sem-fato",
  "fato-sem-objeto",
  "no-orfao",
  "entidade-orfa",
  "relacao-quebrada",
  "referencia-inexistente",
  "link-invalido",
  "dependencia-circular",
  "fato-duplicado",
  "duplicidade-semantica",
] as const;
export type IssueKind = (typeof ISSUE_KINDS)[number];

export const ISSUE_KIND_LABEL: Readonly<Record<IssueKind, string>> = {
  "objeto-sem-fato": "Knowledge Object sem Fato",
  "fato-sem-objeto": "Fato sem Knowledge Object",
  "no-orfao": "Nó órfão",
  "entidade-orfa": "Entidade órfã",
  "relacao-quebrada": "Relação quebrada",
  "referencia-inexistente": "Referência inexistente",
  "link-invalido": "Link inválido",
  "dependencia-circular": "Dependência circular",
  "fato-duplicado": "Fato duplicado",
  "duplicidade-semantica": "Duplicidade semântica",
};

export interface KnowledgeIssue {
  readonly id: string;
  readonly tipo: IssueKind;
  readonly severidade: Severity;
  readonly alvo: string;
  readonly rotulo: string;
  readonly detalhe: string;
  readonly rota?: string;
}

export interface BrokenReport {
  readonly issues: readonly KnowledgeIssue[];
  readonly porTipo: Readonly<Record<IssueKind, number>>;
  readonly criticas: number;
  readonly total: number;
}

/* ── Normalização usada nas detecções de duplicidade ──────────────────────── */
export const normalizeText = (v: string): string =>
  String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const STOPWORDS = new Set([
  "a","o","as","os","de","da","do","das","dos","em","no","na","nos","nas","para","por",
  "que","e","ou","um","uma","com","ao","aos","se","sobre","ate","pode","ser",
]);

export const shingles = (v: string): Set<string> =>
  new Set(normalizeText(v).split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w)));

/** Jaccard entre conjuntos de termos: 0..1. Determinístico, sem embeddings. */
export const similarity = (a: string, b: string): number => {
  const sa = shingles(a);
  const sb = shingles(b);
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  sa.forEach((t) => {
    if (sb.has(t)) inter += 1;
  });
  return inter / (sa.size + sb.size - inter);
};

export const SEMANTIC_DUPLICATE_THRESHOLD = 0.82;

/** Detecta ciclos entre relações hierárquicas (proibidas por construção). */
export const findCycles = (edges: readonly GraphEdge[]): readonly (readonly NodeId[])[] => {
  const hier = edges.filter((e) => propagates(e) && ACYCLIC_EDGE_TYPES.includes(e.tipo));
  const adj = new Map<NodeId, NodeId[]>();
  for (const e of hier) {
    const cur = adj.get(e.origem);
    if (cur) cur.push(e.destino);
    else adj.set(e.origem, [e.destino]);
  }

  const cor = new Map<NodeId, 0 | 1 | 2>();
  const pilha: NodeId[] = [];
  const ciclos: NodeId[][] = [];

  const visitar = (id: NodeId) => {
    cor.set(id, 1);
    pilha.push(id);
    for (const prox of adj.get(id) ?? []) {
      const c = cor.get(prox) ?? 0;
      if (c === 1) {
        const i = pilha.indexOf(prox);
        ciclos.push([...pilha.slice(i >= 0 ? i : 0), prox]);
      } else if (c === 0) {
        visitar(prox);
      }
    }
    pilha.pop();
    cor.set(id, 2);
  };

  for (const id of adj.keys()) if ((cor.get(id) ?? 0) === 0) visitar(id);
  return ciclos;
};

const isValidUrl = (v: string): boolean => {
  const s = String(v ?? "").trim();
  if (!s) return false;
  if (s.startsWith("/")) return true;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const factNodeId = (id: string) => `fact:${id}` as NodeId;

export const detectBrokenKnowledge = (
  snapshot: ReasoningSnapshot,
  ix: SnapshotIndex,
): BrokenReport => {
  const issues: KnowledgeIssue[] = [];
  const add = (i: KnowledgeIssue) => issues.push(i);

  /* 1. Knowledge Objects sem nenhum fato sustentando. */
  const objetosComFato = new Set<string>();
  for (const f of snapshot.facts) {
    for (const slug of f.objetosAfetados) objetosComFato.add(String(slug));
  }
  for (const d of snapshot.drafts) {
    const temFato =
      objetosComFato.has(d.slug) ||
      objetosComFato.has(String(d.id)) ||
      incidentEdges(ix, `knowledge-object:${d.slug}` as NodeId).some(
        (e) => e.origem.startsWith("fact:") || e.destino.startsWith("fact:"),
      );
    if (temFato) continue;
    add({
      id: `objeto-sem-fato:${d.id}`,
      tipo: "objeto-sem-fato",
      severidade: d.estado === "publicado" ? "critica" : "media",
      alvo: String(d.id),
      rotulo: d.titulo || d.slug,
      detalhe: "Nenhum fato verificável sustenta este objeto. Conteúdo sem lastro.",
      rota: `/intelligence/admin/factory/objetos/${d.id}`,
    });
  }

  /* 2. Fatos que não alimentam nenhum objeto. */
  for (const f of snapshot.facts) {
    const ligado =
      f.objetosAfetados.length > 0 ||
      incidentEdges(ix, factNodeId(String(f.id))).some(
        (e) =>
          e.origem.startsWith("knowledge-object:") || e.destino.startsWith("knowledge-object:"),
      );
    if (ligado) continue;
    add({
      id: `fato-sem-objeto:${f.id}`,
      tipo: "fato-sem-objeto",
      severidade: f.status === "vigente" ? "alta" : "baixa",
      alvo: String(f.id),
      rotulo: f.enunciado,
      detalhe: "Fato validado que ainda não gera conhecimento publicável.",
      rota: `/intelligence/admin/fatos/${f.id}`,
    });
  }

  /* 3 e 4. Nós e entidades sem nenhuma conexão. */
  for (const n of snapshot.nodes) {
    if (incidentEdges(ix, n.id).length > 0) continue;
    const entidade = n.kind === "entity";
    add({
      id: `${entidade ? "entidade-orfa" : "no-orfao"}:${n.id}`,
      tipo: entidade ? "entidade-orfa" : "no-orfao",
      severidade: entidade ? "alta" : n.status === "ativo" ? "media" : "baixa",
      alvo: n.id,
      rotulo: n.rotulo,
      detalhe: entidade
        ? "Entidade isolada: nada aponta para ela e ela não aponta para nada."
        : "Nó sem nenhuma relação — invisível para o raciocínio estrutural.",
      rota: n.rota,
    });
  }

  /* 5 e 6. Relações quebradas e referências inexistentes. */
  for (const e of snapshot.edges) {
    const origemExiste = ix.nodeById.has(e.origem);
    const destinoExiste = ix.nodeById.has(e.destino);
    if (!origemExiste || !destinoExiste) {
      add({
        id: `referencia-inexistente:${e.id}`,
        tipo: "referencia-inexistente",
        severidade: "critica",
        alvo: e.id,
        rotulo: `${e.origem} → ${e.destino}`,
        detalhe: `A ponta ${!origemExiste ? "de origem" : "de destino"} não existe mais no grafo.`,
        rota: "/intelligence/admin/graph/relacoes",
      });
      continue;
    }
    if (e.status === "invalida" || e.origem === e.destino) {
      add({
        id: `relacao-quebrada:${e.id}`,
        tipo: "relacao-quebrada",
        severidade: "alta",
        alvo: e.id,
        rotulo: `${ix.nodeById.get(e.origem)?.rotulo} → ${ix.nodeById.get(e.destino)?.rotulo}`,
        detalhe:
          e.origem === e.destino
            ? "Auto-relação: o nó aponta para si mesmo."
            : "Relação marcada como inválida e ainda presente no grafo.",
        rota: "/intelligence/admin/graph/relacoes",
      });
    }
  }

  /* 7. Links inválidos declarados em objetos e fontes de fatos. */
  for (const d of snapshot.drafts) {
    for (const url of d.linksExternos) {
      if (isValidUrl(url)) continue;
      add({
        id: `link-invalido:${d.id}:${url}`,
        tipo: "link-invalido",
        severidade: "media",
        alvo: String(d.id),
        rotulo: d.titulo || d.slug,
        detalhe: `Link externo malformado: "${url}".`,
        rota: `/intelligence/admin/factory/objetos/${d.id}`,
      });
    }
  }
  for (const f of snapshot.facts) {
    if (f.fonte?.url && !isValidUrl(f.fonte.url)) {
      add({
        id: `link-invalido:${f.id}`,
        tipo: "link-invalido",
        severidade: "media",
        alvo: String(f.id),
        rotulo: f.enunciado,
        detalhe: `URL da fonte malformada: "${f.fonte.url}".`,
        rota: `/intelligence/admin/fatos/${f.id}`,
      });
    }
  }

  /* 8. Dependências circulares. */
  for (const ciclo of findCycles(snapshot.edges)) {
    const rotulos = ciclo.map((id) => ix.nodeById.get(id)?.rotulo ?? id);
    add({
      id: `dependencia-circular:${ciclo.join(">")}`,
      tipo: "dependencia-circular",
      severidade: "critica",
      alvo: ciclo[0],
      rotulo: rotulos.join(" → "),
      detalhe: "Ciclo em relação hierárquica: a cadeia de dependência não tem base.",
      rota: "/intelligence/admin/graph/relacoes",
    });
  }

  /* 9. Fatos duplicados (mesma afirmação normalizada). */
  const porTexto = new Map<string, string[]>();
  for (const f of snapshot.facts) {
    if (f.status === "substituido") continue;
    const k = normalizeText(f.enunciado);
    if (!k) continue;
    const cur = porTexto.get(k);
    if (cur) cur.push(String(f.id));
    else porTexto.set(k, [String(f.id)]);
  }
  porTexto.forEach((ids, texto) => {
    if (ids.length < 2) return;
    add({
      id: `fato-duplicado:${ids.join("|")}`,
      tipo: "fato-duplicado",
      severidade: "alta",
      alvo: ids[0],
      rotulo: texto.slice(0, 120),
      detalhe: `${ids.length} fatos com enunciado idêntico. Consolide em uma única cadeia.`,
      rota: `/intelligence/admin/fatos/${ids[0]}`,
    });
  });

  /* 10. Duplicidade semântica entre objetos publicáveis. */
  const candidatos = snapshot.drafts.filter((d) => d.estado !== "arquivado");
  for (let i = 0; i < candidatos.length; i += 1) {
    for (let j = i + 1; j < candidatos.length; j += 1) {
      const a = candidatos[i];
      const b = candidatos[j];
      const sim = similarity(`${a.titulo} ${a.descricao}`, `${b.titulo} ${b.descricao}`);
      if (sim < SEMANTIC_DUPLICATE_THRESHOLD) continue;
      add({
        id: `duplicidade-semantica:${a.id}:${b.id}`,
        tipo: "duplicidade-semantica",
        severidade: "media",
        alvo: String(a.id),
        rotulo: `${a.titulo} ≈ ${b.titulo}`,
        detalhe: `Sobreposição de ${Math.round(sim * 100)}% entre os dois objetos.`,
        rota: `/intelligence/admin/factory/objetos/${a.id}`,
      });
    }
  }

  /* Duplicidade de arestas idênticas. */
  const chaves = new Map<string, number>();
  for (const e of snapshot.edges) {
    const k = edgeKey(e.origem, e.destino, e.tipo, e.direcao);
    chaves.set(k, (chaves.get(k) ?? 0) + 1);
  }
  chaves.forEach((qtd, k) => {
    if (qtd < 2) return;
    add({
      id: `relacao-duplicada:${k}`,
      tipo: "relacao-quebrada",
      severidade: "media",
      alvo: k,
      rotulo: k,
      detalhe: `${qtd} relações idênticas entre os mesmos nós.`,
      rota: "/intelligence/admin/graph/relacoes",
    });
  });

  const porTipo = ISSUE_KINDS.reduce(
    (acc, k) => ({ ...acc, [k]: issues.filter((i) => i.tipo === k).length }),
    {} as Record<IssueKind, number>,
  );

  const ordenadas = [...issues].sort(
    (a, b) => SEVERITY_ORDER[a.severidade] - SEVERITY_ORDER[b.severidade],
  );

  return {
    issues: ordenadas,
    porTipo,
    criticas: issues.filter((i) => i.severidade === "critica").length,
    total: issues.length,
  };
};

export type { GraphNode };