import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { NAV_ITEMS } from "./AdminShell";

const AdminHome = () => (
  <div>
    <h1 className="text-2xl font-bold text-foreground">Knowledge OS — Administração</h1>
    <p className="mt-2 max-w-2xl text-muted-foreground">
      Fundação instalada. Cada módulo abaixo já possui rota e estrutura; a lógica é
      entregue nas fases seguintes, sempre isolada em <code>/intelligence</code>.
    </p>

    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {NAV_ITEMS.map(({ to, label, icon: Icon, fase }) => (
        <Link key={to} to={to}>
          <Card className="h-full p-5 transition-shadow hover:shadow-md">
            <Icon className="h-6 w-6 text-primary" />
            <h2 className="mt-3 font-semibold text-foreground">{label}</h2>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
              {fase}
            </p>
          </Card>
        </Link>
      ))}
    </div>
  </div>
);

export default AdminHome;