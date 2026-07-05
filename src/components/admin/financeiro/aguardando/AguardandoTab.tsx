import { lazy, Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Send, Bell, Mail, MessageCircle, Link2 } from "lucide-react";
import LembreteConfirmDialog, { type LembreteInvoice } from "./LembreteConfirmDialog";
import { format, addDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { loadClientForSheet } from "@/lib/clientSheet";
import type { ClientWithProcess } from "@/components/admin/clients/ClientKanbanBoard";
import { LinkClientToInvoiceDialog } from "./LinkClientToInvoiceDialog";

const ClientDetailSheet = lazy(() =>
  import("@/components/admin/clients/ClientDetailSheet").then((m) => ({ default: m.ClientDetailSheet }))
);

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
  const [openClient, setOpenClient] = useState<ClientWithProcess | null>(null);
  const [loadingClient, setLoadingClient] = useState<string | null>(null);
  const [linkDialog, setLinkDialog] = useState<{ asaas_payment_id: string | null; asaas_customer_id: string | null; invoice_id: string | null; nome: string | null } | null>(null);

  // Fonte da verdade: Asaas. Listamos cobranças ativas direto na API do Asaas
  // e enriquecemos com dados locais (perfil + invoice_id). Faturas que não
  // existem mais no Asaas simplesmente não aparecem.
  const query = useQuery({
    queryKey: ["financeiro-aguardando-asaas", tab, d0, d3],
    queryFn: async () => {
      const body: Record<string, string> = {};
      if (tab === "d0") body.date = d0;
      else if (tab === "d3") body.date = d3;
      else { body.date_from = d0; body.date_to = isoDate(addDays(today, 60)); }

      const { data, error } = await supabase.functions.invoke("list-asaas-due-invoices", { body });
      if (error) throw error;
      const items = ((data as any)?.items ?? []) as Array<any>;
      // Normaliza para o formato usado pela UI
      return items.map((it) => ({
        // usa asaas_payment_id como chave de seleção (garante unicidade mesmo sem invoice local)
        row_key: it.asaas_payment_id,
        id: it.invoice_id,                 // invoice_id local (pode ser null)
        asaas_payment_id: it.asaas_payment_id,
        asaas_customer_id: it.asaas_customer_id,
        user_id: it.user_id,
        amount: it.amount,
        due_date: it.due_date,
        status: it.status,
        invoice_url: it.invoice_url,
        description: it.description,
        profiles: {
          full_name: it.cliente_nome,
          email: it.cliente_email,
          phone: it.cliente_phone,
        },
      }));
    },
  });

  const openClientFile = async (row: any) => {
    if (!row.user_id) {
      // órfão: abre diálogo para vincular
      setLinkDialog({
        asaas_payment_id: row.asaas_payment_id,
        asaas_customer_id: row.asaas_customer_id ?? null,
        invoice_id: row.id,
        nome: row.profiles?.full_name ?? null,
      });
      return;
    }
    setLoadingClient(row.user_id);
    try {
      const full = await loadClientForSheet(row.user_id);
      if (!full) { toast.error("Ficha do cliente não encontrada"); return; }
      setOpenClient(full);
    } catch (e: any) {
      toast.error("Falha ao abrir ficha: " + (e.message || e));
    } finally {
      setLoadingClient(null);
    }
  };

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
    if (checked) setSelected(new Set(rows.filter((r: any) => r.id).map((r: any) => r.row_key)));
    else setSelected(new Set());
  };
  const toggle = (id: string) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  };

  const dialogInvoices: LembreteInvoice[] = useMemo(() => {
    return rows
      .filter((r: any) => selected.has(r.row_key) && r.id)
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
            onClick={() => setSelected(new Set(rows.filter((r: any) => r.id).map((r: any) => r.row_key)))}
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
              const last = r.id ? historyQuery.data?.get(r.id) : undefined;
              const tipoRow: "d0" | "d3" = r.due_date === d0 ? "d0" : "d3";
              const canRemind = !!r.id;
              return (
                <tr key={r.row_key} className="border-t hover:bg-muted/20">
                  <td className="p-2">
                    <Checkbox
                      checked={selected.has(r.row_key)}
                      disabled={!canRemind}
                      onCheckedChange={() => toggle(r.row_key)}
                    />
                  </td>
                  <td className="p-2">
                    <div className="font-medium">{p.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{p.email || "sem email"}</div>
                    {!canRemind && (
                      <div className="text-[10px] text-amber-600 mt-0.5">Sem vínculo local — envio manual apenas</div>
                    )}
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
                      disabled={!canRemind}
                      onClick={() => { setSelected(new Set([r.row_key])); setDialogOpen(true); }}
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