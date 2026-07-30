/** Lista mestre de relações com filtros, transições de status e remoção auditada. */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { EdgeFilter } from "@/modules/intelligence/application/ports/graph";
import {
  EDGE_STATUSES,
  EDGE_STATUS_LABEL,
  EDGE_TYPES,
  EDGE_TYPE_LABEL,
  type EdgeStatus,
  type EdgeType,
  type GraphEdge,
} from "@/modules/intelligence/domain/graph/GraphEdge";
import {
  useGraphCommands,
  useGraphEdges,
  useGraphUniverse,
} from "@/modules/intelligence/presentation/hooks/useGraph";
import {
  EdgeStatusBadge,
  EdgeTypeBadge,
  WeightBadge,
} from "@/modules/intelligence/presentation/components/graph/GraphBadges";
import EdgeForm from "@/modules/intelligence/presentation/components/graph/EdgeForm";

const TODOS = "__todos__";

const GraphRelations = () => {
  const [filter, setFilter] = useState<EdgeFilter>({});
  const [dialogo, setDialogo] = useState(false);
  const [edicao, setEdicao] = useState<GraphEdge | null>(null);
  const [autor, setAutor] = useState("");

  const { items, nodes, loading, recarregar } = useGraphEdges(filter);
  const { data: universo, recarregar: recarregarUniverso } = useGraphUniverse();
  const { mudarStatus, removerRelacao, salvando } = useGraphCommands();

  const rotulo = (id: string) => nodes.find((n) => n.id === id)?.rotulo ?? id;
  const setF = (p: Partial<EdgeFilter>) => setFilter((f) => ({ ...f, ...p }));
  const pick = (v: string) => (v === TODOS ? undefined : v);

  const atualizar = () => {
    void recarregar();
    void recarregarUniverso();
  };

  const transicionar = async (edge: GraphEdge, status: EdgeStatus) => {
    if (!autor.trim()) {
      toast({ title: "Informe seu identificador", description: "A auditoria exige quem realizou a ação.", variant: "destructive" });
      return;
    }
    const motivo = window.prompt(`Motivo para marcar como "${EDGE_STATUS_LABEL[status]}":`) ?? "";
    if (!motivo.trim()) return;
    const r = await mudarStatus({ id: edge.id, status, autorId: autor, motivo });
    if (!r.ok) {
      toast({ title: "Não foi possível alterar", description: r.error as string, variant: "destructive" });
      return;
    }
    toast({ title: "Status atualizado", description: "Ação registrada na auditoria." });
    atualizar();
  };

  const remover = async (edge: GraphEdge) => {
    if (!autor.trim()) {
      toast({ title: "Informe seu identificador", description: "A auditoria exige quem realizou a ação.", variant: "destructive" });
      return;
    }
    const motivo = window.prompt("Motivo da remoção da relação:") ?? "";
    if (!motivo.trim()) return;
    const r = await removerRelacao(edge.id, autor, motivo);
    if (!r.ok) {
      toast({ title: "Não foi possível remover", description: r.error as string, variant: "destructive" });
      return;
    }
    toast({ title: "Relação removida", description: "Registro preservado na auditoria." });
    atualizar();
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relações</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Cada aresta carrega origem, destino, tipo, direção, peso, confiança, fonte,
            justificativa, autor, datas, validação e status.
          </p>
        </div>
        <Button
          onClick={() => {
            setEdicao(null);
            setDialogo(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Nova relação
        </Button>
      </div>

      <Card className="mt-6 space-y-3 p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Buscar por nó ou justificativa"
            value={filter.texto ?? ""}
            onChange={(e) => setF({ texto: e.target.value || undefined })}
          />
          <Select value={filter.tipo ?? TODOS} onValueChange={(v) => setF({ tipo: pick(v) as EdgeType })}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={TODOS}>Todos os tipos</SelectItem>
              {EDGE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{EDGE_TYPE_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filter.status ?? TODOS} onValueChange={(v) => setF({ status: pick(v) as EdgeStatus })}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os status</SelectItem>
              {EDGE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{EDGE_STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Seu identificador (auditoria)"
            value={autor}
            onChange={(e) => setAutor(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={filter.semFonte ? "default" : "outline"}
            onClick={() => setF({ semFonte: !filter.semFonte || undefined })}
          >
            Sem fonte
          </Button>
          <Button
            size="sm"
            variant={filter.vencidas ? "default" : "outline"}
            onClick={() => setF({ vencidas: !filter.vencidas || undefined })}
          >
            Revalidação vencida
          </Button>
        </div>
      </Card>

      <div className="mt-4 space-y-2">
        {loading && <p className="text-sm text-muted-foreground">Carregando relações...</p>}
        {!loading && items.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma relação registrada com estes filtros.
          </Card>
        )}
        {items.map((r) => (
          <Card key={r.edge.id} className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <EdgeTypeBadge tipo={r.edge.tipo} />
              <EdgeStatusBadge status={r.edge.status} />
              {r.vencida && <span className="text-xs text-destructive">revalidação vencida</span>}
              {!r.valida && <span className="text-xs text-destructive">estruturalmente inválida</span>}
              <span className="ml-auto text-xs text-muted-foreground">v{r.edge.versao}</span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-foreground">{rotulo(r.edge.origem)}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium text-foreground">{rotulo(r.edge.destino)}</span>
              <span className="text-xs text-muted-foreground">
                ({r.edge.direcao === "bidirecional" ? "bidirecional" : "dirigida"})
              </span>
            </div>

            <p className="mt-1.5 text-sm text-muted-foreground">{r.edge.justificativa}</p>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <WeightBadge peso={r.edge.peso} confianca={r.edge.confianca} />
              <span>por {r.edge.criadoPor}</span>
              <span>criada em {new Date(r.edge.criadoEm).toLocaleDateString("pt-BR")}</span>
              <span>
                validação:{" "}
                {r.edge.ultimaValidacaoEm
                  ? `${new Date(r.edge.ultimaValidacaoEm).toLocaleDateString("pt-BR")} por ${r.edge.revisorId}`
                  : "nunca"}
              </span>
              {r.edge.fonte?.titulo && (
                <span>
                  fonte: {r.edge.fonte.titulo}
                  {r.edge.fonte.dispositivo ? `, ${r.edge.fonte.dispositivo}` : ""}
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEdicao(r.edge);
                  setDialogo(true);
                }}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
              </Button>
              {r.edge.status !== "ativa" && (
                <Button size="sm" disabled={salvando} onClick={() => transicionar(r.edge, "ativa")}>
                  Aprovar / validar
                </Button>
              )}
              {r.edge.status === "ativa" && (
                <Button size="sm" variant="outline" disabled={salvando} onClick={() => transicionar(r.edge, "suspensa")}>
                  Suspender
                </Button>
              )}
              <Button size="sm" variant="outline" disabled={salvando} onClick={() => transicionar(r.edge, "invalida")}>
                Marcar inválida
              </Button>
              <Button size="sm" variant="outline" disabled={salvando} onClick={() => transicionar(r.edge, "arquivada")}>
                Arquivar
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remover(r.edge)}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remover
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <EdgeForm
        aberto={dialogo}
        onFechar={() => setDialogo(false)}
        nodes={universo?.nodes ?? []}
        edges={universo?.edges ?? []}
        edicao={edicao}
        onSalvo={atualizar}
      />
    </div>
  );
};

export default GraphRelations;