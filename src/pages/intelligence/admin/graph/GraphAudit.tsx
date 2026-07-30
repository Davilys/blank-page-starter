/** Trilha de auditoria append-only do Knowledge Graph. */
import { Card } from "@/components/ui/card";
import { GRAPH_AUDIT_ACTION_LABEL } from "@/modules/intelligence/domain/graph/audit";
import { useGraphAudit } from "@/modules/intelligence/presentation/hooks/useGraph";

const GraphAudit = () => {
  const { items, loading } = useGraphAudit(200);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Auditoria do grafo</h1>
      <p className="mt-1 max-w-2xl text-muted-foreground">
        Registro imutável: quem realizou, quando, qual relação, motivo e versão. Nada é editado
        ou apagado desta trilha.
      </p>

      {loading && <p className="mt-6 text-sm text-muted-foreground">Carregando trilha...</p>}
      {!loading && items.length === 0 && (
        <Card className="mt-6 p-8 text-center text-sm text-muted-foreground">
          Nenhuma ação registrada ainda.
        </Card>
      )}

      <ol className="mt-6 space-y-2">
        {items.map((e) => (
          <li key={e.id}>
            <Card className="p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-foreground">{GRAPH_AUDIT_ACTION_LABEL[e.acao] ?? e.acao}</span>
                <span className="text-muted-foreground">por {e.autorId}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(e.em).toLocaleString("pt-BR")} · v{e.versao}
                </span>
              </div>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{e.relacao}</p>
              <p className="mt-1 text-sm text-foreground">{e.motivo}</p>
              {e.alteracoes?.length ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Campos alterados: {e.alteracoes.join(", ")}
                </p>
              ) : null}
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default GraphAudit;