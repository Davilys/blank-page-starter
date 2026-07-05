import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

function buildWhatsApp(nome: string, quando: string, data: string, link: string, valor: string) {
  const first = (nome || "Cliente").split(" ")[0];
  return `Olá, *${first}*!

Passando para lembrar que sua cobrança no valor de *${valor}* vence *${quando}* (${data}).

Para evitar juros e multas, você pode realizar o pagamento aqui:
${link ? `\n🔗 ${link}\n` : "\n(entre em contato para receber o link)\n"}
Qualquer dúvida estamos à disposição 😊

Equipe WebMarcas`;
}

function buildEmailHtml(nome: string, quando: string, data: string, link: string, valor: string) {
  const first = (nome || "Cliente").split(" ")[0];
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;line-height:1.6">
  <h2 style="color:#0a3d62">Lembrete de vencimento — WebMarcas</h2>
  <p>Olá, <strong>${first}</strong>!</p>
  <p>Passando para lembrar que sua cobrança no valor de <strong>${valor}</strong> vence <strong>${quando}</strong> (${data}).</p>
  <p>Para evitar juros e multas, você pode realizar o pagamento aqui:</p>
  ${link ? `<p><a href="${link}" target="_blank" rel="noopener" style="background:#0a3d62;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Acessar fatura / boleto</a></p>` : `<p><em>Entre em contato para receber o link de pagamento.</em></p>`}
  <p>Qualquer dúvida estamos à disposição 😊</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:13px;color:#666">Atenciosamente,<br><strong>Equipe WebMarcas</strong><br>🌐 www.webmarcas.net · 📧 ola@webmarcas.net · 📱 (11) 91112-0225</p>
</div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const invoice_id: string | undefined = body.invoice_id;
    const asaas_payment_id: string | undefined = body.asaas_payment_id;
    const tipo: "d3" | "d0" = body.tipo === "d3" ? "d3" : "d0";
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
        .select("id, user_id, contract_id, amount, due_date, status, invoice_url, description, profiles:user_id(full_name,email,phone)")
        .eq("id", invoice_id)
        .maybeSingle();
      invoice = data;
    } else if (asaas_payment_id) {
      const { data } = await admin
        .from("invoices")
        .select("id, user_id, contract_id, amount, due_date, status, invoice_url, description, profiles:user_id(full_name,email,phone)")
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

    const tipoKey = tipo === "d3" ? "lembrete_d3" : "lembrete_d0";

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

    const waMsg = buildWhatsApp(nome, quando, dataStr, link, valor);
    const emailHtml = buildEmailHtml(nome, quando, dataStr, link, valor);
    const subject = `Lembrete: sua fatura vence ${quando} (${dataStr}) — WebMarcas`;

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