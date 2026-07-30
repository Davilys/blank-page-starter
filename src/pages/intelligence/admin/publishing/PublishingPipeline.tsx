/** Lista do pipeline: todo objeto e seu estado perante o checklist. */
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { usePublishingMetrics } from "@/modules/intelligence/presentation/hooks/usePublishing";
import {
  ScorePill,
  StatePill,
} from "@/modules/intelligence/presentation/components/publishing/PublishingBadges";

const PublishingPipeline = () => {
  const { data, loading } = usePublishingMetrics();

  if (loading) return <p className="text-sm text-muted-foreground">Carregando pipeline...</p>;
  if (!data || data.linhas.length === 0)
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Nenhum objeto disponível para publicação.
      </Card>
    );

  return (
    <div className="space-y-2">
      {data.linhas.map((l) => (
        <Card key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <Link
              to={l.id}
              className="text-sm font-medium text-foreground hover:text-primary"
            >
              {l.titulo}
            </Link>
            <p className="text-xs text-muted-foreground">
              /{l.slug || "sem-slug"} · estado editorial: {l.estado}
              {l.versaoAtiva ? ` · versão no ar: v${l.versaoAtiva}` : ""}
            </p>
            {l.bloqueios > 0 && (
              <p className="text-xs text-destructive">
                {l.bloqueios} item(ns) bloqueando a publicação.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ScorePill label="Cobertura" score={l.cobertura} />
            <ScorePill label="IA" score={l.aiReadiness} />
            <StatePill publicado={l.publicado} liberado={l.liberado} />
          </div>
        </Card>
      ))}
    </div>
  );
};

export default PublishingPipeline;