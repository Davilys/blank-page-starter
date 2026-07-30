/** Painel executivo do Reasoning Engine. Todas as métricas são calculadas. */
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Activity, AlertTriangle, Clock, Gauge } from "lucide-react";
import { ANALYSIS_KIND_LABEL } from "@/modules/intelligence/domain/reasoning/Reasoning";
import { useReasoningMetrics } from "@/modules/intelligence/presentation/hooks/useReasoning";

const Metric = ({ rotulo, valor }: { rotulo: string; valor: string | number }) => (
  <Card className="p-4">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
    <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{valor}</p>
  </Card>
);

const ReasoningDashboard = () => {
  const { data, loading } = useReasoningMetrics();
  const v = (n?: number) => (loading || !data ? "—" : String(n ?? 0));

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric rotulo="Análises disponíveis" valor={v(data?.analisesDisponiveis)} />
        <Metric rotulo="Análises executadas" valor={v(data?.analisesExecutadas)} />
        <Metric rotulo="Impactos encontrados" valor={v(data?.impactosEncontrados)} />
        <Metric rotulo="Inconsistências" valor={v(data?.inconsistencias)} />
        <Metric rotulo="Conhecimentos afetados" valor={v(data?.conhecimentosAfetados)} />
        <Metric rotulo="Fatos críticos" valor={v(data?.fatosCriticos)} />
        <Metric rotulo="Relações inválidas" valor={v(data?.relacoesInvalidas)} />
        <Metric rotulo="Objetos órfãos" valor={v(data?.objetosOrfaos)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <Gauge className="h-4 w-4" /> Health Score estrutural
          </h2>
          <p className="mt-3 text-4xl font-bold tabular-nums text-foreground">
            {loading || !data ? "—" : `${data.healthScore}%`}
          </p>
          <Progress value={data?.healthScore ?? 0} className="mt-3" />
          <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
            <li>Confiança média dos objetos: <strong>{v(data?.confiancaMedia)}%</strong></li>
            <li>Cobertura média por entidade: <strong>{v(data?.coberturaMedia)}%</strong></li>
            <li>Nós no grafo: <strong>{v(data?.totalNos)}</strong></li>
            <li>Relações mapeadas: <strong>{v(data?.totalRelacoes)}</strong></li>
          </ul>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <Clock className="h-4 w-4" /> Execuções recentes
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tempo médio por análise: <strong>{v(data?.tempoMedioMs)} ms</strong>
            {data?.ultimaExecucao
              ? ` · última em ${new Date(data.ultimaExecucao.executadoEm).toLocaleString("pt-BR")}`
              : ""}
          </p>

          {!data || data.recentes.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Nenhuma análise executada ainda. Comece pelo{" "}
              <Link className="text-primary underline" to="impacto">
                Impact Analysis
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {data.recentes.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium text-foreground">
                    {ANALYSIS_KIND_LABEL[r.tipo]}
                  </span>
                  <span className="flex-1 truncate text-muted-foreground">{r.resumo}</span>
                  <span className="tabular-nums text-xs text-muted-foreground">
                    {r.duracaoMs} ms
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <AlertTriangle className="h-4 w-4" /> Como ler estes números
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O Health Score parte da média entre confiança dos objetos e cobertura das entidades e
          desconta cada inconsistência estrutural encontrada — inconsistências críticas pesam
          mais. Nenhuma análise altera dados: todas rodam sobre um snapshot em memória.
        </p>
      </Card>
    </div>
  );
};

export default ReasoningDashboard;