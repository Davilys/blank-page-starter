/** ENGINE 7 — Sugestões estruturais (sem IA). Somente leitura. */
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { SEVERITY_ORDER } from "@/modules/intelligence/domain/reasoning/Reasoning";
import {
  SUGGESTION_KINDS,
  SUGGESTION_KIND_LABEL,
  type SuggestionKind,
} from "@/modules/intelligence/domain/reasoning/suggestions";
import { SeverityBadge } from "@/modules/intelligence/presentation/components/reasoning/ReasoningBadges";
import { useSuggestions } from "@/modules/intelligence/presentation/hooks/useReasoning";
import { cn } from "@/lib/utils";

const ReasoningSuggestions = () => {
  const { resultado, execucao, loading } = useSuggestions();
  const [filtro, setFiltro] = useState<SuggestionKind | "todos">("todos");

  const lista = useMemo(() => {
    const base = resultado ?? [];
    const f = filtro === "todos" ? base : base.filter((s) => s.tipo === filtro);
    return [...f].sort((a, b) => SEVERITY_ORDER[a.prioridade] - SEVERITY_ORDER[b.prioridade]);
  }, [resultado, filtro]);

  return (
    <div>
      <Card className="p-5">
        <h2 className="font-semibold text-foreground">Sugestões estruturais</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Derivadas apenas da estrutura do acervo — fatos, objetos e relações. Nenhuma delas é
          aplicada automaticamente: são recomendações para decisão humana.
        </p>
      </Card>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {(["todos", ...SUGGESTION_KINDS] as const).map((k) => {
          const qtd =
            k === "todos"
              ? (resultado?.length ?? 0)
              : (resultado ?? []).filter((s) => s.tipo === k).length;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setFiltro(k)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs transition-colors",
                filtro === k
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {k === "todos" ? "Todas" : SUGGESTION_KIND_LABEL[k]} ({qtd})
            </button>
          );
        })}
      </div>

      <Card className="mt-4 divide-y divide-border">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Gerando sugestões...</p>
        ) : lista.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            Nenhuma sugestão neste filtro. A estrutura está completa aqui.
          </p>
        ) : (
          lista.map((s) => (
            <div key={s.id} className="flex flex-wrap items-start gap-3 p-4">
              <SeverityBadge severidade={s.prioridade} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{s.titulo}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{s.motivo}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {SUGGESTION_KIND_LABEL[s.tipo]}
                </span>
                {s.rota ? (
                  <Link to={s.rota} className="text-xs text-primary underline">
                    Abrir
                  </Link>
                ) : null}
              </div>
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

export default ReasoningSuggestions;