/**
 * Relatórios do Observatory. Projeções puras do resultado da análise — nenhum
 * texto é gerado por IA, nenhum dado é inventado.
 */
import {
  DIMENSION_LABEL,
  SEVERITY_LABEL,
  SCORE_BAND_LABEL,
  scoreBand,
  type ObservatoryFinding,
} from "./Observatory";
import type { ObservatoryResult } from "./runObservatory";

export const REPORT_KINDS = [
  "executivo",
  "tecnico",
  "cobertura",
  "qualidade",
  "consistencia",
  "publicacao",
] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_LABEL: Readonly<Record<ReportKind, string>> = {
  executivo: "Relatório Executivo",
  tecnico: "Relatório Técnico",
  cobertura: "Relatório de Cobertura",
  qualidade: "Relatório de Qualidade",
  consistencia: "Relatório de Consistência",
  publicacao: "Relatório de Publicação",
};

export interface ReportSection {
  readonly titulo: string;
  readonly linhas: readonly string[];
}

export interface ObservatoryReport {
  readonly tipo: ReportKind;
  readonly titulo: string;
  readonly geradoEm: string;
  readonly hash: string;
  readonly secoes: readonly ReportSection[];
  /** Tabela plana usada nas exportações CSV. */
  readonly tabela: {
    readonly colunas: readonly string[];
    readonly linhas: readonly (readonly string[])[];
  };
}

const findingRows = (achados: readonly ObservatoryFinding[]) =>
  achados.map((a) => [
    SEVERITY_LABEL[a.severidade],
    DIMENSION_LABEL[a.dimensao],
    a.titulo,
    a.detalhe,
    a.slug || a.objetoId || a.entidadeId || "",
  ]);

export const buildReport = (r: ObservatoryResult, tipo: ReportKind): ObservatoryReport => {
  const base = { tipo, titulo: REPORT_LABEL[tipo], geradoEm: String(r.executadoEm), hash: r.hash };

  switch (tipo) {
    case "executivo":
      return {
        ...base,
        secoes: [
          {
            titulo: "Índice geral",
            linhas: [
              `Knowledge Health Score: ${r.health.score} (${SCORE_BAND_LABEL[r.health.faixa]})`,
              `Objetos analisados: ${r.totais.objetos}`,
              `Objetos publicados: ${r.totais.publicados}`,
              `Achados: ${r.achados.length} (${r.totais.criticos} críticos)`,
              `Tempo de execução: ${r.duracaoMs} ms`,
            ],
          },
          {
            titulo: "Dimensões",
            linhas: r.health.dimensoes.map(
              (d) => `${d.rotulo}: ${d.valor} (peso ${d.peso}, ${SCORE_BAND_LABEL[d.faixa]})`,
            ),
          },
        ],
        tabela: {
          colunas: ["Dimensão", "Score", "Peso", "Faixa"],
          linhas: r.health.dimensoes.map((d) => [
            d.rotulo,
            String(d.valor),
            String(d.peso),
            SCORE_BAND_LABEL[d.faixa],
          ]),
        },
      };

    case "tecnico":
      return {
        ...base,
        secoes: [
          {
            titulo: "Achados por severidade",
            linhas: [
              `Críticos: ${r.totais.criticos}`,
              `Alertas: ${r.totais.alertas}`,
              `Informativos: ${r.totais.informativos}`,
              `Hash da análise: ${r.hash}`,
            ],
          },
        ],
        tabela: {
          colunas: ["Severidade", "Dimensão", "Título", "Detalhe", "Referência"],
          linhas: findingRows(r.achados),
        },
      };

    case "cobertura":
      return {
        ...base,
        secoes: [
          {
            titulo: "Cobertura",
            linhas: [
              `Coverage Score: ${r.coverage.score}`,
              `Objetos isolados: ${r.coverage.objetosIsolados.length}`,
              `Entidades sem conteúdo publicado: ${r.coverage.entidadesSemObjeto.length}`,
              `Objetos sem publicação: ${r.coverage.objetosSemPublicacao.length}`,
              `Fatos sem publicação: ${r.coverage.fatosSemPublicacao}`,
            ],
          },
        ],
        tabela: {
          colunas: ["Grupo", "Objetos", "Publicados", "Com fontes", "Score"],
          linhas: [...r.coverage.porCategoria, ...r.coverage.porTipo].map((c) => [
            c.rotulo,
            String(c.objetos),
            String(c.publicados),
            String(c.comFontes),
            String(c.score),
          ]),
        },
      };

    case "qualidade":
      return {
        ...base,
        secoes: [
          {
            titulo: "Qualidade e atualidade",
            linhas: [
              `Freshness Score: ${r.freshness.score}`,
              `Schema Score: ${r.schema.score} (${r.schema.totalErros} erros, ${r.schema.totalAvisos} avisos)`,
              `Entity Score: ${r.entity.score}`,
              `Objetos vencidos: ${r.freshness.vencidos}`,
              `Objetos sem revisão: ${r.freshness.semRevisao}`,
            ],
          },
        ],
        tabela: {
          colunas: ["Objeto", "Tipo", "Idade (dias)", "TTL", "Score", "Sem revisão"],
          linhas: r.freshness.fila.map((l) => [
            l.titulo,
            l.tipo,
            String(l.idadeDias),
            String(l.ttlDias),
            String(l.score),
            l.semRevisao ? "sim" : "não",
          ]),
        },
      };

    case "consistencia":
      return {
        ...base,
        secoes: [
          {
            titulo: "Consistência",
            linhas: [
              `Consistency Score: ${r.consistency.score}`,
              `Conflitos: ${r.consistency.conflitos}`,
              `Datas incompatíveis: ${r.consistency.datasIncompativeis}`,
              `Versões inconsistentes: ${r.consistency.versoesInconsistentes}`,
              `Relacionamentos inválidos: ${r.consistency.relacoesInvalidas}`,
              `Duplicidades: ${r.consistency.duplicidades}`,
              `Referências quebradas: ${r.consistency.referenciasQuebradas}`,
            ],
          },
        ],
        tabela: {
          colunas: ["Severidade", "Dimensão", "Título", "Detalhe", "Referência"],
          linhas: findingRows(r.consistency.achados),
        },
      };

    case "publicacao":
    default: {
      const dim = r.health.dimensoes.find((d) => d.dimensao === "publication");
      return {
        ...base,
        tipo: "publicacao",
        titulo: REPORT_LABEL.publicacao,
        secoes: [
          {
            titulo: "Publicação",
            linhas: [
              `Publication Score: ${dim?.valor ?? 0} (${SCORE_BAND_LABEL[scoreBand(dim?.valor ?? 0)]})`,
              `Objetos no ar: ${r.totais.publicados} de ${r.totais.objetos}`,
              `Eventos na linha do tempo: ${r.timeline.eventos.length}`,
              `Última movimentação: ${r.timeline.ultimo ?? "—"}`,
            ],
          },
        ],
        tabela: {
          colunas: ["Data", "Tipo", "Título", "Detalhe", "Autor"],
          linhas: r.timeline.eventos
            .slice(0, 200)
            .map((e) => [e.em, e.tipo, e.titulo, e.detalhe, e.autorId || ""]),
        },
      };
    }
  }
};

