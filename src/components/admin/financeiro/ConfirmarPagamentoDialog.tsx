import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";

export interface ConfirmarPagamentoTarget {
  historico_id?: string | null;
  invoice_id?: string | null;
  parcela_id?: string | null;
  parcela_tipo?: "devedor" | "renegociada" | null;
  cliente_nome?: string | null;
  valor?: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: ConfirmarPagamentoTarget | null;
  onConfirmed?: () => void;
}

export function ConfirmarPagamentoDialog({ open, onOpenChange, target, onConfirmed }: Props) {
  const [valor, setValor] = useState<string>("");
  const [data, setData] = useState<string>(new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  const confirmar = async () => {
    if (!target) return;
    setSaving(true);
    try {
      const parsed = Number(valor.replace(/\./g, "").replace(",", "."));
      const { data: res, error } = await supabase.functions.invoke("confirmar-pagamento-manual", {
        body: {
          historico_id: target.historico_id ?? null,
          invoice_id: target.invoice_id ?? null,
          parcela_id: target.parcela_id ?? null,
          parcela_tipo: target.parcela_tipo ?? null,
          valor: Number.isFinite(parsed) && parsed > 0 ? parsed : target.valor ?? undefined,
          pago_em: data,
          observacao: obs,
        },
      });
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      const asaas = (res as any)?.asaas as string | undefined;
      if (asaas && asaas.startsWith("nao_registrado")) {
        toast.warning("Pagamento confirmado no CRM, mas não foi possível dar baixa no Asaas: " + asaas.replace("nao_registrado: ", ""));
      } else {
        toast.success("Pagamento confirmado e baixado no Asaas");
      }
      onOpenChange(false);
      setValor(""); setObs("");
      onConfirmed?.();
    } catch (e: any) {
      toast.error("Falha ao confirmar pagamento: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Confirmar pagamento manual
          </DialogTitle>
          <DialogDescription>
            Use quando o cliente pagou por fora (Pix em outra conta). A fatura recebe baixa em dinheiro no Asaas e é marcada como paga no CRM.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {target?.cliente_nome && (
            <div className="text-sm">
              Cliente: <span className="font-medium">{target.cliente_nome}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="cp-valor">Valor recebido (R$)</Label>
            <Input
              id="cp-valor"
              inputMode="decimal"
              placeholder={target?.valor ? String(target.valor) : "0,00"}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">Deixe em branco para usar o valor original da fatura.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-data">Data do pagamento</Label>
            <Input id="cp-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-obs">Observação (opcional)</Label>
            <Textarea id="cp-obs" rows={3} maxLength={500} value={obs} onChange={(e) => setObs(e.target.value)}
              placeholder="Ex.: Pix recebido na conta Itaú, comprovante enviado no WhatsApp." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={confirmar} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
