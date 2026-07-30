/**
 * ENGINE 1 — Knowledge Health.
 * Índice geral 0..100 composto pelas nove dimensões medidas pelos demais
 * engines. Determinístico e explicável: cada dimensão expõe seu peso.
 */
import { isServable } from "../factory/workflow";
import {
  DIMENSION_LABEL,
  DIMENSION_WEIGHT,
  OBSERVATORY_DIMENSIONS,
  ratioScore,
  scoreBand,
  weightedScore,
  type ObservatoryDimension,
  type ObservatorySnapshot,
  type ScoreBand,
} from "./Observatory";
import type { ConsistencyReport } from "./consistency";
import type { CoverageReport } from "./coverage";
import type { EntityReport } from "./entities";
import type { FreshnessReport } from "./freshness";
import type { SchemaReport } from "./schemaAudit";

export interface DimensionScore {
  readonly dimensao: ObservatoryDimension;
  readonly rotulo: string;
  readonly valor: number;
  readonly peso: number;
  readonly faixa: ScoreBand;
}

export interface HealthReport {
  readonly score: number;
  readonly faixa: ScoreBand;
  readonly dimensoes: readonly DimensionScore[];
}

/** Publication Score: proporção do que está aprovado e efetivamente no ar. */
export const publicationScore = (s: ObservatorySnapshot): number => {
  const publicaveis = s.rascunhos.filter(
    (d) => d.estado === "aprovado" || isServable(d.estado),
  ).length;
  const noAr = new Set(s.publicacoes.filter((p) => p.ativa).map((p) => p.objetoId)).size;
  const falhas = s.auditoriaPublicacao.filter((a) => !a.sucesso).length;
  const tentativas = s.auditoriaPublicacao.length;
  return weightedScore([
    { valor: ratioScore(noAr, Math.max(publicaveis, noAr)), peso: 3 },
    { valor: tentativas === 0 ? 100 : ratioScore(tentativas - falhas, tentativas), peso: 1 },
  ]);
};

/** Internal Linking Score: densidade de links internos que realmente resolvem. */
export const linkingScore = (s: ObservatorySnapshot): number => {
  const slugs = new Set(s.rascunhos.map((d) => d.slug).filter(Boolean));
  const total = s.rascunhos.reduce((a, d) => a + d.linksInternos.length, 0);
  const validos = s.rascunhos.reduce(
    (a, d) => a + d.linksInternos.filter((l) => slugs.has(l)).length,
    0,
  );
  const comAoMenosUm = s.rascunhos.filter((d) =>
    d.linksInternos.some((l) => slugs.has(l)),
  ).length;
  return weightedScore([
    { valor: total === 0 ? 0 : ratioScore(validos, total), peso: 2 },
    { valor: ratioScore(comAoMenosUm, s.rascunhos.length), peso: 2 },
  ]);
};

/** Fact Score: fatos ancorados em fontes, com preferência por fonte oficial. */
export const factScore = (s: ObservatorySnapshot): number => {
  const comFontes = s.rascunhos.filter((d) => d.fontes.length > 0).length;
  const comOficial = s.rascunhos.filter((d) =>
    d.fontes.some((f) => f.tier === "oficial" || f.tier === "jurisprudencia"),
  ).length;
  const comUrl = s.rascunhos.filter((d) => d.fontes.some((f) => Boolean(f.url))).length;
  return weightedScore([
    { valor: ratioScore(comFontes, s.rascunhos.length), peso: 3 },
    { valor: ratioScore(comOficial, s.rascunhos.length), peso: 2 },
    { valor: ratioScore(comUrl, s.rascunhos.length), peso: 1 },
  ]);
};

/** Graph Score: conectividade efetiva entre objetos. */
export const graphScore = (s: ObservatorySnapshot): number => {
  const slugs = new Set(s.rascunhos.map((d) => d.slug).filter(Boolean));
  const arestas = s.rascunhos.reduce(
    (a, d) => a + d.relacionamentos.filter((r) => slugs.has(r.alvoSlug)).length,
    0,
  );
  const conectados = s.rascunhos.filter((d) =>
    d.relacionamentos.some((r) => slugs.has(r.alvoSlug)),
  ).length;
  const densidadeAlvo = Math.max(1, s.rascunhos.length) * 1.5;
  return weightedScore([
    { valor: ratioScore(conectados, s.rascunhos.length), peso: 3 },
    { valor: ratioScore(arestas, densidadeAlvo), peso: 1 },
  ]);
};

export interface HealthInputs {
  readonly coverage: CoverageReport;
  readonly consistency: ConsistencyReport;
  readonly freshness: FreshnessReport;
  readonly schema: SchemaReport;
  readonly entity: EntityReport;
}

export const analyzeHealth = (
  s: ObservatorySnapshot,
  i: HealthInputs,
): HealthReport => {
  const valores: Readonly<Record<ObservatoryDimension, number>> = {
    coverage: i.coverage.score,
    consistency: i.consistency.score,
    freshness: i.freshness.score,
    publication: publicationScore(s),
    linking: linkingScore(s),
    schema: i.schema.score,
    entity: i.entity.score,
    fact: factScore(s),
    graph: graphScore(s),
  };

  const dimensoes: DimensionScore[] = OBSERVATORY_DIMENSIONS.map((d) => ({
    dimensao: d,
    rotulo: DIMENSION_LABEL[d],
    valor: valores[d],
    peso: DIMENSION_WEIGHT[d],
    faixa: scoreBand(valores[d]),
  }));

  const score = weightedScore(dimensoes.map((d) => ({ valor: d.valor, peso: d.peso })));

  return { score, faixa: scoreBand(score), dimensoes };
};