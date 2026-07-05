import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Mail, MessageCircle, History } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Row = {
  id: string;
  invoice_id: string | null;
  cliente_nome: string | null;
  cliente_email: string | null;
  cliente_phone: string | null;
  canais: string[] | null;
  tipo: string | null;
  status: string | null;
  enviada_em: string | null;
  created_at: string;
};

export default function HistoricoLembretesTab() {
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["historico-lembretes-vencimento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cobranca_historico")
        .select("id, invoice_id, cliente_nome, cliente_email, cliente_phone, canais, tipo, status, enviada_em, created_at")
        .in("tipo", ["lembrete_d0", "lembrete_d3"])
        .order("enviada_em", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const { error } = await supabase.from("cobranca_historico").delete().eq("id", id);
      if (error) throw error;
      toast.success("Registro excluído do histórico");
      qc.invalidateQueries({ queryKey: ["historico-lembretes-vencimento"] });
      qc.invalidateQueries({ queryKey: ["cobranca-historico-lembretes"] });
    } catch (e: any) {
      toast.error(`Falha ao excluir: ${e?.message ?? e}`);
    } finally {
      setDeleting(null);
      setConfirmId(null);
    }
  };

  if (query.isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const rows = query.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <History className="h-4 w-4" /> {rows.length} lembrete(s) enviados
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide">
            <tr>
              <th className="p-2 text-left">Cliente</th>
              <th className="p-2 text-left">Tipo</th>
              <th className="p-2 text-left">Canais</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Enviado em</th>
              <th className="p-2 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/20">
                <td className="p-2">
                  <div className="font-medium">{r.cliente_nome || "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.cliente_email || r.cliente_phone || ""}</div>
                </td>
                <td className="p-2">
                  <Badge variant="outline">{r.tipo === "lembrete_d0" ? "D-0" : "D-3"}</Badge>
                </td>
                <td className="p-2">
                  <div className="flex gap-1">
                    {r.canais?.includes("email") && <Mail className="h-3.5 w-3.5 text-muted-foreground" />}
                    {r.canais?.includes("whatsapp") && <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />}
                  </div>
                </td>
                <td className="p-2">
                  <Badge variant={r.status === "enviada" ? "default" : "secondary"}>{r.status}</Badge>
                </td>
                <td className="p-2 text-xs text-muted-foreground">
                  {r.enviada_em ? format(new Date(r.enviada_em), "dd/MM/yyyy HH:mm") : "—"}
                </td>
                <td className="p-2 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmId(r.id)}
                    disabled={deleting === r.id}
                  >
                    {deleting === r.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum lembrete enviado ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!confirmId} onOpenChange={(v) => { if (!v) setConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro do histórico?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove permanentemente o registro deste envio. Não afeta a fatura no Asaas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmId && handleDelete(confirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}