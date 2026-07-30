/**
 * Intelligence back-office shell (FASE 05, structure only).
 *
 * IMPORTANT: this is intentionally SEPARATE from the CRM's AdminLayout.
 * The constitution forbids touching the CRM, so the Knowledge OS gets its own
 * shell with its own navigation. No auth, no data, no business logic yet —
 * only the frame that later phases plug their engines into.
 */
import { NavLink, Outlet } from "react-router-dom";
import {
  Activity,
  Boxes,
  BrainCircuit,
  Bot,
  Factory,
  GitBranch,
  Gauge,
  Import,
  LineChart,
  ScrollText,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: React.ElementType;
  readonly fase: string;
}

/** Each entry maps to an engine defined in the constitution. */
const NAV_ITEMS: readonly NavItem[] = [
  { to: "factory", label: "Knowledge Factory", icon: Factory, fase: "Fase 06" },
  { to: "factory/objetos", label: "Knowledge Objects", icon: Boxes, fase: "Fase 06" },
  { to: "ingestion", label: "Knowledge Ingestion", icon: Import, fase: "Fase 07" },
  { to: "fatos", label: "Fact Ledger", icon: ScrollText, fase: "Fase 08" },
  { to: "entidades", label: "Entity Engine", icon: GitBranch, fase: "Fase 01" },
  { to: "autoridade", label: "Authority Engine", icon: ShieldCheck, fase: "Fase 02" },
  { to: "sinais", label: "Signals", icon: Radio, fase: "Fase 02" },
  { to: "reasoning", label: "Reasoning", icon: BrainCircuit, fase: "Fase 03" },
  { to: "learning", label: "Learning", icon: Activity, fase: "Fase 04" },
  { to: "analytics", label: "Analytics", icon: LineChart, fase: "Fase 02" },
  { to: "crawlers", label: "Crawler Center", icon: Bot, fase: "Fase 02" },
  { to: "health", label: "Health Center", icon: Gauge, fase: "Fase 02" },
];

const AdminShell = () => (
  <div className="flex min-h-screen bg-background">
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:block">
      <div className="border-b border-border p-5">
        <p className="font-display text-sm font-bold text-foreground">Knowledge OS</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Painel administrativo</p>
      </div>

      <nav className="space-y-0.5 p-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon, fase }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{label}</span>
            <span className="text-[10px] uppercase tracking-wide opacity-60">{fase}</span>
          </NavLink>
        ))}
      </nav>
    </aside>

    <main className="flex-1 overflow-x-hidden p-6 md:p-8">
      <Outlet />
    </main>
  </div>
);

export default AdminShell;
export { NAV_ITEMS };
