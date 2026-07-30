/** ENGINE 4 — Confidence Engine: score estrutural por Knowledge Object. */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ObjectConfidence } from "@/modules/intelligence/domain/reasoning/confidence";
import { ScoreBadge } from "@/modules/intelligence/presentation/components/reasoning/ReasoningBadges";
import { StructuralHeatmap } from "@/modules/intelligence/presentation/components/reasoning/StructuralHeatmap";
import { useConfidenceReport } from "@/modules/intelligence/presentation/hooks/useReasoning";

const Detalhe = ({ o }: { o: ObjectConfidence }) => (
  <div className="mt-3 space-y-2 border-t border-border pt-3">
    {o.fatores.map((f) => (
      <div key={f.rotulo}>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{f.rotulo}</span>
          <span className="tabular-nums text-foreground">
            {f.pontos}/{f.maximo}
          </span>
        </div>
        <Progress value={(f.pontos / Math.max(f.maximo, 1)) * 100} className="mt-1 h-1.5" />
        <p className="mt-1 text-[11px] text-muted-foreground">{f.detalhe}</p>
      </div>
    ))}
  </div>
);

const ReasoningConfidence = () => {
  const { resultado, execucao, loading } = useConfidenceReport();
  const [aberto, setAberto] = useState<string>("");

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Confiança média", resultado ? `${resultado.media}%` : "—"],
          ["Objetos sólidos", resultado?.solidos ?? "—"],
          ["Objetos críticos", resultado?.criticos ?? "—"],
        ].map(([r, v]) => (
          <Card key={String(r)} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{r}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{v}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6 p-5">
        <h2 className="font-semibold text-foreground">Heatmap estrutural</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Score calculado sem IA: lastro em fatos, validação humana, fontes, conectividade e
          atualidade.
        </p>
        <div className="mt-4">
          <StructuralHeatmap
            cells={(resultado?.objetos ?? []).map((o) => ({
              id: o.id,
              rotulo: o.titulo,
              valor: o.score,
              detalhe: `${o.fatos} fato(s) · ${o.relacoes} relação(ões)`,
            }))}
          />
        </div>
      </Card>

      <Card className="mt-6 divide-y divide-border">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Calculando confiança...</p>
        ) : (resultado?.objetos.length ?? 0) === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            Nenhum Knowledge Object cadastrado ainda.
          </p>
        ) : (
          resultado?.objetos.map((o) => (
            <div key={o.id} className="p-4">
              <button
                type="button"
                className="flex w-full flex-wrap items-center gap-3 text-left"
                onClick={() => setAberto((a) => (a === o.id ? "" : o.id))}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {o.titulo}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {o.slug} · {o.estado} · {o.fatos} fato(s) · {o.fontes} fonte(s)
                  </span>
                </span>
                <ScoreBadge score={o.score} />
              </button>
              {aberto === o.id ? <Detalhe o={o} /> : null}
            </div>
          ))
        )}
      </Card>

      {execucao ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Execução {execucao.duracaoMs} ms · hash {execucao.hash}
        </p>
      ) : null}
    </div>
  );
};

export default ReasoningConfidence;