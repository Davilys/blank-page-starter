import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") || "";
const ASAAS_ENV = (Deno.env.get("ASAAS_ENV") || "production").toLowerCase();
const ASAAS_BASE = ASAAS_ENV === "sandbox"
  ? "https://api-sandbox.asaas.com/v3"
  : "https://api.asaas.com/v3";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Dá baixa em dinheiro (recebimento externo) no Asaas. */
async function receiveInCash(paymentId: string, value: number, date: string) {
  if (!ASAAS_API_KEY) return { ok: false, error: "ASAAS_API_KEY não configurada" };
  const res = await fetch(`${ASAAS_BASE}/payments/${paymentId}/receiveInCash`, {
    method: "POST",
    headers: { access_token: ASAAS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ paymentDate: date, value, notifyCustomer: false }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Asaas ${res.status} receiveInCash ${paymentId}: ${text.slice(0, 400)}`);
    return { ok: false, error: `Asaas ${res.status}: ${text.slice(0, 300)}` };
  }
  return { ok: true, data: text ? JSON.parse(text) : null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const historico_id: string | null = body.historico_id ?? null;
    const invoice_id: string | null = body.invoice_id ?? null;
    const parcela_id: string | null = body.parcela_id ?? null;
    const parcela_tipo: "devedor" | "renegociada" | null = body.parcela_tipo ?? null;
    const observacao: string = typeof body.observacao === "string" ? body.observacao.slice(0, 500) : "";
    const valorInput = Number(body.valor);
    const pagamentoEm: string = typeof body.pago_em === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.pago_em)
      ? body.pago_em
      : new Date().toISOString().slice(0, 10);

    if (!historico_id && !invoice_id && !parcela_id) {
      return json({ error: "Informe historico_id, invoice_id ou parcela_id" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    let targetInvoiceId = invoice_id;
    if (!targetInvoiceId && historico_id) {
      const { data: h } = await admin
        .from("cobranca_historico")
        .select("invoice_id")
        .eq("id", historico_id)
        .maybeSingle();
      targetInvoiceId = (h as any)?.invoice_id ?? null;
    }

    let asaasPaymentId: string | null = null;
    let valor = Number.isFinite(valorInput) && valorInput > 0 ? valorInput : 0;

    if (targetInvoiceId) {
      const { data: inv } = await admin
        .from("invoices")
        .select("id, amount, asaas_invoice_id")
        .eq("id", targetInvoiceId)
        .maybeSingle();
      if (inv) {
        asaasPaymentId = (inv as any).asaas_invoice_id ?? null;
        if (!valor) valor = Number((inv as any).amount || 0);
      }
    }

    if (parcela_id && parcela_tipo) {
      const table = parcela_tipo === "devedor" ? "parcelas_devedor" : "parcelas_renegociadas";
      const { data: p } = await admin
        .from(table)
        .select("id, valor, asaas_payment_id")
        .eq("id", parcela_id)
        .maybeSingle();
      if (p) {
        asaasPaymentId = asaasPaymentId || ((p as any).asaas_payment_id ?? null);
        if (!valor) valor = Number((p as any).valor || 0);
      }
    }

    let asaasResult: { ok: boolean; error?: string } = { ok: false, error: "Sem vínculo com o Asaas" };
    if (asaasPaymentId) {
      asaasResult = await receiveInCash(asaasPaymentId, valor, pagamentoEm);
    }

    const nowIso = new Date().toISOString();

    if (targetInvoiceId) {
      await admin.from("invoices").update({
        status: "paid",
        payment_date: pagamentoEm,
        payment_method: "manual_pix",
      }).eq("id", targetInvoiceId);
    }

    const histUpdate = {
      status: "confirmada_paga",
      situacao: "recebida",
      pago_em: nowIso,
      pago_manual: true,
      pago_obs: observacao || null,
      updated_at: nowIso,
    };
    if (historico_id) {
      await admin.from("cobranca_historico").update(histUpdate).eq("id", historico_id);
    } else if (targetInvoiceId) {
      await admin.from("cobranca_historico").update(histUpdate).eq("invoice_id", targetInvoiceId);
    }

    if (parcela_id && parcela_tipo) {
      const table = parcela_tipo === "devedor" ? "parcelas_devedor" : "parcelas_renegociadas";
      await admin.from(table).update({ status: "paga", pago_em: pagamentoEm }).eq("id", parcela_id);
    }

    return json({
      success: true,
      asaas: asaasResult.ok ? "baixa_em_dinheiro_registrada" : `nao_registrado: ${asaasResult.error}`,
      invoice_id: targetInvoiceId,
      valor,
      pago_em: pagamentoEm,
    });
  } catch (e) {
    console.error("confirmar-pagamento-manual error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
