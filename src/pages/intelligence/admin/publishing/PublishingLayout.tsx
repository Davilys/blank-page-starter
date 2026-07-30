/**
 * FASE 11 — Casca do Knowledge Publishing Engine.
 * Segurança: somente Administrador Master (papel `admin` validado no servidor
 * via RPC `has_role`). Nenhuma publicação ocorre automaticamente.
 */
import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ManualOnlyBadge } from "@/modules/intelligence/presentation/components/publishing/PublishingBadges";
import { usePublishingAuthor } from "@/modules/intelligence/presentation/hooks/usePublishing";

const TABS = [
  { to: ".", label: "Dashboard", end: true },
  { to: "pipeline", label: "Pipeline" },
  { to: "publicados", label: "Publicados" },
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

const PublishingLayout = () => {
  const estado = useIsMasterAdmin();
  const { autor, setAutor } = usePublishingAuthor();

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
              O Knowledge Publishing é exclusivo do Administrador Master. Entre com uma conta
              administrativa para operar o pipeline de publicação.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Knowledge Publishing</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Transforma conhecimento validado em páginas públicas otimizadas para buscadores e
            assistentes de IA. Sem geração automática de texto e sem publicação automática.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ManualOnlyBadge />
          <Input
            value={autor}
            onChange={(e) => setAutor(e.target.value)}
            placeholder="Seu identificador (auditoria)"
            className="h-8 w-56 text-xs"
          />
        </div>
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

export default PublishingLayout;