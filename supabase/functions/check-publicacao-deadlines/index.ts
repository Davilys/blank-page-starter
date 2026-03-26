import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATUS_LABELS: Record<string, string> = {
  depositada: "Depositada",
  publicada: "Publicada",
  oposicao: "Oposição",
  deferida: "Deferida",
  certificada: "Certificada",
  indeferida: "Indeferida",
  arquivada: "Arquivada",
  renovacao_pendente: "Renovação Pendente",
};

// Map pub status → process pipeline_stage for reverse sync
const STAGE_MAP: Record<string, string> = {
  depositada: "protocolado",
  publicada: "protocolado",
  oposicao: "oposicao",
  deferida: "deferimento",
  certificada: "certificados",
  indeferida: "indeferimento",
  arquivada: "distrato",
  renovacao_pendente: "renovacao",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const oneDayMs = 24 * 60 * 60 * 1000;

    // Fetch all publicacoes with upcoming deadlines (next 31 days) that are not archived/certificada
    const { data: pubs, error } = await supabase
      .from("publicacoes_marcas")
      .select("id, process_id, client_id, admin_id, status, proximo_prazo_critico, descricao_prazo, brand_name_rpi, process_number_rpi, last_notification_sent_at")
      .not("status", "in", '("arquivada","certificada")')
      .not("proximo_prazo_critico", "is", null);

    if (error) throw error;

    // Get all admin IDs
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = (adminRoles || []).map((r: any) => r.user_id);

    // Get process info for brand names
    const processIds = [...new Set((pubs || []).filter((p: any) => p.process_id).map((p: any) => p.process_id))];
    let processMap = new Map();
    if (processIds.length > 0) {
      const { data: procs } = await supabase
        .from("brand_processes")
        .select("id, brand_name, process_number")
        .in("id", processIds);
      (procs || []).forEach((p: any) => processMap.set(p.id, p));
    }

    let notified = 0;
    let skipped = 0;
    let autoArchived = 0;
    const alertDays = [30, 15, 7, 3, 1, 0]; // Days before deadline to alert

    for (const pub of pubs || []) {
      const deadline = new Date(pub.proximo_prazo_critico);
      const daysLeft = Math.round((deadline.getTime() - now.getTime()) / oneDayMs);

      // ─── AUTO-ARCHIVE: prazo vencido → arquivada ───
      if (daysLeft < 0 && pub.status !== "arquivada") {
        const { error: archiveErr } = await supabase
          .from("publicacoes_marcas")
          .update({
            status: "arquivada",
            updated_at: now.toISOString(),
          })
          .eq("id", pub.id);

        if (!archiveErr) {
          autoArchived++;

          // Reverse sync: update brand_processes pipeline_stage → distrato
          if (pub.process_id) {
            await supabase
              .from("brand_processes")
              .update({
                pipeline_stage: "arquivado",
                updated_at: now.toISOString(),
              })
              .eq("id", pub.process_id);
          }

          // Log the auto-archive
          await supabase.from("publicacao_logs").insert({
            publicacao_id: pub.id,
            admin_email: "sistema",
            campo_alterado: "status",
            valor_anterior: pub.status,
            valor_novo: "arquivada",
          });

          // Notify admin about auto-archive
          const proc = pub.process_id ? processMap.get(pub.process_id) : null;
          const brandName = proc?.brand_name || pub.brand_name_rpi || "Marca";
          const processNumber = proc?.process_number || pub.process_number_rpi || "";

          const archiveNotifs: any[] = [];
          const targetAdmins = pub.admin_id ? [pub.admin_id] : adminIds;
          for (const adminId of targetAdmins) {
            archiveNotifs.push({
              user_id: adminId,
              title: `📦 Arquivado automaticamente: ${brandName}`,
              message: `A publicação "${brandName}" (${processNumber}) foi arquivada automaticamente por prazo vencido em ${deadline.toLocaleDateString("pt-BR")}. Caso uma nova publicação RPI saia, o status será revertido.`,
              type: "warning",
              link: "/admin/publicacao",
            });
          }
          if (pub.client_id) {
            archiveNotifs.push({
              user_id: pub.client_id,
              title: `📦 Processo arquivado: ${brandName}`,
              message: `O processo "${brandName}" foi arquivado por expiração de prazo. Acompanhe pelo portal.`,
              type: "warning",
              link: "/cliente/processos",
            });
          }
          if (archiveNotifs.length > 0) {
            await supabase.from("notifications").insert(archiveNotifs);
          }
        }
        continue; // Skip normal notification flow for auto-archived
      }

      // Only alert at specific day thresholds (30, 15, 7, 3, 1, 0) or if overdue
      const isAlertDay = alertDays.includes(daysLeft) || daysLeft < 0;
      if (!isAlertDay) {
        skipped++;
        continue;
      }

      // Dedup: skip if we already notified within the last 20 hours
      if (pub.last_notification_sent_at) {
        const lastSent = new Date(pub.last_notification_sent_at);
        const hoursSinceLast = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLast < 20) {
          skipped++;
          continue;
        }
      }

      const proc = pub.process_id ? processMap.get(pub.process_id) : null;
      const brandName = proc?.brand_name || pub.brand_name_rpi || "Marca";
      const processNumber = proc?.process_number || pub.process_number_rpi || "";
      const statusLabel = STATUS_LABELS[pub.status] || pub.status;
      const deadlineStr = deadline.toLocaleDateString("pt-BR");

      const notifications: any[] = [];

      // Determine urgency
      let urgencyEmoji = "📋";
      let notifType = "info";
      if (daysLeft < 0) {
        urgencyEmoji = "🚨";
        notifType = "error";
      } else if (daysLeft <= 3) {
        urgencyEmoji = "⚠️";
        notifType = "warning";
      } else if (daysLeft <= 7) {
        urgencyEmoji = "⏰";
        notifType = "warning";
      }

      const timeLabel = daysLeft < 0
        ? `atrasado por ${Math.abs(daysLeft)} dia(s)`
        : daysLeft === 0
          ? "vence HOJE"
          : `vence em ${daysLeft} dia(s)`;

      // Notify client
      if (pub.client_id) {
        notifications.push({
          user_id: pub.client_id,
          title: `${urgencyEmoji} Prazo: ${brandName}`,
          message: `O prazo do processo "${brandName}" (${processNumber}) ${timeLabel}. Status: ${statusLabel}. Prazo: ${deadlineStr}.`,
          type: notifType,
          link: "/cliente/processos",
        });
      }

      // Notify responsible admin or all admins
      const targetAdmins = pub.admin_id ? [pub.admin_id] : adminIds;
      for (const adminId of targetAdmins) {
        notifications.push({
          user_id: adminId,
          title: `${urgencyEmoji} Prazo ${timeLabel}: ${brandName}`,
          message: `Publicação "${brandName}" (${processNumber}) - ${statusLabel}. ${pub.descricao_prazo || ""}. Prazo: ${deadlineStr}.`,
          type: notifType,
          link: "/admin/publicacao",
        });
      }

      if (notifications.length > 0) {
        const { error: insertErr } = await supabase.from("notifications").insert(notifications);
        if (insertErr) {
          console.error(`Failed to insert notifications for pub ${pub.id}:`, insertErr.message);
          continue;
        }

        // Update last_notification_sent_at for dedup
        await supabase
          .from("publicacoes_marcas")
          .update({ last_notification_sent_at: now.toISOString() })
          .eq("id", pub.id);

        notified++;
      }

      // Also try to send email via Resend for urgent deadlines (≤7 days)
      if (daysLeft <= 7 && pub.client_id) {
        try {
          const { data: clientProfile } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("id", pub.client_id)
            .single();

          if (clientProfile?.email) {
            const resendKey = Deno.env.get("RESEND_API_KEY");
            if (resendKey) {
              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${resendKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: "Webmarcas <noreply@webmarcas.net>",
                  to: clientProfile.email,
                  subject: `${urgencyEmoji} Prazo importante: ${brandName} ${timeLabel}`,
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <h2 style="color: ${daysLeft < 0 ? '#dc2626' : daysLeft <= 3 ? '#d97706' : '#2563eb'};">
                        ${urgencyEmoji} Alerta de Prazo - ${brandName}
                      </h2>
                      <p>Olá ${clientProfile.full_name || ""},</p>
                      <p>O prazo do seu processo de marca <strong>${brandName}</strong> ${processNumber ? `(${processNumber})` : ""} <strong>${timeLabel}</strong>.</p>
                      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                        <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Status</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${statusLabel}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Prazo</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${deadlineStr}</td></tr>
                        ${pub.descricao_prazo ? `<tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Descrição</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${pub.descricao_prazo}</td></tr>` : ""}
                      </table>
                      <p>Entre em contato conosco caso precise de orientação.</p>
                      <p style="color: #6b7280; font-size: 12px;">— Equipe Webmarcas</p>
                    </div>
                  `,
                }),
              });
            }
          }
        } catch (emailErr) {
          console.error(`Email send failed for pub ${pub.id}:`, emailErr);
        }
      }
    }

    console.log(`Deadline check complete: ${notified} notified, ${skipped} skipped, ${autoArchived} auto-archived`);

    return new Response(
      JSON.stringify({ success: true, notified, skipped, autoArchived, total: (pubs || []).length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in check-publicacao-deadlines:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
