import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Eye, Mail, MessageCircle } from "lucide-react";
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

type PreviewRow = {
  invoice_id: string;
  tipo: string;
  recipient?: { nome?: string; email?: string; phone?: string };
  channels?: string[];
  subject?: string;
  whatsapp_message?: string;
  email_html?: string;
  skipped?: boolean;
  error?: string;
  reason?: string;
};

export default function LembreteConfirmDialog({ open, onOpenChange, invoices, onDone }: Props) {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [previews, setPreviews] = useState<PreviewRow[]>([]);

  const runSimulate = async () => {
    setLoading(true);
    setPreviews([]);
    const results: PreviewRow[] = [];
    for (const inv of invoices) {
      try {
        const { data, error } = await supabase.functions.invoke("lembrar-fatura-vencendo", {
          body: { invoice_id: inv.id, tipo: inv.tipo, dry_run: true },
        });
        if (error) {
          results.push({ invoice_id: inv.id, tipo: inv.tipo, error: error.message });
        } else {
          results.push(data as PreviewRow);
        }
      } catch (e) {
        results.push({ invoice_id: inv.id, tipo: inv.tipo, error: (e as Error).message });
      }
    }
    setPreviews(results);
    setLoading(false);
  };

  const runSend = async () => {
    setSending(true);
    let ok = 0, fail = 0, skip = 0;
    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];
      try {
        const { data, error } = await supabase.functions.invoke("lembrar-fatura-vencendo", {
          body: { invoice_id: inv.id, tipo: inv.tipo, origin: "manual_admin" },
        });
        if (error) { fail++; }
        else if ((data as any)?.skipped) { skip++; }
        else { ok++; }
      } catch { fail++; }

      // Delay escalonado 5/7/10 min entre envios reais (limitado a 30s por chamada para não estourar timeout)
      if (i < invoices.length - 1) {
        const delays = [5, 7, 10];
        const waitMs = Math.min(delays[i % 3] * 60_000, 30_000);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
    setSending(false);
    toast.success(`Envio concluído: ${ok} enviadas · ${skip} puladas · ${fail} falhas`);
    onDone?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar lembretes de vencimento</DialogTitle>
          <DialogDescription>
            {invoices.length} fatura(s) selecionada(s). Simule antes de enviar para conferir a mensagem.
          </DialogDescription>
        </DialogHeader>

        {previews.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4">
            Clique em <strong>Simular</strong> para gerar a prévia (não envia nada).
          </div>
        ) : (
          <div className="space-y-3">
            {previews.map((p, idx) => (
              <div key={idx} className="rounded-lg border p-3 bg-muted/20 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{p.recipient?.nome ?? "—"}</div>
                  <div className="flex gap-1">
                    <Badge variant="outline">{p.tipo}</Badge>
                    {p.channels?.includes("email") && <Badge variant="secondary"><Mail className="h-3 w-3 mr-1" />Email</Badge>}
                    {p.channels?.includes("whatsapp") && <Badge variant="secondary"><MessageCircle className="h-3 w-3 mr-1" />WhatsApp</Badge>}
                  </div>
                </div>
                {p.error && <div className="text-destructive">Erro: {p.error}</div>}
                {p.subject && <div><strong>Assunto:</strong> {p.subject}</div>}
                {p.whatsapp_message && (
                  <pre className="whitespace-pre-wrap font-sans bg-background border rounded p-2 text-[11px]">{p.whatsapp_message}</pre>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={runSimulate} disabled={loading || sending}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            Simular
          </Button>
          <Button onClick={runSend} disabled={sending || invoices.length === 0}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Confirmar envio ({invoices.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}