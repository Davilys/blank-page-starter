import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { reguaAuthorized } from "../_shared/reguaAuth.ts";
import { businessHourBRT, regraAcordo, primeiraParcelaAuto } from "../_shared/reguaElegibilidade.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") || "";
const ASAAS_BASE = (Deno.env.get("ASAAS_ENV") || "production").toLowerCase() === "sandbox"
  ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const PAGO = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "REFUNDED", "REFUND_REQUESTED", "CHARGEBACK_REQUESTED"];

async function chamar(fn: string, body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": CRON_SECRET, apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!reguaAuthorized(req)) return json({ error: "Não autorizado" }, 401);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: cfgRow } = await admin.from("system_settings").select("value").eq("key", "regua_cobranca").maybeSingle();
  const cfg: any = cfgRow?.value || {};
  if (cfg.dry_run !== false) return json({ skipped: true, reason: "dry_run" });
  if (!businessHourBRT()) return json({ skipped: true, reason: "fora do horário comercial" });

  const { data: claimed, error: cErr } = await admin.rpc("claim_cobranca_fila");
  if (cErr) return json({ error: cErr.message }, 500);
  const item = Array.isArray(claimed) ? claimed[0] : claimed;
  if (!item) return json({ idle: true });

  const fechar = async (status: string, extra: Record<string, unknown> = {}) => {
    await admin.from("cobranca_fila").update({ status, processado_em: new Date().toISOString(), ...extra }).eq("id", item.id);
    return json({ id: item.id, tipo: item.tipo, status, ...extra });
  };
  const cancelar = (motivo: string) => fechar("cancelado", { resultado: { motivo } });

  try {
    const flagOn = item.tipo === "acordo_auto" ? cfg.acordo_auto_ativo === true : cfg.lembretes_ativo === true;
    if (!flagOn) return cancelar("flag desligada");

    const { data: inv } = await admin.from("invoices")
      .select("id, amount, description, status, due_date, asaas_invoice_id, acordo_id, sync_status").eq("id", item.invoice_id).maybeSingle();
    if (!inv) return cancelar("fatura inexistente");
    const { data: cls } = await admin.rpc("classificar_situacao_cobranca", { p_status: inv.status, p_due_date: inv.due_date, p_sync_status: inv.sync_status });
    if (cls !== "vencidas") return cancelar(`situacao ${cls ?? "fora"}`);
    const { data: ativo } = await admin.from("acordos_cliente").select("id").eq("invoice_original_id", inv.id)
      .in("status", ["processando", "ativo", "falha_pendente"]).limit(1);
    if (ativo && ativo.length) return cancelar("acordo ativo");

    // Reconferência real no Asaas: nunca cobrar nem criar acordo de fatura paga.
    if (inv.asaas_invoice_id && ASAAS_API_KEY) {
      const r = await fetch(`${ASAAS_BASE}/payments/${inv.asaas_invoice_id}`, { headers: { access_token: ASAAS_API_KEY } });
      if (!r.ok) throw new Error(`Asaas ${r.status} ao reconferir`);
      const p = await r.json();
      if (p?.deleted || PAGO.includes(String(p?.status || "").toUpperCase())) return cancelar(`asaas ${p?.deleted ? "removida" : p.status}`);
    } else if (item.tipo === "acordo_auto") {
      return cancelar("sem vínculo Asaas");
    }

    if (item.tipo === "acordo_auto") {
      if (inv.acordo_id) return cancelar("já é parcela de acordo");
      const regra = regraAcordo(Number(inv.amount), inv.description);
      if (!regra) return cancelar("fora das regras de acordo automático");
      const criar = await chamar("criar-acordo-cliente", {
        action: "criar", invoice_id: inv.id, crm_action_id: `regua-auto:${inv.id}`,
        num_parcelas: regra.numParcelas, juros_percentual: regra.jurosPct,
        primeira_parcela_data: primeiraParcelaAuto(),
        preview_total_centavos: Math.round(regra.total * 100),
      });
      const acordoId = criar.data?.acordo_id;
      if (!criar.ok || criar.data?.error || !acordoId) throw new Error(`criar acordo: ${String(criar.data?.error || criar.status).slice(0, 200)}`);
      const env = await chamar("criar-acordo-cliente", { action: "enviar-acordo", acordo_id: acordoId });
      if (!env.ok || env.data?.error) {
        // Acordo já existe: não repetir a criação; marca para revisão humana.
        return fechar("erro", { erro: `acordo ${acordoId} criado, envio falhou: ${String(env.data?.error || env.status).slice(0, 150)}`, resultado: { acordo_id: acordoId } });
      }
      return fechar("enviado", { resultado: { acordo_id: acordoId } });
    }

    const l = await chamar("lembrar-fatura-vencendo", { invoice_id: inv.id, tipo: item.tipo, origin: "regua" });
    if (!l.ok) throw new Error(`lembrete: ${String(l.data?.error || l.status).slice(0, 200)}`);
    if (l.data?.skipped) return fechar("cancelado", { resultado: { motivo: String(l.data.reason || "skipped") } });
    return fechar("enviado", { resultado: { canais: l.data?.channels ?? null } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (item.tipo !== "acordo_auto" && item.tentativas < 3) {
      await admin.from("cobranca_fila").update({ status: "pendente", erro: msg.slice(0, 300), agendado_para: new Date(Date.now() + 15 * 60_000).toISOString() }).eq("id", item.id);
      return json({ id: item.id, retry: true });
    }
    return fechar("erro", { erro: msg.slice(0, 300) });
  }
});
