import { lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle, ArrowLeft, Clock, CalendarClock, History, List, Loader2 } from "lucide-react";

const Vencidos30DiasTab = lazy(() => import("@/components/admin/financeiro/vencidos/Vencidos30DiasTab"));
const Devedores = lazy(() => import("./Devedores"));

type TabKey = "ate30" | "mais30" | "mais60";
type View = "lista" | "historico";

function ViewToggle({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  return (
    <div className="inline-flex rounded-md border border-border/60 overflow-hidden bg-background">
      <Button
        size="sm"
        variant={value === "lista" ? "default" : "ghost"}
        className="rounded-none h-9 gap-1"
        onClick={() => onChange("lista")}
      >
        <List className="h-3.5 w-3.5" /> Lista
      </Button>
      <Button
        size="sm"
        variant={value === "historico" ? "default" : "ghost"}
        className="rounded-none h-9 gap-1"
        onClick={() => onChange("historico")}
      >
        <History className="h-3.5 w-3.5" /> Histórico
      </Button>
    </div>
  );
}

export default function FinanceiroVencidos() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("ate30");
  const [view30, setView30] = useState<View>("lista");
  const [view60, setView60] = useState<View>("lista");
  const [viewAte30, setViewAte30] = useState<View>("lista");

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Premium hero */}
      <div className="relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-red-500/10 via-orange-500/5 to-background p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/financeiro")} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Financeiro
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/20">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Central de Vencidos</h1>
                <p className="text-sm text-muted-foreground">
                  Faturas vencidas e devedores 30/60+ dias em um único lugar — fluido e organizado.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="space-y-4">
        <TabsList className="h-auto flex-wrap p-1 bg-muted/60 backdrop-blur">
          <TabsTrigger
            value="ate30"
            className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white"
          >
            <Clock className="h-4 w-4" /> Vencidos até 30 dias
          </TabsTrigger>
          <TabsTrigger
            value="mais30"
            className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white"
          >
            <CalendarClock className="h-4 w-4" /> Devedores +30 dias
          </TabsTrigger>
          <TabsTrigger
            value="mais60"
            className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-rose-600 data-[state=active]:text-white"
          >
            <AlertTriangle className="h-4 w-4" /> Devedores +60 dias
          </TabsTrigger>
        </TabsList>

        <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
          <TabsContent value="ate30" className="mt-0 space-y-3">
            <ViewToggle value={viewAte30} onChange={setViewAte30} />
            <Vencidos30DiasTab view={viewAte30} />
          </TabsContent>

          <TabsContent value="mais30" className="mt-0 space-y-3">
            <ViewToggle value={view30} onChange={setView30} />
            <Devedores embedded forceTab={view30 === "lista" ? "devedor" : "historico-devedor"} />
          </TabsContent>

          <TabsContent value="mais60" className="mt-0 space-y-3">
            <ViewToggle value={view60} onChange={setView60} />
            <Devedores embedded forceTab={view60 === "lista" ? "lista" : "historico"} />
          </TabsContent>
        </Suspense>
      </Tabs>
    </div>
  );
}
