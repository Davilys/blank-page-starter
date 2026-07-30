/**
 * Confiabilidade — determinística, explicável, nunca digitada.
 *
 * Score = peso da fonte
 *       × fator de frescor da validação
 *       × fator de precisão do dispositivo
 *       − penalidades (contradição, contestação, vigência encerrada)
 *
 * Toda parcela é devolvida junto com o score para que a UI mostre POR QUE
 * um fato vale 92 e não 100. Score sem justificativa é opinião disfarçada.
 */
import { asScore, type Score } from "../shared/primitives";
import { SOURCE_TIER_WEIGHT, type Fact } from "./Fact";

export type ConfidenceBand = "alta" | "media" | "baixa" | "insuficiente";

export interface ConfidenceFactor {
  readonly rotulo: string;
  /** Contribuição em pontos, positiva ou negativa. */
  readonly pontos: number;
  readonly detalhe: string;
}

export interface ConfidenceReport {
  readonly score: Score;
  readonly faixa: ConfidenceBand;
  readonly fatores: readonly ConfidenceFactor[];
  /** Dias desde a última validação humana; null quando nunca validado. */
  readonly diasDesdeValidacao: number | null;
  readonly validacaoVencida: boolean;
}

const DAY = 86_400_000;

export const daysSince = (iso?: string, agora: Date = new Date()): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((agora.getTime() - t) / DAY));
};

export const bandOf = (score: number): ConfidenceBand =>
  score >= 85 ? "alta" : score >= 65 ? "media" : score >= 40 ? "baixa" : "insuficiente";

export const CONFIDENCE_BAND_LABEL: Readonly<Record<ConfidenceBand, string>> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
  insuficiente: "Insuficiente",
};

/**
 * @param fato fato avaliado
 * @param contradicoesAtivas nº de relações "contradiz" apontando para fatos vigentes
 */
export const computeConfidence = (
  fato: Fact,
  contradicoesAtivas = 0,
  agora: Date = new Date(),
): ConfidenceReport => {
  const fatores: ConfidenceFactor[] = [];

  const base = SOURCE_TIER_WEIGHT[fato.fonte.tier] ?? 0;
  fatores.push({
    rotulo: "Fonte",
    pontos: base,
    detalhe: `${fato.fonte.titulo || "sem título"} — tier ${fato.fonte.tier}`,
  });

  // Dispositivo exato: sem localizador, a fonte não é verificável na prática.
  if (!fato.fonte.dispositivo.trim()) {
    fatores.push({
      rotulo: "Dispositivo",
      pontos: -20,
      detalhe: "Fonte sem artigo/seção — impossível conferir pontualmente.",
    });
  }
  if (!fato.fonte.url && fato.fonte.tier !== "doutrina") {
    fatores.push({ rotulo: "Rastreabilidade", pontos: -5, detalhe: "Fonte sem URL pública." });
  }

  // Frescor da validação humana.
  const dias = daysSince(fato.ultimaValidacaoEm, agora);
  const limite = Math.max(30, fato.periodicidadeDias || 180);
  let vencida = false;
  if (dias === null) {
    fatores.push({
      rotulo: "Validação",
      pontos: -25,
      detalhe: "Nunca revalidado por um humano.",
    });
    vencida = true;
  } else if (dias > limite) {
    vencida = true;
    const excesso = Math.min(30, Math.round(((dias - limite) / limite) * 20) + 10);
    fatores.push({
      rotulo: "Validação",
      pontos: -excesso,
      detalhe: `Vencida há ${dias - limite} dias (limite de ${limite} dias).`,
    });
  } else {
    fatores.push({
      rotulo: "Validação",
      pontos: 0,
      detalhe: `Validada há ${dias} dias, dentro do ciclo de ${limite} dias.`,
    });
  }

  // Vigência encerrada.
  if (fato.vigenciaFim && Date.parse(fato.vigenciaFim) < agora.getTime()) {
    fatores.push({
      rotulo: "Vigência",
      pontos: -40,
      detalhe: `Vigência encerrada em ${fato.vigenciaFim}.`,
    });
  }

  // Contradições e contestação.
  if (contradicoesAtivas > 0) {
    fatores.push({
      rotulo: "Contradição",
      pontos: -15 * contradicoesAtivas,
      detalhe: `${contradicoesAtivas} fato(s) vigente(s) contradizem este.`,
    });
  }
  if (fato.status === "contestado") {
    fatores.push({ rotulo: "Status", pontos: -20, detalhe: "Fato marcado como contestado." });
  }
  if (fato.status === "revogado" || fato.status === "substituido") {
    fatores.push({
      rotulo: "Status",
      pontos: -100,
      detalhe: "Fato revogado ou substituído: não pode sustentar conteúdo.",
    });
  }

  const bruto = fatores.reduce((acc, f) => acc + f.pontos, 0);
  const score = asScore(bruto);
  return {
    score,
    faixa: bandOf(score),
    fatores,
    diasDesdeValidacao: dias,
    validacaoVencida: vencida,
  };
};