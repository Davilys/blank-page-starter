import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildFollowupEmail, buildFollowupWhatsApp, documentName } from "../_shared/signatureFollowups.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SIGNATURE_WEBHOOK = "https://new-backend.botconversa.com.br/api/v1/webhooks-automation/catch/9093/dtJVsg4sy39l/";
const BASE_URL = "https://webmarcas.net";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, key);
  const now = new Date().toISOString();
  const summary = { sent: 0, skipped: 0, expired: 0, errors: 0 };

  try {
    // 1. Links vencidos sem assinatura → marcados como expirados (sem tocar em cobranças)
    const { data: exp } = await db.from("contracts")
      .update({ signature_status: "expired" })
      .eq("signature_status", "pending").not("signature_token", "is", null).lt("signature_expires_at", now)
      .select("id");
    summary.expired = exp?.length || 0;
    if (exp?.length) {
      await db.from("signature_followups").update({ status: "skipped" })
        .in("contract_id", exp.map((c) => c.id)).eq("status", "pending");
    }

    // 2. Lembretes vencidos
    const { data: due } = await db.from("signature_followups")
      .select("id, contract_id, step, token").eq("status", "pending").lte("scheduled_at", now)
      .order("scheduled_at").limit(25);

    for (const f of due || []) {
      // trava o item (evita envio duplo se duas execuções coincidirem)
      const { data: lock } = await db.from("signature_followups").update({ status: "sending" })
        .eq("id", f.id).eq("status", "pending").select("id");
      if (!lock?.length) continue;

      const { data: c } = await db.from("contracts")
        .select("id, subject, document_type, contract_value, signature_status, signature_token, signature_expires_at, signatory_name, user_id, profiles:user_id(full_name,email,phone)")
        .eq("id", f.contract_id).maybeSingle();

      const valid = c && c.signature_status === "pending" && c.signature_token === f.token &&
        c.signature_expires_at && c.signature_expires_at > now;
      if (!valid) {
        await db.from("signature_followups").update({ status: "skipped" }).eq("id", f.id);
        summary.skipped++;
        continue;
      }

      const p: any = (c as any).profiles || {};
      const isProc = c.document_type === "procuracao";
      const data = {
        nome: c.signatory_name || p.full_name || "Cliente",
        documento: documentName(c.document_type),
        marca: c.subject || "",
        link: `${BASE_URL}/assinar/${c.signature_token}`,
        valor: !isProc && Number(c.contract_value) > 0 ? fmtBRL(Number(c.contract_value)) : null,
      };
      const step = f.step as 1 | 2 | 3;
      const results: Record<string, unknown> = {};

      if (p.email) {
        const { subject, html } = buildFollowupEmail(step, data);
        const r = await fetch(`${url}/functions/v1/send-email`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ to: [p.email], subject, body: subject, html }),
        });
        results.email = { success: r.ok, ...(r.ok ? {} : { error: (await r.text()).slice(0, 300) }) };
        if (r.ok) await r.body?.cancel();
      } else results.email = { success: false, error: "sem e-mail" };

      if (p.phone) {
        const r = await fetch(`${url}/functions/v1/send-multichannel-notification`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            event_type: "manual", channels: ["whatsapp"],
            recipient: { nome: data.nome, phone: p.phone, email: p.email, user_id: c.user_id },
            custom_message: buildFollowupWhatsApp(step, data),
            data: { link: data.link, marca: data.marca },
            whatsapp_webhook_override: SIGNATURE_WEBHOOK,
          }),
        });
        const j = await r.json().catch(() => ({}));
        results.whatsapp = j?.results?.whatsapp ?? { success: false, error: `HTTP ${r.status}` };
      } else results.whatsapp = { success: false, error: "sem telefone" };

      const anyOk = Object.values(results).some((x: any) => x?.success);
      await db.from("signature_followups").update({
        status: anyOk ? "sent" : "failed", sent_at: new Date().toISOString(), results,
      }).eq("id", f.id);
      await db.from("signature_audit_log").insert({
        contract_id: c.id, event_type: `signature_followup_${step}`, event_data: results,
      });
      anyOk ? summary.sent++ : summary.errors++;
    }

    return new Response(JSON.stringify({ success: true, ...summary }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("signature-followups error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
