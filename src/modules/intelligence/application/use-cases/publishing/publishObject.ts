/**
 * FASE 11 — Casos de uso do pipeline de publicação (CQRS + Event Driven).
 *
 * Pipeline: Knowledge Object → Validação → Checklist → Preview → Publicação → Auditoria.
 * Nenhum passo publica automaticamente: `publish` exige autor e checklist verde.
 */
import type { DraftRepository } from "../../ports/factory";
import type {
  PublicationAuditRepository,
  PublicationRepository,
} from "../../ports/publishing";
import type { KnowledgeDraft } from "../../../domain/factory/KnowledgeDraft";
import {
  blockingFailures,
  checklistScore,
  runChecklist,
  type ChecklistItem,
  type PublicationContext,
} from "../../../domain/publishing/checklist";
import {
  buildPreview,
  type PublicationPreview,
} from "../../../domain/publishing/preview";
import {
  nextVersion,
  type PublicationAction,
  type PublicationAuditRecord,
  type PublishedVersion,
} from "../../../domain/publishing/Publication";
import { buildSeo } from "../../../domain/publishing/seo";
import { asIsoDateTime, err, ok, type Result } from "../../../domain/shared/primitives";
import type { KnowledgeObjectId } from "../../../domain/shared/primitives";

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Contexto derivado de TODOS os objetos: resolve slugs e entidades. */
export const buildContext = (
  drafts: readonly KnowledgeDraft[],
  limiteConfianca = 70,
): PublicationContext => ({
  slugsConhecidos: new Set(drafts.map((d) => d.slug).filter(Boolean)),
  entidadesConhecidas: new Set(
    drafts.map((d) => String(d.entidadePrincipal)).filter((e) => e.trim().length > 0),
  ),
  limiteConfianca,
});

export interface ChecklistResult {
  readonly draft: KnowledgeDraft;
  readonly itens: readonly ChecklistItem[];
  readonly bloqueios: readonly ChecklistItem[];
  readonly score: number;
  readonly liberado: boolean;
}

export interface PublishingUseCases {
  checklist(id: string): Promise<Result<ChecklistResult>>;
  preview(id: string): Promise<Result<{ draft: KnowledgeDraft; preview: PublicationPreview }>>;
  publish(id: string, autorId: string): Promise<Result<PublishedVersion>>;
  rollback(id: string, versao: number, autorId: string): Promise<Result<PublishedVersion>>;
  unpublish(id: string, autorId: string): Promise<Result<true>>;
  listVersions(id: string): Promise<Result<readonly PublishedVersion[]>>;
}

