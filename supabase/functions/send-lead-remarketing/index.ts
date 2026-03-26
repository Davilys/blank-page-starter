import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Business hours: Mon-Fri 10:00-17:00 BRT (UTC-3)
const BRT_OFFSET = -3;
const WORK_START = 10;
const WORK_END = 17;
const EMAIL_DAILY_LIMIT = 100;
const WA_DAILY_LIMIT = 10;
const WA_INTERVAL_MIN = 10;

function toBRT(d: Date): Date {
  return new Date(d.getTime() + BRT_OFFSET * 3600000);
}

function isBusinessDay(brt: Date): boolean {
  const day = brt.getUTCDay();
  return day >= 1 && day <= 5;
}

function nextBusinessSlot(from: Date, channel: 'email' | 'whatsapp', slotIndex: number): Date {
  const brt = toBRT(from);
  let dayOffset = 0;

  if (channel === 'email') {
    const perDay = EMAIL_DAILY_LIMIT;
    dayOffset = Math.floor(slotIndex / perDay);
    const indexInDay = slotIndex % perDay;
    // Distribute evenly across 10-17 (7 hours = 420 min)
    const minuteOffset = Math.floor((indexInDay / perDay) * 420);
    
    let target = new Date(brt);
    target.setUTCDate(target.getUTCDate() + dayOffset);
    // Skip weekends
    while (!isBusinessDay(target)) {
      target.setUTCDate(target.getUTCDate() + 1);
    }
    target.setUTCHours(WORK_START, 0, 0, 0);
    target.setUTCMinutes(target.getUTCMinutes() + minuteOffset);
    // Convert back to UTC
    return new Date(target.getTime() - BRT_OFFSET * 3600000);
  } else {
    // WhatsApp: 10/day, 10min interval
    const perDay = WA_DAILY_LIMIT;
    dayOffset = Math.floor(slotIndex / perDay);
    const indexInDay = slotIndex % perDay;
    const minuteOffset = indexInDay * WA_INTERVAL_MIN;

    let target = new Date(brt);
    target.setUTCDate(target.getUTCDate() + dayOffset);
    while (!isBusinessDay(target)) {
      target.setUTCDate(target.getUTCDate() + 1);
    }
    target.setUTCHours(WORK_START, 0, 0, 0);
    target.setUTCMinutes(target.getUTCMinutes() + minuteOffset);
    return new Date(target.getTime() - BRT_OFFSET * 3600000);
  }
}

