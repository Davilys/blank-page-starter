/**
 * ENGINE 4 — CONFIDENCE ENGINE (estrutural, sem IA).
 *
 * Score 0..100 por Knowledge Object, calculado a partir de sinais objetivos:
 * lastro factual, validação humana, conectividade, fontes, frescor,
 * consistência estrutural. Cada ponto é explicado — score sem explicação é
 * opinião, não medição.
 */
import type { Fact } from "../facts/Fact";
import type { KnowledgeDraft } from "../factory/KnowledgeDraft";
import type { NodeId } from "../graph/GraphNode";
import { confidenceBand, type Severity } from "./Reasoning";
import { degreeOf, incidentEdges, propagates, type ReasoningSnapshot, type SnapshotIndex } from "./snapshot";

export interface ConfidenceFactor {
  readonly rotulo: string;
  readonly pontos: number;
  readonly maximo: number;
  readonly detalhe: string;
}

export interface ObjectConfidence {
  readonly id: string;
  readonly slug: string;
  readonly titulo: string;
  readonly estado: string;
  readonly score: number;
  readonly faixa: Severity;
  readonly fatores: readonly ConfidenceFactor[];
  readonly fatos: number;
  readonly relacoes: number;
  readonly fontes: number;
}

export interface ConfidenceReportSummary {
  readonly objetos: readonly ObjectConfidence[];
  readonly media: number;
  readonly criticos: number;
  readonly solidos: number;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const daysSince = (iso?: string): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
};

const factsOf = (d: KnowledgeDraft, facts: readonly Fact[]): readonly Fact[] =>
  facts.filter(
    (f) => f.objetosAfetados.includes(d.slug) || f.objetosAfetados.includes(String(d.id)),
  );

export const scoreObject = (
  d: KnowledgeDraft,
  snapshot: ReasoningSnapshot,
  ix: SnapshotIndex,
): ObjectConfidence => {
  const fatos = factsOf(d, snapshot.facts);
  const vigentes = fatos.filter((f) => f.status === "vigente");
  const validados = fatos.filter((f) => Boolean(f.ultimaValidacaoEm && f.revisorId));
  const nodeId = `knowledge-object:${d.slug || String(d.id)}` as NodeId;
  const relacoes = incidentEdges(ix, nodeId).filter(propagates);
  const grau = degreeOf(ix, nodeId);

  const fatores: ConfidenceFactor[] = [];

  // 1. Lastro factual (0..25)
  const pLastro = clamp(vigentes.length * 8, 0, 25);
  fatores.push({
    rotulo: "Lastro factual",
    pontos: pLastro,
    maximo: 25,
    detalhe: `${vigentes.length} fato(s) vigente(s) sustentando o objeto.`,
  });

  // 2. Validação humana (0..20)
  const pValidacao = fatos.length
    ? Math.round((validados.length / fatos.length) * 20)
    : 0;
  fatores.push({
    rotulo: "Validação humana",
    pontos: pValidacao,
    maximo: 20,
    detalhe: `${validados.length}/${fatos.length || 0} fatos revisados por um segundo par de olhos.`,
  });

  // 3. Conectividade (0..15)
  const pConexao = clamp(grau * 3, 0, 15);
  fatores.push({
    rotulo: "Conectividade",
    pontos: pConexao,
    maximo: 15,
    detalhe: `${grau} conexão(ões) operacional(is) no grafo.`,
  });

  // 4. Fontes declaradas (0..15)
  const fontesUnicas = new Set([
    ...d.fontes.map((f) => f.titulo.trim().toLowerCase()).filter(Boolean),
    ...fatos.map((f) => f.fonte?.titulo?.trim().toLowerCase()).filter(Boolean),
  ]);
  const pFontes = clamp(fontesUnicas.size * 5, 0, 15);
  fatores.push({
    rotulo: "Fontes",
    pontos: pFontes,
    maximo: 15,
    detalhe: `${fontesUnicas.size} fonte(s) distinta(s) declarada(s).`,
  });

  // 5. Frescor (0..15)
  const dias = daysSince(d.atualizadoEm);
  const pFrescor = dias === null ? 0 : dias <= 90 ? 15 : dias <= 180 ? 10 : dias <= 365 ? 5 : 0;
  fatores.push({
    rotulo: "Atualização",
    pontos: pFrescor,
    maximo: 15,
    detalhe: dias === null ? "Sem data de atualização." : `Atualizado há ${dias} dia(s).`,
  });

  // 6. Consistência estrutural (0..10)
  const temResumo = d.resumoCurto.trim().length >= 40;
  const temExplicacao = d.explicacaoCompleta.trim().length >= 200;
  const temEntidade = String(d.entidadePrincipal ?? "").trim().length > 0;
  const consistencia = [temResumo, temExplicacao, temEntidade, d.faq.length > 0].filter(Boolean)
    .length;
  const pConsistencia = consistencia * 2.5;
  fatores.push({
    rotulo: "Consistência estrutural",
    pontos: pConsistencia,
    maximo: 10,
    detalhe: `${consistencia}/4 slots estruturais preenchidos (resumo, explicação, entidade, FAQ).`,
  });

  // 7. Penalidade de orfandade
  if (!fatos.length) {
    fatores.push({
      rotulo: "Sem lastro",
      pontos: -15,
      maximo: 0,
      detalhe: "Nenhum fato aponta para este objeto.",
    });
  }
  if (!relacoes.length) {
    fatores.push({
      rotulo: "Órfão no grafo",
      pontos: -10,
      maximo: 0,
      detalhe: "Objeto sem nenhuma relação ativa.",
    });
  }

  const score = clamp(
    Math.round(fatores.reduce((s, f) => s + f.pontos, 0)),
    0,
    100,
  );

  return {
    id: String(d.id),
    slug: d.slug,
    titulo: d.titulo || d.slug,
    estado: d.estado,
    score,
    faixa: confidenceBand(score),
    fatores,
    fatos: fatos.length,
    relacoes: relacoes.length,
    fontes: fontesUnicas.size,
  };
};

export const computeConfidence = (
  snapshot: ReasoningSnapshot,
  ix: SnapshotIndex,
): ConfidenceReportSummary => {
  const objetos = snapshot.drafts
    .map((d) => scoreObject(d, snapshot, ix))
    .sort((a, b) => b.score - a.score);
  const media = objetos.length
    ? Math.round(objetos.reduce((s, o) => s + o.score, 0) / objetos.length)
    : 0;
  return {
    objetos,
    media,
    criticos: objetos.filter((o) => o.score < 50).length,
    solidos: objetos.filter((o) => o.score >= 85).length,
  };
};