/** CSV RFC-4180: aspas duplicadas e campos sempre delimitados. */
export const toCsv = (report: ObservatoryReport): string => {
  const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [report.tabela.colunas, ...report.tabela.linhas]
    .map((linha) => linha.map(escape).join(","))
    .join("\r\n");
};

/** HTML de impressão — a exportação em PDF usa a caixa de impressão do SO. */
export const toPrintableHtml = (report: ObservatoryReport): string => {
  const esc = (v: string) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const secoes = report.secoes
    .map(
      (s) =>
        `<section><h2>${esc(s.titulo)}</h2><ul>${s.linhas
          .map((l) => `<li>${esc(l)}</li>`)
          .join("")}</ul></section>`,
    )
    .join("");
  const cabecalho = report.tabela.colunas.map((c) => `<th>${esc(c)}</th>`).join("");
  const corpo = report.tabela.linhas
    .map((l) => `<tr>${l.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${esc(report.titulo)}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#111;margin:32px;}
  h1{font-size:20px;margin:0 0 4px;} h2{font-size:14px;margin:20px 0 6px;}
  p.meta{color:#555;font-size:12px;margin:0 0 16px;}
  ul{margin:0;padding-left:18px;font-size:12px;line-height:1.6;}
  table{width:100%;border-collapse:collapse;margin-top:16px;font-size:11px;}
  th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top;}
  th{background:#f4f6f8;}
</style></head><body>
<h1>${esc(report.titulo)}</h1>
<p class="meta">Gerado em ${esc(report.geradoEm)} · hash ${esc(report.hash)} · WebMarcas Intelligence</p>
${secoes}
<table><thead><tr>${cabecalho}</tr></thead><tbody>${corpo}</tbody></table>
</body></html>`;
};