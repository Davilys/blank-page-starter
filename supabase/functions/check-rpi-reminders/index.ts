import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find entries linked to clients, not resolved, and due for reminder (5+ days since last)
    const { data: entries, error } = await supabase
      .from("rpi_entries")
      .select("id, process_number, brand_name, matched_client_id, tag, last_reminder_sent_at, linked_at")
      .not("matched_client_id", "is", null)
      .not("tag", "in", '("resolvido","arquivado","prazo_encerrado")');

    if (error) throw error;

    const now = new Date();
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
    let sent = 0;

    for (const entry of entries || []) {
      const lastReminder = entry.last_reminder_sent_at ? new Date(entry.last_reminder_sent_at) : null;
      const linkedAt = entry.linked_at ? new Date(entry.linked_at) : null;
      const referenceDate = lastReminder || linkedAt;

      // Skip if linked less than 5 days ago and never reminded
      if (!referenceDate || (now.getTime() - referenceDate.getTime()) < fiveDaysMs) {
        continue;
      }

      // Get client info
      const { data: client } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", entry.matched_client_id)
        .single();

      const brandLabel = entry.brand_name || entry.process_number || "Processo";
      const clientName = client?.full_name || client?.email || "Cliente";

      // Notification for client
      await supabase.from("notifications").insert({
        user_id: entry.matched_client_id,
        title: "⏰ Lembrete: Publicação INPI pendente",
        message: `A publicação do processo ${brandLabel} (${entry.process_number}) ainda aguarda regularização. Prazo em andamento.`,
        type: "warning",
        link: "/cliente/processos",
      });

      // Notification for all admins
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      for (const admin of admins || []) {
        await supabase.from("notifications").insert({
          user_id: admin.user_id,
          title: "⏰ Lembrete RPI pendente",
          message: `Publicação RPI do processo ${brandLabel} (${entry.process_number}) vinculada ao cliente ${clientName} ainda não foi resolvida.`,
          type: "warning",
          link: "/admin/revista-inpi",
        });
      }

      // Update last_reminder_sent_at
      await supabase
        .from("rpi_entries")
        .update({ last_reminder_sent_at: now.toISOString() })
        .eq("id", entry.id);

      sent++;
    }

    console.log(`RPI reminders sent: ${sent}`);

    return new Response(JSON.stringify({ success: true, reminders_sent: sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in check-rpi-reminders:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
