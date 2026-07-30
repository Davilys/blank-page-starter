/** Advisory duplicate warning (FASE 07 §7) — informs, never blocks. */
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import type { DuplicateSuspicion } from "../../../domain/ingestion/SourceDocument";

export const DuplicateAlert = ({ itens }: { itens: readonly DuplicateSuspicion[] }) => {
  if (itens.length === 0) return null;

  return (
    <Card className="border-accent/40 bg-accent/5 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-accent">
        <AlertTriangle className="h-4 w-4" />
        Possível duplicidade ({itens.length})
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Alerta consultivo. A aprovação continua liberada — a decisão é do editor.
      </p>
      <ul className="mt-3 space-y-2">
        {itens.map((d) => (
          <li key={d.draftId} className="text-sm">
            <Link
              to={`/intelligence/admin/factory/objetos/${d.draftId}`}
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              {d.titulo || "(sem título)"}
            </Link>
            <span className="ml-2 text-xs text-muted-foreground">
              {Math.round(d.similaridade * 100)}% · {d.motivos.join(" · ")}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
};