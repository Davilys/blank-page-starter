import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PAID = ["paid", "confirmed", "received", "RECEIVED", "CONFIRMED", "cancelled", "CANCELLED", "canceled"];
const onlyDigits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action: "preview" | "negativar" | "remover" = body.action || "preview";
    const user_id: string | null = body.user_id ?? null;
    const cpf_cnpj: string | null = body.cpf_cnpj ?? null;
    const nome: string | null = body.nome ?? null;

    if (!user_id && !cpf_cnpj && !nome) {
      return json({ error: "Informe user_id, cpf_cnpj ou nome" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Resolver os perfis do cliente (por id, documento ou nome)
    const profileIds = new Set<string>();
    let profile: any = null;

    if (user_id) {
      const { data } = await admin
        .from("profiles")
        .select("id, full_name, email, cpf, cnpj, cpf_cnpj, negativado")
        .eq("id", user_id)
        .maybeSingle();
      if (data) { profile = data; profileIds.add(data.id); }
    }

    const doc = onlyDigits(cpf_cnpj || profile?.cpf_cnpj || profile?.cpf || profile?.cnpj);
    if (doc.length >= 11) {
      const { data } = await admin
        .from("profiles")
        .select("id, full_name, email, cpf, cnpj, cpf_cnpj, negativado")
        .limit(200);
      for (const p of data || []) {
        const docs = [p.cpf, p.cnpj, p.cpf_cnpj].map(onlyDigits);
        if (docs.includes(doc)) { profileIds.add(p.id); profile = profile || p; }
      }
    }

    if (profileIds.size === 0 && nome) {
      const { data } = await admin
        .from("profiles")
        .select("id, full_name, email, cpf, cnpj, cpf_cnpj, negativado")
        .ilike("full_name", nome.trim())
        .limit(5);
      for (const p of data || []) { profileIds.add(p.id); profile = profile || p; }
    }

    if (profileIds.size === 0) {
      return json({ error: "Cliente não localizado no CRM" }, 404);
    }

    const ids = Array.from(profileIds);

    // 2. Somar todos os débitos em aberto do cliente
    const { data: invs } = await admin
      .from("invoices")
      .select("id, description, amount, due_date, status")
      .in("user_id", ids)
      .limit(500);

    const abertos = (invs || []).filter((i: any) => !PAID.includes(i.status || ""));
    const total = abertos.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);

    if (action === "preview") {
      return json({
        cliente: { nome: profile?.full_name || nome, email: profile?.email || null, negativado: !!profile?.negativado },
        profile_ids: ids,
        total_debitos: total,
        qtd_debitos: abertos.length,
        debitos: abertos.map((i: any) => ({
          id: i.id, descricao: i.description, valor: Number(i.amount || 0), vencimento: i.due_date,
        })),
      });
    }

    if (action === "remover") {
      await admin.from("profiles")
        .update({ negativado: false, negativado_em: null, negativado_total: null })
        .in("id", ids);
      for (const id of ids) {
        await admin.from("client_activities").insert({
          user_id: id,
          activity_type: "negativacao",
          description: "Etiqueta de negativado removida",
        });
      }
      return json({ success: true, negativado: false, profile_ids: ids });
    }

    const nowIso = new Date().toISOString();
    await admin.from("profiles")
      .update({ negativado: true, negativado_em: nowIso, negativado_total: total })
      .in("id", ids);

    for (const id of ids) {
      await admin.from("client_activities").insert({
        user_id: id,
        activity_type: "negativacao",
        description: `Cliente negativado — total em aberto R$ ${total.toFixed(2)} (${abertos.length} débito(s))`,
        metadata: { total, qtd: abertos.length, invoice_ids: abertos.map((i: any) => i.id) },
      });
    }

    return json({ success: true, negativado: true, total_debitos: total, qtd_debitos: abertos.length, profile_ids: ids });
  } catch (e) {
    console.error("negativar-cliente error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
