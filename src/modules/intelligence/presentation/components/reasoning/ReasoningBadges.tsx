/** Indicadores visuais compartilhados pelos motores de raciocínio. */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CONFIDENCE_BAND_LABEL,
  SEVERITY_LABEL,
  confidenceBand,
  type Severity,
} from "../../../domain/reasoning/Reasoning";

const SEVERITY_CLASS: Readonly<Record<Severity, string>> = {
  critica: "border-destructive/40 bg-destructive/10 text-destructive",
  alta: "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  media: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  baixa: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export const SeverityBadge = ({
  severidade,
  rotulo,
}: {
  severidade: Severity;
  rotulo?: string;
}) => (
  <Badge variant="outline" className={cn("shrink-0", SEVERITY_CLASS[severidade])}>
    {rotulo ?? SEVERITY_LABEL[severidade]}
  </Badge>
);

export const ScoreBadge = ({ score }: { score: number }) => {
  const faixa = confidenceBand(score);
  return (
    <Badge variant="outline" className={cn("shrink-0 tabular-nums", SEVERITY_CLASS[faixa])}>
      {score}% · {CONFIDENCE_BAND_LABEL[faixa]}
    </Badge>
  );
};

export const ReadOnlyBadge = () => (
  <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
    Somente leitura
  </Badge>
);

export const severityClass = (s: Severity) => SEVERITY_CLASS[s];