async function sendEmailNow(
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
    return res.ok ? { success: true } : { success: false, error: `Resend HTTP ${res.status}` };
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
- A mensagem recebida JÁ CONTÉM saudação e nome do cliente. NÃO adicione "Olá" nem repita o nome.
- Resuma o conteúdo principal em 2-3 pontos, mantendo a saudação original que já existe na mensagem.
- NÃO inclua número de telefone da empresa (a mensagem já é enviada pelo WhatsApp da empresa)
- Termine com um CTA conversacional, exemplo: "Posso te ligar para explicar melhor ou prefere continuar por aqui?"
- Inclua o link do site: www.webmarcas.net
- Use no máximo 2 emojis
- Tom amigável e direto, como conversa de WhatsApp
- NÃO use "WebMarcas:" no início
- NÃO use aspas
- NUNCA repita o nome do cliente mais de uma vez na mensagem inteira`,
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

  // Fallback: use first meaningful lines without duplicating name
  const lines = message.split('\n').filter(l => l.trim().length > 10);
  const keyContent = lines.slice(0, 3).join(' ').substring(0, 280);
  return `${keyContent}...\n\n👉 Acesse: www.webmarcas.net\n\nPosso te ligar ou prefere continuar por aqui?`;
}

async function sendWhatsAppNow(
  supabase: any,
  phone: string,
  nome: string,
  message: string,
): Promise<{ success: boolean; error?: string }> {
  // Get BotConversa settings
  const { data: botRow } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "botconversa")
    .maybeSingle();

  const settings = (botRow?.value as Record<string, unknown>) || {};
  if (!settings.enabled) return { success: false, error: "WhatsApp desativado" };

  const webhookUrl = (settings.webhook_url as string) || "";
  if (!webhookUrl) return { success: false, error: "Webhook BotConversa não configurado" };
  if (!phone) return { success: false, error: "Telefone não informado" };

  const normalized = phone.replace(/\D/g, "").replace(/^0/, "");
  const finalPhone = normalized.startsWith("55") ? normalized : `55${normalized}`;

  const payload = { telefone: finalPhone, nome: nome || "Cliente", mensagem: message };
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const authToken = (settings.auth_token as string) || "";
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  try {
    const res = await fetch(webhookUrl, { method: "POST", headers, body: JSON.stringify(payload) });
    const text = await res.text();
    return res.ok ? { success: true } : { success: false, error: `BotConversa HTTP ${res.status}: ${text}` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { lead_ids, campaign_id, subject, body, channels, test, scheduled_for, immediate } = await req.json();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    // ─── TEST MODE ─────────────────────────────────────────────────────
    if (test === true) {
      if (!lead_ids || lead_ids.length === 0) throw new Error("lead_ids required for test");

      const { data: lead } = await supabase
        .from("leads")
        .select("id, full_name, email, phone, company_name")
        .eq("id", lead_ids[0])
        .single();

      if (!lead) throw new Error("Lead não encontrado");

      const testSubject = (subject || "Teste de Remarketing - Webmarcas")
        .replace(/\{\{nome\}\}/g, lead.full_name || "");
      const testBody = (body || "Olá {{nome}}, este é um teste de remarketing.")
        .replace(/\{\{nome\}\}/g, lead.full_name || "")
        .replace(/\{\{email\}\}/g, lead.email || "")
        .replace(/\{\{empresa\}\}/g, lead.company_name || "");

      const results: Record<string, any> = {};

      // Email test
      if (lead.email) {
        results.email = await sendEmailNow(resendApiKey, lead.email, testSubject, testBody);
        if (results.email.success) {
          await supabase.from("email_logs").insert({
            from_email: "noreply@webmarcas.net",
            to_email: lead.email,
            subject: testSubject,
            body: testBody,
            status: "sent",
            trigger_type: "remarketing_test",
            related_lead_id: lead.id,
          });
        }
      } else {
        results.email = { success: false, error: "Sem e-mail" };
      }

      // WhatsApp test
      if (lead.phone) {
        const waMessage = await summarizeForWhatsApp(testBody, lead.full_name || "", testSubject);
        results.whatsapp = await sendWhatsAppNow(supabase, lead.phone, lead.full_name, waMessage);
        if (results.whatsapp.success) {
          await supabase.from("lead_activities").insert({
            lead_id: lead.id,
            activity_type: "remarketing_test",
            content: `Teste WhatsApp enviado para ${lead.phone}`,
          });
        }
      } else {
        results.whatsapp = { success: false, error: "Sem telefone" };
      }

      // Log activity
      await supabase.from("lead_activities").insert({
        lead_id: lead.id,
        activity_type: "remarketing_test",
        content: `Teste de remarketing: Email=${results.email?.success}, WhatsApp=${results.whatsapp?.success}`,
      });

      return new Response(JSON.stringify({ success: true, test: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── CAMPAIGN MODE ────────────────────────────────────────────────
    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      throw new Error("lead_ids is required");
    }

    const selectedChannels: string[] = channels || ["email"];

    // Fetch leads in batches to avoid URL length limits
    const allLeads: any[] = [];
    const BATCH_SIZE = 50;
    for (let i = 0; i < lead_ids.length; i += BATCH_SIZE) {
      const batch = lead_ids.slice(i, i + BATCH_SIZE);
      const { data: batchLeads, error: batchErr } = await supabase
        .from("leads")
        .select("id, full_name, email, phone, company_name")
        .in("id", batch);
      if (batchErr) throw batchErr;
      if (batchLeads) allLeads.push(...batchLeads);
    }
    const leads = allLeads;

    const emailSubject = subject || "Temos uma oportunidade especial para você!";
    const emailBody = body || "Olá {{nome}}, gostaríamos de retomar contato com você.";

    // ─── IMMEDIATE MODE: Send now, don't queue ─────────────────────────
    if (immediate === true) {
      let emailsSent = 0;
      let whatsappSent = 0;
      const errors: string[] = [];

      for (const lead of leads) {
        const personalizedBody = emailBody
          .replace(/\{\{nome\}\}/g, lead.full_name || "")
          .replace(/\{\{email\}\}/g, lead.email || "")
          .replace(/\{\{empresa\}\}/g, lead.company_name || "");
        const personalizedSubject = emailSubject
          .replace(/\{\{nome\}\}/g, lead.full_name || "");

        // Send email immediately
        if (selectedChannels.includes("email") && lead.email) {
          const emailResult = await sendEmailNow(resendApiKey, lead.email, personalizedSubject, personalizedBody);
          if (emailResult.success) {
            emailsSent++;
            await supabase.from("email_logs").insert({
              from_email: "noreply@webmarcas.net",
              to_email: lead.email,
              subject: personalizedSubject,
              body: personalizedBody,
              status: "sent",
              trigger_type: "direct_send",
              related_lead_id: lead.id,
            });
          } else {
            errors.push(`Email ${lead.email}: ${emailResult.error}`);
          }
        }

        // Send WhatsApp immediately
        if (selectedChannels.includes("whatsapp") && lead.phone) {
          const waMessage = await summarizeForWhatsApp(personalizedBody, lead.full_name || "", personalizedSubject);
          const waResult = await sendWhatsAppNow(supabase, lead.phone, lead.full_name, waMessage);
          if (waResult.success) {
            whatsappSent++;
          } else {
            errors.push(`WhatsApp ${lead.phone}: ${waResult.error}`);
          }
        }

        // Log activity
        try {
          await supabase.from("lead_activities").insert({
            lead_id: lead.id,
            activity_type: "direct_message",
            content: `Mensagem direta enviada. Email: ${selectedChannels.includes("email") && lead.email ? "sim" : "não"}, WhatsApp: ${selectedChannels.includes("whatsapp") && lead.phone ? "sim" : "não"}`,
          });
        } catch (_) { /* ignore */ }
      }

      // Update campaign as completed
      if (campaign_id) {
        await supabase
          .from("lead_remarketing_campaigns")
          .update({
            status: "concluida",
            total_sent: emailsSent + whatsappSent,
            sent_at: new Date().toISOString(),
            channels: selectedChannels,
          })
          .eq("id", campaign_id);
      }

      return new Response(
        JSON.stringify({ success: true, immediate: true, emails_sent: emailsSent, whatsapp_sent: whatsappSent, errors }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── QUEUE MODE: Schedule for business hours ───────────────────────
    const now = scheduled_for ? new Date(scheduled_for) : new Date();
    let emailSlot = 0;
    let waSlot = 0;
    const queueItems: any[] = [];

    for (const lead of leads || []) {
      const personalizedBody = emailBody
        .replace(/\{\{nome\}\}/g, lead.full_name || "")
        .replace(/\{\{email\}\}/g, lead.email || "")
        .replace(/\{\{empresa\}\}/g, lead.company_name || "");
      const personalizedSubject = emailSubject
        .replace(/\{\{nome\}\}/g, lead.full_name || "");

      if (selectedChannels.includes("email") && lead.email) {
        queueItems.push({
          campaign_id,
          lead_id: lead.id,
          channel: "email",
          status: "pending",
          scheduled_for: nextBusinessSlot(now, "email", emailSlot).toISOString(),
          subject: personalizedSubject,
          body: personalizedBody,
        });
        emailSlot++;
      }

      if (selectedChannels.includes("whatsapp") && lead.phone) {
        queueItems.push({
          campaign_id,
          lead_id: lead.id,
          channel: "whatsapp",
          status: "pending",
          scheduled_for: nextBusinessSlot(now, "whatsapp", waSlot).toISOString(),
          subject: personalizedSubject,
          body: personalizedBody,
        });
        waSlot++;
      }
    }

    // Insert queue in batches of 50
    for (let i = 0; i < queueItems.length; i += 50) {
      const batch = queueItems.slice(i, i + 50);
      await supabase.from("lead_remarketing_queue").insert(batch);
    }

    // Update campaign
    if (campaign_id) {
      await supabase
        .from("lead_remarketing_campaigns")
        .update({
          status: "agendada",
          total_queued: queueItems.length,
          channels: selectedChannels,
        })
        .eq("id", campaign_id);
    }

    return new Response(
      JSON.stringify({ success: true, queued: queueItems.length, emails: emailSlot, whatsapp: waSlot }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
