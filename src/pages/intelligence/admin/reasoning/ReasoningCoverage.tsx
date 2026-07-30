/** ENGINE 5 — Coverage Analysis por entidade: lacunas, isolamento, duplicidade. */
import { Card } from "@/components/ui/card";
import { Check, X } from "lucide-react";
import { ScoreBadge } from "@/modules/intelligence/presentation/components/reasoning/ReasoningBadges";
import { StructuralHeatmap } from "@/modules/intelligence/presentation/components/reasoning/StructuralHeatmap";
import { useCoverageReport } from "@/modules/intelligence/presentation/hooks/useReasoning";

const ReasoningCoverage = () => {
  const { resultado, execucao, loading } = useCoverageReport();

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Cobertura média", resultado ? `${resultado.coberturaMedia}%` : "—"],
          ["Entidades com lacunas", resultado?.comLacunas ?? "—"],
          ["Entidades isoladas", resultado?.isoladas ?? "—"],
        ].map(([r, v]) => (
          <Card key={String(r)} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{r}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{v}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6 p-5">
        <h2 className="font-semibold text-foreground">Mapa de cobertura</h2>
        <div className="mt-4">
          <StructuralHeatmap
            cells={(resultado?.entidades ?? []).map((e) => ({
              id: e.entidade,
              rotulo: e.entidade,
              valor: e.cobertura,
              detalhe: `${e.fatos} fato(s) · ${e.objetos} objeto(s)`,
            }))}
          />
        </div>
      </Card>

      <div className="mt-6 space-y-4">
        {loading ? (
          <Card className="p-6 text-sm text-muted-foreground">Analisando cobertura...</Card>
        ) : (resultado?.entidades.length ?? 0) === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Nenhuma entidade identificada no acervo.
          </Card>
        ) : (
          resultado?.entidades.map((e) => (
            <Card key={e.entidade} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold text-foreground">{e.entidade}</h3>
                <ScoreBadge score={e.cobertura} />
              </div>

              <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3 lg:grid-cols-6">
                <span>Fatos: <strong className="text-foreground">{e.fatos}</strong></span>
                <span>Vigentes: <strong className="text-foreground">{e.fatosVigentes}</strong></span>
                <span>Objetos: <strong className="text-foreground">{e.objetos}</strong></span>
                <span>Publicados: <strong className="text-foreground">{e.objetosPublicados}</strong></span>
                <span>Relações: <strong className="text-foreground">{e.relacoes}</strong></span>
                <span>Perguntas: <strong className="text-foreground">{e.perguntas}</strong></span>
              </div>

              <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
                {e.indicadores.map((i) => (
                  <li key={i.rotulo} className="flex items-start gap-2 text-sm">
                    {i.ok ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    )}
                    <span className="text-muted-foreground">
                      <span className="text-foreground">{i.rotulo}</span> — {i.detalhe}
                    </span>
                  </li>
                ))}
              </ul>

              {e.lacunas.length > 0 ? (
                <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    Lacunas
                  </p>
                  <ul className="mt-1 list-inside list-disc text-sm text-amber-800 dark:text-amber-200">
                    {e.lacunas.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>
          ))
        )}
      </div>

      {execucao ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Execução {execucao.duracaoMs} ms · hash {execucao.hash}
        </p>
      ) : null}
    </div>
  );
};

export default ReasoningCoverage;