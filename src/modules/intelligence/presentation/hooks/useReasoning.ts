/** Hooks do Reasoning Engine. A UI nunca fala com repositórios. */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReasoningMetrics } from "../../application/use-cases/reasoning/getReasoningMetrics";
import type { AnalysisEnvelope } from "../../application/use-cases/reasoning/runAnalysis";
import type { CascadeReport, SimulationKind } from "../../domain/reasoning/cascade";
import type { BrokenReport } from "../../domain/reasoning/broken";
import type { ConfidenceReportSummary } from "../../domain/reasoning/confidence";
import type { CoverageReport } from "../../domain/reasoning/coverage";
import type { ImpactAnalysis } from "../../domain/reasoning/impact";
import type { ReasoningRun } from "../../domain/reasoning/Reasoning";
import type { KnowledgeSuggestion } from "../../domain/reasoning/suggestions";
import type { ReasoningSnapshot } from "../../domain/reasoning/snapshot";
import type { GraphNode } from "../../domain/graph/GraphNode";
import { reasoningContainer } from "../../infrastructure/reasoningContainer";

/** Autor da execução: registrado na auditoria imutável. */
const OPERATOR_KEY = "wm.intelligence.reasoning.operador";

export const useReasoningOperator = () => {
  const [operador, setOperador] = useState<string>(() => {
    try {
      return localStorage.getItem(OPERATOR_KEY) ?? "";
    } catch {
      return "";
    }
  });

  const salvar = useCallback((v: string) => {
    setOperador(v);
    try {
      localStorage.setItem(OPERATOR_KEY, v);
    } catch {
      /* armazenamento indisponível: a execução segue como "sistema". */
    }
  }, []);

  return { operador, setOperador: salvar };
};

export const useReasoningMetrics = () => {
  const [data, setData] = useState<ReasoningMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    setLoading(true);
    const r = await reasoningContainer.getMetrics();
    setData(r.ok ? (r.value as ReasoningMetrics) : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { data, loading, recarregar };
};

/** Nós disponíveis para análise (fatos primeiro — são a raiz do raciocínio). */
export const useAnalysableNodes = () => {
  const [snapshot, setSnapshot] = useState<ReasoningSnapshot | null>(null);

  useEffect(() => {
    void (async () => {
      const r = await reasoningContainer.loadSnapshot();
      setSnapshot(r.ok ? (r.value as ReasoningSnapshot) : null);
    })();
  }, []);

  const nos = useMemo<readonly GraphNode[]>(() => {
    if (!snapshot) return [];
    const peso = (k: string) => (k === "fact" ? 0 : k === "knowledge-object" ? 1 : 2);
    return [...snapshot.nodes].sort(
      (a, b) => peso(a.kind) - peso(b.kind) || a.rotulo.localeCompare(b.rotulo),
    );
  }, [snapshot]);

  return { nos, snapshot };
};

/** Executor genérico com estado de carregamento e erro. */
const useAnalysis = <T>(exec: (operador: string) => Promise<{ ok: boolean; value?: AnalysisEnvelope<T>; error?: string }>) => {
  const { operador } = useReasoningOperator();
  const [resultado, setResultado] = useState<T | null>(null);
  const [execucao, setExecucao] = useState<ReasoningRun | null>(null);
  const [erro, setErro] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const executar = useCallback(async () => {
    setLoading(true);
    setErro("");
    const r = await exec(operador);
    if (r.ok) {
      setResultado((r.value as AnalysisEnvelope<T>).resultado);
      setExecucao((r.value as AnalysisEnvelope<T>).execucao);
    } else {
      setResultado(null);
      setExecucao(null);
      setErro(r.error ?? "Falha ao executar a análise.");
    }
    setLoading(false);
  }, [exec, operador]);

  return { resultado, execucao, erro, loading, executar };
};

export const useBrokenKnowledge = () => {
  const exec = useCallback((op: string) => reasoningContainer.detectBroken(op), []);
  const a = useAnalysis<BrokenReport>(exec);
  useEffect(() => {
    void a.executar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return a;
};

export const useConfidenceReport = () => {
  const exec = useCallback((op: string) => reasoningContainer.confidence(op), []);
  const a = useAnalysis<ConfidenceReportSummary>(exec);
  useEffect(() => {
    void a.executar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return a;
};

export const useCoverageReport = () => {
  const exec = useCallback((op: string) => reasoningContainer.coverage(op), []);
  const a = useAnalysis<CoverageReport>(exec);
  useEffect(() => {
    void a.executar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return a;
};

export const useSuggestions = () => {
  const exec = useCallback((op: string) => reasoningContainer.suggestions(op), []);
  const a = useAnalysis<readonly KnowledgeSuggestion[]>(exec);
  useEffect(() => {
    void a.executar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return a;
};

export const useImpactAnalysis = (alvo: string, profundidade: number) => {
  const exec = useCallback(
    (op: string) => reasoningContainer.analyzeImpact(alvo, op, profundidade),
    [alvo, profundidade],
  );
  return useAnalysis<ImpactAnalysis>(exec);
};

export const useChangeSimulation = (alvo: string, tipo: SimulationKind) => {
  const exec = useCallback(
    (op: string) => reasoningContainer.simulate(alvo, op, tipo),
    [alvo, tipo],
  );
  return useAnalysis<CascadeReport>(exec);
};

export const useReasoningAudit = (limit = 100) => {
  const [items, setItems] = useState<readonly ReasoningRun[]>([]);
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    setLoading(true);
    const r = await reasoningContainer.listAudit(limit);
    setItems(r.ok ? r.value.items : []);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { items, loading, recarregar };
};