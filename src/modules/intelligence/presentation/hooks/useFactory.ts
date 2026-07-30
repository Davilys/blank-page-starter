/**
 * Presentation hooks for the Knowledge Factory. The UI never touches
 * repositories — only use cases exposed by the container.
 */
import { useCallback, useEffect, useState } from "react";
import type { DraftFilter } from "../../application/ports/factory";
import type { FactoryMetrics } from "../../application/use-cases/factory/getFactoryMetrics";
import type { SaveDraftInput } from "../../application/use-cases/factory/saveDraft";
import type { TransitionInput } from "../../application/use-cases/factory/transitionDraft";
import type { KnowledgeDraft } from "../../domain/factory/KnowledgeDraft";
import type { KnowledgeVersion } from "../../domain/memory/KnowledgeVersion";
import { factoryContainer } from "../../infrastructure/factoryContainer";

export const useFactoryMetrics = () => {
  const [data, setData] = useState<FactoryMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    setLoading(true);
    const r = await factoryContainer.getMetrics();
    if (r.ok) setData(r.value);
    setLoading(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { data, loading, recarregar };
};

export const useDraftList = (filter: DraftFilter) => {
  const [items, setItems] = useState<readonly KnowledgeDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const chave = JSON.stringify(filter);

  const recarregar = useCallback(async () => {
    setLoading(true);
    const r = await factoryContainer.listDrafts(JSON.parse(chave));
    if (r.ok) setItems(r.value.items);
    setLoading(false);
  }, [chave]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { items, loading, recarregar };
};

export const useDraft = (id?: string) => {
  const [draft, setDraft] = useState<KnowledgeDraft | null>(null);
  const [versoes, setVersoes] = useState<readonly KnowledgeVersion[]>([]);
  const [loading, setLoading] = useState(Boolean(id));

  const recarregar = useCallback(async () => {
    if (!id) {
      setDraft(null);
      setVersoes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const r = await factoryContainer.getDraft(id);
    setDraft(r.ok ? r.value : null);
    const h = await factoryContainer.listVersions(id);
    setVersoes(h.ok ? h.value.items : []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const salvar = useCallback(
    async (input: SaveDraftInput) => {
      const r = await factoryContainer.saveDraft(input);
      if (r.ok) await recarregar();
      return r;
    },
    [recarregar],
  );

  const transicionar = useCallback(
    async (input: TransitionInput) => {
      const r = await factoryContainer.transitionDraft(input);
      if (r.ok) await recarregar();
      return r;
    },
    [recarregar],
  );

  return { draft, versoes, loading, recarregar, salvar, transicionar };
};