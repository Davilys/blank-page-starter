/** Fact Ledger — painel de fatos verificáveis. Métricas 100% reais. */
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, CalendarClock, Plus } from "lucide-react";
import { FACT_STATUSES, FACT_STATUS_LABEL } from "@/modules/intelligence/domain/facts/Fact";
import { useFactMetrics } from "@/modules/intelligence/presentation/hooks/useFacts";
import { FactStatusBadge } from "@/modules/intelligence/presentation/components/facts/FactBadges";

const FactsDashboard = () => {
  const { data, loading } = useFactMetrics();

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fact Ledger</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Um Knowledge Object explica; um Fato afirma. Cada afirmação carrega fonte, vigência,
            versão, confiabilidade calculada, relacionamentos, objetos afetados, última
            validação e revisor.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="../fatos">Ver fatos</Link>
          </Button>
          <Button asChild>
            <Link to="../fatos/novo">
              <Plus className="mr-1.5 h-4 w-4" /> Novo fato
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total de fatos</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{loading ? "—" : data?.total ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Confiabilidade média (vigentes)
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {loading ? "—" : data?.confiancaMedia ?? 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Revalidações vencidas
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {loading ? "—" : data?.validacoesVencidas.length ?? 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Fatos sem objeto vinculado
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {loading ? "—" : data?.semObjetoAfetado ?? 0}
          </p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {FACT_STATUSES.map((s) => (
          <Card key={s} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {FACT_STATUS_LABEL[s]}
            </p>
            <p className="mt-1 text-xl font-bold text-foreground">
              {loading ? "—" : data?.porStatus[s] ?? 0}
            </p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <CalendarClock className="h-4 w-4" /> Aguardando revalidação
          </h2>
          {!data || data.validacoesVencidas.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhuma revalidação vencida. Ledger em dia.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.validacoesVencidas.slice(0, 8).map((f) => (
                <li key={f.id}>
                  <Link
                    to={`../fatos/${f.id}`}
                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted"
                  >
                    <span className="flex-1 truncate text-foreground">{f.enunciado}</span>
                    <FactStatusBadge status={f.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4" /> Contradições declaradas
          </h2>
          {!data || data.contradicoes.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhuma contradição registrada entre fatos.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.contradicoes.map((f) => (
                <li key={f.id}>
                  <Link
                    to={`../fatos/${f.id}`}
                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted"
                  >
                    <span className="flex-1 truncate text-foreground">{f.enunciado}</span>
                    <FactStatusBadge status={f.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};

export default FactsDashboard;