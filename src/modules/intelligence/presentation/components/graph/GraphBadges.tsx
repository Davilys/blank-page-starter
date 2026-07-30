/** Badges determinísticos do grafo — sem cor decorativa, cor com significado. */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  EDGE_STATUS_LABEL,
  EDGE_TYPE_LABEL,
  type EdgeStatus,
  type EdgeType,
} from "../../../domain/graph/GraphEdge";
import { NODE_KIND_LABEL, NODE_STATUS_LABEL, type NodeKind, type NodeStatus } from "../../../domain/graph/GraphNode";

const STATUS_CLASS: Readonly<Record<EdgeStatus, string>> = {
  proposta: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  ativa: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  suspensa: "bg-orange-500/10 text-orange-700 border-orange-500/30",
  invalida: "bg-destructive/10 text-destructive border-destructive/30",
  arquivada: "bg-muted text-muted-foreground border-border",
};

export const EdgeStatusBadge = ({ status }: { status: EdgeStatus }) => (
  <Badge variant="outline" className={cn("font-medium", STATUS_CLASS[status])}>
    {EDGE_STATUS_LABEL[status]}
  </Badge>
);

export const EdgeTypeBadge = ({ tipo }: { tipo: EdgeType }) => (
  <Badge variant="outline" className="border-primary/30 bg-primary/5 font-mono text-[11px] text-primary">
    {EDGE_TYPE_LABEL[tipo] ?? tipo}
  </Badge>
);

export const NodeKindBadge = ({ kind }: { kind: NodeKind }) => (
  <Badge variant="secondary" className="text-[11px] font-medium">
    {NODE_KIND_LABEL[kind] ?? kind}
  </Badge>
);

const NODE_STATUS_CLASS: Readonly<Record<NodeStatus, string>> = {
  ativo: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  rascunho: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  vencido: "bg-destructive/10 text-destructive border-destructive/30",
  arquivado: "bg-muted text-muted-foreground border-border",
};

export const NodeStatusBadge = ({ status }: { status: NodeStatus }) => (
  <Badge variant="outline" className={cn("text-[11px]", NODE_STATUS_CLASS[status])}>
    {NODE_STATUS_LABEL[status]}
  </Badge>
);

export const WeightBadge = ({ peso, confianca }: { peso: number; confianca: number }) => (
  <span className="text-xs text-muted-foreground">
    peso <strong className="text-foreground">{peso}</strong> · confiança{" "}
    <strong className="text-foreground">{confianca}</strong>
  </span>
);