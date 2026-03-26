import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const minuteOffset = Math.floor((indexInDay / perDay) * 420);
    
    let target = new Date(brt);
    target.setUTCDate(target.getUTCDate() + dayOffset);
    while (!isBusinessDay(target)) {
      target.setUTCDate(target.getUTCDate() + 1);
    }
    target.setUTCHours(WORK_START, 0, 0, 0);
    target.setUTCMinutes(target.getUTCMinutes() + minuteOffset);
    return new Date(target.getTime() - BRT_OFFSET * 3600000);
  } else {
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

async function sendWhatsAppNow(
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

    const { client_ids, campaign_id, subject, body, channels, test, scheduled_for } = await req.json();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    // ─── TEST MODE ─────────────────────────────────────────────────────
    if (test === true) {
      if (!client_ids || client_ids.length === 0) throw new Error("client_ids required for test");

      const { data: client } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, company_name")
        .eq("id", client_ids[0])
        .single();

      if (!client) throw new Error("Cliente não encontrado");

      // Fetch brand name for {{marca}} variable
      const { data: brandProcess } = await supabase
        .from("brand_processes")
        .select("brand_name")
        .eq("user_id", client.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const brandName = brandProcess?.brand_name || "sua marca";

      const testSubject = (subject || "Teste de Remarketing - Webmarcas")
        .replace(/\{\{nome\}\}/g, client.full_name || "")
        .replace(/\{\{marca\}\}/g, brandName);
      const testBody = (body || "Olá {{nome}}, este é um teste de remarketing.")
        .replace(/\{\{nome\}\}/g, client.full_name || "")
        .replace(/\{\{email\}\}/g, client.email || "")
        .replace(/\{\{empresa\}\}/g, client.company_name || "")
        .replace(/\{\{marca\}\}/g, brandName);

      const results: Record<string, any> = {};

      if (client.email) {
        results.email = await sendEmailNow(resendApiKey, client.email, testSubject, testBody);
        if (results.email.success) {
          await supabase.from("email_logs").insert({
            from_email: "noreply@webmarcas.net",
            to_email: client.email,
            subject: testSubject,
            body: testBody,
            status: "sent",
            trigger_type: "remarketing_test",
          });
        }
      } else {
        results.email = { success: false, error: "Sem e-mail" };
      }

      if (client.phone) {
        const waMessage = await summarizeForWhatsApp(testBody, client.full_name || "", testSubject);
        results.whatsapp = await sendWhatsAppNow(supabase, client.phone, client.full_name, waMessage);
        if (results.whatsapp.success) {
          await supabase.from("client_activities").insert({
            user_id: client.id,
            activity_type: "remarketing_test",
            description: `Teste WhatsApp enviado para ${client.phone}`,
          });
        }
      } else {
        results.whatsapp = { success: false, error: "Sem telefone" };
      }

      await supabase.from("client_activities").insert({
        user_id: client.id,
        activity_type: "remarketing_test",
        description: `Teste de remarketing: Email=${results.email?.success}, WhatsApp=${results.whatsapp?.success}`,
      });

      return new Response(JSON.stringify({ success: true, test: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── CAMPAIGN MODE: Queue items ────────────────────────────────────
    if (!client_ids || !Array.isArray(client_ids) || client_ids.length === 0) {
      throw new Error("client_ids is required");
    }

    const selectedChannels: string[] = channels || ["email"];

    const allClients: any[] = [];
    const BATCH_SIZE = 50;
    for (let i = 0; i < client_ids.length; i += BATCH_SIZE) {
      const batch = client_ids.slice(i, i + BATCH_SIZE);
      const { data: batchClients, error: batchErr } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, company_name")
        .in("id", batch);
      if (batchErr) throw batchErr;
      if (batchClients) allClients.push(...batchClients);
    }

    // Fetch brand names for all clients for {{marca}} variable
    const clientIds = allClients.map(c => c.id);
    const brandMap: Record<string, string> = {};
    if (clientIds.length > 0) {
      const { data: brands } = await supabase
        .from("brand_processes")
        .select("user_id, brand_name")
        .in("user_id", clientIds)
        .order("created_at", { ascending: false });
      for (const b of brands || []) {
        if (b.user_id && !brandMap[b.user_id]) {
          brandMap[b.user_id] = b.brand_name;
        }
      }
    }

    const emailSubject = subject || "Temos uma oportunidade especial para você!";
    const emailBody = body || "Olá {{nome}}, gostaríamos de retomar contato com você.";

    const now = scheduled_for ? new Date(scheduled_for) : new Date();
    let emailSlot = 0;
    let waSlot = 0;
    const queueItems: any[] = [];

    for (const client of allClients) {
      const marca = brandMap[client.id] || "sua marca";
      const personalizedBody = emailBody
        .replace(/\{\{nome\}\}/g, client.full_name || "")
        .replace(/\{\{email\}\}/g, client.email || "")
        .replace(/\{\{empresa\}\}/g, client.company_name || "")
        .replace(/\{\{marca\}\}/g, marca);
      const personalizedSubject = emailSubject
        .replace(/\{\{nome\}\}/g, client.full_name || "")
        .replace(/\{\{marca\}\}/g, marca);

      if (selectedChannels.includes("email") && client.email) {
        queueItems.push({
          campaign_id,
          client_id: client.id,
          channel: "email",
          status: "pending",
          scheduled_for: nextBusinessSlot(now, "email", emailSlot).toISOString(),
          subject: personalizedSubject,
          body: personalizedBody,
        });
        emailSlot++;
      }

      if (selectedChannels.includes("whatsapp") && client.phone) {
        queueItems.push({
          campaign_id,
          client_id: client.id,
          channel: "whatsapp",
          status: "pending",
          scheduled_for: nextBusinessSlot(now, "whatsapp", waSlot).toISOString(),
          subject: personalizedSubject,
          body: personalizedBody,
        });
        waSlot++;
      }
    }

    for (let i = 0; i < queueItems.length; i += 50) {
      const batch = queueItems.slice(i, i + 50);
      await supabase.from("client_remarketing_queue").insert(batch);
    }

    if (campaign_id) {
      await supabase
        .from("client_remarketing_campaigns")
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
