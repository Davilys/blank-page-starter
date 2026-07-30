/**
 * ENGINE 6 — Entity Observatory.
 * Um painel por entidade canônica: volume, publicação, atualidade e score.
 */
import {
  daysBetween,
  ratioScore,
  scoreBand,
  weightedScore,
  type ObservatoryFinding,
  type ObservatorySnapshot,
  type ScoreBand,
} from "./Observatory";

export interface EntityRow {
  readonly entidadeId: string;
  readonly fatos: number;
  readonly objetos: number;
  readonly relacoes: number;
  readonly publicacoes: number;
  readonly ultimaAtualizacao: string | null;
  readonly idadeDias: number;
  readonly cobertura: number;
  readonly score: number;
  readonly status: ScoreBand;
}

export interface EntityReport {
  readonly score: number;
  readonly linhas: readonly EntityRow[];
  readonly semPublicacao: number;
  readonly achados: readonly ObservatoryFinding[];
}

export const analyzeEntities = (s: ObservatorySnapshot): EntityReport => {
  const ativos = new Set(s.publicacoes.filter((p) => p.ativa).map((p) => p.objetoId));
  const mapa = new Map<
    string,
    { fatos: Set<string>; objetos: number; relacoes: number; publicacoes: number; ultima: string | null }
  >();

  for (const d of s.rascunhos) {
    const key = String(d.entidadePrincipal || "(sem entidade)");
    const atual =
      mapa.get(key) ?? { fatos: new Set<string>(), objetos: 0, relacoes: 0, publicacoes: 0, ultima: null };
    for (const f of d.fontes) atual.fatos.add(f.id);
    atual.objetos += 1;
    atual.relacoes += d.relacionamentos.length;
    atual.publicacoes += ativos.has(d.id) ? 1 : 0;
    const ref = d.dataRevisao || d.atualizadoEm;
    atual.ultima = !atual.ultima || ref > atual.ultima ? ref : atual.ultima;
    mapa.set(key, atual);
  }

  const linhas: EntityRow[] = [...mapa.entries()]
    .map(([entidadeId, v]) => {
      const cobertura = ratioScore(v.publicacoes, v.objetos);
      const idadeDias = v.ultima ? daysBetween(v.ultima, s.agora) : 9999;
      const score = weightedScore([
        { valor: cobertura, peso: 3 },
        { valor: Math.min(100, v.fatos.size * 20), peso: 2 },
        { valor: Math.min(100, v.objetos * 25), peso: 2 },
        { valor: Math.min(100, v.relacoes * 20), peso: 1 },
        { valor: Math.max(0, 100 - idadeDias / 3.65), peso: 2 },
      ]);
      return {
        entidadeId,
        fatos: v.fatos.size,
        objetos: v.objetos,
        relacoes: v.relacoes,
        publicacoes: v.publicacoes,
        ultimaAtualizacao: v.ultima,
        idadeDias,
        cobertura,
        score,
        status: scoreBand(score),
      };
    })
    .sort((a, b) => a.score - b.score);

  const achados: ObservatoryFinding[] = linhas
    .filter((l) => l.status !== "saudavel")
    .map((l) => ({
      id: `entity:${l.entidadeId}`,
      dimensao: "entity" as const,
      severidade: l.status === "critico" ? ("critico" as const) : ("alerta" as const),
      titulo: `Entidade com score ${l.score}`,
      detalhe: `${l.objetos} objeto(s), ${l.publicacoes} publicado(s), ${l.fatos} fato(s).`,
      entidadeId: l.entidadeId,
    }));

  return {
    score: linhas.length === 0 ? 0 : Math.round(linhas.reduce((a, l) => a + l.score, 0) / linhas.length),
    linhas,
    semPublicacao: linhas.filter((l) => l.publicacoes === 0).length,
    achados,
  };
};