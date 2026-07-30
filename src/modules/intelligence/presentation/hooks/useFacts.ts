/** Hooks do Fact Ledger. A UI nunca fala com repositórios. */
import { useCallback, useEffect, useState } from "react";
import type { FactFilter } from "../../application/ports/facts";
import type { FactMetrics } from "../../application/use-cases/facts/getFactMetrics";
import type { FactDetail, FactView } from "../../application/use-cases/facts/listFacts";
import type { Fact, FactValidation } from "../../domain/facts/Fact";
import type { KnowledgeDraft } from "../../domain/factory/KnowledgeDraft";
import { factsContainer } from "../../infrastructure/factsContainer";

export const useFactMetrics = () => {
  const [data, setData] = useState<FactMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    setLoading(true);
    const r = await factsContainer.getMetrics();
    if (r.ok) setData(r.value);
    setLoading(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { data, loading, recarregar };
};

export const useFactList = (filter: FactFilter) => {
  const [items, setItems] = useState<readonly FactView[]>([]);
  const [loading, setLoading] = useState(true);
  const chave = JSON.stringify(filter);

  const recarregar = useCallback(async () => {
    setLoading(true);
    const r = await factsContainer.listFacts(JSON.parse(chave));
    if (r.ok) setItems(r.value.items);
    setLoading(false);
  }, [chave]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { items, loading, recarregar };
};

/** Fatos disponíveis para relacionamento e objetos disponíveis para vínculo. */
export const useFactLinkOptions = () => {
  const [fatos, setFatos] = useState<readonly Fact[]>([]);
  const [objetos, setObjetos] = useState<readonly KnowledgeDraft[]>([]);

  useEffect(() => {
    void (async () => {
      const f = await factsContainer.listFacts({});
      if (f.ok) setFatos(f.value.items.map((v) => v.fato));
      const d = await factsContainer.listDraftsForLinking();
      if (d.ok) setObjetos(d.value.items);
    })();
  }, []);

  return { fatos, objetos };
};

export const useFact = (id?: string) => {
  const [detalhe, setDetalhe] = useState<FactDetail | null>(null);
  const [loading, setLoading] = useState(Boolean(id));

  const recarregar = useCallback(async () => {
    if (!id || id === "novo") {
      setDetalhe(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const r = await factsContainer.getFact(id);
    setDetalhe(r.ok ? r.value : null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const salvar = useCallback(
    async (patch: Partial<Fact>, autorId: string) => {
      const r = await factsContainer.saveFact({
        id: id && id !== "novo" ? id : undefined,
        patch,
        autorId,
      });
      if (r.ok) await recarregar();
      return r;
    },
    [id, recarregar],
  );

  const validar = useCallback(
    async (revisorId: string, resultado: FactValidation["resultado"], observacao?: string) => {
      const r = await factsContainer.validateFact({
        id: id as string,
        revisorId,
        resultado,
        observacao,
      });
      if (r.ok) await recarregar();
      return r;
    },
    [id, recarregar],
  );

  return { detalhe, loading, recarregar, salvar, validar };
};