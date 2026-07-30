/** Auditoria imutável: quem publicou, quando, versão, hash, tempo e resultado. */
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PUBLICATION_ACTION_LABEL } from "@/modules/intelligence/domain/publishing/Publication";
import { usePublicationAudit } from "@/modules/intelligence/presentation/hooks/usePublishing";

const PublishingAudit = () => {
  const { items, loading } = usePublicationAudit();

  if (loading) return <p className="text-sm text-muted-foreground">Carregando auditoria...</p>;
  if (items.length === 0)
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Nenhum evento registrado. Todo evento gravado aqui é permanente.
      </Card>
    );

  return (
    <div className="space-y-2">
      {items.map((r) => (
        <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {PUBLICATION_ACTION_LABEL[r.acao]} · /{r.slug || "sem-slug"}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(r.registradoEm).toLocaleString("pt-BR")} · {r.autorId} ·{" "}
              {r.versao ? `v${r.versao}` : "sem versão"} · {r.duracaoMs} ms
              {r.hash ? ` · hash ${r.hash}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">{r.mensagem}</p>
            {r.itensBloqueantes.length > 0 && (
              <p className="text-xs text-destructive">
                Bloqueios: {r.itensBloqueantes.join("; ")}
              </p>
            )}
          </div>
          <Badge variant="outline" className={r.sucesso ? "text-emerald-600" : "text-destructive"}>
            {r.sucesso ? "Sucesso" : "Falha"}
          </Badge>
        </Card>
      ))}
    </div>
  );
};

export default PublishingAudit;