import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: accounts, error } = await supabase
    .from("email_accounts")
    .select("id, email_address, imap_host");
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }

  const targets = (accounts || []).filter(a => a.imap_host);
  const results: any[] = [];

  // Fire syncs in parallel (each independent IMAP connection)
  await Promise.all(targets.map(async (acc) => {
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/sync-imap-inbox`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ account_id: acc.id }),
      });
      const j = await r.json().catch(() => ({}));
      results.push({ account: acc.email_address, ok: r.ok, summary: j?.results?.[0]?.folders });
    } catch (e: any) {
      results.push({ account: acc.email_address, ok: false, error: e?.message });
    }
  }));

  // Alert: 3+ consecutive failures recorded by sync-imap-inbox
  try {
    const { data: bad } = await supabase
      .from("email_sync_state")
      .select("account_id, last_error, consecutive_errors")
      .eq("folder", "_account")
      .gte("consecutive_errors", 3);
    if (bad && bad.length) {
      const { data: admins } = await supabase
        .from("user_roles").select("user_id").eq("role", "admin");
      const adminIds = (admins || []).map(a => a.user_id);
      for (const row of bad) {
        const acc = (accounts || []).find(a => a.id === row.account_id);
        const title = "Falha na sincronização de e-mail";
        const message = `Conta ${acc?.email_address || row.account_id} falhou ${row.consecutive_errors}x seguidas: ${row.last_error || "erro desconhecido"}`;
        // De-dupe: only insert one notification per account per 6h
        const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
        const { data: recent } = await supabase
          .from("notifications").select("id")
          .eq("title", title)
          .ilike("message", `%${acc?.email_address || row.account_id}%`)
          .gte("created_at", since).limit(1).maybeSingle();
        if (recent) continue;
        for (const uid of adminIds) {
          await supabase.from("notifications").insert({
            user_id: uid, title, message, type: "alert",
          });
        }
      }
    }
  } catch (e) {
    console.error("alerting failed:", e);
  }

  return new Response(JSON.stringify({ success: true, count: targets.length, results }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
