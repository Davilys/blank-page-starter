/** Painel executivo da publicação. Todas as métricas são calculadas. */
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Gauge } from "lucide-react";
import { usePublishingMetrics } from "@/modules/intelligence/presentation/hooks/usePublishing";
import {
  ScorePill,
  StatePill,
} from "@/modules/intelligence/presentation/components/publishing/PublishingBadges";

const Metric = ({ rotulo, valor }: { rotulo: string; valor: string | number }) => (
  <Card className="p-4">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
    <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{valor}</p>
  </Card>
);

const PublishingDashboard = () => {
  const { data, loading } = usePublishingMetrics();
  const v = (n?: number) => (loading || !data ? "—" : String(n ?? 0));

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric rotulo="Objetos publicáveis" valor={v(data?.publicaveis)} />
        <Metric rotulo="Objetos publicados" valor={v(data?.publicados)} />
        <Metric rotulo="Objetos pendentes" valor={v(data?.pendentes)} />
        <Metric rotulo="Objetos arquivados" valor={v(data?.arquivados)} />
        <Metric
          rotulo="Última publicação"
          valor={
            data?.ultimaPublicacao
              ? new Date(data.ultimaPublicacao).toLocaleString("pt-BR")
              : "—"
          }
        />
        <Metric rotulo="Tempo médio" valor={`${v(data?.tempoMedioMs)} ms`} />
        <Metric rotulo="Falhas" valor={v(data?.falhas)} />
        <Metric rotulo="Cobertura pública" valor={`${v(data?.coberturaPublica)}%`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <Gauge className="h-4 w-4" /> Health Score de publicação
          </h2>
          <p className="mt-3 text-4xl font-bold tabular-nums text-foreground">
            {loading || !data ? "—" : `${data.healthScore}%`}
          </p>
          <Progress value={data?.healthScore ?? 0} className="mt-3" />
          <p className="mt-3 text-sm text-muted-foreground">
            Combina proporção publicada, cobertura pública e legibilidade para IA, descontando
            falhas registradas na auditoria.
          </p>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="font-semibold text-foreground">Fila de publicação</h2>
          {!data || data.linhas.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Nenhum objeto disponível. Crie objetos na{" "}
              <Link className="text-primary underline" to="/intelligence/admin/factory">
                Knowledge Factory
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {data.linhas.slice(0, 8).map((l) => (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <Link
                      to={`pipeline/${l.id}`}
                      className="truncate text-sm font-medium text-foreground hover:text-primary"
                    >
                      {l.titulo}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      /{l.slug || "sem-slug"} · {l.categoria || "sem categoria"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ScorePill label="Cobertura" score={l.cobertura} />
                    <ScorePill label="IA" score={l.aiReadiness} />
                    <StatePill publicado={l.publicado} liberado={l.liberado} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};

export default PublishingDashboard;