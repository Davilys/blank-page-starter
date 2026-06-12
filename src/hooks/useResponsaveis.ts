import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Entidade = "invoice" | "devedor" | "publicacao";

export interface ResponsavelInfo {
  user_id: string | null;
  user_nome: string | null;
  atribuido_em: string | null;
}

export interface AdminOption {
  user_id: string;
  full_name: string;
  email: string | null;
}

/** Carrega as atribuições de responsável para um conjunto de IDs de uma entidade. */
export function useResponsaveis(entidade: Entidade, ids: string[]) {
  const [map, setMap] = useState<Record<string, ResponsavelInfo>>({});

  const idsKey = ids.join("|");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (ids.length === 0) {
        setMap({});
        return;
      }
      const { data } = await supabase
        .from("responsavel_atribuicao")
        .select("entidade_id, user_id, user_nome, atribuido_em")
        .eq("entidade", entidade)
        .in("entidade_id", ids);
      if (cancelled) return;
      const next: Record<string, ResponsavelInfo> = {};
      for (const row of data || []) {
        next[(row as any).entidade_id] = {
          user_id: (row as any).user_id,
          user_nome: (row as any).user_nome,
          atribuido_em: (row as any).atribuido_em,
        };
      }
      setMap(next);
    };
    load();

    const channel = supabase
      .channel(`resp_${entidade}_${ids.length}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "responsavel_atribuicao", filter: `entidade=eq.${entidade}` },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (!row) return;
          if (!ids.includes(row.entidade_id)) return;
          setMap((prev) => {
            const next = { ...prev };
            if (payload.eventType === "DELETE") {
              delete next[row.entidade_id];
            } else {
              next[row.entidade_id] = {
                user_id: row.user_id,
                user_nome: row.user_nome,
                atribuido_em: row.atribuido_em,
              };
            }
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entidade, idsKey]);

  return map;
}

/** Lista de admins disponíveis para atribuição. */
export function useAdminList() {
  const [admins, setAdmins] = useState<AdminOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        const userIds = (roles || []).map((r: any) => r.user_id).filter(Boolean);
        if (userIds.length === 0) {
          if (!cancelled) setAdmins([]);
          return;
        }
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        if (cancelled) return;
        setAdmins(
          (profiles || []).map((p: any) => ({
            user_id: p.id,
            full_name: p.full_name || p.email || "Admin",
            email: p.email,
          })),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { admins, loading };
}

/** Atribui (ou reatribui) um responsável. Se não passar userId, usa o usuário logado. */
export async function atribuirResponsavel(
  entidade: Entidade,
  entidade_id: string,
  opts?: { userId?: string; userNome?: string; acao?: "cobrou" | "negociou" | "atribuiu" | "assumiu"; observacao?: string; somenteSeVazio?: boolean },
) {
  const { data: sess } = await supabase.auth.getUser();
  const me = sess.user;
  if (!me) throw new Error("Sessão expirada");

  const userId = opts?.userId ?? me.id;
  let userNome = opts?.userNome;
  if (!userNome) {
    if (userId === me.id) {
      userNome =
        (me.user_metadata?.full_name as string) ||
        me.email ||
        "Admin";
    } else {
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name,email")
        .eq("id", userId)
        .maybeSingle();
      userNome = (p as any)?.full_name || (p as any)?.email || "Admin";
    }
  }

  if (opts?.somenteSeVazio) {
    const { data: existing } = await supabase
      .from("responsavel_atribuicao")
      .select("user_id")
      .eq("entidade", entidade)
      .eq("entidade_id", entidade_id)
      .maybeSingle();
    if (existing && (existing as any).user_id) {
      // já tem responsável → não sobrescreve
      await supabase.from("responsavel_historico").insert({
        entidade,
        entidade_id,
        user_id: me.id,
        user_nome: (me.user_metadata?.full_name as string) || me.email || "Admin",
        acao: opts.acao || "cobrou",
        observacao: opts.observacao || null,
      });
      return;
    }
  }

  await supabase
    .from("responsavel_atribuicao")
    .upsert(
      {
        entidade,
        entidade_id,
        user_id: userId,
        user_nome: userNome,
        atribuido_em: new Date().toISOString(),
        atribuido_por: me.id,
      },
      { onConflict: "entidade,entidade_id" },
    );

  await supabase.from("responsavel_historico").insert({
    entidade,
    entidade_id,
    user_id: me.id,
    user_nome: (me.user_metadata?.full_name as string) || me.email || "Admin",
    acao: opts?.acao || "atribuiu",
    observacao: opts?.observacao || null,
  });
}

/** Remove o responsável de um item. */
export async function removerResponsavel(entidade: Entidade, entidade_id: string) {
  const { data: sess } = await supabase.auth.getUser();
  const me = sess.user;
  await supabase
    .from("responsavel_atribuicao")
    .delete()
    .eq("entidade", entidade)
    .eq("entidade_id", entidade_id);
  if (me) {
    await supabase.from("responsavel_historico").insert({
      entidade,
      entidade_id,
      user_id: me.id,
      user_nome: (me.user_metadata?.full_name as string) || me.email || "Admin",
      acao: "removeu",
    });
  }
}