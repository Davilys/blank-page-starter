/** Indicadores compartilhados do Publishing Engine. */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { healthBand } from "../../../domain/publishing/Publication";

export const ScorePill = ({ label, score }: { label: string; score: number }) => {
  const faixa = healthBand(score);
  const classe =
    faixa === "saudavel"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : faixa === "atencao"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "border-destructive/40 bg-destructive/10 text-destructive";
  return (
    <Badge variant="outline" className={cn("shrink-0 tabular-nums", classe)}>
      {label}: {score}%
    </Badge>
  );
};

export const StatePill = ({ publicado, liberado }: { publicado: boolean; liberado: boolean }) => (
  <Badge
    variant="outline"
    className={cn(
      "shrink-0",
      publicado
        ? "border-primary/40 bg-primary/10 text-primary"
        : liberado
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    )}
  >
    {publicado ? "Publicado" : liberado ? "Publicável" : "Pendente"}
  </Badge>
);

export const ManualOnlyBadge = () => (
  <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
    Publicação manual · sem IA generativa
  </Badge>
);