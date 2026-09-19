import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pendente: { label: "Aguardando", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  processando: { label: "Enviando", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  enviado: { label: "Enviado", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  pulado: { label: "Pulado", className: "bg-muted text-muted-foreground" },
  falha: { label: "Falha", className: "bg-destructive/15 text-destructive" },
  cancelado: { label: "Cancelado", className: "bg-muted text-muted-foreground" },
};

export default function FilaLembretesTab() {
  const query = useQuery({
    queryKey: ["lembrete-fila"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lembrete_fila")
        .select("*")
        .order("scheduled_at", { ascending: true })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = query.data ?? [];
  const pendentes = rows.filter((r) => r.status === "pendente" || r.status === "processando");
  const enviados = rows.filter((r) => r.status === "enviado").length;
  const falhas = rows.filter((r) => r.status === "falha").length;

  const cancelar = async (id: string) => {
    const { error } = await supabase
      .from("lembrete_fila")
      .update({ status: "cancelado" })
      .eq("id", id)
      .eq("status", "pendente");
    if (error) toast.error(`Falha ao cancelar: ${error.message}`);
    else {
      toast.success("Lembrete cancelado");
      query.refetch();
    }
  };

  const cancelarTodos = async () => {
    const { error } = await supabase
      .from("lembrete_fila")
      .update({ status: "cancelado" })
      .eq("status", "pendente");
    if (error) toast.error(`Falha ao cancelar: ${error.message}`);
    else {
      toast.success("Fila cancelada");
      query.refetch();
    }
  };

  if (query.isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-muted-foreground">
          {pendentes.length} na fila · {enviados} enviado(s) · {falhas} falha(s)
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => query.refetch()} className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={cancelarTodos}
            disabled={pendentes.length === 0}
            className="gap-1"
          >
            <XCircle className="h-3.5 w-3.5" /> Cancelar pendentes
          </Button>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide">
            <tr>
              <th className="p-2 text-left">Cliente</th>
              <th className="p-2 text-left">Tipo</th>
              <th className="p-2 text-left">Previsto para</th>
              <th className="p-2 text-left">Situação</th>
              <th className="p-2 text-left">Observação</th>
              <th className="p-2 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = STATUS_LABEL[r.status] ?? { label: r.status, className: "bg-muted" };
              return (
                <tr key={r.id} className="border-t hover:bg-muted/20">
                  <td className="p-2 font-medium">{r.cliente_nome || "Cliente"}</td>
                  <td className="p-2">
                    <Badge variant="outline">{r.tipo === "d0" ? "D-0" : "D-3"}</Badge>
                  </td>
                  <td className="p-2 text-xs">
                    {format(new Date(r.scheduled_at), "dd/MM HH:mm")}
                    {r.sent_at && (
                      <div className="text-muted-foreground">enviado {format(new Date(r.sent_at), "dd/MM HH:mm")}</div>
                    )}
                  </td>
                  <td className="p-2">
                    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${st.className}`}>
                      {st.label}
                    </span>
                  </td>
                  <td className="p-2 text-xs text-muted-foreground max-w-[260px] break-words">
                    {r.last_error || "—"}
                  </td>
                  <td className="p-2 text-right">
                    {r.status === "pendente" ? (
                      <Button size="sm" variant="ghost" onClick={() => cancelar(r.id)}>
                        Cancelar
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum lembrete na fila.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
