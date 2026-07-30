/**
 * ENGINE 5 — COVERAGE ANALYSIS.
 *
 * Responde, por entidade/assunto: existe lastro suficiente? há lacunas?
 * há relacionamento demais/de menos? existe duplicidade? há isolamento?
 */
import type { Severity } from "./Reasoning";
import { similarity, SEMANTIC_DUPLICATE_THRESHOLD } from "./broken";
import { degreeOf, propagates, type ReasoningSnapshot, type SnapshotIndex } from "./snapshot";
import type { NodeId } from "../graph/GraphNode";

export interface CoverageIndicator {
  readonly rotulo: string;
  readonly ok: boolean;
  readonly detalhe: string;
}

export interface EntityCoverage {
  readonly entidade: string;
  readonly fatos: number;
  readonly fatosVigentes: number;
  readonly objetos: number;
  readonly objetosPublicados: number;
  readonly relacoes: number;
  readonly perguntas: number;
  readonly duplicidades: number;
  readonly isolada: boolean;
  readonly cobertura: number;
  readonly faixa: Severity;
  readonly indicadores: readonly CoverageIndicator[];
  readonly lacunas: readonly string[];
}

export interface CoverageReport {
  readonly entidades: readonly EntityCoverage[];
  readonly coberturaMedia: number;
  readonly comLacunas: number;
  readonly isoladas: number;
}

const faixaDe = (v: number): Severity =>
  v >= 80 ? "baixa" : v >= 60 ? "media" : v >= 35 ? "alta" : "critica";

export const analyzeCoverage = (
  snapshot: ReasoningSnapshot,
  ix: SnapshotIndex,
): CoverageReport => {
  const nomes = new Set<string>();
  for (const f of snapshot.facts) {
    const e = String(f.entidadePrincipal ?? "").trim();
    if (e) nomes.add(e);
  }
  for (const d of snapshot.drafts) {
    const e = String(d.entidadePrincipal ?? "").trim();
    if (e) nomes.add(e);
  }
  for (const n of snapshot.nodes) {
    if (n.kind === "entity" && n.rotulo?.trim()) nomes.add(n.rotulo.trim());
    // Qualquer nó marcado com entidade também define uma área de cobertura.
    if (n.entidade?.trim()) nomes.add(n.entidade.trim());
  }

  const entidades: EntityCoverage[] = [...nomes].map((entidade) => {
    const fatos = snapshot.facts.filter(
      (f) => String(f.entidadePrincipal ?? "").trim() === entidade,
    );
    const objetos = snapshot.drafts.filter(
      (d) => String(d.entidadePrincipal ?? "").trim() === entidade,
    );
    const nos = snapshot.nodes.filter((n) => n.entidade === entidade);
    const relacoes = snapshot.edges.filter(
      (e) =>
        propagates(e) &&
        nos.some((n) => n.id === e.origem || n.id === e.destino),
    ).length;
    const perguntas = objetos.reduce((s, d) => s + d.faq.length, 0);

    let duplicidades = 0;
    for (let i = 0; i < objetos.length; i += 1) {
      for (let j = i + 1; j < objetos.length; j += 1) {
        const sim = similarity(
          `${objetos[i].titulo} ${objetos[i].descricao}`,
          `${objetos[j].titulo} ${objetos[j].descricao}`,
        );
        if (sim >= SEMANTIC_DUPLICATE_THRESHOLD) duplicidades += 1;
      }
    }

    const entityNodeId = nos.find((n) => n.kind === "entity")?.id as NodeId | undefined;
    const isolada = entityNodeId ? degreeOf(ix, entityNodeId) === 0 : true;
    const fatosVigentes = fatos.filter((f) => f.status === "vigente").length;
    const objetosPublicados = objetos.filter((d) => d.estado === "publicado").length;

    const indicadores: CoverageIndicator[] = [
      {
        rotulo: "Possui fatos suficientes?",
        ok: fatosVigentes >= 3,
        detalhe: `${fatosVigentes} fato(s) vigente(s). Mínimo recomendado: 3.`,
      },
      {
        rotulo: "Possui objetos publicados?",
        ok: objetosPublicados >= 1,
        detalhe: `${objetosPublicados} objeto(s) publicado(s) de ${objetos.length}.`,
      },
      {
        rotulo: "Possui relacionamentos?",
        ok: relacoes >= 3,
        detalhe: `${relacoes} relação(ões) operacional(is). Mínimo recomendado: 3.`,
      },
      {
        rotulo: "Possui FAQ?",
        ok: perguntas >= 3,
        detalhe: `${perguntas} pergunta(s) respondida(s).`,
      },
      {
        rotulo: "Livre de duplicidade?",
        ok: duplicidades === 0,
        detalhe: duplicidades ? `${duplicidades} par(es) de objetos sobrepostos.` : "Sem sobreposição detectada.",
      },
      {
        rotulo: "Entidade conectada?",
        ok: !isolada,
        detalhe: isolada ? "Entidade isolada no grafo." : "Entidade ancorada em relações.",
      },
    ];

    const atendidos = indicadores.filter((i) => i.ok).length;
    const cobertura = Math.round((atendidos / indicadores.length) * 100);

    return {
      entidade,
      fatos: fatos.length,
      fatosVigentes,
      objetos: objetos.length,
      objetosPublicados,
      relacoes,
      perguntas,
      duplicidades,
      isolada,
      cobertura,
      faixa: faixaDe(cobertura),
      indicadores,
      lacunas: indicadores.filter((i) => !i.ok).map((i) => i.rotulo),
    };
  });

  entidades.sort((a, b) => a.cobertura - b.cobertura);

  return {
    entidades,
    coberturaMedia: entidades.length
      ? Math.round(entidades.reduce((s, e) => s + e.cobertura, 0) / entidades.length)
      : 0,
    comLacunas: entidades.filter((e) => e.lacunas.length > 0).length,
    isoladas: entidades.filter((e) => e.isolada).length,
  };
};