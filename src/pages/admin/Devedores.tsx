import { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Loader2, Zap, AlertTriangle, Users, DollarSign, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ClientWithProcess } from "@/components/admin/clients/ClientKanbanBoard";

const ClientDetailSheet = lazy(() =>
  import("@/components/admin/clients/ClientDetailSheet").then((m) => ({ default: m.ClientDetailSheet }))
);

interface Debtor {
  key: string;
  cliente_nome: string | null;
  cliente_cpf_cnpj: string | null;
  cliente_email: string | null;
  asaas_customer_id: string;
  parcelas: any[];
  qtd_parcelas: number;
  total_original: number;
  acrescimo: number;
  novo_total: number;
  valor_parcela: number;
  datas_parcelas: string[];
}

interface Renegociacao {
  id: string;
  cliente_nome: string | null;
  cliente_cpf_cnpj: string | null;
  valor_original_total: number;
  valor_acrescimo: number;
  valor_renegociado: number;
  motivo_cobranca: string;
  created_at: string;
  parcelas_renegociadas?: any[];
}

const fmtBRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const fmtDate = (s: string) => {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

async function callApi(action: string, body?: any) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("Sessão expirada — faça login novamente.");
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-debtors-api?action=${encodeURIComponent(action)}`;
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

export default function Devedores() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [history, setHistory] = useState<Renegociacao[]>([]);
  const [selected, setSelected] = useState<Debtor | null>(null);
  const [observacao, setObservacao] = useState("");
  const [renegLoading, setRenegLoading] = useState(false);
  const [openClient, setOpenClient] = useState<ClientWithProcess | null>(null);
  const [loadingClient, setLoadingClient] = useState<string | null>(null);

  const fetchDebtors = async () => {
    setLoading(true);
    try {
      const r = await callApi("list-debtors-grouped");
      setDebtors(r.debtors || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from("renegociacoes")
      .select("*, parcelas_renegociadas(*)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) { toast.error(error.message); return; }
    setHistory((data || []) as any);
  };

  useEffect(() => {
    fetchDebtors();
    fetchHistory();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await callApi("sync-overdue");
      toast.success(`Sincronizado: ${r.kept_over_60d} cobrança(s) com mais de 60 dias de atraso (de ${r.total_overdue} vencidas no Asaas).`);
      await fetchDebtors();
    } catch (e: any) {
      toast.error(`Falha na sincronização: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleRenegotiate = async () => {
    if (!selected) return;
    setRenegLoading(true);
    try {
      const r = await callApi("renegotiate", {
        cliente_cpf_cnpj: selected.cliente_cpf_cnpj,
        asaas_customer_id: selected.asaas_customer_id,
        observacao: observacao || undefined,
      });
      toast.success(`Renegociação criada com ${r.parcelas_criadas} boleto(s) no Asaas.`);
      setSelected(null);
      setObservacao("");
      await fetchDebtors();
      await fetchHistory();
    } catch (e: any) {
      toast.error(`Falha: ${e.message}`);
    } finally {
      setRenegLoading(false);
    }
  };

  const totalDevedores = debtors.length;
  const totalParcelas = debtors.reduce((s, d) => s + d.qtd_parcelas, 0);
  const totalOriginal = debtors.reduce((s, d) => s + d.total_original, 0);
  const totalComAcrescimo = debtors.reduce((s, d) => s + d.novo_total, 0);

  const openClientFile = async (d: Debtor) => {
    setLoadingClient(d.key);
    try {
      const r = await callApi("__direct__", null);
      // placeholder, replaced below
    } catch {}
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Sessão expirada.");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/find-or-create-client-from-asaas`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          asaas_customer_id: d.asaas_customer_id,
          cliente_nome: d.cliente_nome,
          cliente_cpf_cnpj: d.cliente_cpf_cnpj,
          cliente_email: d.cliente_email,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      const p = json.profile;
      const client: ClientWithProcess = {
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        company_name: p.company_name,
        priority: p.priority,
        origin: p.origin,
        contract_value: p.contract_value,
        process_id: null,
        brand_name: null,
        business_area: null,
        pipeline_stage: null,
        process_status: null,
        cpf_cnpj: p.cpf_cnpj,
        created_by: p.created_by,
        assigned_to: p.assigned_to,
      };
      setOpenClient(client);
      if (json.created) toast.success("Cliente criado automaticamente a partir dos dados do Asaas.");
    } catch (e: any) {
      toast.error(`Falha ao abrir ficheiro do cliente: ${e.message}`);
    } finally {
      setLoadingClient(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/financeiro")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Financeiro
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-red-500" /> Devedores
            </h1>
            <p className="text-sm text-muted-foreground">Cobranças Asaas com mais de 60 dias de atraso</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchDebtors} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button size="sm" onClick={handleSync} disabled={syncing} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {syncing ? "Sincronizando..." : "Sincronizar com Asaas"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <SummaryCard icon={<Users className="h-5 w-5" />} label="Devedores" value={String(totalDevedores)} />
        <SummaryCard icon={<AlertTriangle className="h-5 w-5" />} label="Parcelas vencidas" value={String(totalParcelas)} />
        <SummaryCard icon={<DollarSign className="h-5 w-5" />} label="Valor original" value={fmtBRL(totalOriginal)} />
        <SummaryCard icon={<TrendingUp className="h-5 w-5" />} label="Total +10%" value={fmtBRL(totalComAcrescimo)} accent />
      </div>

      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista">Devedores ({totalDevedores})</TabsTrigger>
          <TabsTrigger value="historico">Histórico ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="lista">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead className="text-center">Parcelas</TableHead>
                    <TableHead className="text-right">Total devido</TableHead>
                    <TableHead className="text-right">Total + 10%</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debtors.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {loading ? "Carregando..." : "Nenhum devedor com mais de 60 dias. Clique em Sincronizar para buscar no Asaas."}
                      </TableCell>
                    </TableRow>
                  )}
                  {debtors.map((d) => (
                    <TableRow key={d.key}>
                      <TableCell className="font-medium">
                        <button
                          type="button"
                          onClick={() => openClientFile(d)}
                          disabled={loadingClient === d.key}
                          className="text-left hover:text-primary hover:underline transition-colors inline-flex items-center gap-2 disabled:opacity-50"
                        >
                          {loadingClient === d.key && <Loader2 className="h-3 w-3 animate-spin" />}
                          {d.cliente_nome || "—"}
                        </button>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.cliente_cpf_cnpj || "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="destructive">{d.qtd_parcelas}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{fmtBRL(d.total_original)}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">{fmtBRL(d.novo_total)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => setSelected(d)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                          Renegociar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Original</TableHead>
                    <TableHead className="text-right">Acréscimo</TableHead>
                    <TableHead className="text-right">Renegociado</TableHead>
                    <TableHead className="text-center">Parcelas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma renegociação ainda.</TableCell></TableRow>
                  )}
                  {history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-sm">{new Date(h.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{h.cliente_nome || h.cliente_cpf_cnpj || "—"}</TableCell>
                      <TableCell className="text-right">{fmtBRL(h.valor_original_total)}</TableCell>
                      <TableCell className="text-right text-amber-600">{fmtBRL(h.valor_acrescimo)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtBRL(h.valor_renegociado)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{h.parcelas_renegociadas?.length || 0}/5</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Renegociar — {selected?.cliente_nome}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Parcelas vencidas agrupadas</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {selected.parcelas.map((p) => (
                    <div key={p.id} className="flex justify-between border-b border-border/50 py-1">
                      <span>Venc. {fmtDate(p.data_vencimento)} <span className="text-muted-foreground">({p.dias_atraso}d atraso)</span></span>
                      <span className="font-medium">{fmtBRL(Number(p.valor))}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Total original</div>
                  <div className="font-semibold">{fmtBRL(selected.total_original)}</div>
                </div>
                <div className="rounded-lg border p-3 bg-amber-500/5">
                  <div className="text-xs text-muted-foreground">+ 10%</div>
                  <div className="font-semibold text-amber-600">{fmtBRL(selected.acrescimo)}</div>
                </div>
                <div className="rounded-lg border p-3 bg-emerald-500/5">
                  <div className="text-xs text-muted-foreground">Novo total</div>
                  <div className="font-bold text-emerald-600">{fmtBRL(selected.novo_total)}</div>
                </div>
              </div>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">5 boletos serão gerados — vencimento sempre dia 20</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {selected.datas_parcelas.map((d, i) => (
                    <div key={i} className="flex justify-between border-b border-border/50 py-1">
                      <span>Parcela {i + 1}/5 — venc. {fmtDate(d)}</span>
                      <span className="font-medium">{fmtBRL(selected.valor_parcela)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div>
                <label className="text-sm font-medium">Observação (opcional, será incluída no motivo)</label>
                <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)} disabled={renegLoading}>Cancelar</Button>
            <Button onClick={handleRenegotiate} disabled={renegLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              {renegLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar renegociação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {openClient && (
        <Suspense fallback={null}>
          <ClientDetailSheet
            client={openClient}
            open={!!openClient}
            onOpenChange={(o) => !o && setOpenClient(null)}
            onUpdate={() => { fetchDebtors(); }}
          />
        </Suspense>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-emerald-500/30" : ""}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${accent ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>{icon}</div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="font-bold text-lg">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}