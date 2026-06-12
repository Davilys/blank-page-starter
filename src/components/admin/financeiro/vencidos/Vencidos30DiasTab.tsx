import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Mail, Loader2, RefreshCw, Search, CheckCircle2, Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { startOfDay, startOfWeek, startOfMonth, subDays } from "date-fns";
import { loadClientForSheet } from "@/lib/clientSheet";
import type { ClientWithProcess } from "@/components/admin/clients/ClientKanbanBoard";
import { PaginationBar, type PageSize } from "@/components/admin/financeiro/PaginationBar";
import { EditableAmountCell } from "@/components/admin/financeiro/EditableAmountCell";
import { ResponsavelChip } from "@/components/admin/shared/ResponsavelChip";
import { useResponsaveis, atribuirResponsavel } from "@/hooks/useResponsaveis";

const ClientDetailSheet = lazy(() =>
  import("@/components/admin/clients/ClientDetailSheet").then((m) => ({ default: m.ClientDetailSheet }))
);

type Period = "today" | "week" | "month" | "30d";

interface OverdueInvoice {
  id: string;
  description: string | null;
  amount: number;
  due_date: string;
  status: string | null;
  invoice_url: string | null;
  user_id: string | null;
  profiles?: { full_name: string | null; email: string; phone: string | null } | null;
}

interface CobrancaHist {
  id: string;
  invoice_id: string;
  user_id: string | null;
  enviada_em: string;
  canais: string[];
  status: string;
  cliente_nome: string | null;
  proxima_acao_em: string | null;
}

const PAID = ["paid", "confirmed", "received", "RECEIVED", "CONFIRMED"];
const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) => (d ? new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("pt-BR") : "—");
const daysAgo = (d: string) => Math.floor((Date.now() - new Date(d.length === 10 ? d + "T00:00:00" : d).getTime()) / 86400000);

interface Vencidos30DiasTabProps {
  view?: "lista" | "historico";
}

