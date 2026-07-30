/**
 * Presentation-layer hooks. The UI never imports repositories or adapters —
 * it only consumes use cases through the container.
 */
import { useCallback, useEffect, useState } from "react";
import type { HomeOverview } from "../../application/use-cases/getHomeOverview";
import type { SearchKnowledgeOutput } from "../../application/use-cases/searchKnowledge";
import { intelligenceContainer } from "../../infrastructure/container";

export const useHomeOverview = () => {
  const [data, setData] = useState<HomeOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    intelligenceContainer.getHomeOverview().then((result) => {
      if (!active) return;
      if (result.ok) setData(result.value);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { data, loading };
};

export const useKnowledgeSearch = () => {
  const [termo, setTermo] = useState("");
  const [resultado, setResultado] = useState<SearchKnowledgeOutput | null>(null);
  const [buscando, setBuscando] = useState(false);

  const buscar = useCallback(async (valor: string) => {
    setTermo(valor);
    if (!valor.trim()) {
      setResultado(null);
      return;
    }
    setBuscando(true);
    const r = await intelligenceContainer.searchKnowledge({ termo: valor });
    if (r.ok) setResultado(r.value);
    setBuscando(false);
  }, []);

  return { termo, resultado, buscando, buscar };
};
