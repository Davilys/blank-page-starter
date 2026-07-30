/** Impact Analysis — "se este fato cair, o que quebra?". */
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { ImpactedNode } from "@/modules/intelligence/application/use-cases/graph/analyzeImpact";
import { useGraphNodes, useImpactAnalysis } from "@/modules/intelligence/presentation/hooks/useGraph";
import {
  NodeKindBadge,
  NodeStatusBadge,
} from "@/modules/intelligence/presentation/components/graph/GraphBadges";
import NodePicker from "@/modules/intelligence/presentation/components/graph/NodePicker";

const SEVERITY_LABEL: Record<string, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const Lista = ({ titulo, itens, vazio }: { titulo: string; itens: readonly ImpactedNode[]; vazio: string }) => (
  <Card className="p-4">
    <p className="text-sm font-semibold text-foreground">
      {titulo} <span className="text-muted-foreground">({itens.length})</span>
    </p>
    {itens.length === 0 && <p className="mt-2 text-sm text-muted-foreground">{vazio}</p>}
    <ul className="mt-3 space-y-2">
      {itens.map((i) => (
        <li key={i.no.id} className="rounded-lg border border-border p-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <NodeKindBadge kind={i.no.kind} />
            <NodeStatusBadge status={i.no.status} />
            <span className="text-xs text-muted-foreground">
              nível {i.profundidade} · via {i.viaRelacao}
              {i.peso > 0 ? ` · peso ${i.peso}` : ""}
            </span>
          </div>
          <Link
            to={`/intelligence/admin/graph/explorer?no=${encodeURIComponent(i.no.id)}`}
            className="mt-1 block truncate text-sm font-medium text-foreground hover:text-primary"
          >
            {i.no.rotulo}
          </Link>
        </li>
      ))}
    </ul>
  </Card>
);

const GraphImpact = () => {
  const [params, setParams] = useSearchParams();
  const alvo = params.get("no");
  const [profundidade, setProfundidade] = useState(3);

  const { items: nodes } = useGraphNodes({});
  const { data, loading } = useImpactAnalysis(alvo, profundidade);

  const escolher = (id: string) => {
    params.set("no", id);
    setParams(params, { replace: true });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Impact Analysis</h1>
      <p className="mt-1 max-w-2xl text-muted-foreground">
        Selecione um Fato ou Knowledge Object e veja exatamente o que depende dele, quais respostas
        e FAQs seriam afetadas, quais entidades sofrem impacto e quais relações ficariam inválidas.
      </p>

      <Card className="mt-6 grid gap-3 p-4 sm:grid-cols-[1fr_180px]">
        <div>
          <Label className="text-xs">Nó analisado</Label>
          <NodePicker nodes={nodes} value={alvo ?? ""} onChange={escolher} placeholder="Selecionar fato ou objeto" />
        </div>
        <div>
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
      </Card>

      {loading && <p className="mt-6 text-sm text-muted-foreground">Calculando impacto...</p>}

      {data && (
        <>
          <Card className="mt-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5">
                  <NodeKindBadge kind={data.alvo.kind} />
                  <span className="text-lg font-semibold text-foreground">{data.alvo.rotulo}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.dependentesDiretos.length} dependentes diretos ·{" "}
                  {data.dependentesIndiretos.length} indiretos ·{" "}
                  {data.entidadesImpactadas.length} entidades
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Severidade</p>
                <p
                  className={`text-2xl font-bold ${
                    data.severidade === "critica" || data.severidade === "alta"
                      ? "text-destructive"
                      : "text-foreground"
                  }`}
                >
                  {SEVERITY_LABEL[data.severidade]}
                </p>
              </div>
            </div>
          </Card>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Lista titulo="Dependentes diretos" itens={data.dependentesDiretos} vazio="Nada depende diretamente deste nó." />
            <Lista titulo="Dependentes indiretos" itens={data.dependentesIndiretos} vazio="Nenhuma propagação indireta." />
            <Lista titulo="Knowledge Objects afetados" itens={data.objetosAfetados} vazio="Nenhum objeto vinculado." />
            <Lista titulo="Perguntas / FAQs afetadas" itens={data.faqsAfetadas} vazio="Nenhuma pergunta vinculada." />
            <Lista titulo="Respostas afetadas" itens={data.respostasAfetadas} vazio="Nenhuma resposta vinculada." />

            <Card className="p-4">
              <p className="text-sm font-semibold text-foreground">Entidades impactadas</p>
              {data.entidadesImpactadas.length === 0 && (
                <p className="mt-2 text-sm text-muted-foreground">Nenhuma entidade declarada nos nós afetados.</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {data.entidadesImpactadas.map((e) => (
                  <span key={e} className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                    {e}
                  </span>
                ))}
              </div>
            </Card>
          </div>

          <Card className="mt-4 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Relações que ficariam inválidas se este nó for removido (
              {data.relacoesQueFicamInvalidas.length})
            </p>
            {data.relacoesJaInvalidas.length > 0 && (
              <p className="mt-1 text-xs text-destructive">
                {data.relacoesJaInvalidas.length} já estão inválidas hoje.
              </p>
            )}
            <ul className="mt-3 space-y-1.5">
              {data.relacoesQueFicamInvalidas.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{e.tipo}</span>
                  <span className="truncate">{e.origem}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="truncate">{e.destino}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
};

export default GraphImpact;