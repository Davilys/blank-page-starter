import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Mail, MessageCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type LembreteInvoice = {
  id: string | null;
  asaas_payment_id?: string | null;
  tipo: "d0" | "d3";
  cliente_nome?: string | null;
  amount?: number | null;
  due_date?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoices: LembreteInvoice[];
  onDone?: () => void;
};

const INTERVALOS = [3, 5, 10, 15];

function horaPrevista(minutos: number) {
  const d = new Date(Date.now() + minutos * 60 * 1000);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function LembreteConfirmDialog({ open, onOpenChange, invoices, onDone }: Props) {
  const [enfileirando, setEnfileirando] = useState(false);
  const [intervalo, setIntervalo] = useState(5);

  const enfileirar = async () => {
    setEnfileirando(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const batchId = crypto.randomUUID();
      const agora = Date.now();

      // Evita duplicar quem já está aguardando envio na fila
      const { data: jaNaFila } = await supabase
        .from("lembrete_fila")
        .select("invoice_id, asaas_payment_id")
        .in("status", ["pendente", "processando"]);

      const invoicesNaFila = new Set((jaNaFila ?? []).map((r) => r.invoice_id).filter(Boolean) as string[]);
      const asaasNaFila = new Set((jaNaFila ?? []).map((r) => r.asaas_payment_id).filter(Boolean) as string[]);

      const novos = invoices.filter((inv) => {
        if (inv.id && invoicesNaFila.has(inv.id)) return false;
        if (!inv.id && inv.asaas_payment_id && asaasNaFila.has(inv.asaas_payment_id)) return false;
        return true;
      });

      const ignorados = invoices.length - novos.length;

      if (novos.length === 0) {
        toast.info("Todas as faturas selecionadas já estão aguardando envio na fila.");
        onDone?.();
        onOpenChange(false);
        return;
      }

      const rows = novos.map((inv, i) => ({
        invoice_id: inv.id ?? null,
        asaas_payment_id: inv.asaas_payment_id ?? null,
        tipo: inv.tipo,
        cliente_nome: inv.cliente_nome ?? null,
        scheduled_at: new Date(agora + i * intervalo * 60 * 1000).toISOString(),
        status: "pendente",
        batch_id: batchId,
        interval_minutes: intervalo,
        created_by: userRes?.user?.id ?? null,
      }));

      const { error } = await supabase.from("lembrete_fila").insert(rows);
      if (error) throw error;

      toast.success(
        `${rows.length} lembrete(s) na fila — 1 a cada ${intervalo} min.` +
          (ignorados > 0 ? ` ${ignorados} já estava(m) aguardando envio.` : "")
      );
      onDone?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(`Falha ao enfileirar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setEnfileirando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!enfileirando) onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar lembretes de vencimento</DialogTitle>
          <DialogDescription>
            {invoices.length} fatura(s) selecionada(s). Os envios entram em uma <strong>fila no servidor</strong> e saem
            um por vez, respeitando o intervalo escolhido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-lg border bg-muted/20 p-3 text-sm space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" /> Email
              <MessageCircle className="h-4 w-4 ml-2 text-emerald-500" /> WhatsApp
            </div>
            <div className="text-xs text-muted-foreground">Clientes que receberão o lembrete:</div>
            <ul className="text-xs space-y-1">
              {invoices.slice(0, 5).map((i, idx) => (
                <li key={i.id ?? i.asaas_payment_id ?? idx}>• {i.cliente_nome || "Cliente"}</li>
              ))}
              {invoices.length > 5 && (
                <li className="text-muted-foreground">…e mais {invoices.length - 5}</li>
              )}
            </ul>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Intervalo entre envios</Label>
            <Select value={String(intervalo)} onValueChange={(v) => setIntervalo(Number(v))}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVALOS.map((m) => (
                  <SelectItem key={m} value={String(m)}>{m} minutos</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 border rounded-md p-2">
            <Clock className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              O 1º sai por volta de {horaPrevista(0)} e o último por volta de{" "}
              {horaPrevista((invoices.length - 1) * intervalo)}. Você pode fechar a tela — o envio continua no servidor,
              dentro do horário comercial (08h–18h, seg–sex). Acompanhe na aba <strong>Fila</strong>.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enfileirando}>
            Cancelar
          </Button>
          <Button onClick={enfileirar} disabled={enfileirando || invoices.length === 0}>
            {enfileirando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            {enfileirando ? "Enfileirando..." : `Colocar na fila (${invoices.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
