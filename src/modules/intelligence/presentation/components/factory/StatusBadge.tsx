import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  EDITORIAL_STATE_LABEL,
  type EditorialState,
  type Priority,
} from "../../../domain/factory/KnowledgeDraft";

const STATE_CLASS: Record<EditorialState, string> = {
  rascunho: "bg-muted text-muted-foreground",
  "em-revisao": "bg-accent/15 text-accent",
  aprovado: "bg-primary/15 text-primary",
  publicado: "bg-emerald-500/15 text-emerald-600",
  arquivado: "bg-destructive/10 text-destructive",
};

export const StatusBadge = ({ estado }: { estado: EditorialState }) => (
  <Badge variant="outline" className={cn("border-transparent", STATE_CLASS[estado])}>
    {EDITORIAL_STATE_LABEL[estado]}
  </Badge>
);

const PRIORITY_CLASS: Record<Priority, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-primary/10 text-primary",
  alta: "bg-accent/15 text-accent",
  critica: "bg-destructive/15 text-destructive",
};

export const PriorityBadge = ({ prioridade }: { prioridade: Priority }) => (
  <Badge variant="outline" className={cn("border-transparent capitalize", PRIORITY_CLASS[prioridade])}>
    {prioridade}
  </Badge>
);