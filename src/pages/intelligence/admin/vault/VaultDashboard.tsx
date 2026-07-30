/** Knowledge Vault — painel operacional. Somente métricas reais. */
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, ShieldCheck } from "lucide-react";
import { VAULT_EVENT_LABEL } from "@/modules/intelligence/domain/vault/VaultFact";
import { useVaultMetrics } from "@/modules/intelligence/presentation/hooks/useVault";

const Metric = ({ rotulo, valor }: { rotulo: string; valor: string | number }) => (
  <Card className="p-4">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
    <p className="mt-1 text-2xl font-bold text-foreground">{valor}</p>
  </Card>
);

const VaultDashboard = () => {
  const { data, loading } = useVaultMetrics();
  const n = (v?: number) => (loading ? "—" : (v ?? 0));

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <ShieldCheck className="h-6 w-6" /> Knowledge Vault
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            O Vault guarda fatos, não documentos. Todo Knowledge Object publicado deverá ser
            rastreável até um ou mais fatos validados por revisão humana.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/intelligence/admin/vault/fatos">Buscar fatos</Link>
          </Button>
          <Button asChild>
            <Link to="/intelligence/admin/vault/fatos/novo">
              <Plus className="mr-1.5 h-4 w-4" /> Novo fato
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric rotulo="Total de fatos" valor={n(data?.total)} />
        <Metric rotulo="Rascunhos" valor={n(data?.porStatus.rascunho)} />
        <Metric rotulo="Validados" valor={n(data?.porStatus.validado)} />
        <Metric rotulo="Obsoletos" valor={n(data?.porStatus.obsoleto)} />
        <Metric rotulo="Sem revisão" valor={n(data?.semRevisao)} />
        <Metric rotulo="Sem fonte primária" valor={n(data?.semFontePrimaria)} />
        <Metric rotulo="Sem objeto consumidor" valor={n(data?.semObjetoConsumidor)} />
        <Metric rotulo="Com contradição declarada" valor={n(data?.comContradicao)} />
      </div>

      <Card className="mt-6 p-5">
        <h2 className="font-semibold text-foreground">Últimas alterações</h2>
        {!data || data.ultimasAlteracoes.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum evento registrado ainda.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.ultimasAlteracoes.map((e) => (
              <li key={e.id}>
                <Link
                  to={`/intelligence/admin/vault/fatos/${e.fatoId}`}
                  className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted"
                >
                  <span className="font-medium text-foreground">
                    {VAULT_EVENT_LABEL[e.tipo]}
                  </span>
                  <span className="flex-1 truncate text-muted-foreground">{e.motivo}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(e.em).toLocaleString("pt-BR")} · {e.autorId}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default VaultDashboard;