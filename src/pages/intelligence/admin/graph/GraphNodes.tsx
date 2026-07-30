/**
 * Cadastro manual de nós que não existem em outro módulo:
 * leis, manuais, atos INPI, classes NICE, glossário, conceitos, serviços.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  DERIVED_KINDS,
  NODE_KINDS,
  NODE_KIND_LABEL,
  normalizeRef,
  type NodeKind,
} from "@/modules/intelligence/domain/graph/GraphNode";
import { useGraphCommands, useGraphNodes } from "@/modules/intelligence/presentation/hooks/useGraph";
import {
  NodeKindBadge,
  NodeStatusBadge,
} from "@/modules/intelligence/presentation/components/graph/GraphBadges";

const MANUAL_KINDS = NODE_KINDS.filter((k) => !DERIVED_KINDS.includes(k));

const GraphNodes = () => {
  const [kind, setKind] = useState<NodeKind>("law");
  const [rotulo, setRotulo] = useState("");
  const [ref, setRef] = useState("");
  const [descricao, setDescricao] = useState("");
  const [entidade, setEntidade] = useState("");
  const [autor, setAutor] = useState("");

  const { items, recarregar } = useGraphNodes({});
  const { criarNo, salvando } = useGraphCommands();

  const manuais = items.filter((n) => n.origem.startsWith("manual"));

  const salvar = async () => {
    const r = await criarNo(
      { kind, rotulo, ref: ref || rotulo, descricao, entidade },
      autor,
      "Cadastro manual de nó no Knowledge Graph.",
    );
    if (!r.ok) {
      toast({ title: "Não foi possível criar o nó", description: r.error as string, variant: "destructive" });
      return;
    }
    toast({ title: "Nó criado", description: "Já disponível para relacionamento." });
    setRotulo("");
    setRef("");
    setDescricao("");
    void recarregar();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Nós manuais</h1>
      <p className="mt-1 max-w-2xl text-muted-foreground">
        Knowledge Objects, Fatos, Fontes, Categorias e Perguntas são projetados automaticamente
        dos seus módulos. Aqui cadastram-se apenas os nós que não existem em outro lugar.
      </p>

      <Card className="mt-6 grid gap-3 p-4 md:grid-cols-2">
        <div>
          <Label>Tipo de nó</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as NodeKind)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {MANUAL_KINDS.map((k) => (
                <SelectItem key={k} value={k}>{NODE_KIND_LABEL[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Rótulo</Label>
          <Input placeholder="Ex.: Lei 9.279/96 (LPI)" value={rotulo} onChange={(e) => setRotulo(e.target.value)} />
        </div>
        <div>
          <Label>Referência (slug)</Label>
          <Input
            placeholder={normalizeRef(rotulo) || "gerado a partir do rótulo"}
            value={ref}
            onChange={(e) => setRef(e.target.value)}
          />
        </div>
        <div>
          <Label>Entidade</Label>
          <Input placeholder="Ex.: marca" value={entidade} onChange={(e) => setEntidade(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>Descrição</Label>
          <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        <div>
          <Label>Criado por</Label>
          <Input placeholder="seu.nome" value={autor} onChange={(e) => setAutor(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button onClick={salvar} disabled={salvando || !rotulo.trim() || !autor.trim()}>
            <Plus className="mr-1.5 h-4 w-4" /> Criar nó
          </Button>
        </div>
      </Card>

      <Card className="mt-4 p-4">
        <p className="text-sm font-semibold text-foreground">Nós manuais ({manuais.length})</p>
        {manuais.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">Nenhum nó manual cadastrado ainda.</p>
        )}
        <ul className="mt-3 space-y-2">
          {manuais.map((n) => (
            <li key={n.id} className="rounded-lg border border-border p-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <NodeKindBadge kind={n.kind} />
                <NodeStatusBadge status={n.status} />
                <Link
                  to={`/intelligence/admin/graph/explorer?no=${encodeURIComponent(n.id)}`}
                  className="ml-auto text-xs text-primary hover:underline"
                >
                  Explorar
                </Link>
              </div>
              <p className="mt-1 text-sm font-medium text-foreground">{n.rotulo}</p>
              {n.descricao && <p className="text-xs text-muted-foreground">{n.descricao}</p>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};

export default GraphNodes;