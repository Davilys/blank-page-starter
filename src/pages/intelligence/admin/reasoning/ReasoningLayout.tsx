/**
 * FASE 10 — Casca do Knowledge Reasoning Engine.
 *
 * Segurança: somente Administrador Master (papel `admin` validado no servidor
 * via RPC `has_role`). O motor é somente leitura — nenhuma rota aqui escreve
 * conhecimento; a única gravação é o log append-only de auditoria.
 */
import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ReadOnlyBadge } from "@/modules/intelligence/presentation/components/reasoning/ReasoningBadges";

const TABS = [
  { to: ".", label: "Dashboard", end: true },
  { to: "impacto", label: "Impact Analysis" },
  { to: "simulacao", label: "Cascade & Simulação" },
  { to: "inconsistencias", label: "Broken Knowledge" },
  { to: "confianca", label: "Confidence" },
  { to: "cobertura", label: "Coverage" },
  { to: "sugestoes", label: "Sugestões" },
  { to: "auditoria", label: "Auditoria" },
];

const useIsMasterAdmin = () => {
  const [estado, setEstado] = useState<"carregando" | "permitido" | "negado">("carregando");

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data: sessao } = await supabase.auth.getSession();
      const userId = sessao?.session?.user?.id;
      if (!userId) {
        if (ativo) setEstado("negado");
        return;
      }
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (!ativo) return;
      setEstado(!error && data === true ? "permitido" : "negado");
    })();
    return () => {
      ativo = false;
    };
  }, []);

  return estado;
};

const ReasoningLayout = () => {
  const estado = useIsMasterAdmin();

  if (estado === "carregando") {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Verificando permissão...
      </div>
    );
  }

  if (estado === "negado") {
    return (
      <Card className="max-w-xl p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <h1 className="font-semibold text-foreground">Acesso restrito</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              O Knowledge Reasoning Engine é exclusivo do Administrador Master. Entre com uma
              conta administrativa para executar as análises.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Knowledge Reasoning</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            O sistema raciocina sobre a própria estrutura: fatos, objetos e relações. Sem IA,
            sem escrita, sem simulação salva. Tudo é calculado em memória e auditado.
          </p>
        </div>
        <ReadOnlyBadge />
      </div>

      <nav className="mt-5 flex flex-wrap gap-1.5 border-b border-border pb-3">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              cn(
                "rounded-lg px-3 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
};

export default ReasoningLayout;