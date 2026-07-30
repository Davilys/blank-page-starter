/**
 * Graph Explorer — listas estruturadas (sem visualização gráfica, por decisão
 * desta fase). Busca um nó, lista relações, filtra e mostra profundidade.
 */
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeftRight, ArrowRight, ExternalLink, Plus, Radar } from "lucide-react";
import {
  EDGE_TYPES,
  EDGE_TYPE_LABEL,
  type EdgeType,
} from "@/modules/intelligence/domain/graph/GraphEdge";
import {
  NODE_KINDS,
  NODE_KIND_LABEL,
  NODE_STATUSES,
  NODE_STATUS_LABEL,
  type NodeKind,
  type NodeStatus,
} from "@/modules/intelligence/domain/graph/GraphNode";
import {
  useGraphNodes,
  useGraphUniverse,
  useNodeExploration,
} from "@/modules/intelligence/presentation/hooks/useGraph";
import {
  EdgeStatusBadge,
  EdgeTypeBadge,
  NodeKindBadge,
  NodeStatusBadge,
  WeightBadge,
} from "@/modules/intelligence/presentation/components/graph/GraphBadges";
import EdgeForm from "@/modules/intelligence/presentation/components/graph/EdgeForm";

const TODOS = "__todos__";

const GraphExplorer = () => {
  const [params, setParams] = useSearchParams();
  const selecionado = params.get("no");

  const [texto, setTexto] = useState("");
  const [kind, setKind] = useState<NodeKind | undefined>();
  const [status, setStatus] = useState<NodeStatus | undefined>();
  const [apenasOrfaos, setApenasOrfaos] = useState(false);
  const [tipoRelacao, setTipoRelacao] = useState<EdgeType | undefined>();
  const [profundidade, setProfundidade] = useState(2);
  const [dialogo, setDialogo] = useState(false);

  const { items: nos, loading } = useGraphNodes({ texto, kind, status, apenasOrfaos });
  const { data: universo, recarregar: recarregarUniverso } = useGraphUniverse();
  const tipos = useMemo(() => (tipoRelacao ? [tipoRelacao] : []), [tipoRelacao]);
  const { data: exploracao, erro, recarregar } = useNodeExploration(selecionado, tipos, profundidade);

  const selecionar = (id: string) => {
    params.set("no", id);
    setParams(params, { replace: true });
  };

  const pick = (v: string) => (v === TODOS ? undefined : v);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Graph Explorer</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Navegação por listas estruturadas. Selecione um nó para ver relações, dependências e
            profundidade de alcance.
          </p>
        </div>
        <Button onClick={() => setDialogo(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Nova relação
        </Button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card className="p-4">
          <p className="text-sm font-semibold text-foreground">Nós ({nos.length})</p>
          <div className="mt-3 space-y-2">
            <Input placeholder="Buscar nó" value={texto} onChange={(e) => setTexto(e.target.value)} />
            <Select value={kind ?? TODOS} onValueChange={(v) => setKind(pick(v) as NodeKind)}>
              <SelectTrigger><SelectValue placeholder="Tipo de nó" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={TODOS}>Todos os tipos</SelectItem>
                {NODE_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>{NODE_KIND_LABEL[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status ?? TODOS} onValueChange={(v) => setStatus(pick(v) as NodeStatus)}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os status</SelectItem>
                {NODE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{NODE_STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={apenasOrfaos ? "default" : "outline"}
              size="sm"
              className="w-full"
              onClick={() => setApenasOrfaos((v) => !v)}
            >
              Apenas órfãos
            </Button>
          </div>

          <div className="mt-3 max-h-[520px] space-y-1 overflow-y-auto pr-1">
            {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {!loading && nos.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum nó. Crie Knowledge Objects ou Fatos — eles aparecem aqui automaticamente.
              </p>
            )}
            {nos.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => selecionar(n.id)}
                className={`w-full rounded-md border p-2 text-left transition-colors ${
                  n.id === selecionado ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                }`}
              >
                <p className="truncate text-sm font-medium text-foreground">{n.rotulo}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <NodeKindBadge kind={n.kind} />
                  <NodeStatusBadge status={n.status} />
                </p>
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <Label className="text-xs">Filtrar por tipo de relação</Label>
                <Select value={tipoRelacao ?? TODOS} onValueChange={(v) => setTipoRelacao(pick(v) as EdgeType)}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value={TODOS}>Todas as relações</SelectItem>
                    {EDGE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{EDGE_TYPE_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40">
                <Label className="text-xs">Profundidade</Label>
                <Select value={String(profundidade)} onValueChange={(v) => setProfundidade(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((d) => (
                      <SelectItem key={d} value={String(d)}>{d} nível(is)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {!selecionado && (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Selecione um nó à esquerda para explorar suas conexões.
            </Card>
          )}

          {erro && <Card className="p-4 text-sm text-destructive">{erro}</Card>}

          {exploracao && (
            <>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{exploracao.no.rotulo}</h2>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <NodeKindBadge kind={exploracao.no.kind} />
                      <NodeStatusBadge status={exploracao.no.status} />
                      <span>origem: {exploracao.no.origem}</span>
                      {exploracao.no.entidade && <span>· entidade: {exploracao.no.entidade}</span>}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {exploracao.no.rota && (
                      <Button variant="outline" size="sm" asChild>
                        <Link to={exploracao.no.rota}>
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Abrir origem
                        </Link>
                      </Button>
                    )}
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/intelligence/admin/graph/impacto?no=${encodeURIComponent(exploracao.no.id)}`}>
                        <Radar className="mr-1.5 h-3.5 w-3.5" /> Analisar impacto
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="text-xl font-bold text-foreground">{exploracao.relacoes.length}</p>
                    <p className="text-xs text-muted-foreground">Relações</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="text-xl font-bold text-foreground">{exploracao.totalAtivas}</p>
                    <p className="text-xs text-muted-foreground">Ativas</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="text-xl font-bold text-foreground">{exploracao.profundidadeMaxima}</p>
                    <p className="text-xs text-muted-foreground">Profundidade alcançada</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <p className="text-sm font-semibold text-foreground">Relações diretas</p>
                {exploracao.relacoes.length === 0 && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nó isolado. Nenhuma informação deveria permanecer sem vínculo.
                  </p>
                )}
                <ul className="mt-3 space-y-2">
                  {exploracao.relacoes.map((r) => (
                    <li key={`${r.edge.id}-${r.sentido}`} className="rounded-lg border border-border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {r.sentido === "saida" ? (
                          <ArrowRight className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <EdgeTypeBadge tipo={r.edge.tipo} />
                        <EdgeStatusBadge status={r.edge.status} />
                        {r.vencida && <span className="text-xs text-destructive">revalidação vencida</span>}
                        {!r.valida && <span className="text-xs text-destructive">estruturalmente inválida</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => r.outro && selecionar(r.outro.id)}
                        className="mt-1.5 block text-left text-sm font-medium text-foreground hover:text-primary"
                      >
                        {r.sentido === "saida" ? "→ " : "← "}
                        {r.outro ? r.outro.rotulo : `${r.edge.destino} (nó inexistente)`}
                      </button>
                      <p className="mt-1 text-xs text-muted-foreground">{r.edge.justificativa}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3">
                        <WeightBadge peso={r.edge.peso} confianca={r.edge.confianca} />
                        {r.edge.fonte?.titulo && (
                          <span className="text-xs text-muted-foreground">
                            fonte: {r.edge.fonte.titulo}
                            {r.edge.fonte.dispositivo ? `, ${r.edge.fonte.dispositivo}` : ""}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="p-4">
                  <p className="text-sm font-semibold text-foreground">
                    Vizinhança até {profundidade} nível(is)
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {exploracao.vizinhanca.length === 0 && (
                      <li className="text-sm text-muted-foreground">Sem alcance.</li>
                    )}
                    {exploracao.vizinhanca.map((v) => (
                      <li key={v.entry.id} className="flex items-center justify-between text-sm">
                        <button
                          type="button"
                          className="truncate text-left text-foreground hover:text-primary"
                          onClick={() => selecionar(v.entry.id)}
                        >
                          {v.no?.rotulo ?? v.entry.id}
                        </button>
                        <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                          nível {v.entry.profundidade}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card className="p-4">
                  <p className="text-sm font-semibold text-foreground">Dependências (quem aponta para cá)</p>
                  <ul className="mt-2 space-y-1.5">
                    {exploracao.dependentes.length === 0 && (
                      <li className="text-sm text-muted-foreground">Nenhum nó depende deste.</li>
                    )}
                    {exploracao.dependentes.map((v) => (
                      <li key={v.entry.id} className="flex items-center justify-between text-sm">
                        <button
                          type="button"
                          className="truncate text-left text-foreground hover:text-primary"
                          onClick={() => selecionar(v.entry.id)}
                        >
                          {v.no?.rotulo ?? v.entry.id}
                        </button>
                        <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                          nível {v.entry.profundidade}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>

      <EdgeForm
        aberto={dialogo}
        onFechar={() => setDialogo(false)}
        nodes={universo?.nodes ?? []}
        edges={universo?.edges ?? []}
        origemInicial={selecionado ?? undefined}
        onSalvo={() => {
          void recarregar();
          void recarregarUniverso();
        }}
      />
    </div>
  );
};

export default GraphExplorer;