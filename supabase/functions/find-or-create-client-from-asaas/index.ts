import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")!;
const ASAAS_ENV = (Deno.env.get("ASAAS_ENV") || "production").toLowerCase();
const ASAAS_BASE = ASAAS_ENV === "sandbox"
  ? "https://api-sandbox.asaas.com/v3"
  : "https://api.asaas.com/v3";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeCpfCnpj(v?: string | null): string {
  return (v || "").replace(/\D/g, "");
}

async function asaasGet(path: string) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    headers: { "access_token": ASAAS_API_KEY, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Asaas ${res.status}: ${t.slice(0, 300)}`);
  }
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.slice(7);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: uErr } = await userClient.auth.getUser(token);
    if (uErr || !userData?.user) return json({ error: "Invalid session" }, 401);
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden: admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const asaas_customer_id = (body.asaas_customer_id || "").toString().trim();
    const hintName = body.cliente_nome as string | undefined;
    const hintCpf = body.cliente_cpf_cnpj as string | undefined;
    const hintEmail = body.cliente_email as string | undefined;

    if (!asaas_customer_id && !hintCpf && !hintEmail) {
      return json({ error: "Informe asaas_customer_id ou cpf ou email" }, 400);
    }

    // 1) Buscar profile existente
    let profile: any = null;

    if (asaas_customer_id) {
      const { data } = await admin.from("profiles").select("*").eq("asaas_customer_id", asaas_customer_id).maybeSingle();
      if (data) profile = data;
    }

    if (!profile && hintCpf) {
      const norm = normalizeCpfCnpj(hintCpf);
      const { data: byExact } = await admin.from("profiles").select("*").eq("cpf_cnpj", hintCpf).maybeSingle();
      if (byExact) profile = byExact;
      if (!profile && norm) {
        const { data: byNorm } = await admin.from("profiles").select("*").ilike("cpf_cnpj", `%${norm}%`).limit(1);
        if (byNorm && byNorm.length > 0) profile = byNorm[0];
      }
    }

    if (!profile && hintEmail) {
      const { data } = await admin.from("profiles").select("*").eq("email", hintEmail.toLowerCase().trim()).maybeSingle();
      if (data) profile = data;
    }

    // 2) Se achou e ainda não tem asaas_customer_id, atualiza
    if (profile && asaas_customer_id && !profile.asaas_customer_id) {
      await admin.from("profiles").update({ asaas_customer_id }).eq("id", profile.id);
      profile.asaas_customer_id = asaas_customer_id;
    }

    if (profile) return json({ profile, created: false });

    // 3) Não achou — buscar dados completos no Asaas
    let cust: any = null;
    if (asaas_customer_id) {
      try { cust = await asaasGet(`/customers/${asaas_customer_id}`); } catch (e) {
        console.warn("asaas customer fetch failed", e);
      }
    }

    const finalName = cust?.name || hintName || "Cliente Asaas";
    const finalCpf = cust?.cpfCnpj || hintCpf || null;
    const rawEmail = (cust?.email || hintEmail || "").toString().toLowerCase().trim();
    const placeholderEmail = `asaas-${asaas_customer_id || normalizeCpfCnpj(finalCpf) || crypto.randomUUID()}@webmarcas.local`;
    const finalEmail = rawEmail || placeholderEmail;

    // Tenta achar por email (caso já exista mas sem ligação)
    if (rawEmail) {
      const { data: byEmail } = await admin.from("profiles").select("*").eq("email", rawEmail).maybeSingle();
      if (byEmail) {
        await admin.from("profiles").update({
          asaas_customer_id: asaas_customer_id || byEmail.asaas_customer_id,
          cpf_cnpj: byEmail.cpf_cnpj || finalCpf,
          full_name: byEmail.full_name || finalName,
        }).eq("id", byEmail.id);
        const { data: refreshed } = await admin.from("profiles").select("*").eq("id", byEmail.id).maybeSingle();
        return json({ profile: refreshed, created: false });
      }
    }

    // 4) Criar profile (com auth user se houver email real)
    let newUserId: string | null = null;
    if (rawEmail) {
      try {
        const { data: created, error: cErr } = await admin.auth.admin.createUser({
          email: rawEmail,
          password: crypto.randomUUID() + "Aa1!",
          email_confirm: true,
          user_metadata: { full_name: finalName },
        });
        if (!cErr && created?.user) {
          newUserId = created.user.id;
        } else if (cErr && /already/i.test(cErr.message || "")) {
          // pega usuário existente
          const { data: existing } = await admin.rpc("get_auth_user_id_by_email", { lookup_email: rawEmail });
          if (existing) newUserId = existing as string;
        }
      } catch (e) {
        console.warn("auth create failed", e);
      }
    }
    if (!newUserId) newUserId = crypto.randomUUID();

    const profilePayload: Record<string, any> = {
      id: newUserId,
      email: finalEmail,
      full_name: finalName,
      phone: cust?.mobilePhone || cust?.phone || null,
      cpf_cnpj: finalCpf,
      address: cust?.address ? `${cust.address}${cust.addressNumber ? ", " + cust.addressNumber : ""}` : null,
      neighborhood: cust?.province || null,
      city: cust?.city || null,
      state: cust?.state || null,
      zip_code: cust?.postalCode || null,
      asaas_customer_id: asaas_customer_id || null,
      origin: "asaas-devedor",
      created_by: userId,
    };

    const { data: inserted, error: insErr } = await admin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" })
      .select("*")
      .single();
    if (insErr) throw insErr;

    return json({ profile: inserted, created: true });
  } catch (e) {
    console.error("find-or-create-client-from-asaas error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});