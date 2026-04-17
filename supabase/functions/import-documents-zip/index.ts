import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { documents } = await req.json();
    if (!Array.isArray(documents) || documents.length === 0) {
      return new Response(JSON.stringify({ error: "No documents provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let imported = 0;
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const doc of documents) {
      try {
        let userId: string | null = null;
        let processId: string | null = null;
        let contractId: string | null = null;

        if (doc.client_email) {
          const { data: profile } = await supabaseAdmin
            .from("profiles").select("id").eq("email", doc.client_email).maybeSingle();
          if (profile) userId = profile.id;
        }

        if (doc.brand_name && userId) {
          const { data: process } = await supabaseAdmin
            .from("brand_processes").select("id")
            .eq("brand_name", doc.brand_name).eq("user_id", userId).maybeSingle();
          if (process) processId = process.id;
        }

        if (doc.contract_number) {
          const { data: contract } = await supabaseAdmin
            .from("contracts").select("id")
            .eq("contract_number", doc.contract_number).maybeSingle();
          if (contract) contractId = contract.id;
        }

        // Upsert: find existing document by (user_id + name + document_type) or by protocol
        let existingId: string | null = null;
        let oldFileUrl: string | null = null;

        if (doc.protocol) {
          const { data: existing } = await supabaseAdmin
            .from("documents").select("id, file_url")
            .eq("protocol", doc.protocol).maybeSingle();
          if (existing) { existingId = existing.id; oldFileUrl = existing.file_url; }
        }

        if (!existingId && userId) {
          const { data: existing } = await supabaseAdmin
            .from("documents").select("id, file_url")
            .eq("user_id", userId)
            .eq("name", doc.name)
            .eq("document_type", doc.document_type || "outro")
            .maybeSingle();
          if (existing) { existingId = existing.id; oldFileUrl = existing.file_url; }
        }

        const baseData: any = {
          name: doc.name,
          file_url: doc.file_url,
          document_type: doc.document_type || "outro",
          mime_type: doc.mime_type,
          file_size: doc.file_size,
          protocol: doc.protocol,
          user_id: userId,
          process_id: processId,
          contract_id: contractId,
        };

        if (existingId) {
          const { error: updErr } = await supabaseAdmin
            .from("documents").update(baseData).eq("id", existingId);
          if (updErr) {
            errors.push(`${doc.name} (update): ${updErr.message}`);
            failed++;
          } else {
            updated++;
            // Best-effort delete of old file in storage
            if (oldFileUrl) {
              const marker = '/storage/v1/object/public/documents/';
              const idx = oldFileUrl.indexOf(marker);
              if (idx !== -1) {
                const oldPath = decodeURIComponent(oldFileUrl.substring(idx + marker.length));
                await supabaseAdmin.storage.from('documents').remove([oldPath]).catch(() => {});
              }
            }
          }
        } else {
          const { error: insertErr } = await supabaseAdmin.from("documents").insert({
            ...baseData,
            created_at: doc.created_at || new Date().toISOString(),
            uploaded_by: 'system',
          });

          if (insertErr) {
            errors.push(`${doc.name}: ${insertErr.message}`);
            failed++;
          } else {
            imported++;
          }
        }
      } catch (err: any) {
        errors.push(`${doc.name}: ${err.message}`);
        failed++;
      }
    }

    return new Response(JSON.stringify({ imported, updated, failed, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
