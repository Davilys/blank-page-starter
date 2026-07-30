/** ENGINE 3 — Broken Knowledge Detector. Relatório completo de inconsistências. */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, RefreshCw } from "lucide-react";
import {
  ISSUE_KINDS,
  ISSUE_KIND_LABEL,
  type IssueKind,
} from "@/modules/intelligence/domain/reasoning/broken";
import { SEVERITY_ORDER } from "@/modules/intelligence/domain/reasoning/Reasoning";
import { SeverityBadge } from "@/modules/intelligence/presentation/components/reasoning/ReasoningBadges";
import { useBrokenKnowledge } from "@/modules/intelligence/presentation/hooks/useReasoning";
import { cn } from "@/lib/utils";

const PAGE = 25;

const ReasoningBroken = () => {
  const { resultado, execucao, loading, erro, executar } = useBrokenKnowledge();
  const [filtro, setFiltro] = useState<IssueKind | "todos">("todos");
  const [visiveis, setVisiveis] = useState(PAGE);

  const issues = useMemo(() => {
    const base = resultado?.issues ?? [];
    const f = filtro === "todos" ? base : base.filter((i) => i.tipo === filtro);
    return [...f].sort((a, b) => SEVERITY_ORDER[a.severidade] - SEVERITY_ORDER[b.severidade]);
  }, [resultado, filtro]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3">
          {[
            ["Inconsistências", resultado?.total ?? 0],
            ["Críticas", resultado?.criticas ?? 0],
          ].map(([r, n]) => (
            <Card key={String(r)} className="px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{r}</p>
              <p className="text-xl font-bold tabular-nums text-foreground">{n}</p>
            </Card>
          ))}
        </div>
        <Button variant="outline" disabled={loading} onClick={() => void executar()}>
          {loading ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-4 w-4" />
          )}
          Reexecutar varredura
        </Button>
      </div>

      {erro ? <p className="mt-4 text-sm text-destructive">{erro}</p> : null}

      <div className="mt-5 flex flex-wrap gap-1.5">
        {(["todos", ...ISSUE_KINDS] as const).map((k) => {
          const qtd = k === "todos" ? (resultado?.total ?? 0) : (resultado?.porTipo[k] ?? 0);
          return (
            <button
              key={k}
              type="button"
              onClick={() => {
                setFiltro(k);
                setVisiveis(PAGE);
              }}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs transition-colors",
                filtro === k
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {k === "todos" ? "Todas" : ISSUE_KIND_LABEL[k]} ({qtd})
            </button>
          );
        })}
      </div>

      <Card className="mt-4 divide-y divide-border">
        {issues.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            {loading
              ? "Varrendo a base..."
              : "Nenhuma inconsistência neste filtro. A estrutura está íntegra aqui."}
          </p>
        ) : (
          issues.slice(0, visiveis).map((i) => (
            <div key={i.id} className="flex flex-wrap items-start gap-3 p-4">
              <SeverityBadge severidade={i.severidade} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{i.rotulo}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{i.detalhe}</p>
              </div>
              <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
                {ISSUE_KIND_LABEL[i.tipo]}
              </span>
            </div>
          ))
        )}
      </Card>

      {issues.length > visiveis ? (
        <div className="mt-4 text-center">
          <Button variant="outline" onClick={() => setVisiveis((v) => v + PAGE)}>
            Carregar mais ({issues.length - visiveis} restantes)
          </Button>
        </div>
      ) : null}

      {execucao ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Execução {execucao.duracaoMs} ms · hash {execucao.hash}
        </p>
      ) : null}
    </div>
  );
};

export default ReasoningBroken;