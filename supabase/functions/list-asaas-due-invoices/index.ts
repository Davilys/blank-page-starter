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

const ACTIVE_STATUSES = new Set(["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Admin gate
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.slice(7);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: uErr } = await userClient.auth.getUser(token);
    if (uErr || !userData?.user) return json({ error: "Invalid session" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden: admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const dateFrom: string | null = body.date_from || null; // YYYY-MM-DD
    const dateTo: string | null = body.date_to || null;
    const exactDate: string | null = body.date || null;

    // 1) Buscar TODAS as cobranças ativas do Asaas no intervalo
    const params = new URLSearchParams();
    params.set("limit", "100");
    if (exactDate) {
      params.set("dueDate[ge]", exactDate);
      params.set("dueDate[le]", exactDate);
    } else {
      if (dateFrom) params.set("dueDate[ge]", dateFrom);
      if (dateTo) params.set("dueDate[le]", dateTo);
    }

    const allPayments: any[] = [];
    let offset = 0;
    for (let page = 0; page < 30; page++) {
      params.set("offset", String(offset));
      const r = await asaasGet(`/payments?${params.toString()}`);
      const data = r?.data || [];
      for (const p of data) {
        // Só cobranças ativas (não pagas, não deletadas, não estornadas)
        if (ACTIVE_STATUSES.has(p.status)) {
          allPayments.push(p);
        }
      }
      if (data.length < 100) break;
      offset += 100;
    }

    if (allPayments.length === 0) {
      return json({ items: [], total: 0 });
    }

    // 2) Enriquecer com invoice local + profile
    const asaasIds = allPayments.map((p) => p.id);
    const { data: invoices } = await admin
      .from("invoices")
      .select("id, user_id, asaas_invoice_id, invoice_url, status, description, profiles:user_id(full_name,email,phone,asaas_customer_id,cpf_cnpj)")
      .in("asaas_invoice_id", asaasIds);

    const invByAsaasId = new Map<string, any>();
    for (const inv of invoices ?? []) {
      if (inv.asaas_invoice_id) invByAsaasId.set(inv.asaas_invoice_id, inv);
    }

    // Coletar customer_ids não encontrados via invoice para buscar profile pelo asaas_customer_id
    const missingCustomerIds = new Set<string>();
    for (const p of allPayments) {
      if (!invByAsaasId.has(p.id) && p.customer) missingCustomerIds.add(p.customer);
    }

    const profByCustomerId = new Map<string, any>();
    if (missingCustomerIds.size > 0) {
      const { data: profs } = await admin
        .from("profiles")
        .select("id, full_name, email, phone, asaas_customer_id, cpf_cnpj")
        .in("asaas_customer_id", Array.from(missingCustomerIds));
      for (const p of profs ?? []) {
        if (p.asaas_customer_id) profByCustomerId.set(p.asaas_customer_id, p);
      }
    }

    // Buscar dados de customer do Asaas em batch (para nome/email quando não há profile)
    const customerCache = new Map<string, any>();
    async function getAsaasCustomer(cid: string) {
      if (customerCache.has(cid)) return customerCache.get(cid);
      try {
        const c = await asaasGet(`/customers/${cid}`);
        customerCache.set(cid, c);
        return c;
      } catch { return null; }
    }

    const items: any[] = [];
    for (const p of allPayments) {
      const inv = invByAsaasId.get(p.id);
      const profile = inv?.profiles || profByCustomerId.get(p.customer) || null;
      let asaasCust: any = null;
      if (!profile && p.customer) {
        asaasCust = await getAsaasCustomer(p.customer);
      }

      items.push({
        asaas_payment_id: p.id,
        asaas_customer_id: p.customer,
        invoice_id: inv?.id ?? null,
        user_id: inv?.user_id ?? profile?.id ?? null,
        amount: Number(p.value ?? 0),
        due_date: p.dueDate,
        status: p.status,
        billing_type: p.billingType,
        invoice_url: p.invoiceUrl || inv?.invoice_url || p.bankSlipUrl || null,
        description: p.description || inv?.description || null,
        cliente_nome: profile?.full_name || asaasCust?.name || null,
        cliente_email: profile?.email || asaasCust?.email || null,
        cliente_phone: profile?.phone || asaasCust?.mobilePhone || asaasCust?.phone || null,
      });
    }

    // Ordenar por due_date asc
    items.sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));

    return json({ items, total: items.length });
  } catch (e) {
    console.error("list-asaas-due-invoices error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});