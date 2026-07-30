import { Card } from "@/components/ui/card";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KnowledgeDraft } from "../../../domain/factory/KnowledgeDraft";
import { completeness, validateForPublication } from "../../../domain/factory/validation";

export const ValidationChecklist = ({ draft }: { draft: KnowledgeDraft }) => {
  const itens = validateForPublication(draft);
  const pct = completeness(draft);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Validação para publicação</h3>
        <span className="text-sm font-medium text-muted-foreground">{pct}%</span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ul className="mt-4 space-y-2.5">
        {itens.map((i) => (
          <li key={i.chave} className="flex items-start gap-2.5">
            <span
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                i.ok ? "bg-emerald-500/15 text-emerald-600" : "bg-destructive/15 text-destructive",
              )}
            >
              {i.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">{i.rotulo}</p>
              {!i.ok && <p className="text-xs text-muted-foreground">{i.detalhe}</p>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
};