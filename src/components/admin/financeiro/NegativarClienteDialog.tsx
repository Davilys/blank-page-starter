import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Ban, Loader2, ShieldOff } from "lucide-react";

export interface NegativarTarget {
  user_id?: string | null;
  cpf_cnpj?: string | null;
  nome?: string | null;
  jaNegativado?: boolean;
}

interface Preview {
  cliente: { nome: string | null; email: string | null; negativado: boolean };
  total_debitos: number;
  qtd_debitos: number;
  debitos: Array<{ id: string; descricao: string | null; valor: number; vencimento: string | null }>;
}

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: NegativarTarget | null;
  onDone?: () => void;
}

export function NegativarClienteDialog({ open, onOpenChange, target, onDone }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    if (!open || !target) { setPreview(null); return; }
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("negativar-cliente", {
          body: { action: "preview", user_id: target.user_id ?? null, cpf_cnpj: target.cpf_cnpj ?? null, nome: target.nome ?? null },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        setPreview(data as Preview);
      } catch (e: any) {
        toast.error("Não foi possível carregar os débitos: " + (e.message || e));
        onOpenChange(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, target]);

  const run = async (action: "negativar" | "remover") => {
    if (!target) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("negativar-cliente", {
        body: { action, user_id: target.user_id ?? null, cpf_cnpj: target.cpf_cnpj ?? null, nome: target.nome ?? null },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(action === "negativar" ? "Cliente marcado como negativado" : "Etiqueta de negativado removida");
      onOpenChange(false);
      onDone?.();
    } catch (e: any) {
      toast.error("Falha: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const jaNegativado = preview?.cliente.negativado ?? target?.jaNegativado ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-4 w-4 text-red-500" /> Negativar cliente
          </DialogTitle>
          <DialogDescription>
            Marcação interna do CRM. Todos os débitos em aberto do cliente (por CPF/CNPJ) são consolidados abaixo.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : preview ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">{preview.cliente.nome || target?.nome || "—"}</div>
              {jaNegativado && <Badge className="bg-zinc-800 text-white">Negativado</Badge>}
            </div>
            <div className="rounded-md border p-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{preview.qtd_debitos} débito(s) em aberto</span>
              <span className="text-lg font-bold text-red-500">{fmtBRL(preview.total_debitos)}</span>
            </div>
            <div className="max-h-56 overflow-auto rounded-md border divide-y">
              {preview.debitos.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">Nenhum débito em aberto encontrado.</div>
              ) : preview.debitos.map((d) => (
                <div key={d.id} className="p-2 flex items-center justify-between text-xs">
                  <span className="truncate max-w-[60%]">{d.descricao || "Fatura"}</span>
                  <span className="text-muted-foreground">{d.vencimento ? new Date(d.vencimento + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</span>
                  <span className="font-semibold">{fmtBRL(d.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          {jaNegativado ? (
            <Button variant="secondary" onClick={() => run("remover")} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShieldOff className="h-4 w-4 mr-1" />}
              Remover negativação
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => run("negativar")} disabled={saving || loading}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Ban className="h-4 w-4 mr-1" />}
              Confirmar negativação
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
