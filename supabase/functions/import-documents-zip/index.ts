import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { documents } = await req.json();
    if (!Array.isArray(documents) || documents.length === 0) {
      return new Response(JSON.stringify({ error: "No documents provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const doc of documents) {
      try {
        let userId: string | null = null;
        let processId: string | null = null;

        // Resolve user_id by email
        if (doc.client_email) {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("email", doc.client_email)
            .maybeSingle();
          if (profile) userId = profile.id;
        }

        // Resolve process_id by brand_name
        if (doc.brand_name && userId) {
          const { data: process } = await supabaseAdmin
            .from("brand_processes")
            .select("id")
            .eq("brand_name", doc.brand_name)
            .eq("user_id", userId)
            .maybeSingle();
          if (process) processId = process.id;
        }

        const { error: insertErr } = await supabaseAdmin.from("documents").insert({
          name: doc.name,
          file_url: doc.file_url,
          document_type: doc.document_type || "outro",
          mime_type: doc.mime_type,
          file_size: doc.file_size,
          protocol: doc.protocol,
          created_at: doc.created_at || new Date().toISOString(),
          user_id: userId,
          process_id: processId,
        });

        if (insertErr) {
          errors.push(`${doc.name}: ${insertErr.message}`);
          failed++;
        } else {
          imported++;
        }
      } catch (err: any) {
        errors.push(`${doc.name}: ${err.message}`);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ imported, failed, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
