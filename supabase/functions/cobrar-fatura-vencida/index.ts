import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Webhook BotConversa DEDICADO às cobranças do Financeiro (Devedores ≤30 / +30 / +60).
// As demais notificações WhatsApp do CRM continuam usando o webhook padrão em system_settings.botconversa.
const FINANCEIRO_WEBHOOK =
  "https://new-backend.botconversa.com.br/api/v1/webhooks-automation/catch/17504/Z6cCNjvBc9uv/";

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR");
  } catch { return d; }
}
function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildWhatsApp(nome: string, data: string, link: string, valor: string) {
  const first = (nome || "Cliente").split(" ")[0];
  return `Olá, *${first}*, tudo bem?

Identificamos que sua fatura no valor de *${valor}* com vencimento em *${data}* encontra-se em aberto.

Você consegue realizar o pagamento hoje?
Preciso apenas da sua confirmação para atualizar nosso sistema.

✅ Pagando hoje via PIX, conseguimos retirar multas e juros.

🔑 Chave PIX (CNPJ):
*39.528.012/0001-29*
${link ? `\n🔗 Link da fatura: ${link}\n` : ""}
Após o pagamento, me envie o comprovante por aqui para que eu possa dar baixa no sistema, tudo bem?

Atenciosamente,
Equipe WebMarcas`;
}

function buildEmailHtml(nome: string, data: string, link: string, valor: string) {
  const first = (nome || "Cliente").split(" ")[0];
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;line-height:1.6">
  <h2 style="color:#0a3d62">Fatura em aberto — WebMarcas</h2>
  <p>Olá, <strong>${first}</strong>, tudo bem?</p>
  <p>Identificamos que sua fatura no valor de <strong>${valor}</strong> com vencimento em <strong>${data}</strong> encontra-se em aberto.</p>
  <p>Você consegue realizar o pagamento hoje? Preciso apenas da sua confirmação para atualizar nosso sistema.</p>
  <p style="background:#e8f5e9;padding:10px;border-radius:6px">✅ <strong>Pagando hoje via PIX</strong>, conseguimos retirar multas e juros.</p>
  <p>🔑 <strong>Chave PIX (CNPJ):</strong><br><code style="font-size:16px">39.528.012/0001-29</code></p>
  ${link ? `<p>🔗 <a href="${link}" target="_blank" rel="noopener">Acessar fatura / boleto</a></p>` : ""}
  <p>Após o pagamento, envie o comprovante respondendo este e-mail para que possamos dar baixa no sistema.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:13px;color:#666">Atenciosamente,<br><strong>Equipe WebMarcas</strong><br>🌐 www.webmarcas.net · 📧 ola@webmarcas.net · 📱 (11) 91112-0225</p>
</div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const invoice_id: string | undefined = body.invoice_id;
    const channels: Array<"whatsapp" | "email"> = Array.isArray(body.channels) && body.channels.length
      ? body.channels
      : ["whatsapp", "email"];
    const force: boolean = !!body.force;

    if (!invoice_id) {
      return new Response(JSON.stringify({ error: "invoice_id é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: invoice, error: invErr } = await admin
      .from("invoices")
      .select("id, user_id, contract_id, amount, due_date, status, invoice_url, description, profiles:user_id(full_name,email,phone)")
      .eq("id", invoice_id)
      .maybeSingle();

    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: "Fatura não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotência: bloqueia nova cobrança nas últimas 24h, salvo `force`
    if (!force) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await admin
        .from("cobranca_historico")
        .select("id, enviada_em")
        .eq("invoice_id", invoice_id)
        .gte("enviada_em", since)
        .limit(1);
      if (recent && recent.length > 0) {
        return new Response(JSON.stringify({
          skipped: true,
          reason: "Cobrança já enviada nas últimas 24h",
          last_sent_at: recent[0].enviada_em,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const profile: any = (invoice as any).profiles || {};
    let nome = profile.full_name || "";
    let email = profile.email || "";
    let phone = profile.phone || "";

    // Fallback: buscar dados do lead via contrato quando o profile não tem contato
    if (!email || !phone) {
      try {
        let leadId: string | null = null;
        if ((invoice as any).contract_id) {
          const { data: contract } = await admin
            .from("contracts")
            .select("lead_id")
            .eq("id", (invoice as any).contract_id)
            .maybeSingle();
          leadId = (contract as any)?.lead_id ?? null;
        }
        if (leadId) {
          const { data: lead } = await admin
            .from("leads")
            .select("full_name,email,phone")
            .eq("id", leadId)
            .maybeSingle();
          if (lead) {
            nome = nome || (lead as any).full_name || "";
            email = email || (lead as any).email || "";
            phone = phone || (lead as any).phone || "";
          }
        }
      } catch (_) { /* ignore */ }
    }

    if (!nome) nome = "Cliente";
    const data = fmtDate(invoice.due_date);
    const valor = fmtBRL(Number(invoice.amount || 0));
    const link = invoice.invoice_url || "";

    const waMsg = buildWhatsApp(nome, data, link, valor);
    const emailHtml = buildEmailHtml(nome, data, link, valor);
    const subject = `Fatura em aberto — vencimento ${data} — WebMarcas`;

    const finalChannels: Array<"whatsapp" | "email"> = [];
    if (channels.includes("whatsapp") && phone) finalChannels.push("whatsapp");
    if (channels.includes("email") && email) finalChannels.push("email");

    if (finalChannels.length === 0) {
      return new Response(JSON.stringify({
        error: "Cliente sem telefone/e-mail cadastrados",
        details: { invoice_id, has_user: !!invoice.user_id, has_contract: !!(invoice as any).contract_id },
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
          data: { link, marca: invoice.description || "sua fatura" },
          whatsapp_webhook_override: FINANCEIRO_WEBHOOK,
        },
      },
    );

    const proximaAcao = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await admin.from("cobranca_historico").insert({
      invoice_id,
      user_id: invoice.user_id,
      cliente_nome: nome,
      cliente_email: email,
      cliente_phone: phone,
      canais: finalChannels,
      status: "enviada",
      proxima_acao_em: proximaAcao,
      message_whatsapp: waMsg,
      message_email_html: emailHtml,
      message_email_subject: subject,
      metadata: { notif: notifResult ?? null, error: notifErr?.message ?? null },
    });

    return new Response(JSON.stringify({
      success: true,
      channels: finalChannels,
      proxima_acao_em: proximaAcao,
      result: notifResult ?? null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("cobrar-fatura-vencida error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});