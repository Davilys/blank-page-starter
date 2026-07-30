/** Badges do Fact Ledger — apenas tokens do design system da WebMarcas. */
import { cn } from "@/lib/utils";
import {
  FACT_STATUS_LABEL,
  SOURCE_TIER_LABEL,
  type FactStatus,
  type SourceTier,
} from "../../../domain/facts/Fact";
import {
  CONFIDENCE_BAND_LABEL,
  type ConfidenceBand,
} from "../../../domain/facts/confidence";

const base =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

const STATUS_CLASS: Readonly<Record<FactStatus, string>> = {
  rascunho: "bg-muted text-muted-foreground",
  vigente: "bg-primary/10 text-primary",
  contestado: "bg-accent/15 text-accent",
  vencido: "bg-accent/15 text-accent",
  revogado: "bg-destructive/10 text-destructive",
  substituido: "bg-muted text-muted-foreground line-through",
};

export const FactStatusBadge = ({ status }: { status: FactStatus }) => (
  <span className={cn(base, STATUS_CLASS[status])}>{FACT_STATUS_LABEL[status]}</span>
);

export const TierBadge = ({ tier }: { tier: SourceTier }) => (
  <span className={cn(base, "border border-border bg-background text-muted-foreground")}>
    {SOURCE_TIER_LABEL[tier]}
  </span>
);

const BAND_CLASS: Readonly<Record<ConfidenceBand, string>> = {
  alta: "bg-primary/10 text-primary",
  media: "bg-accent/15 text-accent",
  baixa: "bg-accent/25 text-accent",
  insuficiente: "bg-destructive/10 text-destructive",
};

export const ConfidenceBadge = ({
  score,
  faixa,
}: {
  score: number;
  faixa: ConfidenceBand;
}) => (
  <span className={cn(base, BAND_CLASS[faixa])}>
    Confiabilidade {score} · {CONFIDENCE_BAND_LABEL[faixa]}
  </span>
);