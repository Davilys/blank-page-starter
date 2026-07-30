import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CANDIDATE_STATUS_LABEL,
  SOURCE_FORMAT_LABEL,
  type CandidateStatus,
  type SourceFormat,
} from "../../../domain/ingestion/SourceDocument";

const STATUS_CLASS: Record<CandidateStatus, string> = {
  pendente: "bg-accent/15 text-accent",
  aprovado: "bg-emerald-500/15 text-emerald-600",
  rejeitado: "bg-destructive/10 text-destructive",
};

export const CandidateStatusBadge = ({ status }: { status: CandidateStatus }) => (
  <Badge variant="outline" className={cn("border-transparent", STATUS_CLASS[status])}>
    {CANDIDATE_STATUS_LABEL[status]}
  </Badge>
);

export const FormatBadge = ({ formato }: { formato: SourceFormat }) => (
  <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
    {SOURCE_FORMAT_LABEL[formato]}
  </Badge>
);