export const makePublishingUseCases = (
  drafts: DraftRepository,
  publications: PublicationRepository,
  audit: PublicationAuditRepository,
  limiteConfianca = 70,
): PublishingUseCases => {
  const registrar = async (
    r: Omit<PublicationAuditRecord, "id" | "registradoEm">,
  ): Promise<void> => {
    await audit.append({
      ...r,
      id: uid(),
      registradoEm: asIsoDateTime(new Date()),
    });
  };

  const carregar = async (id: string) => {
    const todos = await drafts.list({});
    if (!todos.ok) return { erro: todos.error ?? "Falha ao carregar objetos." };
    const lista = (todos.value?.items ?? []) as readonly KnowledgeDraft[];
    const draft = lista.find((d) => String(d.id) === id);
    if (!draft) return { erro: "Objeto não encontrado." };
    return { draft, ctx: buildContext(lista, limiteConfianca) };
  };

  const avaliar = async (id: string): Promise<Result<ChecklistResult>> => {
    const c = await carregar(id);
    if (!c.draft) return err<ChecklistResult>(c.erro as string);
    const itens = runChecklist(c.draft, c.ctx);
    const bloqueios = blockingFailures(itens);
    return ok({
      draft: c.draft,
      itens,
      bloqueios,
      score: checklistScore(itens),
      liberado: bloqueios.length === 0,
    });
  };

  const gravarVersao = async (
    draft: KnowledgeDraft,
    autorId: string,
    origem: PublicationAction,
    versaoNumero: number,
    restauradaDe?: number,
  ): Promise<Result<PublishedVersion>> => {
    const preview = buildPreview(draft, versaoNumero);
    const seo = buildSeo(draft);
    const versao: PublishedVersion = {
      id: uid(),
      objetoId: String(draft.id),
      slug: draft.slug,
      versao: versaoNumero,
      hash: preview.hash,
      publicadoEm: asIsoDateTime(new Date()),
      autorId: autorId || "sistema",
      origem,
      restauradaDe,
      titulo: seo.title,
      descricao: seo.description,
      canonical: seo.canonical,
      html: preview.html,
      jsonLd: preview.jsonLd,
      metaTags: preview.metaTags,
      fatos: draft.fontes.map((f) => ({
        id: f.id,
        titulo: f.titulo,
        url: f.url,
        tier: f.tier,
      })),
      entidadePrincipal: String(draft.entidadePrincipal),
      ativa: true,
    };
    return publications.append(versao);
  };

  return {
    checklist: avaliar,

    async preview(id) {
      const c = await carregar(id);
      if (!c.draft) return err(c.erro as string);
      const versoes = await publications.listByObject(id);
      const proxima = nextVersion(
        (versoes.value?.items ?? []) as readonly PublishedVersion[],
      );
      return ok({ draft: c.draft, preview: buildPreview(c.draft, proxima) });
    },

    async publish(id, autorId) {
      const inicio = Date.now();
      const avaliacao = await avaliar(id);
      if (!avaliacao.ok) return err<PublishedVersion>(avaliacao.error as string);
      const { draft, bloqueios } = avaliacao.value as ChecklistResult;

      if (bloqueios.length > 0) {
        await registrar({
          objetoId: id,
          slug: draft.slug,
          acao: "publicacao",
          autorId: autorId || "sistema",
          versao: null,
          hash: "",
          sucesso: false,
          duracaoMs: Date.now() - inicio,
          mensagem: "Publicação bloqueada pelo checklist automático.",
          itensBloqueantes: bloqueios.map((b) => b.rotulo),
        });
        return err<PublishedVersion>(
          `Publicação bloqueada: ${bloqueios.map((b) => b.rotulo).join("; ")}.`,
        );
      }

      const existentes = await publications.listByObject(id);
      const anteriores = (existentes.value?.items ?? []) as readonly PublishedVersion[];
      const numero = nextVersion(anteriores);
      const gravada = await gravarVersao(
        draft,
        autorId,
        anteriores.length ? "republicacao" : "publicacao",
        numero,
      );

      await registrar({
        objetoId: id,
        slug: draft.slug,
        acao: anteriores.length ? "republicacao" : "publicacao",
        autorId: autorId || "sistema",
        versao: gravada.ok ? numero : null,
        hash: gravada.ok ? (gravada.value as PublishedVersion).hash : "",
        sucesso: gravada.ok,
        duracaoMs: Date.now() - inicio,
        mensagem: gravada.ok
          ? `Versão ${numero} publicada.`
          : ((gravada.error as string | undefined) ?? "Falha ao publicar."),
        itensBloqueantes: [],
      });

      return gravada;
    },

    async rollback(id, versao, autorId) {
      const inicio = Date.now();
      const lista = await publications.listByObject(id);
      const versoes = (lista.value?.items ?? []) as readonly PublishedVersion[];
      const alvo = versoes.find((v) => v.versao === versao);
      if (!alvo) return err<PublishedVersion>("Versão inexistente para este objeto.");

      const aplicada = await publications.setActive(id, versao);
      await registrar({
        objetoId: id,
        slug: alvo.slug,
        acao: "rollback",
        autorId: autorId || "sistema",
        versao,
        hash: alvo.hash,
        sucesso: aplicada.ok,
        duracaoMs: Date.now() - inicio,
        mensagem: aplicada.ok
          ? `Rollback para a versão ${versao}.`
          : ((aplicada.error as string | undefined) ?? "Falha no rollback."),
        itensBloqueantes: [],
      });
      return aplicada;
    },

    async unpublish(id, autorId) {
      const inicio = Date.now();
      const lista = await publications.listByObject(id);
      const versoes = (lista.value?.items ?? []) as readonly PublishedVersion[];
      if (!versoes.length) return err<true>("Objeto nunca foi publicado.");
      const r = await publications.deactivate(id);
      await registrar({
        objetoId: id,
        slug: versoes[0].slug,
        acao: "despublicacao",
        autorId: autorId || "sistema",
        versao: null,
        hash: "",
        sucesso: r.ok,
        duracaoMs: Date.now() - inicio,
        mensagem: r.ok ? "Objeto retirado do ar (histórico preservado)." : "Falha ao despublicar.",
        itensBloqueantes: [],
      });
      return r;
    },

    async listVersions(id) {
      const r = await publications.listByObject(id);
      if (!r.ok) return err<readonly PublishedVersion[]>(r.error as string);
      return ok((r.value?.items ?? []) as readonly PublishedVersion[]);
    },
  };
};

export type { KnowledgeObjectId };