import { Card } from "@/components/ui/card";
import { History } from "lucide-react";
import { FIELD_LABELS } from "../../../domain/factory/diff";
import type { KnowledgeVersion } from "../../../domain/memory/KnowledgeVersion";

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR");

export const HistoryTimeline = ({ versoes }: { versoes: readonly KnowledgeVersion[] }) => (
  <Card className="p-5">
    <div className="flex items-center gap-2">
      <History className="h-4 w-4 text-primary" />
      <h3 className="font-semibold text-foreground">Histórico (append-only)</h3>
    </div>

    {versoes.length === 0 ? (
      <p className="mt-3 text-sm text-muted-foreground">Nenhuma versão registrada ainda.</p>
    ) : (
      <ol className="mt-4 space-y-4 border-l border-border pl-4">
        {versoes.map((v) => (
          <li key={v.id} className="relative">
            <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
            <p className="text-sm font-medium text-foreground">
              v{v.versao} · {v.resumoMudanca}
            </p>
            <p className="text-xs text-muted-foreground">
              {v.autorId} · {fmt(v.registradoEm)} · motivo: {v.motivo}
            </p>
            {v.diffs.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {v.diffs.map((d) => (
                  <li key={d.campo} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {FIELD_LABELS[d.campo] ?? d.campo}
                    </span>
                    : <span className="line-through opacity-70">{d.antes ?? "vazio"}</span> →{" "}
                    <span>{d.depois ?? "vazio"}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    )}
  </Card>
);