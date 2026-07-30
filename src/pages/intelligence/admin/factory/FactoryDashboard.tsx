/**
 * Knowledge Factory — dashboard (FASE 06 §8). Only real metrics.
 */
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { FileText, Plus, ShieldAlert } from "lucide-react";
import { EDITORIAL_STATES, EDITORIAL_STATE_LABEL } from "@/modules/intelligence/domain/factory/KnowledgeDraft";
import { FIELD_LABELS } from "@/modules/intelligence/domain/factory/diff";
import { useFactoryMetrics } from "@/modules/intelligence/presentation/hooks/useFactory";
import { StatusBadge } from "@/modules/intelligence/presentation/components/factory/StatusBadge";

const FactoryDashboard = () => {
  const { data, loading } = useFactoryMetrics();

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Knowledge Factory</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Fábrica de conhecimento: criação manual, revisão humana, validação e
            versionamento. Nenhum conteúdo é gerado automaticamente.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="../factory/objetos">Ver objetos</Link>
          </Button>
          <Button asChild>
            <Link to="../factory/novo">
              <Plus className="mr-1.5 h-4 w-4" /> Novo objeto
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {loading ? "—" : data?.total ?? 0}
          </p>
        </Card>
        {EDITORIAL_STATES.map((e) => (
          <Card key={e} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {EDITORIAL_STATE_LABEL[e]}
            </p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {loading ? "—" : data?.porEstado[e] ?? 0}
            </p>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold text-foreground">Aguardando revisão</h2>
          {!data || data.aguardandoRevisao.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nada na fila de revisão.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.aguardandoRevisao.map((d) => (
                <li key={d.id}>
                  <Link
                    to={`../factory/objetos/${d.id}`}
                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-foreground">{d.titulo}</span>
                    <StatusBadge estado={d.estado} />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {data && data.bloqueadosParaPublicar > 0 && (
            <p className="mt-4 flex items-center gap-2 text-sm text-destructive">
              <ShieldAlert className="h-4 w-4" />
              {data.bloqueadosParaPublicar} objeto(s) aprovado(s) com pendências de validação.
            </p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-foreground">Últimas alterações</h2>
          {!data || data.ultimasAlteracoes.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhuma alteração registrada.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {data.ultimasAlteracoes.map((v) => (
                <li key={v.id} className="text-sm">
                  <p className="text-foreground">
                    v{v.versao} · {v.resumoMudanca}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {v.autorId} · {new Date(v.registradoEm).toLocaleString("pt-BR")} ·{" "}
                    {v.diffs.map((d) => FIELD_LABELS[d.campo] ?? d.campo).slice(0, 4).join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};

export default FactoryDashboard;