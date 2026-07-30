/** Árvore de impacto com breadcrumb de profundidade. Renderização recursiva. */
import { NODE_KIND_LABEL } from "../../../domain/graph/GraphNode";
import type { ImpactTreeNode } from "../../../domain/reasoning/impact";

const Branch = ({ node, nivel }: { node: ImpactTreeNode; nivel: number }) => (
  <li className="relative pl-4">
    <span className="absolute left-0 top-3 h-px w-3 bg-border" aria-hidden />
    <div className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        N{node.profundidade}
      </span>
      <span className="text-sm text-foreground">{node.no.rotulo}</span>
      <span className="text-xs text-muted-foreground">
        {NODE_KIND_LABEL[node.no.kind]} · via {node.viaRelacao}
        {node.peso ? ` · peso ${node.peso}` : ""}
      </span>
    </div>
    {node.filhos.length > 0 && nivel < 6 ? (
      <ul className="ml-3 space-y-0.5 border-l border-border">
        {node.filhos.map((f) => (
          <Branch key={`${f.no.id}-${f.profundidade}`} node={f} nivel={nivel + 1} />
        ))}
      </ul>
    ) : null}
  </li>
);

export const ImpactTree = ({
  raiz,
  itens,
}: {
  raiz: string;
  itens: readonly ImpactTreeNode[];
}) => {
  if (!itens.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum nó depende deste alvo. Alterá-lo não quebra nada hoje.
      </p>
    );
  }
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">{raiz}</p>
      <ul className="space-y-0.5 border-l border-border">
        {itens.map((n) => (
          <Branch key={`${n.no.id}-${n.profundidade}`} node={n} nivel={1} />
        ))}
      </ul>
    </div>
  );
};