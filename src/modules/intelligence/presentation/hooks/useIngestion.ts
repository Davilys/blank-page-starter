/** Presentation hooks for the Ingestion Engine. UI never touches repositories. */
import { useCallback, useEffect, useState } from "react";
import type { CandidateFilter } from "../../application/ports/ingestion";
import type { IngestionMetrics } from "../../application/use-cases/ingestion/getIngestionMetrics";
import type {
  CandidateChoices,
  IngestionCandidate,
  IngestionLogEntry,
} from "../../domain/ingestion/SourceDocument";
import { ingestionContainer } from "../../infrastructure/ingestionContainer";

export const useIngestionMetrics = () => {
  const [data, setData] = useState<IngestionMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    setLoading(true);
    const r = await ingestionContainer.getMetrics();
    if (r.ok) setData(r.value);
    setLoading(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { data, loading, recarregar };
};

export const useCandidateList = (filter: CandidateFilter) => {
  const [items, setItems] = useState<readonly IngestionCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const chave = JSON.stringify(filter);

  const recarregar = useCallback(async () => {
    setLoading(true);
    const r = await ingestionContainer.listCandidates(JSON.parse(chave));
    if (r.ok) setItems(r.value.items);
    setLoading(false);
  }, [chave]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { items, loading, recarregar };
};

export const useCandidate = (id?: string) => {
  const [candidato, setCandidato] = useState<IngestionCandidate | null>(null);
  const [eventos, setEventos] = useState<readonly IngestionLogEntry[]>([]);
  const [loading, setLoading] = useState(Boolean(id));

  const recarregar = useCallback(async () => {
    if (!id) {
      setCandidato(null);
      setEventos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const r = await ingestionContainer.getCandidate(id);
    setCandidato(r.ok ? r.value : null);
    const l = await ingestionContainer.listCandidateLog(id);
    setEventos(l.ok ? l.value.items : []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const salvarEscolhas = useCallback(
    async (escolhas: CandidateChoices) => {
      const r = await ingestionContainer.updateCandidate({ id: id as string, escolhas });
      if (r.ok) await recarregar();
      return r;
    },
    [id, recarregar],
  );

  const aprovar = useCallback(
    async (usuario: string) => {
      const r = await ingestionContainer.promoteCandidate({ id: id as string, usuario });
      if (r.ok) await recarregar();
      return r;
    },
    [id, recarregar],
  );

  const rejeitar = useCallback(
    async (usuario: string, motivo: string) => {
      const r = await ingestionContainer.rejectCandidate({ id: id as string, usuario, motivo });
      if (r.ok) await recarregar();
      return r;
    },
    [id, recarregar],
  );

  const reabrir = useCallback(
    async (usuario: string) => {
      const r = await ingestionContainer.reopenCandidate(id as string, usuario);
      if (r.ok) await recarregar();
      return r;
    },
    [id, recarregar],
  );

  return { candidato, eventos, loading, recarregar, salvarEscolhas, aprovar, rejeitar, reabrir };
};