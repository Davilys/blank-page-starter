/**
 * ENGINE 2 — Freshness Monitor.
 * Identifica conhecimento envelhecido e monta a fila de revisão.
 * Puro e determinístico: a "idade" sempre é medida contra `snapshot.agora`.
 */
import type { KnowledgeDraft } from "../factory/KnowledgeDraft";
import type { KnowledgeObjectType } from "../shared/taxonomy";
import {
  clampScore,
  daysBetween,
  ratioScore,
  type ObservatoryFinding,
  type ObservatorySnapshot,
  type Severity,
} from "./Observatory";

/** TTL por tipo, em dias. Prazos normativos envelhecem mais rápido. */
export const TTL_BY_TYPE: Readonly<Record<KnowledgeObjectType, number>> = {
  "alerta-mudanca": 90,
  "caso-pratico": 540,
  classificacao: 365,
  comparacao: 365,
  conceito: 730,
  custo: 180,
  decisao: 365,
  excecao: 365,
  "fato-normativo": 180,
  "pergunta-canonica": 365,
  prazo: 180,
  procedimento: 365,
  requisito: 365,
};

export const ttlFor = (tipo: KnowledgeObjectType): number => TTL_BY_TYPE[tipo] ?? 365;

export interface FreshnessRow {
  readonly objetoId: string;
  readonly slug: string;
  readonly titulo: string;
  readonly tipo: KnowledgeObjectType;
  readonly entidadeId: string;
  /** Data base: revisão quando existe, senão última atualização. */
  readonly referencia: string;
  readonly idadeDias: number;
  readonly ttlDias: number;
  /** 0..100 — 100 é recém-revisado, 0 é totalmente vencido. */
  readonly score: number;
  readonly vencido: boolean;
  readonly semRevisao: boolean;
  readonly publicadoDesatualizado: boolean;
}

export interface FreshnessReport {
  readonly score: number;
  readonly linhas: readonly FreshnessRow[];
  /** Fila de revisão ordenada pelo pior score primeiro. */
  readonly fila: readonly FreshnessRow[];
  readonly vencidos: number;
  readonly semRevisao: number;
  readonly achados: readonly ObservatoryFinding[];
}

const referenceDate = (d: KnowledgeDraft): string =>
  d.dataRevisao || d.atualizadoEm || d.criadoEm;

export const analyzeFreshness = (s: ObservatorySnapshot): FreshnessReport => {
  const ativas = new Map(
    s.publicacoes.filter((p) => p.ativa).map((p) => [p.objetoId, p] as const),
  );

  const linhas: FreshnessRow[] = s.rascunhos.map((d) => {
    const referencia = referenceDate(d);
    const idadeDias = daysBetween(referencia, s.agora);
    const ttlDias = ttlFor(d.tipo);
    const publicada = ativas.get(d.id);
    return {
      objetoId: d.id,
      slug: d.slug,
      titulo: d.titulo || "(sem título)",
      tipo: d.tipo,
      entidadeId: String(d.entidadePrincipal || ""),
      referencia,
      idadeDias,
      ttlDias,
      score: clampScore(100 - (idadeDias / ttlDias) * 100),
      vencido: idadeDias > ttlDias,
      semRevisao: !d.dataRevisao || !d.revisorId,
      publicadoDesatualizado: Boolean(publicada) && publicada.publicadoEm < d.atualizadoEm,
    };
  });

  const achados: ObservatoryFinding[] = [];
  for (const l of linhas) {
    if (l.vencido) {
      achados.push(finding(l, "critico", "Conhecimento vencido", `Sem revisão há ${l.idadeDias} dias (TTL de ${l.ttlDias}).`));
    } else if (l.score < 30) {
      achados.push(finding(l, "alerta", "Revisão próxima do vencimento", `Idade de ${l.idadeDias} dias contra TTL de ${l.ttlDias}.`));
    }
    if (l.semRevisao) {
      achados.push(finding(l, "alerta", "Sem revisão registrada", "Não há revisor humano nem data de revisão."));
    }
    if (l.publicadoDesatualizado) {
      achados.push(finding(l, "critico", "Versão pública desatualizada", "O rascunho mudou depois da última publicação."));
    }
  }

  return {
    score: linhas.length === 0 ? 0 : Math.round(linhas.reduce((a, l) => a + l.score, 0) / linhas.length),
    linhas,
    fila: [...linhas].filter((l) => l.score < 70 || l.semRevisao).sort((a, b) => a.score - b.score),
    vencidos: linhas.filter((l) => l.vencido).length,
    semRevisao: linhas.filter((l) => l.semRevisao).length,
    achados,
  };
};

/** Percentual de objetos dentro do TTL — usado em relatórios executivos. */
export const freshRatio = (r: FreshnessReport): number =>
  ratioScore(r.linhas.filter((l) => !l.vencido).length, r.linhas.length);

const finding = (
  l: FreshnessRow,
  severidade: Severity,
  titulo: string,
  detalhe: string,
): ObservatoryFinding => ({
  id: `freshness:${titulo}:${l.objetoId}`,
  dimensao: "freshness",
  severidade,
  titulo,
  detalhe,
  objetoId: l.objetoId,
  slug: l.slug,
  entidadeId: l.entidadeId,
});