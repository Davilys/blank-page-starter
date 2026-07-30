/**
 * FASE 10 — Testes dos motores de raciocínio.
 *
 * Regra sob teste em todos os casos: as análises NÃO alteram dados. Cada
 * motor recebe o snapshot e devolve um resultado novo.
 */
import { describe, expect, it } from "vitest";
import { detectBrokenKnowledge, findCycles, similarity } from "../broken";
import { simulateChange } from "../cascade";
import { analyzeCoverage } from "../coverage";
import { computeConfidence } from "../confidence";
import { stableHash } from "../hash";
import { analyzeImpactOn, dependentsOf } from "../impact";
import { confidenceBand } from "../Reasoning";
import { buildIndex } from "../snapshot";
import { generateSuggestions } from "../suggestions";
import { edge, node, snapshot } from "./factories";

/** Cadeia: raiz ← meio ← folha (todos dependem do anterior). */
const cadeia = () =>
  snapshot({
    nodes: [
      node("raiz", "fact", { entidade: "INPI" }),
      node("meio", "knowledge-object", { entidade: "INPI" }),
      node("folha", "question", { entidade: "INPI" }),
      node("solto", "concept"),
    ],
    edges: [edge("e1", "meio", "raiz"), edge("e2", "folha", "meio")],
  });

describe("Snapshot e índices", () => {
  it("indexa arestas de entrada e saída sem N+1", () => {
    const ix = buildIndex(cadeia());
    expect(ix.nodeById.size).toBe(4);
    expect(ix.entradas.get("raiz" as never)?.length).toBe(1);
    expect(ix.saidas.get("folha" as never)?.length).toBe(1);
    expect(ix.vigentes.length).toBe(2);
  });
});

describe("Engine 1 — Impact Analysis", () => {
  it("descobre dependentes em profundidade e não muta o snapshot", () => {
    const s = cadeia();
    const antes = JSON.stringify(s);
    const ix = buildIndex(s);

    const hits = dependentsOf(ix, "raiz" as never, 4);
    expect(hits.map((h) => h.no.id)).toEqual(["meio", "folha"]);
    expect(hits[1].profundidade).toBe(2);
    expect(JSON.stringify(s)).toBe(antes);
  });

  it("monta a árvore e classifica severidade", () => {
    const ix = buildIndex(cadeia());
    const r = analyzeImpactOn(ix, "raiz" as never, 4);
    expect(r).not.toBeNull();
    expect(r?.arvore.length).toBe(1);
    expect(r?.arvore[0].filhos.length).toBe(1);
    expect(r?.profundidadeMaxima).toBe(2);
    expect(r?.objetos.length).toBe(1);
    expect(r?.faqs.length).toBe(1);
  });

  it("respeita o limite de profundidade", () => {
    const ix = buildIndex(cadeia());
    expect(dependentsOf(ix, "raiz" as never, 1).length).toBe(1);
  });

  it("devolve nulo para alvo inexistente", () => {
    const ix = buildIndex(cadeia());
    expect(analyzeImpactOn(ix, "fantasma" as never, 3)).toBeNull();
  });
});

describe("Engine 2 e 6 — Cascade e Change Simulation", () => {
  it("organiza o impacto em ondas e declara somente leitura", () => {
    const s = cadeia();
    const antes = JSON.stringify(s);
    const r = simulateChange(buildIndex(s), "raiz" as never, "alteracao");

    expect(r?.somenteLeitura).toBe(true);
    expect(r?.ondas[0].nos.map((n) => n.no.id)).toEqual(["meio"]);
    expect(r?.ondas[1].nos.map((n) => n.no.id)).toEqual(["folha"]);
    expect(r?.totalAfetados).toBe(2);
    expect(JSON.stringify(s)).toBe(antes);
  });

  it("remoção alcança pelo menos o mesmo que alteração", () => {
    const ix = buildIndex(cadeia());
    const alt = simulateChange(ix, "raiz" as never, "alteracao");
    const rem = simulateChange(ix, "raiz" as never, "remocao");
    expect(rem!.totalAfetados).toBeGreaterThanOrEqual(alt!.totalAfetados);
  });
});

describe("Engine 3 — Broken Knowledge Detector", () => {
  it("detecta nó órfão", () => {
    const s = cadeia();
    const rel = detectBrokenKnowledge(s, buildIndex(s));
    expect(rel.issues.some((i) => i.tipo === "no-orfao" && i.alvo === "solto")).toBe(true);
  });

  it("detecta relação apontando para nó inexistente", () => {
    const s = snapshot({
      nodes: [node("a", "fact")],
      edges: [edge("e1", "a", "inexistente")],
    });
    const rel = detectBrokenKnowledge(s, buildIndex(s));
    expect(rel.issues.some((i) => i.tipo === "referencia-inexistente")).toBe(true);
  });

  it("detecta dependência circular", () => {
    const ciclos = findCycles([edge("e1", "a", "b"), edge("e2", "b", "a")]);
    expect(ciclos.length).toBeGreaterThan(0);
  });

  it("mede similaridade textual para duplicidade semântica", () => {
    expect(similarity("prazo de oposição é 60 dias", "prazo de oposição é 60 dias")).toBe(1);
    expect(similarity("prazo de oposição", "classe NICE 45")).toBeLessThan(0.3);
  });
});

describe("Engine 4 — Confidence Engine", () => {
  it("devolve média zero e nenhum objeto quando não há drafts", () => {
    const s = snapshot();
    const r = computeConfidence(s, buildIndex(s));
    expect(r.objetos).toEqual([]);
    expect(r.media).toBe(0);
  });

  it("classifica faixas de confiança de forma monotônica", () => {
    expect(confidenceBand(97)).toBe("baixa");
    expect(confidenceBand(74)).toBe("media");
    expect(confidenceBand(51)).toBe("alta");
    expect(confidenceBand(20)).toBe("critica");
  });
});

describe("Engine 5 — Coverage Analysis", () => {
  it("calcula cobertura por entidade e aponta lacunas", () => {
    const s = cadeia();
    const r = analyzeCoverage(s, buildIndex(s));
    const inpi = r.entidades.find((e) => e.entidade === "INPI");
    expect(inpi).toBeDefined();
    expect(inpi!.cobertura).toBeGreaterThanOrEqual(0);
    expect(inpi!.cobertura).toBeLessThanOrEqual(100);
    expect(inpi!.indicadores.length).toBeGreaterThan(0);
  });
});

describe("Engine 7 — Knowledge Suggestions", () => {
  it("gera sugestões estruturais sem IA e sem escrita", () => {
    const s = cadeia();
    const antes = JSON.stringify(s);
    const ix = buildIndex(s);
    const sugestoes = generateSuggestions(
      s,
      detectBrokenKnowledge(s, ix),
      computeConfidence(s, ix),
      analyzeCoverage(s, ix),
    );
    expect(Array.isArray(sugestoes)).toBe(true);
    expect(JSON.stringify(s)).toBe(antes);
  });
});

describe("Auditoria — hash determinístico", () => {
  it("gera o mesmo hash independentemente da ordem das chaves", () => {
    expect(stableHash({ a: 1, b: [2, 3] })).toBe(stableHash({ b: [2, 3], a: 1 }));
  });

  it("muda o hash quando o resultado muda", () => {
    expect(stableHash({ a: 1 })).not.toBe(stableHash({ a: 2 }));
  });
});