export default function Vencidos30DiasTab({ view = "lista" }: Vencidos30DiasTabProps = {}) {
  const [invoices, setInvoices] = useState<OverdueInvoice[]>([]);
  const [history, setHistory] = useState<CobrancaHist[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [period, setPeriod] = useState<Period>("30d");
  const [search, setSearch] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openClient, setOpenClient] = useState<ClientWithProcess | null>(null);
  const [loadingClient, setLoadingClient] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const invoiceIds = useMemo(() => invoices.map(i => i.id), [invoices]);
  const responsaveisMap = useResponsaveis("invoice", invoiceIds);

  const openClientFile = async (userId: string | null | undefined) => {
    if (!userId) { toast.error("Cliente sem perfil vinculado"); return; }
    setLoadingClient(userId);
    try {
      const full = await loadClientForSheet(userId);
      if (!full) { toast.error("Ficha do cliente não encontrada"); return; }
      setOpenClient(full);
    } catch (e: any) {
      toast.error("Falha ao abrir ficha: " + (e.message || e));
    } finally {
      setLoadingClient(null);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const since = subDays(new Date(), 30).toISOString().split("T")[0];
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("invoices")
        .select("id, description, amount, due_date, status, invoice_url, user_id, profiles:user_id(full_name,email,phone)")
        .gte("due_date", since)
        .lte("due_date", today)
        .order("due_date", { ascending: false })
        .limit(500);
      if (error) throw error;
      // Só consideramos vencido se a data de vencimento já passou.
      // Status 'overdue' isolado não basta — o Asaas pode ter reagendado a fatura para o futuro.
      const overdue = (data || []).filter((i: any) => {
        const s = i.status || "";
        if (PAID.includes(s)) return false;
        if (s === "cancelled" || s === "CANCELLED") return false;
        if (!i.due_date) return false;
        if (daysAgo(i.due_date) <= 0) return false; // vence hoje ou no futuro → não vencido
        return s === "pending" || s === "overdue" || s === "OVERDUE";
      });
      setInvoices(overdue as any);

      const { data: hist } = await supabase
        .from("cobranca_historico")
        .select("id, invoice_id, user_id, enviada_em, canais, status, cliente_nome, proxima_acao_em")
        .order("enviada_em", { ascending: false })
        .limit(200);
      setHistory((hist as any) || []);
    } catch (e: any) {
      toast.error("Erro ao carregar vencidos: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const sync = async () => {
    setSyncing(true);
    try {
      await supabase.functions.invoke("sync-asaas-invoices", { body: {} });
      await supabase.functions.invoke("asaas-debtors-api", { body: { action: "sync-overdue-30" } }).catch(() => {});
      await supabase.functions.invoke("asaas-debtors-api", { body: { action: "sync-overdue" } }).catch(() => {});
      toast.success("Sincronização concluída");
      await load();
    } catch (e: any) {
      toast.error("Falha ao sincronizar: " + (e.message || e));
    } finally {
      setSyncing(false);
    }
  };

  const cobrar = async (invoice_id: string, channelsOverride?: Array<"whatsapp" | "email">) => {
    setSendingId(invoice_id + (channelsOverride?.join("") || ""));
    try {
      // Marca o usuário logado como responsável (não sobrescreve se já tiver um)
      atribuirResponsavel("invoice", invoice_id, { acao: "cobrou", somenteSeVazio: true }).catch(() => {});
      const { data, error } = await supabase.functions.invoke("cobrar-fatura-vencida", {
        body: { invoice_id, channels: channelsOverride },
      });
      if (error) throw error;
      if ((data as any)?.skipped) toast.info((data as any).reason || "Cobrança recente já existe");
      else toast.success("Cobrança enviada");
      await load();
    } catch (e: any) {
      toast.error("Falha: " + (e.message || e));
    } finally {
      setSendingId(null);
    }
  };

  const excluir = async (invoice_id: string) => {
    if (!window.confirm("Remover esta fatura da lista de vencidos? Ela será marcada como cancelada.")) return;
    setDeletingId(invoice_id);
    try {
      // Fetch asaas_invoice_id to also clear cobrancas_vencidas
      const { data: inv } = await supabase
        .from("invoices")
        .select("asaas_invoice_id")
        .eq("id", invoice_id)
        .maybeSingle();
      const { data, error } = await supabase.functions.invoke("asaas-debtors-api", {
        body: { action: "exclude-invoice", invoice_id, asaas_payment_id: inv?.asaas_invoice_id || null },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setInvoices((prev) => prev.filter((i) => i.id !== invoice_id));
      toast.success("Fatura removida da lista");
    } catch (e: any) {
      toast.error("Falha ao excluir: " + (e.message || e));
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = useMemo(() => {
    const now = new Date();
    const start =
      period === "today" ? startOfDay(now) :
      period === "week" ? startOfWeek(now, { weekStartsOn: 1 }) :
      period === "month" ? startOfMonth(now) :
      subDays(now, 30);
    const q = search.trim().toLowerCase();
    const charged = new Set(
      history
        .filter((h) => h.status === "enviada" || h.status === "reentrada_fila" || h.status === "confirmada_paga")
        .map((h) => h.invoice_id)
    );
    return invoices.filter((i) => {
      if (charged.has(i.id)) return false;
      const d = new Date(i.due_date + "T00:00:00");
      if (d < start) return false;
      if (!q) return true;
      const name = (i.profiles?.full_name || i.profiles?.email || "").toLowerCase();
      return name.includes(q) || (i.description || "").toLowerCase().includes(q);
    });
  }, [invoices, period, search, history]);

  const total = filtered.reduce((s, i) => s + Number(i.amount || 0), 0);
  useEffect(() => { setPage(1); }, [search, period, pageSize, filtered.length]);
  const pagedRows = useMemo(() => {
    if (pageSize === "all") return filtered;
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);
  const recentByInvoice = useMemo(() => {
    const map = new Map<string, CobrancaHist>();
    for (const h of history) if (!map.has(h.invoice_id)) map.set(h.invoice_id, h);
    return map;
  }, [history]);

  return (
    <div className="flex flex-col gap-3">
      {view === "lista" ? (
      <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente..." className="pl-8 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex border rounded-md overflow-hidden">
          {([
            ["today", "Hoje"], ["week", "Semana"], ["month", "Mês"], ["30d", "30 dias"],
          ] as Array<[Period, string]>).map(([k, l]) => (
            <Button key={k} size="sm" variant={period === k ? "default" : "ghost"}
              className="rounded-none h-9 text-xs" onClick={() => setPeriod(k)}>
              <Calendar className="h-3 w-3 mr-1" />{l}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={sync} disabled={syncing} className="h-9">
          {syncing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          Sincronizar Asaas
        </Button>
        <Badge variant="outline" className="text-red-500 border-red-500/40">
          Total: {fmtBRL(total)}
        </Badge>
      </div>

      <div className="border rounded-md overflow-auto max-h-[calc(100vh-340px)]">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Atraso</TableHead>
              <TableHead>Última cobrança</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Nenhuma fatura vencida no período</TableCell></TableRow>
            ) : pagedRows.map((inv) => {
              const last = recentByInvoice.get(inv.id);
              const dias = daysAgo(inv.due_date);
              return (
                <TableRow key={inv.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => openClientFile(inv.user_id)}
                      disabled={!inv.user_id || loadingClient === inv.user_id}
                      className="text-sm font-medium text-left hover:underline text-primary disabled:opacity-60"
                    >
                      {loadingClient === inv.user_id ? <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> : null}
                      {inv.profiles?.full_name || inv.profiles?.email || "—"}
                    </button>
                    <div className="text-xs text-muted-foreground">{inv.profiles?.phone || "sem telefone"}</div>
                  </TableCell>
                  <TableCell className="max-w-[220px]"><div className="text-sm line-clamp-1">{inv.description || "—"}</div></TableCell>
                  <TableCell className="font-semibold text-sm">
                    <EditableAmountCell
                      value={Number(inv.amount || 0)}
                      onSave={async (newValue) => {
                        const { error } = await supabase
                          .from("invoices")
                          .update({ amount: newValue })
                          .eq("id", inv.id);
                        if (error) throw error;
                        setInvoices((prev) =>
                          prev.map((i) => (i.id === inv.id ? { ...i, amount: newValue } : i))
                        );
                        toast.success("Valor atualizado");
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-sm">{fmtDate(inv.due_date)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={dias > 30 ? "text-red-500 border-red-500/40" : "text-amber-500 border-amber-500/40"}>
                      {dias}d
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {last ? (
                      <div className="text-xs">
                        <div className="flex items-center gap-1">
                          {last.status === "confirmada_paga" ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> :
                            last.status === "reentrada_fila" ? <RefreshCw className="h-3 w-3 text-amber-500" /> :
                            <CheckCircle2 className="h-3 w-3 text-blue-500" />}
                          {fmtDate(last.enviada_em)}
                        </div>
                        <div className="text-muted-foreground">{last.canais.join(", ")}</div>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <ResponsavelChip
                      entidade="invoice"
                      entidadeId={inv.id}
                      responsavel={responsaveisMap[inv.id]}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" disabled={!inv.profiles?.phone || sendingId !== null}
                        onClick={() => cobrar(inv.id, ["whatsapp"])} title="Cobrar por WhatsApp">
                        {sendingId === inv.id + "whatsapp" ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3" />}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={!inv.profiles?.email || sendingId !== null}
                        onClick={() => cobrar(inv.id, ["email"])} title="Cobrar por E-mail">
                        {sendingId === inv.id + "email" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                      </Button>
                      <Button size="sm" disabled={sendingId !== null}
                        onClick={() => cobrar(inv.id)}
                        className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white">
                        {sendingId === inv.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Cobrar
                      </Button>
                      <Button size="sm" variant="ghost" disabled={deletingId !== null}
                        onClick={() => excluir(inv.id)} title="Remover da lista">
                        {deletingId === inv.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Trash2 className="h-3 w-3 text-destructive" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <PaginationBar
        page={page}
        pageSize={pageSize}
        total={filtered.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
      </>
      ) : (
        <div className="border rounded-md overflow-auto max-h-[calc(100vh-340px)]">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Canais</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Próx. ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Sem cobranças registradas</TableCell></TableRow>
              ) : history.map((h) => (
                <TableRow key={h.id} className="hover:bg-muted/40">
                  <TableCell className="text-sm">{new Date(h.enviada_em).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-sm">
                    <button
                      type="button"
                      onClick={() => openClientFile(h.user_id)}
                      disabled={!h.user_id || loadingClient === h.user_id}
                      className="text-left hover:underline text-primary disabled:opacity-60"
                    >
                      {loadingClient === h.user_id ? <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> : null}
                      {h.cliente_nome || "—"}
                    </button>
                  </TableCell>
                  <TableCell className="text-xs">{h.canais.join(", ")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      h.status === "confirmada_paga" ? "text-emerald-500 border-emerald-500/40" :
                      h.status === "reentrada_fila" ? "text-amber-500 border-amber-500/40" :
                      "text-blue-500 border-blue-500/40"
                    }>{h.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {h.proxima_acao_em ? new Date(h.proxima_acao_em).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {openClient && (
        <Suspense fallback={null}>
          <ClientDetailSheet
            client={openClient}
            open={!!openClient}
            onOpenChange={(o) => !o && setOpenClient(null)}
            onUpdate={() => { load(); }}
          />
        </Suspense>
      )}
    </div>
  );
}