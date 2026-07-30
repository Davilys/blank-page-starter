/** Seletor de nó com busca — usado por Impact Analysis e Change Simulation. */
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { NODE_KIND_LABEL, type GraphNode } from "../../../domain/graph/GraphNode";

const MAX_VISIVEIS = 40;

export const NodePicker = ({
  nos,
  valor,
  onChange,
}: {
  nos: readonly GraphNode[];
  valor: string;
  onChange: (id: string) => void;
}) => {
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const base = t
      ? nos.filter((n) => `${n.rotulo} ${n.ref}`.toLowerCase().includes(t))
      : nos;
    return base.slice(0, MAX_VISIVEIS);
  }, [nos, busca]);

  return (
    <div>
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar fato, objeto, entidade ou norma..."
      />
      <div className="mt-2 max-h-72 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
        {filtrados.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">Nenhum nó encontrado.</p>
        ) : (
          filtrados.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onChange(n.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                valor === n.id
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <span className="flex-1 truncate">{n.rotulo}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                {NODE_KIND_LABEL[n.kind]}
              </span>
            </button>
          ))
        )}
        {nos.length > filtrados.length ? (
          <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
            Mostrando {filtrados.length} de {nos.length}. Refine a busca.
          </p>
        ) : null}
      </div>
    </div>
  );
};