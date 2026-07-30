/** Versões atualmente no ar. Cada linha é um snapshot imutável servido ao público. */
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { usePublishedVersions } from "@/modules/intelligence/presentation/hooks/usePublishing";

const PublishingPublished = () => {
  const { items, loading } = usePublishedVersions();

  if (loading) return <p className="text-sm text-muted-foreground">Carregando publicações...</p>;
  if (items.length === 0)
    return <Card className="p-6 text-sm text-muted-foreground">Nada publicado ainda.</Card>;

  return (
    <div className="space-y-2">
      {items.map((v) => (
        <Card key={v.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <Link
              to={`../pipeline/${v.objetoId}`}
              className="text-sm font-medium text-foreground hover:text-primary"
            >
              {v.titulo}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{v.canonical}</p>
          </div>
          <p className="text-xs tabular-nums text-muted-foreground">
            v{v.versao} · {new Date(v.publicadoEm).toLocaleString("pt-BR")} · {v.autorId} ·{" "}
            <code>{v.hash}</code>
          </p>
        </Card>
      ))}
    </div>
  );
};

export default PublishingPublished;