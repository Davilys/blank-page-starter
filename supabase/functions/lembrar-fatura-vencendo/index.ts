import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildWhatsApp, buildEmailHtml, buildSubject, temClausulaInadimplencia, TIPOS_LEMBRETE, type TipoLembrete } from "../_shared/lembreteTemplates.ts";
import { PAID_STATUSES } from "../_shared/crmCobranca.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FINANCEIRO_WEBHOOK =
  "https://new-backend.botconversa.com.br/api/v1/webhooks-automation/catch/17504/Z6cCNjvBc9uv/";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") || "";
const ASAAS_ENV = (Deno.env.get("ASAAS_ENV") || "production").toLowerCase();
const ASAAS_BASE = ASAAS_ENV === "sandbox"
  ? "https://api-sandbox.asaas.com/v3"
  : "https://api.asaas.com/v3";

async function asaasGet(path: string) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    headers: { "access_token": ASAAS_API_KEY, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Asaas ${res.status}`);
  return await res.json();
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR");
  } catch { return d as string; }
}
function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const invoice_id: string | undefined = body.invoice_id;
    const asaas_payment_id: string | undefined = body.asaas_payment_id;
    const tipo: TipoLembrete = TIPOS_LEMBRETE.includes(body.tipo) ? body.tipo : "d0";
    const channels: Array<"whatsapp" | "email"> = Array.isArray(body.channels) && body.channels.length
      ? body.channels
      : ["whatsapp", "email"];
    const force: boolean = !!body.force;
    const origin: string = body.origin || "manual";

    if (!invoice_id && !asaas_payment_id) {
      return new Response(JSON.stringify({ error: "invoice_id ou asaas_payment_id é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    let invoice: any = null;
    if (invoice_id) {
      const { data } = await admin
        .from("invoices")
        .select("id, user_id, contract_id, amount, due_date, status, asaas_invoice_id, invoice_url, description, profiles:user_id(full_name,email,phone)")
        .eq("id", invoice_id)
        .maybeSingle();
      invoice = data;
    } else if (asaas_payment_id) {
      const { data } = await admin
        .from("invoices")
        .select("id, user_id, contract_id, amount, due_date, status, asaas_invoice_id, invoice_url, description, profiles:user_id(full_name,email,phone)")
        .eq("asaas_invoice_id", asaas_payment_id)
        .maybeSingle();
      invoice = data;
    }

    // Fallback: buscar direto no Asaas quando não há invoice local
    if (!invoice && asaas_payment_id) {
      try {
        const p = await asaasGet(`/payments/${asaas_payment_id}`);
        let cust: any = null;
        if (p?.customer) { try { cust = await asaasGet(`/customers/${p.customer}`); } catch { /* ignore */ } }
        // Tenta amarrar a um profile pelo asaas_customer_id
        let profileMatch: any = null;
        if (p?.customer) {
          const { data: prof } = await admin
            .from("profiles").select("id, full_name, email, phone")
            .eq("asaas_customer_id", p.customer).maybeSingle();
          profileMatch = prof;
        }
        invoice = {
          id: null,
          user_id: profileMatch?.id ?? null,
          contract_id: null,
          amount: Number(p?.value ?? 0),
          due_date: p?.dueDate ?? null,
          status: p?.status ?? null,
          invoice_url: p?.invoiceUrl || p?.bankSlipUrl || null,
          description: p?.description ?? null,
          profiles: {
            full_name: profileMatch?.full_name || cust?.name || null,
            email: profileMatch?.email || cust?.email || null,
            phone: profileMatch?.phone || cust?.mobilePhone || cust?.phone || null,
          },
          _asaas_payment_id: asaas_payment_id,
        };
      } catch (e) {
        return new Response(JSON.stringify({ error: "Fatura não encontrada no Asaas nem localmente" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!invoice) {
      return new Response(JSON.stringify({ error: "Fatura não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const effInvoiceId: string | null = (invoice as any).id ?? null;
    const effAsaasPaymentId: string | null = (invoice as any)._asaas_payment_id ?? asaas_payment_id ?? null;

    const tipoKey = `lembrete_${tipo}`;
    const isVencido = tipo.startsWith("vencido_");

    // Re-checagem de pagamento (nunca cobrar quem já pagou): estado local + Asaas.
    if (!force && isVencido) {
      const st = String((invoice as any).status || "").toLowerCase();
      if (PAID_STATUSES.includes(st.toUpperCase()) || ["paid", "refunded", "cancelled", "deleted"].includes(st)) {
        return new Response(JSON.stringify({ skipped: true, reason: `Fatura com status ${st}` }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const payId = effAsaasPaymentId || (invoice as any).asaas_invoice_id || null;
      if (payId && ASAAS_API_KEY) {
        try {
          const p = await asaasGet(`/payments/${payId}`);
          const as = String(p?.status || "").toUpperCase();
          if (p?.deleted || ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "REFUNDED"].includes(as)) {
            return new Response(JSON.stringify({ skipped: true, reason: `Asaas ${p?.deleted ? "removida" : as}` }), {
              status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        } catch (e) {
          // Sem confirmação do Asaas: não envia cobrança (fail closed).
          return new Response(JSON.stringify({ error: "Falha ao reconferir pagamento no Asaas; envio abortado" }), {
            status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    // Idempotência: bloqueia reenvio se já houver do mesmo tipo nas últimas 20h.
    if (!force && effInvoiceId) {
      const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await admin
        .from("cobranca_historico")
        .select("id, enviada_em")
        .eq("invoice_id", effInvoiceId)
        .eq("tipo", tipoKey)
        .gte("enviada_em", since)
        .limit(1);
      if (recent && recent.length > 0) {
        return new Response(JSON.stringify({
          skipped: true,
          reason: `Lembrete ${tipo.toUpperCase()} já enviado nas últimas 20h`,
          last_sent_at: recent[0].enviada_em,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const profile: any = (invoice as any).profiles || {};
    let nome = profile.full_name || "";
    let email = profile.email || "";
    let phone = profile.phone || "";

    if (!email || !phone) {
      try {
        let leadId: string | null = null;
        if ((invoice as any).contract_id) {
          const { data: contract } = await admin
            .from("contracts").select("lead_id")
            .eq("id", (invoice as any).contract_id).maybeSingle();
          leadId = (contract as any)?.lead_id ?? null;
        }
        if (leadId) {
          const { data: lead } = await admin
            .from("leads").select("full_name,email,phone")
            .eq("id", leadId).maybeSingle();
          if (lead) {
            nome = nome || (lead as any).full_name || "";
            email = email || (lead as any).email || "";
            phone = phone || (lead as any).phone || "";
          }
        }
      } catch (_) { /* ignore */ }
    }

    if (!nome) nome = "Cliente";
    const dataStr = fmtDate((invoice as any).due_date);
    const valor = fmtBRL(Number((invoice as any).amount || 0));
    const link = (invoice as any).invoice_url || "";
    const quando = tipo === "d0" ? "hoje" : "em 3 dias";
    const servico = String((invoice as any).description || "").trim();

    let comClausula = false;
    if (tipo === "vencido_d5" && (invoice as any).contract_id) {
      const { data: ct } = await admin.from("contracts").select("contract_html").eq("id", (invoice as any).contract_id).maybeSingle();
      comClausula = temClausulaInadimplencia((ct as any)?.contract_html);
    }
    const waMsg = buildWhatsApp(nome, quando, dataStr, link, valor, tipo, servico, comClausula);
    const emailHtml = buildEmailHtml(nome, quando, dataStr, link, valor, tipo, servico, comClausula);
    const subject = buildSubject(tipo, quando, dataStr);

    const finalChannels: Array<"whatsapp" | "email"> = [];
    if (channels.includes("whatsapp") && phone) finalChannels.push("whatsapp");
    if (channels.includes("email") && email) finalChannels.push("email");

    if (finalChannels.length === 0) {
      return new Response(JSON.stringify({
        error: "Cliente sem telefone/e-mail cadastrados",
        details: { invoice_id: effInvoiceId, asaas_payment_id: effAsaasPaymentId, has_user: !!(invoice as any).user_id },
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: notifResult, error: notifErr } = await admin.functions.invoke(
      "send-multichannel-notification",
      {
        body: {
          event_type: "manual",
          channels: finalChannels,
          recipient: { nome, email, phone },
          custom_message: waMsg,
          custom_html: emailHtml,
          custom_subject: subject,
          ...(isVencido ? { whatsapp_webhook_override: FINANCEIRO_WEBHOOK } : {}),
          data: { link, marca: (invoice as any).description || "sua fatura" },
        },
      },
    );

    await admin.from("cobranca_historico").insert({
      invoice_id: effInvoiceId,
      user_id: (invoice as any).user_id,
      cliente_nome: nome,
      cliente_email: email,
      cliente_phone: phone,
      canais: finalChannels,
      status: "enviada",
      tipo: tipoKey,
      message_whatsapp: waMsg,
      message_email_html: emailHtml,
      message_email_subject: subject,
      metadata: { notif: notifResult ?? null, error: notifErr?.message ?? null, origin, due_date: (invoice as any).due_date, asaas_payment_id: effAsaasPaymentId },
    });

    return new Response(JSON.stringify({
      success: true,
      channels: finalChannels,
      tipo: tipoKey,
      result: notifResult ?? null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("lembrar-fatura-vencendo error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});