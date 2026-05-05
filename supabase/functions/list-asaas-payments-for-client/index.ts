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

function digits(v?: string | null): string {
  return (v || "").toString().replace(/\D/g, "");
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

const PAID = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"]);
const OVERDUE = new Set(["OVERDUE", "DUNNING_REQUESTED"]);

function classify(p: any): "pago" | "vencido" | "aberto" {
  if (PAID.has(p.status)) return "pago";
  if (OVERDUE.has(p.status)) return "vencido";
  if (p.dueDate && new Date(p.dueDate + "T23:59:59") < new Date()) return "vencido";
  return "aberto";
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
    const client_id = (body.client_id || "").toString().trim();
    if (!client_id) return json({ error: "client_id is required" }, 400);

    const { data: profile, error: pErr } = await admin
      .from("profiles").select("id, email, cpf_cnpj, asaas_customer_id, full_name").eq("id", client_id).maybeSingle();
    if (pErr || !profile) return json({ error: "Profile not found" }, 404);

    // 1) Resolve customer ids
    const customerIds = new Set<string>();
    if (profile.asaas_customer_id) customerIds.add(profile.asaas_customer_id);

    const cpf = digits(profile.cpf_cnpj);
    if (cpf) {
      try {
        const r = await asaasGet(`/customers?cpfCnpj=${encodeURIComponent(cpf)}&limit=100`);
        for (const c of (r?.data || [])) if (c.id) customerIds.add(c.id);
      } catch (e) { console.warn("asaas cpf lookup failed", e); }
    }

    const email = (profile.email || "").toLowerCase().trim();
    const isPlaceholder = email.endsWith("@webmarcas.local");
    if (email && !isPlaceholder) {
      try {
        const r = await asaasGet(`/customers?email=${encodeURIComponent(email)}&limit=100`);
        for (const c of (r?.data || [])) if (c.id) customerIds.add(c.id);
      } catch (e) { console.warn("asaas email lookup failed", e); }
    }

    // If profile had none and we found exactly one, persist link
    if (!profile.asaas_customer_id && customerIds.size === 1) {
      const onlyId = Array.from(customerIds)[0];
      await admin.from("profiles").update({ asaas_customer_id: onlyId }).eq("id", client_id);
    }

    if (customerIds.size === 0) {
      return json({ customer_ids: [], totals: { pago: 0, aberto: 0, vencido: 0, count_pago: 0, count_aberto: 0, count_vencido: 0 }, items: [] });
    }

    // 2) Fetch payments per customer (paginated)
    const items: any[] = [];
    for (const cid of customerIds) {
      let offset = 0;
      const limit = 100;
      for (let page = 0; page < 10; page++) {
        const r = await asaasGet(`/payments?customer=${encodeURIComponent(cid)}&limit=${limit}&offset=${offset}`);
        const data = r?.data || [];
        for (const p of data) {
          items.push({
            customer_id: cid,
            asaas_id: p.id,
            value: Number(p.value || 0),
            net_value: Number(p.netValue || 0),
            status: p.status,
            classification: classify(p),
            due_date: p.dueDate || null,
            payment_date: p.paymentDate || p.confirmedDate || null,
            description: p.description || null,
            invoice_url: p.invoiceUrl || null,
            bank_slip_url: p.bankSlipUrl || null,
            billing_type: p.billingType || null,
            installment: p.installment || null,
            installment_number: p.installmentNumber || null,
          });
        }
        if (data.length < limit) break;
        offset += limit;
      }
    }

    // 3) Totals
    const totals = { pago: 0, aberto: 0, vencido: 0, count_pago: 0, count_aberto: 0, count_vencido: 0 };
    for (const it of items) {
      if (it.classification === "pago") { totals.pago += it.value; totals.count_pago++; }
      else if (it.classification === "vencido") { totals.vencido += it.value; totals.count_vencido++; }
      else { totals.aberto += it.value; totals.count_aberto++; }
    }

    // Sort: vencidas first by due asc, then abertas asc, then pagas desc by paid date
    items.sort((a, b) => {
      const order: any = { vencido: 0, aberto: 1, pago: 2 };
      if (order[a.classification] !== order[b.classification]) return order[a.classification] - order[b.classification];
      if (a.classification === "pago") {
        return (b.payment_date || "").localeCompare(a.payment_date || "");
      }
      return (a.due_date || "").localeCompare(b.due_date || "");
    });

    return json({ customer_ids: Array.from(customerIds), totals, items });
  } catch (e) {
    console.error("list-asaas-payments-for-client error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});