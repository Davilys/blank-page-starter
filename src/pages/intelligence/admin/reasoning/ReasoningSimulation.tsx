/** ENGINES 2 e 6 — Cascade Analysis e Change Simulation (nada é salvo). */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Waves } from "lucide-react";
import {
  SIMULATION_LABEL,
  type SimulationKind,
} from "@/modules/intelligence/domain/reasoning/cascade";
import { NodePicker } from "@/modules/intelligence/presentation/components/reasoning/NodePicker";
import {
  ReadOnlyBadge,
  SeverityBadge,
} from "@/modules/intelligence/presentation/components/reasoning/ReasoningBadges";
import {
  useAnalysableNodes,
  useChangeSimulation,
} from "@/modules/intelligence/presentation/hooks/useReasoning";
import { cn } from "@/lib/utils";

const TIPOS: readonly SimulationKind[] = ["alteracao", "revogacao", "remocao"];

const ReasoningSimulation = () => {
  const { nos } = useAnalysableNodes();
  const [alvo, setAlvo] = useState("");
  const [tipo, setTipo] = useState<SimulationKind>("alteracao");
  const { resultado, execucao, erro, loading, executar } = useChangeSimulation(alvo, tipo);

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <Waves className="h-4 w-4" /> Simular mudança
        </h2>
        <div className="mt-3">
          <NodePicker nos={nos} valor={alvo} onChange={setAlvo} />
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {TIPOS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs transition-colors",
                tipo === t
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {SIMULATION_LABEL[t]}
            </button>
          ))}
        </div>

        <Button className="mt-4 w-full" disabled={!alvo || loading} onClick={() => void executar()}>
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Rodar simulação
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          A simulação acontece inteiramente em memória. Nenhum fato, objeto ou relação é alterado.
        </p>
        {erro ? <p className="mt-3 text-sm text-destructive">{erro}</p> : null}
      </Card>

      <div>
        {!resultado ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Escolha um alvo e o tipo de mudança para ver a cascata de impactos em ondas.
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {SIMULATION_LABEL[resultado.tipo]}
                  </p>
                  <h2 className="mt-0.5 font-semibold text-foreground">{resultado.alvo.rotulo}</h2>
                </div>
                <div className="flex gap-2">
                  <SeverityBadge severidade={resultado.severidade} />
                  <ReadOnlyBadge />
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                {[
                  ["Total afetado", resultado.totalAfetados],
                  ["Objetos", resultado.objetosAfetados.length],
                  ["Fatos", resultado.fatosAfetados.length],
                  ["Relações", resultado.relacoesAfetadas.length],
                ].map(([r, n]) => (
                  <div key={String(r)} className="rounded-lg border border-border p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{r}</p>
                    <p className="mt-0.5 text-xl font-bold tabular-nums text-foreground">{n}</p>
                  </div>
                ))}
              </div>
              {execucao ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  Execução {execucao.duracaoMs} ms · hash {execucao.hash}
                </p>
              ) : null}
            </Card>

            {resultado.ondas.length === 0 ? (
              <Card className="p-5 text-sm text-muted-foreground">
                Nenhuma onda de impacto: este nó não sustenta nada hoje.
              </Card>
            ) : (
              <div className="space-y-4">
                {resultado.ondas.map((onda) => (
                  <Card key={onda.ordem} className="p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-foreground">{onda.rotulo}</h3>
                      <span className="tabular-nums text-sm text-muted-foreground">
                        {onda.nos.length} nó(s)
                      </span>
                    </div>
                    <ul className="mt-3 space-y-1">
                      {onda.nos.map((h) => (
                        <li
                          key={h.no.id}
                          className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                        >
                          <span className="flex-1 truncate text-foreground">{h.no.rotulo}</span>
                          <span className="text-xs text-muted-foreground">via {h.viaRelacao}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            )}

            <Card className="p-5">
              <h3 className="font-semibold text-foreground">Entidades afetadas</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {resultado.entidadesAfetadas.length
                  ? resultado.entidadesAfetadas.join(" · ")
                  : "Nenhuma entidade impactada."}
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReasoningSimulation;