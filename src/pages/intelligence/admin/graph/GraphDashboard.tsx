/**
 * FASE 09 — Graph Health. Todos os números vêm do grafo real (nós derivados
 * do Fact Ledger e da Knowledge Factory + nós manuais + arestas humanas).
 */
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertTriangle,
  GitBranch,
  Layers,
  Link2,
  Plus,
  Search,
  ShieldAlert,
  Unlink,
} from "lucide-react";
import { NODE_KIND_LABEL } from "@/modules/intelligence/domain/graph/GraphNode";
import { useGraphHealth } from "@/modules/intelligence/presentation/hooks/useGraph";

const Metric = ({
  rotulo,
  valor,
  detalhe,
  icone: Icone,
  alerta,
}: {
  rotulo: string;
  valor: string | number;
  detalhe: string;
  icone: React.ElementType;
  alerta?: boolean;
}) => (
  <Card className="p-4">
    <div className="flex items-center gap-2">
      <Icone className={alerta ? "h-4 w-4 text-destructive" : "h-4 w-4 text-primary"} />
      <p className="text-sm font-medium text-foreground">{rotulo}</p>
    </div>
    <p className={`mt-2 text-3xl font-bold ${alerta ? "text-destructive" : "text-foreground"}`}>{valor}</p>
    <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>
  </Card>
);

const GraphDashboard = () => {
  const { data, loading } = useGraphHealth();

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Knowledge Graph</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            O núcleo semântico. Objetos, fatos, fontes, leis, classes NICE e perguntas conversam
            entre si por relações explícitas — criadas e aprovadas por humanos, nunca inferidas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/intelligence/admin/graph/explorer">
              <Search className="mr-1.5 h-4 w-4" /> Explorer
            </Link>
          </Button>
          <Button asChild>
            <Link to="/intelligence/admin/graph/relacoes">
              <Plus className="mr-1.5 h-4 w-4" /> Relações
            </Link>
          </Button>
        </div>
      </div>

      {loading && <p className="mt-8 text-sm text-muted-foreground">Calculando indicadores...</p>}

      {data && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric rotulo="Nós" valor={data.totalNos} detalhe="Projetados de todos os módulos" icone={Layers} />
            <Metric rotulo="Relações" valor={data.totalEdges} detalhe={`${data.edgesAtivas} ativas`} icone={Link2} />
            <Metric
              rotulo="Profundidade média"
              valor={data.profundidadeMedia}
              detalhe="Alcance médio a partir de nós conectados"
              icone={GitBranch}
            />
            <Metric
              rotulo="Nós órfãos"
              valor={data.nosOrfaos.length}
              detalhe="Sem nenhuma relação registrada"
              icone={Unlink}
              alerta={data.nosOrfaos.length > 0}
            />
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              rotulo="Relações inválidas"
              valor={data.edgesInvalidas.length}
              detalhe="Referências quebradas ou marcadas como inválidas"
              icone={ShieldAlert}
              alerta={data.edgesInvalidas.length > 0}
            />
            <Metric
              rotulo="Sem fonte"
              valor={data.edgesSemFonte.length}
              detalhe="Tipos que exigem fonte declarada"
              icone={AlertTriangle}
              alerta={data.edgesSemFonte.length > 0}
            />
            <Metric
              rotulo="Vencidas"
              valor={data.edgesVencidas.length}
              detalhe="Passaram da periodicidade de revalidação"
              icone={AlertTriangle}
              alerta={data.edgesVencidas.length > 0}
            />
            <Metric
              rotulo="Sem revisão"
              valor={data.edgesSemRevisao.length}
              detalhe="Nunca validadas por um revisor"
              icone={AlertTriangle}
              alerta={data.edgesSemRevisao.length > 0}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <p className="text-sm font-semibold text-foreground">Composição por tipo de nó</p>
              {data.porTipoDeNo.length === 0 && (
                <p className="mt-2 text-sm text-muted-foreground">Nenhum nó no grafo ainda.</p>
              )}
              <ul className="mt-3 space-y-1.5">
                {data.porTipoDeNo.map((r) => (
                  <li key={r.kind} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{NODE_KIND_LABEL[r.kind]}</span>
                    <span className="font-medium text-foreground">{r.total}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-4">
              <p className="text-sm font-semibold text-foreground">Cobertura por entidade</p>
              {data.cobertura.length === 0 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Nenhuma entidade declarada nos módulos de origem.
                </p>
              )}
              <ul className="mt-3 space-y-2">
                {data.cobertura.map((c) => (
                  <li key={c.entidade}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate text-foreground">{c.entidade}</span>
                      <span className="text-muted-foreground">
                        {c.conectados}/{c.nos} · {c.cobertura}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted">
                      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${c.cobertura}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {data.nosOrfaos.length > 0 && (
            <Card className="mt-4 p-4">
              <p className="text-sm font-semibold text-foreground">
                Nós órfãos ({data.nosOrfaos.length}) — nenhuma informação deve permanecer isolada
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.nosOrfaos.slice(0, 40).map((n) => (
                  <Link
                    key={n.id}
                    to={`/intelligence/admin/graph/explorer?no=${encodeURIComponent(n.id)}`}
                    className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
                  >
                    {NODE_KIND_LABEL[n.kind]} · {n.rotulo}
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default GraphDashboard;