import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Send, Mail, MessageCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type LembreteInvoice = {
  id: string;
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

export default function LembreteConfirmDialog({ open, onOpenChange, invoices, onDone }: Props) {
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [currentName, setCurrentName] = useState<string>("");
  const [stats, setStats] = useState({ ok: 0, fail: 0, skip: 0 });

  const runSend = async () => {
    setSending(true);
    setProgress(0);
    setStats({ ok: 0, fail: 0, skip: 0 });
    let ok = 0, fail = 0, skip = 0;
    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];
      setCurrentIdx(i + 1);
      setCurrentName(inv.cliente_nome || "Cliente");
      try {
        const { data, error } = await supabase.functions.invoke("lembrar-fatura-vencendo", {
          body: { invoice_id: inv.id, tipo: inv.tipo, origin: "manual_admin" },
        });
        if (error) { fail++; }
        else if ((data as any)?.skipped) { skip++; }
        else { ok++; }
      } catch { fail++; }
      setStats({ ok, fail, skip });
      setProgress(Math.round(((i + 1) / invoices.length) * 100));

      // Delay de 1 minuto entre envios (a 1ª sai imediata). Sem delay em envio único.
      if (invoices.length > 1 && i < invoices.length - 1) {
        await new Promise((r) => setTimeout(r, 60_000));
      }
    }
    setSending(false);
    toast.success(`Envio concluído: ${ok} enviadas · ${skip} puladas · ${fail} falhas`);
    onDone?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!sending) onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar lembretes de vencimento</DialogTitle>
          <DialogDescription>
            {invoices.length} fatura(s) selecionada(s). O envio é <strong>real e imediato</strong> por Email + WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {!sending ? (
          <div className="space-y-3 py-2">
            <div className="rounded-lg border bg-muted/20 p-3 text-sm space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" /> Email
                <MessageCircle className="h-4 w-4 ml-2 text-emerald-500" /> WhatsApp
              </div>
              <div className="text-xs text-muted-foreground">Clientes que receberão o lembrete:</div>
              <ul className="text-xs space-y-1">
                {invoices.slice(0, 5).map((i) => (
                  <li key={i.id}>• {i.cliente_nome || "Cliente"}</li>
                ))}
                {invoices.length > 5 && (
                  <li className="text-muted-foreground">…e mais {invoices.length - 5}</li>
                )}
              </ul>
            </div>
            {invoices.length > 1 && (
              <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md p-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Envios sequenciais com intervalo automático de 5 a 10 segundos entre cada cliente. Não feche a janela.</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="text-sm">
              Enviando <strong>{currentIdx}</strong> de <strong>{invoices.length}</strong>
              <span className="text-muted-foreground"> — {currentName}</span>
            </div>
            <Progress value={progress} />
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span>✅ {stats.ok} enviadas</span>
              <span>⏭ {stats.skip} puladas</span>
              <span>❌ {stats.fail} falhas</span>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={runSend} disabled={sending || invoices.length === 0}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            {sending ? "Enviando..." : `Enviar agora (${invoices.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}