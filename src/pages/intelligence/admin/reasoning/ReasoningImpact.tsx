/** ENGINE 1 — Impact Analysis com árvore, breadcrumb e listas por tipo. */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Radar } from "lucide-react";
import { NODE_KIND_LABEL } from "@/modules/intelligence/domain/graph/GraphNode";
import type { ImpactHit } from "@/modules/intelligence/domain/reasoning/impact";
import { ImpactTree } from "@/modules/intelligence/presentation/components/reasoning/ImpactTree";
import { NodePicker } from "@/modules/intelligence/presentation/components/reasoning/NodePicker";
import { SeverityBadge } from "@/modules/intelligence/presentation/components/reasoning/ReasoningBadges";
import {
  useAnalysableNodes,
  useImpactAnalysis,
} from "@/modules/intelligence/presentation/hooks/useReasoning";

const HitList = ({ titulo, itens }: { titulo: string; itens: readonly ImpactHit[] }) => (
  <Card className="p-4">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
      <span className="tabular-nums text-sm text-muted-foreground">{itens.length}</span>
    </div>
    {itens.length === 0 ? (
      <p className="mt-2 text-xs text-muted-foreground">Nada atingido.</p>
    ) : (
      <ul className="mt-2 space-y-1">
        {itens.slice(0, 20).map((h) => (
          <li key={h.no.id} className="truncate text-sm text-muted-foreground">
            <span className="text-foreground">{h.no.rotulo}</span> · N{h.profundidade}
          </li>
        ))}
      </ul>
    )}
  </Card>
);

const ReasoningImpact = () => {
  const { nos } = useAnalysableNodes();
  const [alvo, setAlvo] = useState("");
  const [profundidade, setProfundidade] = useState(4);
  const { resultado, execucao, erro, loading, executar } = useImpactAnalysis(alvo, profundidade);

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <Radar className="h-4 w-4" /> Selecione o alvo
        </h2>
        <div className="mt-3">
          <NodePicker nos={nos} valor={alvo} onChange={setAlvo} />
        </div>

        <div className="mt-4">
          <Label htmlFor="prof">Profundidade máxima: {profundidade}</Label>
          <input
            id="prof"
            type="range"
            min={1}
            max={6}
            value={profundidade}
            onChange={(e) => setProfundidade(Number(e.target.value))}
            className="mt-2 w-full accent-primary"
          />
        </div>

        <Button className="mt-4 w-full" disabled={!alvo || loading} onClick={() => void executar()}>
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Executar análise
        </Button>
        {erro ? <p className="mt-3 text-sm text-destructive">{erro}</p> : null}
      </Card>

      <div>
        {!resultado ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Escolha um fato, objeto ou norma e execute a análise. O motor descobre sozinho tudo
            que depende do alvo — sem alterar nenhum dado.
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {NODE_KIND_LABEL[resultado.alvo.kind]}
                  </p>
                  <h2 className="mt-0.5 font-semibold text-foreground">{resultado.alvo.rotulo}</h2>
                </div>
                <SeverityBadge severidade={resultado.severidade} />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                {[
                  ["Atingidos", resultado.atingidos.length],
                  ["Profundidade", resultado.profundidadeMaxima],
                  ["Conexões", resultado.conexoes],
                  ["Entidades", resultado.entidades.length],
                ].map(([r, n]) => (
                  <div key={String(r)} className="rounded-lg border border-border p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{r}</p>
                    <p className="mt-0.5 text-xl font-bold tabular-nums text-foreground">{n}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Nós pais</p>
                  <p className="mt-1 text-sm text-foreground">
                    {resultado.pais.length ? resultado.pais.map((n) => n.rotulo).join(" · ") : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Nós filhos</p>
                  <p className="mt-1 text-sm text-foreground">
                    {resultado.filhos.length
                      ? resultado.filhos.map((n) => n.rotulo).join(" · ")
                      : "—"}
                  </p>
                </div>
              </div>

              {execucao ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  Execução {execucao.duracaoMs} ms · hash {execucao.hash}
                </p>
              ) : null}
            </Card>

            <Card className="p-5">
              <h3 className="mb-3 font-semibold text-foreground">Árvore de impacto</h3>
              <ImpactTree raiz={resultado.alvo.rotulo} itens={resultado.arvore} />
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <HitList titulo="Knowledge Objects" itens={resultado.objetos} />
              <HitList titulo="FAQs e respostas" itens={resultado.faqs} />
              <HitList titulo="Guias" itens={resultado.guias} />
              <HitList titulo="Artigos e conceitos" itens={resultado.artigos} />
            </div>

            <Card className="p-5">
              <h3 className="font-semibold text-foreground">Relações dependentes</h3>
              {resultado.relacoesDependentes.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Nenhuma relação incidente.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {resultado.relacoesDependentes.map((e) => (
                    <li key={e.id} className="truncate">
                      {e.origem} → {e.destino} · {e.tipo} · peso {e.peso}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReasoningImpact;