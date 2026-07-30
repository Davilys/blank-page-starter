/**
 * ENGINE 3 — Coverage Analyzer.
 * Detecta lacunas de cobertura sem inventar conteúdo: apenas mede ausências.
 */
import {
  ratioScore,
  weightedScore,
  type ObservatoryFinding,
  type ObservatorySnapshot,
} from "./Observatory";

export interface CoverageCell {
  readonly chave: string;
  readonly rotulo: string;
  readonly objetos: number;
  readonly publicados: number;
  readonly comFontes: number;
  /** 0..100 — densidade e publicação combinadas. */
  readonly score: number;
}

export interface CoverageReport {
  readonly score: number;
  readonly porCategoria: readonly CoverageCell[];
  readonly porTipo: readonly CoverageCell[];
  readonly entidadesSemObjeto: readonly string[];
  readonly objetosIsolados: readonly string[];
  readonly objetosSemPublicacao: readonly string[];
  readonly fatosSemPublicacao: number;
  readonly achados: readonly ObservatoryFinding[];
}

const cell = (
  chave: string,
  rotulo: string,
  objetos: number,
  publicados: number,
  comFontes: number,
): CoverageCell => ({
  chave,
  rotulo,
  objetos,
  publicados,
  comFontes,
  score: weightedScore([
    { valor: ratioScore(publicados, objetos), peso: 2 },
    { valor: ratioScore(comFontes, objetos), peso: 1 },
    { valor: Math.min(100, objetos * 25), peso: 1 },
  ]),
});

export const analyzeCoverage = (s: ObservatorySnapshot): CoverageReport => {
  const publicadosIds = new Set(s.publicacoes.filter((p) => p.ativa).map((p) => p.objetoId));
  const slugs = new Set(s.rascunhos.map((d) => d.slug).filter(Boolean));

  const group = (
    keyOf: (d: (typeof s.rascunhos)[number]) => string,
    prefixo: string,
  ): readonly CoverageCell[] => {
    const mapa = new Map<string, { objetos: number; publicados: number; comFontes: number }>();
    for (const d of s.rascunhos) {
      const k = keyOf(d) || "(não classificado)";
      const atual = mapa.get(k) ?? { objetos: 0, publicados: 0, comFontes: 0 };
      mapa.set(k, {
        objetos: atual.objetos + 1,
        publicados: atual.publicados + (publicadosIds.has(d.id) ? 1 : 0),
        comFontes: atual.comFontes + (d.fontes.length > 0 ? 1 : 0),
      });
    }
    return [...mapa.entries()]
      .map(([k, v]) => cell(`${prefixo}:${k}`, k, v.objetos, v.publicados, v.comFontes))
      .sort((a, b) => a.score - b.score);
  };

  const porCategoria = group((d) => d.categoria, "categoria");
  const porTipo = group((d) => d.tipo, "tipo");

  const entidades = new Set(
    s.rascunhos.map((d) => String(d.entidadePrincipal || "")).filter(Boolean),
  );
  const entidadesComPublicacao = new Set(
    s.publicacoes.filter((p) => p.ativa).map((p) => p.entidadePrincipal),
  );
  const entidadesSemObjeto = [...entidades].filter((e) => !entidadesComPublicacao.has(e)).sort();

  const objetosIsolados = s.rascunhos
    .filter(
      (d) =>
        d.relacionamentos.filter((r) => slugs.has(r.alvoSlug)).length === 0 &&
        d.linksInternos.filter((l) => slugs.has(l)).length === 0,
    )
    .map((d) => d.id);

  const objetosSemPublicacao = s.rascunhos
    .filter((d) => !publicadosIds.has(d.id))
    .map((d) => d.id);

  const fatosPublicados = new Set(
    s.publicacoes.filter((p) => p.ativa).flatMap((p) => p.fatos.map((f) => f.id)),
  );
  const todosFatos = new Set(s.rascunhos.flatMap((d) => d.fontes.map((f) => f.id)));
  const fatosSemPublicacao = [...todosFatos].filter((f) => !fatosPublicados.has(f)).length;

  const achados: ObservatoryFinding[] = [];
  for (const c of [...porCategoria, ...porTipo].filter((c) => c.score < 40)) {
    achados.push({
      id: `coverage:baixa:${c.chave}`,
      dimensao: "coverage",
      severidade: c.score < 20 ? "critico" : "alerta",
      titulo: `Cobertura baixa em "${c.rotulo}"`,
      detalhe: `${c.objetos} objeto(s), ${c.publicados} publicado(s), ${c.comFontes} com fontes.`,
    });
  }
  for (const id of objetosIsolados) {
    achados.push({
      id: `coverage:isolado:${id}`,
      dimensao: "coverage",
      severidade: "alerta",
      titulo: "Knowledge Object isolado",
      detalhe: "Sem relacionamentos nem links internos válidos.",
      objetoId: id,
    });
  }
  for (const e of entidadesSemObjeto) {
    achados.push({
      id: `coverage:entidade:${e}`,
      dimensao: "coverage",
      severidade: "alerta",
      titulo: "Entidade sem conteúdo publicado",
      detalhe: "A entidade aparece em rascunhos mas não possui página no ar.",
      entidadeId: e,
    });
  }

  const score = weightedScore([
    { valor: ratioScore(publicadosIds.size, s.rascunhos.length), peso: 3 },
    {
      valor: ratioScore(s.rascunhos.length - objetosIsolados.length, s.rascunhos.length),
      peso: 2,
    },
    { valor: ratioScore(entidades.size - entidadesSemObjeto.length, entidades.size), peso: 2 },
    { valor: ratioScore(todosFatos.size - fatosSemPublicacao, todosFatos.size), peso: 1 },
  ]);

  return {
    score,
    porCategoria,
    porTipo,
    entidadesSemObjeto,
    objetosIsolados,
    objetosSemPublicacao,
    fatosSemPublicacao,
    achados,
  };
};