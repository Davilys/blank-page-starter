import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Clock, ArrowLeft, CalendarClock, ListChecks, Loader2, Bell, RefreshCw, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const AguardandoTab = lazy(() => import("@/components/admin/financeiro/aguardando/AguardandoTab"));
const HistoricoLembretesTab = lazy(() => import("@/components/admin/financeiro/aguardando/HistoricoLembretesTab"));

type TabKey = "d0" | "d3" | "all" | "historico";

export default function FinanceiroAguardando() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("d0");
  const [syncing, setSyncing] = useState(false);
  const qc = useQueryClient();

  const autoSyncRan = useRef(false);
  useEffect(() => {
    if (autoSyncRan.current) return;
    autoSyncRan.current = true;
    (async () => {
      const toastId = toast.loading("Sincronizando com Asaas...");
      try {
        const { data, error } = await supabase.functions.invoke("sync-asaas-invoices");
        if (error) throw error;
        const d: any = data || {};
        const parts: string[] = [];
        if (d.synced) parts.push(`${d.synced} atualizada(s)`);
        if (d.removed) parts.push(`${d.removed} removida(s)`);
        toast.success(parts.length ? `Sincronizado: ${parts.join(" · ")}` : "Tudo sincronizado", { id: toastId });
        qc.invalidateQueries({ queryKey: ["financeiro-aguardando"] });
        qc.invalidateQueries({ queryKey: ["cobranca-historico-lembretes"] });
      } catch (e: any) {
        toast.error(`Falha ao sincronizar: ${e?.message ?? e}`, { id: toastId });
      }
    })();
  }, [qc]);

  const handleSyncAsaas = async () => {
    setSyncing(true);
    const toastId = toast.loading("Sincronizando com Asaas...");
    try {
      const { data, error } = await supabase.functions.invoke("sync-asaas-invoices");
      if (error) throw error;
      toast.success(`Sincronização concluída${(data as any)?.updated ? ` — ${(data as any).updated} atualizadas` : ""}`, { id: toastId });
      qc.invalidateQueries({ queryKey: ["financeiro-aguardando"] });
      qc.invalidateQueries({ queryKey: ["cobranca-historico-lembretes"] });
    } catch (e: any) {
      toast.error(`Erro ao sincronizar: ${e?.message ?? e}`, { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-background p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/financeiro")} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Financeiro
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Bell className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Lembretes de Vencimento</h1>
                <p className="text-sm text-muted-foreground">
                  Envie lembretes por email + WhatsApp para clientes cujas faturas vencem hoje ou em 3 dias. Automação diária ativa.
                </p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAsaas}
            disabled={syncing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar com Asaas"}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="space-y-4">
        <TabsList className="h-auto flex-wrap p-1 bg-muted/60 backdrop-blur">
          <TabsTrigger
            value="d0"
            className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-orange-500 data-[state=active]:text-white"
          >
            <Clock className="h-4 w-4" /> Vence hoje
          </TabsTrigger>
          <TabsTrigger
            value="d3"
            className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-yellow-500 data-[state=active]:text-white"
          >
            <CalendarClock className="h-4 w-4" /> Vence em 3 dias
          </TabsTrigger>
          <TabsTrigger
            value="all"
            className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-600 data-[state=active]:to-slate-800 data-[state=active]:text-white"
          >
            <ListChecks className="h-4 w-4" /> Todos aguardando
          </TabsTrigger>
          <TabsTrigger
            value="historico"
            className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-700 data-[state=active]:text-white"
          >
            <History className="h-4 w-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
          <TabsContent value="d0" className="mt-0"><AguardandoTab tab="d0" /></TabsContent>
          <TabsContent value="d3" className="mt-0"><AguardandoTab tab="d3" /></TabsContent>
          <TabsContent value="all" className="mt-0"><AguardandoTab tab="all" /></TabsContent>
          <TabsContent value="historico" className="mt-0"><HistoricoLembretesTab /></TabsContent>
        </Suspense>
      </Tabs>
    </div>
  );
}