import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Send, Bell, Mail, MessageCircle } from "lucide-react";
import LembreteConfirmDialog, { type LembreteInvoice } from "./LembreteConfirmDialog";
import { format, addDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type TabKey = "d0" | "d3" | "all";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AguardandoTab({ tab }: { tab: TabKey }) {
  const today = new Date();
  const d0 = isoDate(today);
  const d3 = isoDate(addDays(today, 3));

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);

  const query = useQuery({
    queryKey: ["financeiro-aguardando", tab, d0, d3],
    queryFn: async () => {
      let q = supabase
        .from("invoices")
        .select("id, user_id, amount, due_date, status, invoice_url, description, profiles:user_id(full_name,email,phone)")
        .in("status", ["pending", "open"]);

      if (tab === "d0") q = q.eq("due_date", d0);
      else if (tab === "d3") q = q.eq("due_date", d3);
      else q = q.gte("due_date", d0);

      const { data, error } = await q.order("due_date", { ascending: true }).limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const historyQuery = useQuery({
    queryKey: ["cobranca-historico-lembretes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cobranca_historico")
        .select("invoice_id, tipo, enviada_em")
        .in("tipo", ["lembrete_d0", "lembrete_d3"])
        .order("enviada_em", { ascending: false })
        .limit(1000);
      const map = new Map<string, { tipo: string; enviada_em: string }>();
      for (const h of data ?? []) {
        if (!map.has(h.invoice_id!)) map.set(h.invoice_id!, { tipo: h.tipo!, enviada_em: h.enviada_em! });
      }
      return map;
    },
  });

  const rows = query.data ?? [];

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(rows.map((r: any) => r.id)));
    else setSelected(new Set());
  };
  const toggle = (id: string) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  };

  const dialogInvoices: LembreteInvoice[] = useMemo(() => {
    return rows
      .filter((r: any) => selected.has(r.id))
      .map((r: any) => ({
        id: r.id,
        tipo: (r.due_date === d0 ? "d0" : "d3") as "d0" | "d3",
        cliente_nome: r.profiles?.full_name ?? null,
        amount: r.amount,
        due_date: r.due_date,
      }));
  }, [selected, rows, d0]);

  if (query.isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-muted-foreground">
          {rows.length} fatura(s) aguardando pagamento
          {tab === "d0" && " · vencendo hoje"}
          {tab === "d3" && " · vencendo em 3 dias"}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelected(new Set(rows.map((r: any) => r.id)))}
            disabled={rows.length === 0}
          >
            Selecionar todos
          </Button>
          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
            disabled={selected.size === 0}
            className="gap-1"
          >
            <Send className="h-3.5 w-3.5" />
            Lembrar {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide">
            <tr>
              <th className="p-2 w-8">
                <Checkbox
                  checked={rows.length > 0 && selected.size === rows.length}
                  onCheckedChange={(v) => toggleAll(!!v)}
                />
              </th>
              <th className="p-2 text-left">Cliente</th>
              <th className="p-2 text-left">Valor</th>
              <th className="p-2 text-left">Vencimento</th>
              <th className="p-2 text-left">Canais</th>
              <th className="p-2 text-left">Último lembrete</th>
              <th className="p-2 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => {
              const p = r.profiles ?? {};
              const last = historyQuery.data?.get(r.id);
              const tipoRow: "d0" | "d3" = r.due_date === d0 ? "d0" : "d3";
              return (
                <tr key={r.id} className="border-t hover:bg-muted/20">
                  <td className="p-2">
                    <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                  </td>
                  <td className="p-2">
                    <div className="font-medium">{p.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{p.email || "sem email"}</div>
                  </td>
                  <td className="p-2 font-mono">
                    {Number(r.amount || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="p-2">
                    {r.due_date ? format(parseISO(r.due_date), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                    {r.due_date === d0 && <Badge variant="destructive" className="ml-2">Hoje</Badge>}
                    {r.due_date === d3 && <Badge className="ml-2 bg-amber-500">D-3</Badge>}
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      {p.email && <Mail className="h-3.5 w-3.5 text-muted-foreground" />}
                      {p.phone && <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />}
                    </div>
                  </td>
                  <td className="p-2 text-xs">
                    {last ? (
                      <div>
                        <Badge variant="outline">{last.tipo === "lembrete_d0" ? "D-0" : "D-3"}</Badge>
                        <div className="text-muted-foreground mt-0.5">
                          {format(new Date(last.enviada_em), "dd/MM HH:mm")}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Nunca</span>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setSelected(new Set([r.id])); setDialogOpen(true); }}
                    >
                      <Bell className="h-3.5 w-3.5 mr-1" /> Lembrar
                    </Button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhuma fatura encontrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <LembreteConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        invoices={dialogInvoices}
        onDone={() => { query.refetch(); historyQuery.refetch(); setSelected(new Set()); }}
      />
    </div>
  );
}