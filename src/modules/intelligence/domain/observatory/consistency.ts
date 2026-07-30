/**
 * ENGINE 4 — Consistency Monitor.
 * Detecta conflitos, datas incompatíveis, versões inconsistentes, relações
 * inválidas, duplicidades e referências quebradas.
 */
import {
  penaltyScore,
  type ObservatoryFinding,
  type ObservatorySnapshot,
} from "./Observatory";

export interface ConsistencyReport {
  readonly score: number;
  readonly achados: readonly ObservatoryFinding[];
  readonly conflitos: number;
  readonly datasIncompativeis: number;
  readonly versoesInconsistentes: number;
  readonly relacoesInvalidas: number;
  readonly duplicidades: number;
  readonly referenciasQuebradas: number;
}

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

export const analyzeConsistency = (s: ObservatorySnapshot): ConsistencyReport => {
  const achados: ObservatoryFinding[] = [];
  const slugs = new Set(s.rascunhos.map((d) => d.slug).filter(Boolean));
  const porSlug = new Map<string, string[]>();
  const porTitulo = new Map<string, string[]>();

  let conflitos = 0;
  let datasIncompativeis = 0;
  let versoesInconsistentes = 0;
  let relacoesInvalidas = 0;
  let referenciasQuebradas = 0;

  const versoesPorObjeto = new Map<string, number>();
  for (const p of s.publicacoes) {
    versoesPorObjeto.set(p.objetoId, Math.max(versoesPorObjeto.get(p.objetoId) ?? 0, p.versao));
  }

  for (const d of s.rascunhos) {
    porSlug.set(d.slug, [...(porSlug.get(d.slug) ?? []), d.id]);
    porTitulo.set(norm(d.titulo), [...(porTitulo.get(norm(d.titulo)) ?? []), d.id]);

    for (const r of d.relacionamentos) {
      if (r.tipo === "contradiz") {
        conflitos += 1;
        achados.push({
          id: `consistency:conflito:${d.id}:${r.alvoSlug}`,
          dimensao: "consistency",
          severidade: "critico",
          titulo: "Conflito declarado entre objetos",
          detalhe: `"${d.slug}" contradiz "${r.alvoSlug}" e exige resolução humana.`,
          objetoId: d.id,
          slug: d.slug,
        });
      }
      if (!slugs.has(r.alvoSlug)) {
        relacoesInvalidas += 1;
        achados.push({
          id: `consistency:relacao:${d.id}:${r.alvoSlug}`,
          dimensao: "consistency",
          severidade: "critico",
          titulo: "Relacionamento inválido",
          detalhe: `O alvo "${r.alvoSlug}" não existe na base.`,
          objetoId: d.id,
          slug: d.slug,
        });
      }
      if (r.alvoSlug === d.slug) {
        relacoesInvalidas += 1;
        achados.push({
          id: `consistency:autorrelacao:${d.id}`,
          dimensao: "consistency",
          severidade: "alerta",
          titulo: "Auto-relacionamento",
          detalhe: "O objeto se relaciona consigo mesmo.",
          objetoId: d.id,
          slug: d.slug,
        });
      }
    }

    for (const link of d.linksInternos) {
      if (!slugs.has(link)) {
        referenciasQuebradas += 1;
        achados.push({
          id: `consistency:link:${d.id}:${link}`,
          dimensao: "consistency",
          severidade: "alerta",
          titulo: "Referência interna quebrada",
          detalhe: `O link interno "${link}" não resolve para nenhum objeto.`,
          objetoId: d.id,
          slug: d.slug,
        });
      }
    }

    if (d.atualizadoEm < d.criadoEm || (d.dataRevisao && d.dataRevisao < d.criadoEm)) {
      datasIncompativeis += 1;
      achados.push({
        id: `consistency:data:${d.id}`,
        dimensao: "consistency",
        severidade: "critico",
        titulo: "Datas incompatíveis",
        detalhe: "Atualização ou revisão anterior à data de criação.",
        objetoId: d.id,
        slug: d.slug,
      });
    }

    const publicadaMax = versoesPorObjeto.get(d.id) ?? 0;
    if (publicadaMax > d.versao) {
      versoesInconsistentes += 1;
      achados.push({
        id: `consistency:versao:${d.id}`,
        dimensao: "consistency",
        severidade: "critico",
        titulo: "Versão inconsistente",
        detalhe: `Existe publicação v${publicadaMax} acima da versão do rascunho (v${d.versao}).`,
        objetoId: d.id,
        slug: d.slug,
      });
    }
  }

  let duplicidades = 0;
  const registrarDuplicidade = (
    mapa: Map<string, string[]>,
    rotulo: string,
    chavePrefixo: string,
  ) => {
    for (const [chave, ids] of mapa) {
      if (chave && ids.length > 1) {
        duplicidades += 1;
        achados.push({
          id: `consistency:${chavePrefixo}:${chave}`,
          dimensao: "consistency",
          severidade: "critico",
          titulo: `Duplicidade de ${rotulo}`,
          detalhe: `${ids.length} objetos compartilham "${chave}".`,
          objetoId: ids[0],
        });
      }
    }
  };
  registrarDuplicidade(porSlug, "slug", "slug");
  registrarDuplicidade(porTitulo, "título", "titulo");

  const publicadasAtivas = new Map<string, number>();
  for (const p of s.publicacoes.filter((v) => v.ativa)) {
    publicadasAtivas.set(p.objetoId, (publicadasAtivas.get(p.objetoId) ?? 0) + 1);
  }
  for (const [objetoId, qtd] of publicadasAtivas) {
    if (qtd > 1) {
      versoesInconsistentes += 1;
      achados.push({
        id: `consistency:ativa:${objetoId}`,
        dimensao: "consistency",
        severidade: "critico",
        titulo: "Mais de uma versão ativa",
        detalhe: `${qtd} versões marcadas como no ar para o mesmo objeto.`,
        objetoId,
      });
    }
  }

  return {
    score: penaltyScore(achados, Math.max(1, s.rascunhos.length)),
    achados,
    conflitos,
    datasIncompativeis,
    versoesInconsistentes,
    relacoesInvalidas,
    duplicidades,
    referenciasQuebradas,
  };
};