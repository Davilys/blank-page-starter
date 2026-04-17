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

    const { contracts } = await req.json();
    if (!Array.isArray(contracts) || contracts.length === 0) {
      return new Response(JSON.stringify({ error: "No contracts provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let imported = 0;
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const c of contracts) {
      try {
        let userId: string | null = null;
        let processId: string | null = null;
        let contractTypeId: string | null = null;
        let templateId: string | null = null;

        // Resolve user by email
        if (c.client_email) {
          const { data: profile } = await supabaseAdmin
            .from("profiles").select("id").eq("email", c.client_email).maybeSingle();
          if (profile) userId = profile.id;
        }

        // Resolve process by brand_name + user
        if (c.brand_name && userId) {
          const { data: process } = await supabaseAdmin
            .from("brand_processes").select("id")
            .eq("brand_name", c.brand_name).eq("user_id", userId).maybeSingle();
          if (process) processId = process.id;
        }

        // Resolve contract type
        if (c.contract_type_name) {
          const { data: ct } = await supabaseAdmin
            .from("contract_types").select("id").eq("name", c.contract_type_name).maybeSingle();
          if (ct) contractTypeId = ct.id;
        }

        // Resolve template
        if (c.template_name) {
          const { data: tpl } = await supabaseAdmin
            .from("contract_templates").select("id").eq("name", c.template_name).maybeSingle();
          if (tpl) templateId = tpl.id;
        }

        // Detect existing contract by contract_number (upsert behavior)
        let existingId: string | null = null;
        if (c.contract_number) {
          const { data: existing } = await supabaseAdmin
            .from("contracts").select("id").eq("contract_number", c.contract_number).maybeSingle();
          if (existing) existingId = existing.id;
        }

        const data: any = {
          contract_number: c.contract_number,
          subject: c.subject,
          contract_value: c.contract_value,
          start_date: c.start_date,
          end_date: c.end_date,
          contract_html: c.contract_html,
          description: c.description,
          payment_method: c.payment_method,
          document_type: c.document_type,
          contract_type: typeof c.contract_type === 'string' ? c.contract_type : null,
          contract_type_id: contractTypeId,
          template_id: templateId,
          user_id: userId,
          process_id: processId,
          // Signature & forensic
          signature_status: c.signature_status || "not_signed",
          signed_at: c.signed_at,
          signature_token: c.signature_token,
          signature_expires_at: c.signature_expires_at,
          signature_ip: c.signature_ip,
          signature_user_agent: c.signature_user_agent,
          ip_address: c.ip_address,
          user_agent: c.user_agent,
          device_info: c.device_info,
          client_signature_image: c.client_signature_image,
          contractor_signature_image: c.contractor_signature_image,
          signatory_name: c.signatory_name,
          signatory_cpf: c.signatory_cpf,
          signatory_cnpj: c.signatory_cnpj,
          // Blockchain
          blockchain_hash: c.blockchain_hash,
          blockchain_timestamp: c.blockchain_timestamp,
          blockchain_tx_id: c.blockchain_tx_id,
          blockchain_network: c.blockchain_network,
          blockchain_proof: c.blockchain_proof,
          ots_file_url: c.ots_file_url,
          // Other
          asaas_payment_id: c.asaas_payment_id,
          penalty_value: c.penalty_value,
          custom_due_date: c.custom_due_date,
          suggested_classes: c.suggested_classes,
          visible_to_client: c.visible_to_client !== undefined ? c.visible_to_client : true,
        };

        // Strip undefined
        Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

        let contractId: string;
        let wasUpdate = false;

        if (existingId) {
          // UPDATE existing contract
          const { error: updErr } = await supabaseAdmin
            .from("contracts").update(data).eq("id", existingId);
          if (updErr) {
            errors.push(`Contrato ${c.contract_number || '?'} (update): ${updErr.message}`);
            failed++;
            continue;
          }
          contractId = existingId;
          wasUpdate = true;

          // Remove old attached PDFs (will be replaced)
          await supabaseAdmin.from("documents").delete().eq("contract_id", existingId);
        } else {
          // INSERT new contract
          const insertData = { ...data, created_at: c.created_at || new Date().toISOString() };
          const { data: contract, error: insertErr } = await supabaseAdmin
            .from("contracts").insert(insertData).select("id").single();

          if (insertErr || !contract) {
            errors.push(`Contrato ${c.contract_number || '?'}: ${insertErr?.message || 'insert failed'}`);
            failed++;
            continue;
          }
          contractId = contract.id;
        }

        // Insert associated PDF documents
        if (Array.isArray(c.pdf_files) && c.pdf_files.length > 0) {
          for (const pdf of c.pdf_files) {
            await supabaseAdmin.from("documents").insert({
              name: pdf.name || "Documento do Contrato",
              file_url: pdf.file_url,
              document_type: "contrato",
              mime_type: pdf.mime_type || 'application/pdf',
              user_id: userId,
              contract_id: contractId,
              uploaded_by: 'system',
            });
          }
        }

        if (wasUpdate) updated++;
        else imported++;
      } catch (err: any) {
        errors.push(`Contrato ${c.contract_number || '?'}: ${err.message}`);
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
