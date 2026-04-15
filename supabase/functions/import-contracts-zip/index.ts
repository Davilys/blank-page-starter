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

    const { contracts } = await req.json();
    if (!Array.isArray(contracts) || contracts.length === 0) {
      return new Response(JSON.stringify({ error: "No contracts provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const c of contracts) {
      try {
        let userId: string | null = null;

        // Resolve user_id by email
        if (c.client_email) {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("email", c.client_email)
            .maybeSingle();
          if (profile) userId = profile.id;
        }

        const { data: contract, error: insertErr } = await supabaseAdmin
          .from("contracts")
          .insert({
            contract_number: c.contract_number,
            subject: c.subject,
            contract_value: c.contract_value,
            start_date: c.start_date,
            end_date: c.end_date,
            signature_status: c.signature_status || "not_signed",
            signed_at: c.signed_at,
            contract_html: c.contract_html,
            description: c.description,
            payment_method: c.payment_method,
            document_type: c.document_type,
            user_id: userId,
            created_at: c.created_at || new Date().toISOString(),
          })
          .select("id")
          .single();

        if (insertErr || !contract) {
          errors.push(`Contrato ${c.contract_number || '?'}: ${insertErr?.message || 'insert failed'}`);
          failed++;
          continue;
        }

        // Create associated PDF documents
        if (Array.isArray(c.pdf_files) && c.pdf_files.length > 0) {
          for (const pdf of c.pdf_files) {
            await supabaseAdmin.from("documents").insert({
              name: pdf.name || "Documento do Contrato",
              file_url: pdf.file_url,
              document_type: "contrato",
              user_id: userId,
              contract_id: contract.id,
            });
          }
        }

        imported++;
      } catch (err: any) {
        errors.push(`Contrato ${c.contract_number || '?'}: ${err.message}`);
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
