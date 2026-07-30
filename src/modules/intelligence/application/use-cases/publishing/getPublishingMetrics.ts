/** FASE 11 — Métricas do dashboard de publicação. Somente leitura. */
import type { DraftRepository } from "../../ports/factory";
import type {
  PublicationAuditRepository,
  PublicationRepository,
} from "../../ports/publishing";
import type { KnowledgeDraft } from "../../../domain/factory/KnowledgeDraft";
import {
  blockingFailures,
  publicCoverage,
  runChecklist,
} from "../../../domain/publishing/checklist";
import { aiReadinessScore } from "../../../domain/publishing/html";
import {
  healthBand,
  type PublicationAuditRecord,
  type PublishedVersion,
} from "../../../domain/publishing/Publication";
import { err, ok, type Result } from "../../../domain/shared/primitives";
import { buildContext } from "./publishObject";

export interface PublishableRow {
  readonly id: string;
  readonly titulo: string;
  readonly slug: string;
  readonly categoria: string;
  readonly estado: string;
  readonly bloqueios: number;
  readonly liberado: boolean;
  readonly publicado: boolean;
  readonly versaoAtiva: number | null;
  readonly cobertura: number;
  readonly aiReadiness: number;
  readonly atualizadoEm: string;
}

export interface PublishingMetrics {
  readonly publicaveis: number;
  readonly publicados: number;
  readonly pendentes: number;
  readonly arquivados: number;
  readonly ultimaPublicacao: string | null;
  readonly tempoMedioMs: number;
  readonly falhas: number;
  readonly coberturaPublica: number;
  readonly healthScore: number;
  readonly faixa: "critico" | "atencao" | "saudavel";
  readonly linhas: readonly PublishableRow[];
}

export const makeGetPublishingMetrics =
  (
    drafts: DraftRepository,
    publications: PublicationRepository,
    audit: PublicationAuditRepository,
    limiteConfianca = 70,
  ) =>
  async (): Promise<Result<PublishingMetrics>> => {
    const todos = await drafts.list({});
    if (!todos.ok) return err<PublishingMetrics>(todos.error ?? "Falha ao carregar objetos.");
    const lista = (todos.value?.items ?? []) as readonly KnowledgeDraft[];
    const ctx = buildContext(lista, limiteConfianca);

    const versoesR = await publications.listAll();
    const versoes = (versoesR.value?.items ?? []) as readonly PublishedVersion[];
    const ativasPorObjeto = new Map<string, PublishedVersion>();
    for (const v of versoes) if (v.ativa) ativasPorObjeto.set(v.objetoId, v);

    const logsR = await audit.list(500);
    const logs = (logsR.value?.items ?? []) as readonly PublicationAuditRecord[];
    const publicacoes = logs.filter(
      (l) => l.acao === "publicacao" || l.acao === "republicacao",
    );
    const sucesso = publicacoes.filter((l) => l.sucesso);

    const linhas: PublishableRow[] = lista
      .filter((d) => d.estado !== "arquivado")
      .map((d) => {
        const bloqueios = blockingFailures(runChecklist(d, ctx));
        const ativa = ativasPorObjeto.get(String(d.id));
        return {
          id: String(d.id),
          titulo: d.titulo || "(sem título)",
          slug: d.slug,
          categoria: d.categoria,
          estado: d.estado,
          bloqueios: bloqueios.length,
          liberado: bloqueios.length === 0,
          publicado: Boolean(ativa),
          versaoAtiva: ativa ? ativa.versao : null,
          cobertura: publicCoverage(d),
          aiReadiness: aiReadinessScore(d),
          atualizadoEm: String(d.atualizadoEm),
        };
      })
      .sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? 1 : -1));

    const publicados = linhas.filter((l) => l.publicado).length;
    const publicaveis = linhas.filter((l) => l.liberado && !l.publicado).length;
    const pendentes = linhas.filter((l) => !l.liberado).length;
    const arquivados = lista.filter((d) => d.estado === "arquivado").length;

    const coberturaPublica = linhas.length
      ? Math.round(linhas.reduce((s, l) => s + l.cobertura, 0) / linhas.length)
      : 0;

    const proporcaoPublicada = linhas.length ? (publicados / linhas.length) * 100 : 0;
    const aiMedio = linhas.length
      ? linhas.reduce((s, l) => s + l.aiReadiness, 0) / linhas.length
      : 0;
    const taxaFalha = publicacoes.length
      ? ((publicacoes.length - sucesso.length) / publicacoes.length) * 100
      : 0;

    const healthScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          proporcaoPublicada * 0.4 + coberturaPublica * 0.25 + aiMedio * 0.25 - taxaFalha * 0.4,
        ),
      ),
    );

    return ok({
      publicaveis,
      publicados,
      pendentes,
      arquivados,
      ultimaPublicacao: sucesso.length ? String(sucesso[0].registradoEm) : null,
      tempoMedioMs: sucesso.length
        ? Math.round(sucesso.reduce((s, l) => s + l.duracaoMs, 0) / sucesso.length)
        : 0,
      falhas: publicacoes.length - sucesso.length,
      coberturaPublica,
      healthScore,
      faixa: healthBand(healthScore),
      linhas,
    });
  };