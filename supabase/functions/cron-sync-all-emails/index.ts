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

  return new Response(JSON.stringify({ success: true, count: targets.length, results }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
