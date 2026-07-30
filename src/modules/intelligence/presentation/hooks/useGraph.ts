/** Hooks do Knowledge Graph. A UI nunca fala com repositórios diretamente. */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EdgeFilter, NodeFilter } from "../../application/ports/graph";
import type { ImpactReport } from "../../application/use-cases/graph/analyzeImpact";
import type { NodeExploration, RelationRow } from "../../application/use-cases/graph/exploreNode";
import type { GraphUniverseView } from "../../application/use-cases/graph/loadGraph";
import type { SaveEdgeInput, EdgeTransitionInput } from "../../application/use-cases/graph/saveEdge";
import type { GraphAuditEntry } from "../../domain/graph/audit";
import type { EdgeType } from "../../domain/graph/GraphEdge";
import type { GraphNode, ManualNodeInput } from "../../domain/graph/GraphNode";
import type { GraphHealth } from "../../domain/graph/health";
import { graphContainer } from "../../infrastructure/graphContainer";

export const useGraphUniverse = () => {
  const [data, setData] = useState<GraphUniverseView | null>(null);
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    setLoading(true);
    const r = await graphContainer.loadGraph();
    if (r.ok) setData(r.value);
    setLoading(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { data, loading, recarregar };
};

export const useGraphNodes = (filter: NodeFilter) => {
  const [items, setItems] = useState<readonly GraphNode[]>([]);
  const [loading, setLoading] = useState(true);
  const chave = JSON.stringify(filter);

  const recarregar = useCallback(async () => {
    setLoading(true);
    const r = await graphContainer.listNodes(JSON.parse(chave));
    if (r.ok) setItems(r.value.items);
    setLoading(false);
  }, [chave]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { items, loading, recarregar };
};

export const useGraphEdges = (filter: EdgeFilter) => {
  const [items, setItems] = useState<readonly RelationRow[]>([]);
  const [nodes, setNodes] = useState<readonly GraphNode[]>([]);
  const [loading, setLoading] = useState(true);
  const chave = JSON.stringify(filter);

  const recarregar = useCallback(async () => {
    setLoading(true);
    const r = await graphContainer.listEdges(JSON.parse(chave));
    if (r.ok) {
      setItems(r.value.items);
      setNodes(r.value.nodes);
    }
    setLoading(false);
  }, [chave]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { items, nodes, loading, recarregar };
};

export const useNodeExploration = (
  id: string | null,
  tipos: readonly EdgeType[],
  profundidade: number,
) => {
  const [data, setData] = useState<NodeExploration | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const chave = useMemo(() => JSON.stringify(tipos), [tipos]);

  const recarregar = useCallback(async () => {
    if (!id) {
      setData(null);
      return;
    }
    setLoading(true);
    const r = await graphContainer.exploreNode(id, {
      tipos: JSON.parse(chave),
      profundidade,
    });
    if (r.ok) {
      setData(r.value);
      setErro(null);
    } else {
      setData(null);
      setErro(r.error as string);
    }
    setLoading(false);
  }, [id, chave, profundidade]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { data, erro, loading, recarregar };
};

export const useImpactAnalysis = (id: string | null, profundidade = 3) => {
  const [data, setData] = useState<ImpactReport | null>(null);
  const [loading, setLoading] = useState(false);

  const recarregar = useCallback(async () => {
    if (!id) {
      setData(null);
      return;
    }
    setLoading(true);
    const r = await graphContainer.analyzeImpact(id, profundidade);
    setData(r.ok ? r.value : null);
    setLoading(false);
  }, [id, profundidade]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { data, loading, recarregar };
};

export const useGraphHealth = () => {
  const [data, setData] = useState<GraphHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    setLoading(true);
    const r = await graphContainer.getHealth();
    if (r.ok) setData(r.value);
    setLoading(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { data, loading, recarregar };
};

export const useGraphAudit = (limit = 100) => {
  const [items, setItems] = useState<readonly GraphAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    setLoading(true);
    const r = await graphContainer.listAudit(limit);
    if (r.ok) setItems(r.value.items);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { items, loading, recarregar };
};

/** Comandos (escrita). Sempre devolvem mensagem de erro legível. */
export const useGraphCommands = () => {
  const [salvando, setSalvando] = useState(false);

  const salvarRelacao = useCallback(async (input: SaveEdgeInput) => {
    setSalvando(true);
    const r = await graphContainer.saveEdge(input);
    setSalvando(false);
    return r;
  }, []);

  const mudarStatus = useCallback(async (input: EdgeTransitionInput) => {
    setSalvando(true);
    const r = await graphContainer.transitionEdge(input);
    setSalvando(false);
    return r;
  }, []);

  const removerRelacao = useCallback(async (id: string, autorId: string, motivo: string) => {
    setSalvando(true);
    const r = await graphContainer.removeEdge(id, autorId, motivo);
    setSalvando(false);
    return r;
  }, []);

  const criarNo = useCallback(
    async (input: ManualNodeInput, autorId: string, motivo: string) => {
      setSalvando(true);
      const r = await graphContainer.saveManualNode(input, autorId, motivo);
      setSalvando(false);
      return r;
    },
    [],
  );

  return { salvando, salvarRelacao, mudarStatus, removerRelacao, criarNo };
};