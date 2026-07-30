/** Heatmap estrutural: cada célula é um objeto/entidade colorido pelo score. */
import { cn } from "@/lib/utils";

export interface HeatCell {
  readonly id: string;
  readonly rotulo: string;
  readonly valor: number;
  readonly detalhe?: string;
}

const tone = (v: number) =>
  v >= 85
    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
    : v >= 70
      ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300"
      : v >= 50
        ? "bg-orange-500/20 border-orange-500/40 text-orange-700 dark:text-orange-300"
        : "bg-destructive/15 border-destructive/40 text-destructive";

export const StructuralHeatmap = ({ cells }: { cells: readonly HeatCell[] }) => {
  if (!cells.length) {
    return <p className="text-sm text-muted-foreground">Sem dados suficientes para o mapa.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {cells.map((c) => (
        <div
          key={c.id}
          title={c.detalhe}
          className={cn("rounded-lg border p-3 transition-colors", tone(c.valor))}
        >
          <p className="truncate text-xs font-medium">{c.rotulo}</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{c.valor}%</p>
          {c.detalhe ? <p className="mt-0.5 truncate text-[11px] opacity-80">{c.detalhe}</p> : null}
        </div>
      ))}
    </div>
  );
};