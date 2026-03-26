import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BRT_OFFSET = -3;
const WORK_START = 10;
const WORK_END = 17;
const EMAIL_BATCH = 15;
const WA_BATCH = 1;

function toBRT(d: Date): Date {
  return new Date(d.getTime() + BRT_OFFSET * 3600000);
}

function isBusinessHours(): boolean {
  const brt = toBRT(new Date());
  const day = brt.getUTCDay();
  const hour = brt.getUTCHours();
  return day >= 1 && day <= 5 && hour >= WORK_START && hour < WORK_END;
}

async function sendEmail(
  resendApiKey: string,
  to: string,
  subject: string,
  body: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Webmarcas <noreply@webmarcas.net>",
        to: [to],
        subject,
        html: `<div style="font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:0 auto;">
          <p>${body.replace(/\n/g, "<br/>")}</p>
          <hr style="margin:20px 0;border:none;border-top:1px solid #eee;"/>
          <p style="font-size:11px;color:#999;">Webmarcas - Registro de Marcas</p>
        </div>`,
      }),
    });
    return res.ok ? { success: true } : { success: false, error: `HTTP ${res.status}` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

async function summarizeForWhatsApp(message: string, nome: string, assunto: string): Promise<string> {
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você cria mensagens curtas de WhatsApp para remarketing. Gere uma mensagem entre 200 e 400 caracteres.
REGRAS OBRIGATÓRIAS:
- Comece com "Olá ${nome}!" (mencione o nome UMA ÚNICA VEZ, nunca repita)
- Use o ASSUNTO do e-mail como gancho
- Resuma os 2-3 pontos mais importantes
- NÃO inclua número de telefone (a mensagem já é enviada pelo WhatsApp da empresa)
- Termine com um CTA conversacional, exemplo: "Posso te ligar para explicar melhor ou prefere continuar por aqui?" ou "Quer agendar uma ligação ou prefere tirar dúvidas por aqui?"
- Inclua o link do site: www.webmarcas.net
- Use no máximo 2 emojis
- Tom amigável e direto, como conversa de WhatsApp
- NÃO use "WebMarcas:" no início
- NÃO use aspas
- NÃO repita saudação ou nome do cliente`,
          },
          { role: "user", content: `ASSUNTO: ${assunto}\n\nMENSAGEM:\n${message}` },
        ],
        max_tokens: 250,
        temperature: 0.3,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const summary = data?.choices?.[0]?.message?.content?.trim();
      if (summary && summary.length > 20) return summary;
    }
  } catch (e) {
    console.error("AI summarize error:", e);
  }

  const lines = message.split('\n').filter(l => l.trim().length > 10);
  const keyContent = lines.slice(0, 2).join(' ').substring(0, 180);
  return `Olá ${nome}! ${assunto}. ${keyContent}...\n\n👉 Acesse: www.webmarcas.net\n\nPosso te ligar ou prefere continuar por aqui?`;
}

async function sendWhatsApp(
  supabase: any,
  phone: string,
  nome: string,
  message: string,
): Promise<{ success: boolean; error?: string }> {
  const { data: botRow } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "botconversa")
    .maybeSingle();

  const settings = (botRow?.value as Record<string, unknown>) || {};
  if (!settings.enabled) return { success: false, error: "WhatsApp desativado" };

  const webhookUrl = (settings.webhook_url as string) || "";
  if (!webhookUrl) return { success: false, error: "Webhook não configurado" };

  const normalized = phone.replace(/\D/g, "").replace(/^0/, "");
  const finalPhone = normalized.startsWith("55") ? normalized : `55${normalized}`;

  const payload = { telefone: finalPhone, nome: nome || "Cliente", mensagem: message };
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const authToken = (settings.auth_token as string) || "";
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  try {
    const res = await fetch(webhookUrl, { method: "POST", headers, body: JSON.stringify(payload) });
    const text = await res.text();
    return res.ok ? { success: true } : { success: false, error: `HTTP ${res.status}: ${text}` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ─── Process Lead Queue ──────────────────────────────────────────────
async function processLeadQueue(
  supabase: any,
  resendApiKey: string,
  emailLimit: number,
  waLimit: number,
): Promise<number> {
  let processed = 0;

  if (emailLimit > 0) {
    const { data: emailItems } = await supabase
      .from("lead_remarketing_queue")
      .select("*, leads!inner(id, full_name, email, phone, company_name)")
      .eq("status", "pending")
      .eq("channel", "email")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(emailLimit);

    for (const item of emailItems || []) {
      const lead = item.leads;
      if (!lead?.email) {
        await supabase.from("lead_remarketing_queue").update({ status: "failed", error_message: "Sem e-mail" }).eq("id", item.id);
        continue;
      }
      const result = await sendEmail(resendApiKey, lead.email, item.subject || "", item.body || "");
      if (result.success) {
        await supabase.from("lead_remarketing_queue").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", item.id);
        await supabase.from("email_logs").insert({
          from_email: "noreply@webmarcas.net", to_email: lead.email,
          subject: item.subject, body: item.body, status: "sent",
          trigger_type: "remarketing", related_lead_id: lead.id,
        });
        await supabase.from("lead_activities").insert({
          lead_id: lead.id, activity_type: "remarketing",
          content: `Remarketing e-mail enviado: ${item.subject}`,
        });
        processed++;
      } else {
        await supabase.from("lead_remarketing_queue").update({ status: "failed", error_message: result.error }).eq("id", item.id);
      }
    }
  }

  if (waLimit > 0) {
    const { data: waItems } = await supabase
      .from("lead_remarketing_queue")
      .select("*, leads!inner(id, full_name, email, phone, company_name)")
      .eq("status", "pending")
      .eq("channel", "whatsapp")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(waLimit);

    for (const item of waItems || []) {
      const lead = item.leads;
      if (!lead?.phone) {
        await supabase.from("lead_remarketing_queue").update({ status: "failed", error_message: "Sem telefone" }).eq("id", item.id);
        continue;
      }
      const waMessage = await summarizeForWhatsApp(item.body || "", lead.full_name || "", item.subject || "");
      const result = await sendWhatsApp(supabase, lead.phone, lead.full_name, waMessage);
      if (result.success) {
        await supabase.from("lead_remarketing_queue").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", item.id);
        await supabase.from("lead_activities").insert({
          lead_id: lead.id, activity_type: "remarketing",
          content: `Remarketing WhatsApp enviado para ${lead.phone}`,
        });
        processed++;
      } else {
        await supabase.from("lead_remarketing_queue").update({ status: "failed", error_message: result.error }).eq("id", item.id);
      }
    }
  }

  return processed;
}

// ─── Process Client Queue ────────────────────────────────────────────
async function processClientQueue(
  supabase: any,
  resendApiKey: string,
  emailLimit: number,
  waLimit: number,
): Promise<number> {
  let processed = 0;

  if (emailLimit > 0) {
    const { data: emailItems } = await supabase
      .from("client_remarketing_queue")
      .select("*, profiles!inner(id, full_name, email, phone, company_name)")
      .eq("status", "pending")
      .eq("channel", "email")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(emailLimit);

    for (const item of emailItems || []) {
      const client = item.profiles;
      if (!client?.email) {
        await supabase.from("client_remarketing_queue").update({ status: "failed", error_message: "Sem e-mail" }).eq("id", item.id);
        continue;
      }
      const result = await sendEmail(resendApiKey, client.email, item.subject || "", item.body || "");
      if (result.success) {
        await supabase.from("client_remarketing_queue").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", item.id);
        await supabase.from("email_logs").insert({
          from_email: "noreply@webmarcas.net", to_email: client.email,
          subject: item.subject, body: item.body, status: "sent",
          trigger_type: "remarketing",
        });
        await supabase.from("client_activities").insert({
          user_id: client.id, activity_type: "remarketing",
          description: `Remarketing e-mail enviado: ${item.subject}`,
        });
        processed++;
      } else {
        await supabase.from("client_remarketing_queue").update({ status: "failed", error_message: result.error }).eq("id", item.id);
      }
    }
  }

  if (waLimit > 0) {
    const { data: waItems } = await supabase
      .from("client_remarketing_queue")
      .select("*, profiles!inner(id, full_name, email, phone, company_name)")
      .eq("status", "pending")
      .eq("channel", "whatsapp")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(waLimit);

    for (const item of waItems || []) {
      const client = item.profiles;
      if (!client?.phone) {
        await supabase.from("client_remarketing_queue").update({ status: "failed", error_message: "Sem telefone" }).eq("id", item.id);
        continue;
      }
      const waMessage = await summarizeForWhatsApp(item.body || "", client.full_name || "", item.subject || "");
      const result = await sendWhatsApp(supabase, client.phone, client.full_name, waMessage);
      if (result.success) {
        await supabase.from("client_remarketing_queue").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", item.id);
        await supabase.from("client_activities").insert({
          user_id: client.id, activity_type: "remarketing",
          description: `Remarketing WhatsApp enviado para ${client.phone}`,
        });
        processed++;
      } else {
        await supabase.from("client_remarketing_queue").update({ status: "failed", error_message: result.error }).eq("id", item.id);
      }
    }
  }

  return processed;
}

// ─── Update Campaign Counters ────────────────────────────────────────
async function updateCampaignCounters(
  supabase: any,
  queueTable: string,
  campaignTable: string,
) {
  const { data: campaigns } = await supabase
    .from(queueTable)
    .select("campaign_id")
    .eq("status", "sent")
    .not("campaign_id", "is", null);

  const campaignIds = [...new Set((campaigns || []).map((c: any) => c.campaign_id))];

  for (const cid of campaignIds) {
    const { count: sent } = await supabase
      .from(queueTable)
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", cid)
      .eq("status", "sent");

    const { count: pending } = await supabase
      .from(queueTable)
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", cid)
      .eq("status", "pending");

    await supabase
      .from(campaignTable)
      .update({
        total_sent: sent || 0,
        status: (pending || 0) === 0 ? "concluida" : "em_andamento",
        sent_at: (pending || 0) === 0 ? new Date().toISOString() : null,
      })
      .eq("id", cid);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!isBusinessHours()) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Fora do horário comercial (Seg-Sex 10h-17h BRT)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    // Check daily limits (shared across leads + clients)
    const today = toBRT(new Date());
    today.setUTCHours(0, 0, 0, 0);
    const todayUTC = new Date(today.getTime() - BRT_OFFSET * 3600000).toISOString();

    const { count: leadEmailsSent } = await supabase
      .from("lead_remarketing_queue")
      .select("*", { count: "exact", head: true })
      .eq("channel", "email").eq("status", "sent").gte("sent_at", todayUTC);

    const { count: clientEmailsSent } = await supabase
      .from("client_remarketing_queue")
      .select("*", { count: "exact", head: true })
      .eq("channel", "email").eq("status", "sent").gte("sent_at", todayUTC);

    const { count: leadWaSent } = await supabase
      .from("lead_remarketing_queue")
      .select("*", { count: "exact", head: true })
      .eq("channel", "whatsapp").eq("status", "sent").gte("sent_at", todayUTC);

    const { count: clientWaSent } = await supabase
      .from("client_remarketing_queue")
      .select("*", { count: "exact", head: true })
      .eq("channel", "whatsapp").eq("status", "sent").gte("sent_at", todayUTC);

    const totalEmailsSent = (leadEmailsSent || 0) + (clientEmailsSent || 0);
    const totalWaSent = (leadWaSent || 0) + (clientWaSent || 0);

    const emailsRemaining = Math.max(0, 100 - totalEmailsSent);
    const waRemaining = Math.max(0, 10 - totalWaSent);

    // Split limits: leads get first half, clients get second half
    const leadEmailLimit = Math.min(EMAIL_BATCH, emailsRemaining);
    const leadWaLimit = Math.min(WA_BATCH, waRemaining);

    let processed = 0;

    // Process lead queue
    processed += await processLeadQueue(supabase, resendApiKey, leadEmailLimit, leadWaLimit);

    // Recalculate remaining after leads
    const clientEmailLimit = Math.min(EMAIL_BATCH, Math.max(0, emailsRemaining - processed));
    const clientWaLimit = Math.min(WA_BATCH, Math.max(0, waRemaining - (leadWaLimit > 0 ? 1 : 0)));

    // Process client queue
    processed += await processClientQueue(supabase, resendApiKey, clientEmailLimit, clientWaLimit);

    // Update campaign counters for both queues
    await updateCampaignCounters(supabase, "lead_remarketing_queue", "lead_remarketing_campaigns");
    await updateCampaignCounters(supabase, "client_remarketing_queue", "client_remarketing_campaigns");

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        limits: { emailsRemaining, waRemaining },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
