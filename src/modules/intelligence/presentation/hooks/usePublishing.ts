/** FASE 11 — Hooks de publicação. A UI nunca fala com repositórios. */
import { useCallback, useEffect, useState } from "react";
import type { PublishingMetrics } from "../../application/use-cases/publishing/getPublishingMetrics";
import type { ChecklistResult } from "../../application/use-cases/publishing/publishObject";
import type { KnowledgeDraft } from "../../domain/factory/KnowledgeDraft";
import type {
  PublicationAuditRecord,
  PublishedVersion,
} from "../../domain/publishing/Publication";
import type { PublicationPreview } from "../../domain/publishing/preview";
import { publishingContainer } from "../../infrastructure/publishingContainer";

const AUTHOR_KEY = "wm.intelligence.publishing.autor";

export const usePublishingAuthor = () => {
  const [autor, setAutor] = useState<string>(() => {
    try {
      return localStorage.getItem(AUTHOR_KEY) ?? "";
    } catch {
      return "";
    }
  });

  const salvar = useCallback((v: string) => {
    setAutor(v);
    try {
      localStorage.setItem(AUTHOR_KEY, v);
    } catch {
      /* armazenamento indisponível: a publicação segue como "sistema". */
    }
  }, []);

  return { autor, setAutor: salvar };
};

export const usePublishingMetrics = () => {
  const [data, setData] = useState<PublishingMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    setLoading(true);
    const r = await publishingContainer.getMetrics();
    setData(r.ok ? (r.value as PublishingMetrics) : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { data, loading, recarregar };
};

export interface PipelineState {
  readonly draft: KnowledgeDraft | null;
  readonly checklist: ChecklistResult | null;
  readonly preview: PublicationPreview | null;
  readonly versoes: readonly PublishedVersion[];
  readonly erro: string;
  readonly loading: boolean;
  readonly publicando: boolean;
}

export const usePublicationPipeline = (objetoId: string) => {
  const { autor } = usePublishingAuthor();
  const [state, setState] = useState<PipelineState>({
    draft: null,
    checklist: null,
    preview: null,
    versoes: [],
    erro: "",
    loading: true,
    publicando: false,
  });

  const carregar = useCallback(async () => {
    if (!objetoId) return;
    setState((s) => ({ ...s, loading: true, erro: "" }));
    const [chk, prv, vrs] = await Promise.all([
      publishingContainer.checklist(objetoId),
      publishingContainer.preview(objetoId),
      publishingContainer.listVersions(objetoId),
    ]);
    setState({
      draft: prv.ok ? (prv.value as { draft: KnowledgeDraft }).draft : null,
      checklist: chk.ok ? (chk.value as ChecklistResult) : null,
      preview: prv.ok
        ? (prv.value as { preview: PublicationPreview }).preview
        : null,
      versoes: vrs.ok ? (vrs.value as readonly PublishedVersion[]) : [],
      erro: chk.ok ? "" : (chk.error as string) || "Falha ao avaliar o objeto.",
      loading: false,
      publicando: false,
    });
  }, [objetoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const publicar = useCallback(async () => {
    setState((s) => ({ ...s, publicando: true, erro: "" }));
    const r = await publishingContainer.publish(objetoId, autor);
    if (!r.ok) {
      setState((s) => ({ ...s, publicando: false, erro: (r.error as string) ?? "Falha." }));
      return false;
    }
    await carregar();
    return true;
  }, [objetoId, autor, carregar]);

  const reverter = useCallback(
    async (versao: number) => {
      const r = await publishingContainer.rollback(objetoId, versao, autor);
      await carregar();
      return r.ok;
    },
    [objetoId, autor, carregar],
  );

  const despublicar = useCallback(async () => {
    const r = await publishingContainer.unpublish(objetoId, autor);
    await carregar();
    return r.ok;
  }, [objetoId, autor, carregar]);

  return { ...state, recarregar: carregar, publicar, reverter, despublicar };
};

export const usePublicationAudit = (limit = 200) => {
  const [items, setItems] = useState<readonly PublicationAuditRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    setLoading(true);
    const r = await publishingContainer.listAudit(limit);
    setItems(r.ok ? ((r.value?.items ?? []) as readonly PublicationAuditRecord[]) : []);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { items, loading, recarregar };
};

export const usePublishedVersions = () => {
  const [items, setItems] = useState<readonly PublishedVersion[]>([]);
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    setLoading(true);
    const r = await publishingContainer.listActive();
    setItems(r.ok ? ((r.value?.items ?? []) as readonly PublishedVersion[]) : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { items, loading, recarregar };
};