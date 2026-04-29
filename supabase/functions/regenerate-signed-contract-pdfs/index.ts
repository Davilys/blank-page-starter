import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Backfill helper: lists signed contracts (optionally only distratos) that
 * don't have an associated PDF document yet. The actual PDF generation is
 * performed CLIENT-SIDE (html2canvas needs a browser DOM), so this endpoint
 * just returns the list for the admin UI to iterate through and re-trigger
 * `upload-signed-contract-pdf` for each one.
 *
 * Modes:
 *  - GET / POST without body: returns list of pending contracts
 *  - POST { contractId }: returns the full contract data needed to rebuild
 *    the signed HTML on the client.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let body: any = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { body = {}; }
    }

    if (body.contractId) {
      const { data: contract, error } = await supabase
        .from("contracts")
        .select("id, user_id, process_id, subject, document_type, contract_html, signatory_name, signatory_cpf, blockchain_hash, blockchain_timestamp, blockchain_tx_id, blockchain_network, signature_ip")
        .eq("id", body.contractId)
        .single();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ contract }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List signed contracts without an attached PDF document
    const onlyDistratos = body.onlyDistratos !== false;

    let query = supabase
      .from("contracts")
      .select("id, contract_number, subject, document_type, signed_at, user_id, process_id")
      .eq("signature_status", "signed")
      .order("signed_at", { ascending: false })
      .limit(500);

    if (onlyDistratos) {
      query = query.in("document_type", ["distrato_multa", "distrato_sem_multa"]);
    }

    const { data: contracts, error } = await query;
    if (error) throw error;

    // Filter out ones that already have a document
    const pending: any[] = [];
    for (const c of contracts || []) {
      const { data: docs } = await supabase
        .from("documents")
        .select("id")
        .eq("contract_id", c.id)
        .in("document_type", ["contrato", "distrato_multa", "distrato_sem_multa", "procuracao"])
        .limit(1);
      if (!docs || docs.length === 0) pending.push(c);
    }

    return new Response(JSON.stringify({ pending, total: pending.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("regenerate-signed-contract-pdfs error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
