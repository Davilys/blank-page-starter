/**
 * Formulário de relação. Mostra os portões de validação EM TEMPO REAL —
 * o editor entende por que a relação é (ou não é) aceita antes de salvar.
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  EDGE_DIRECTIONS,
  EDGE_SOURCE_KINDS,
  EDGE_SOURCE_KIND_LABEL,
  EDGE_STATUSES,
  EDGE_STATUS_LABEL,
  EDGE_TYPES,
  EDGE_TYPE_LABEL,
  SOURCE_REQUIRED_EDGE_TYPES,
  emptyEdge,
  type EdgeDirection,
  type EdgeSourceKind,
  type EdgeStatus,
  type EdgeType,
  type GraphEdge,
} from "../../../domain/graph/GraphEdge";
import type { GraphNode } from "../../../domain/graph/GraphNode";
import { evaluateEdgeGates, hasBlockers } from "../../../domain/graph/validation";
import { useGraphCommands } from "../../hooks/useGraph";
import NodePicker from "./NodePicker";

interface Props {
  readonly aberto: boolean;
  readonly onFechar: () => void;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly edicao?: GraphEdge | null;
  readonly origemInicial?: string;
  readonly onSalvo: () => void;
}

const EdgeForm = ({ aberto, onFechar, nodes, edges, edicao, origemInicial, onSalvo }: Props) => {
  const { salvando, salvarRelacao } = useGraphCommands();
  const [form, setForm] = useState(() => emptyEdge());
  const [motivo, setMotivo] = useState("");
  const [fonteTipo, setFonteTipo] = useState<EdgeSourceKind>("decisao-editorial");
  const [fonteTitulo, setFonteTitulo] = useState("");
  const [fonteDispositivo, setFonteDispositivo] = useState("");

  useEffect(() => {
    if (!aberto) return;
    if (edicao) {
      setForm({
        origem: edicao.origem,
        destino: edicao.destino,
        tipo: edicao.tipo,
        direcao: edicao.direcao,
        peso: edicao.peso,
        confianca: edicao.confianca,
        justificativa: edicao.justificativa,
        criadoPor: edicao.criadoPor,
        periodicidadeDias: edicao.periodicidadeDias,
        status: edicao.status,
        observacoes: edicao.observacoes ?? "",
      });
      setFonteTipo(edicao.fonte?.tipo ?? "decisao-editorial");
      setFonteTitulo(edicao.fonte?.titulo ?? "");
      setFonteDispositivo(edicao.fonte?.dispositivo ?? "");
    } else {
      setForm({ ...emptyEdge(), origem: origemInicial ?? "" });
      setFonteTipo("decisao-editorial");
      setFonteTitulo("");
      setFonteDispositivo("");
    }
    setMotivo("");
  }, [aberto, edicao, origemInicial]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const fonte = fonteTitulo.trim()
    ? { tipo: fonteTipo, titulo: fonteTitulo.trim(), dispositivo: fonteDispositivo.trim() || undefined }
    : undefined;

  const portoes = useMemo(
    () =>
      evaluateEdgeGates(
        {
          id: edicao?.id,
          origem: form.origem,
          destino: form.destino,
          tipo: form.tipo,
          direcao: form.direcao,
          peso: form.peso,
          confianca: form.confianca,
          justificativa: form.justificativa,
          criadoPor: form.criadoPor,
          fonte,
        },
        { nodes, edges },
      ),
    [form, fonte, nodes, edges, edicao],
  );

  const bloqueado = hasBlockers(portoes);

  const submeter = async () => {
    if (!motivo.trim()) {
      toast({ title: "Motivo obrigatório", description: "A auditoria exige o motivo da alteração.", variant: "destructive" });
      return;
    }
    const r = await salvarRelacao({
      id: edicao?.id,
      origem: form.origem,
      destino: form.destino,
      tipo: form.tipo,
      direcao: form.direcao,
      peso: form.peso,
      confianca: form.confianca,
      justificativa: form.justificativa,
      criadoPor: form.criadoPor,
      fonte,
      status: form.status,
      periodicidadeDias: form.periodicidadeDias,
      observacoes: form.observacoes,
      motivo,
    });
    if (!r.ok) {
      toast({ title: "Relação recusada", description: r.error as string, variant: "destructive" });
      return;
    }
    toast({ title: edicao ? "Relação atualizada" : "Relação criada", description: "Registro gravado na auditoria." });
    onSalvo();
    onFechar();
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{edicao ? "Editar relação" : "Nova relação"}</DialogTitle>
          <DialogDescription>
            Toda relação é criada por um humano, justificada e auditada. Nenhuma inferência automática.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Origem</Label>
              <NodePicker nodes={nodes} value={form.origem} onChange={(v) => set({ origem: v })} excluir={form.destino} />
            </div>
            <div>
              <Label>Destino</Label>
              <NodePicker nodes={nodes} value={form.destino} onChange={(v) => set({ destino: v })} excluir={form.origem} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Tipo de relação</Label>
              <Select value={form.tipo} onValueChange={(v) => set({ tipo: v as EdgeType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {EDGE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{EDGE_TYPE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Direção</Label>
              <Select value={form.direcao} onValueChange={(v) => set({ direcao: v as EdgeDirection })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EDGE_DIRECTIONS.map((d) => (
                    <SelectItem key={d} value={d}>{d === "dirigida" ? "Dirigida (A → B)" : "Bidirecional (A ↔ B)"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set({ status: v as EdgeStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EDGE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{EDGE_STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Peso da relação — {form.peso}</Label>
              <Slider className="mt-3" value={[form.peso]} min={0} max={100} step={5} onValueChange={([v]) => set({ peso: v })} />
            </div>
            <div>
              <Label>Confiança — {form.confianca}</Label>
              <Slider className="mt-3" value={[form.confianca]} min={0} max={100} step={5} onValueChange={([v]) => set({ confianca: v })} />
            </div>
          </div>

          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-sm font-medium text-foreground">
              Fonte da relação
              {SOURCE_REQUIRED_EDGE_TYPES.includes(form.tipo) && (
                <span className="ml-1 text-destructive">*obrigatória para este tipo</span>
              )}
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Select value={fonteTipo} onValueChange={(v) => setFonteTipo(v as EdgeSourceKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EDGE_SOURCE_KINDS.map((s) => (
                    <SelectItem key={s} value={s}>{EDGE_SOURCE_KIND_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Título (ex.: Lei 9.279/96)" value={fonteTitulo} onChange={(e) => setFonteTitulo(e.target.value)} />
              <Input placeholder="Dispositivo (ex.: art. 158)" value={fonteDispositivo} onChange={(e) => setFonteDispositivo(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Justificativa</Label>
            <Textarea
              rows={3}
              placeholder="Por que esta relação existe? (mínimo 15 caracteres)"
              value={form.justificativa}
              onChange={(e) => set({ justificativa: e.target.value })}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Criado por</Label>
              <Input placeholder="seu.nome" value={form.criadoPor} onChange={(e) => set({ criadoPor: e.target.value })} />
            </div>
            <div>
              <Label>Revalidar a cada (dias)</Label>
              <Input
                type="number"
                min={30}
                value={form.periodicidadeDias}
                onChange={(e) => set({ periodicidadeDias: Number(e.target.value) || 180 })}
              />
            </div>
            <div>
              <Label>Motivo (auditoria)</Label>
              <Input placeholder="Ex.: vínculo normativo confirmado" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="mb-2 text-sm font-medium text-foreground">Validação estrutural</p>
            <ul className="space-y-1.5">
              {portoes.map((g) => (
                <li key={g.id} className="flex items-start gap-2 text-xs">
                  {g.ok ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  ) : g.severidade === "bloqueio" ? (
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  )}
                  <span>
                    <strong className="text-foreground">{g.rotulo}</strong>
                    <span className="text-muted-foreground"> — {g.detalhe}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={submeter} disabled={bloqueado || salvando}>
            {bloqueado ? "Relação bloqueada" : salvando ? "Salvando..." : "Salvar relação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EdgeForm;