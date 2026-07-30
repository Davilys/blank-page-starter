/** Seletor de nó com busca — funciona com qualquer tipo de nó do grafo. */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_KIND_LABEL, type GraphNode } from "../../../domain/graph/GraphNode";

interface Props {
  readonly nodes: readonly GraphNode[];
  readonly value: string;
  readonly onChange: (id: string) => void;
  readonly placeholder?: string;
  readonly excluir?: string;
}

const NodePicker = ({ nodes, value, onChange, placeholder = "Selecionar nó", excluir }: Props) => {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");

  const selecionado = nodes.find((n) => n.id === value) ?? null;
  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return nodes
      .filter((n) => n.id !== excluir)
      .filter((n) => !t || `${n.rotulo} ${n.ref} ${NODE_KIND_LABEL[n.kind]}`.toLowerCase().includes(t))
      .slice(0, 80);
  }, [nodes, busca, excluir]);

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between font-normal">
          <span className="truncate text-left">
            {selecionado ? (
              <>
                <span className="text-muted-foreground">{NODE_KIND_LABEL[selecionado.kind]} · </span>
                {selecionado.rotulo}
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="border-b border-border p-2">
          <Input
            autoFocus
            placeholder="Buscar nó por rótulo ou tipo"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <ScrollArea className="max-h-72">
          {filtrados.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Nenhum nó encontrado.</p>
          )}
          {filtrados.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                onChange(n.id);
                setAberto(false);
              }}
              className={cn(
                "flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                n.id === value && "bg-primary/5",
              )}
            >
              <Check className={cn("mt-0.5 h-4 w-4 shrink-0", n.id === value ? "opacity-100" : "opacity-0")} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">{n.rotulo}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {NODE_KIND_LABEL[n.kind]} · {n.ref}
                </span>
              </span>
            </button>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NodePicker;