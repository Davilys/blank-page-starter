/** Checklist automático — bloqueia a publicação quando algo falha. */
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react";
import type { ChecklistItem } from "../../../domain/publishing/checklist";

export const ChecklistPanel = ({
  itens,
  score,
}: {
  itens: readonly ChecklistItem[];
  score: number;
}) => (
  <Card className="p-5">
    <div className="flex items-center justify-between">
      <h3 className="font-semibold text-foreground">Checklist automático</h3>
      <span className="text-sm tabular-nums text-muted-foreground">{score}%</span>
    </div>
    <ul className="mt-4 space-y-2.5">
      {itens.map((i) => (
        <li key={i.chave} className="flex items-start gap-2.5">
          {i.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          )}
          <div>
            <p className="text-sm font-medium text-foreground">{i.rotulo}</p>
            <p className="text-xs text-muted-foreground">{i.detalhe}</p>
          </div>
        </li>
      ))}
    </ul>
  </Card>
);