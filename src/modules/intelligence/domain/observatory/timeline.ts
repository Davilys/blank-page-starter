/**
 * ENGINE 7 — Knowledge Timeline.
 * Une histórico editorial, publicações e auditoria numa linha do tempo única.
 * Somente leitura: nenhum evento é criado aqui, apenas projetado.
 */
import {
  type ObservatorySnapshot,
} from "./Observatory";

export const TIMELINE_KINDS = [
  "criacao",
  "revisao",
  "publicacao",
  "rollback",
  "despublicacao",
  "arquivamento",
  "versao",
  "auditoria",
] as const;
export type TimelineKind = (typeof TIMELINE_KINDS)[number];

export const TIMELINE_KIND_LABEL: Readonly<Record<TimelineKind, string>> = {
  criacao: "Criação",
  revisao: "Revisão",
  publicacao: "Publicação",
  rollback: "Rollback",
  despublicacao: "Despublicação",
  arquivamento: "Arquivamento",
  versao: "Mudança de versão",
  auditoria: "Auditoria",
};

export interface TimelineEvent {
  readonly id: string;
  readonly tipo: TimelineKind;
  readonly em: string;
  readonly titulo: string;
  readonly detalhe: string;
  readonly objetoId?: string;
  readonly slug?: string;
  readonly autorId?: string;
  readonly versao?: number;
  readonly hash?: string;
}

export interface TimelineReport {
  readonly eventos: readonly TimelineEvent[];
  readonly porTipo: Readonly<Record<TimelineKind, number>>;
  readonly primeiro: string | null;
  readonly ultimo: string | null;
}

export const buildTimeline = (s: ObservatorySnapshot, limite = 300): TimelineReport => {
  const eventos: TimelineEvent[] = [];

  for (const d of s.rascunhos) {
    eventos.push({
      id: `t:criacao:${d.id}`,
      tipo: "criacao",
      em: d.criadoEm,
      titulo: d.titulo || d.slug || "(sem título)",
      detalhe: `Objeto criado por ${d.autorId || "autor não informado"}.`,
      objetoId: d.id,
      slug: d.slug,
      autorId: d.autorId,
    });
    if (d.dataRevisao) {
      eventos.push({
        id: `t:revisao:${d.id}`,
        tipo: "revisao",
        em: d.dataRevisao,
        titulo: d.titulo || d.slug,
        detalhe: `Revisado por ${d.revisorId || "revisor não informado"}.`,
        objetoId: d.id,
        slug: d.slug,
        autorId: d.revisorId,
      });
    }
    if (d.estado === "arquivado") {
      eventos.push({
        id: `t:arquivamento:${d.id}`,
        tipo: "arquivamento",
        em: d.atualizadoEm,
        titulo: d.titulo || d.slug,
        detalhe: "Objeto arquivado no fluxo editorial.",
        objetoId: d.id,
        slug: d.slug,
      });
    }
  }

  for (const v of s.historico) {
    eventos.push({
      id: `t:versao:${v.id}`,
      tipo: "versao",
      em: v.registradoEm,
      titulo: `v${v.versao} — ${v.resumoMudanca || v.motivo}`,
      detalhe: `Motivo: ${v.motivo}. ${v.diffs.length} campo(s) alterado(s).`,
      objetoId: String(v.objetoId),
      autorId: v.autorId,
      versao: v.versao,
    });
  }

  for (const p of s.publicacoes) {
    eventos.push({
      id: `t:pub:${p.id}`,
      tipo: p.origem === "rollback" ? "rollback" : "publicacao",
      em: p.publicadoEm,
      titulo: `${p.titulo} — v${p.versao}`,
      detalhe:
        p.origem === "rollback"
          ? `Restaurada da v${p.restauradaDe ?? "?"}.`
          : `Publicada em ${p.canonical}.`,
      objetoId: p.objetoId,
      slug: p.slug,
      autorId: p.autorId,
      versao: p.versao,
      hash: p.hash,
    });
  }

  for (const a of s.auditoriaPublicacao) {
    eventos.push({
      id: `t:audit:${a.id}`,
      tipo: a.acao === "despublicacao" ? "despublicacao" : "auditoria",
      em: a.registradoEm,
      titulo: `${a.acao} — ${a.slug || a.objetoId}`,
      detalhe: a.mensagem,
      objetoId: a.objetoId,
      slug: a.slug,
      autorId: a.autorId,
      versao: a.versao ?? undefined,
      hash: a.hash,
    });
  }

  const ordenados = eventos
    .filter((e) => Boolean(e.em))
    .sort((a, b) => (a.em < b.em ? 1 : a.em > b.em ? -1 : a.id < b.id ? -1 : 1));

  const porTipo = TIMELINE_KINDS.reduce(
    (acc, k) => ({ ...acc, [k]: ordenados.filter((e) => e.tipo === k).length }),
    {} as Record<TimelineKind, number>,
  );

  return {
    eventos: ordenados.slice(0, limite),
    porTipo,
    primeiro: ordenados.length ? ordenados[ordenados.length - 1].em : null,
    ultimo: ordenados.length ? ordenados[0].em : null,
  };
};

/** Eventos de um objeto específico, do mais recente ao mais antigo. */
export const timelineForObject = (
  s: ObservatorySnapshot,
  objetoId: string,
): readonly TimelineEvent[] =>
  buildTimeline(s, Number.MAX_SAFE_INTEGER).eventos.filter((e) => e.objetoId === objetoId);