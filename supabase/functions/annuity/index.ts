import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildAnnuityEmail, calcAnnuityDueDate, campaignStartDate, nowSaoPaulo, mergeSettings, validateSettings, periodLabel, boletoDescription, DEFAULT_SETTINGS, type AnnuitySettings } from "./rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") || "";
const ASAAS_BASE = (Deno.env.get("ASAAS_ENV") || "production").toLowerCase() === "sandbox"
  ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const fromOf = (s: AnnuitySettings) => `${s.sender_name} <noreply@webmarcas.net>`;

async function defaultSettings(): Promise<AnnuitySettings> {
  const { data } = await admin.from("annuity_settings").select("data").eq("id", 1).maybeSingle();
  return mergeSettings(data?.data);
}
/** Configuração efetiva da campanha: cópia salva + colunas operacionais. */
const campSettings = (c: any): AnnuitySettings => mergeSettings(c?.settings, {
  amount_cents: c?.amount_cents, daily_hour: c?.daily_hour, daily_limit: c?.daily_limit,
});
const PAGE = 400;
const BUDGET_MS = 100_000;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const digits = (s?: string | null) => (s || "").replace(/\D/g, "");
const validEmail = (e?: string | null) => !!e && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
const PAID = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "PAID", "PAGO", "RECEBIDO"];
const DEAD = ["CANCELLED", "CANCELED", "DELETED", "CANCELADO", "REFUNDED"];

class AsaasError extends Error { status: number; body: any; uncertain: boolean;
  constructor(m: string, status: number, body: any, uncertain: boolean) { super(m); this.status = status; this.body = body; this.uncertain = uncertain; } }

async function asaas(path: string, init: RequestInit = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  let res: Response;
  try {
    res = await fetch(`${ASAAS_BASE}${path}`, { ...init, signal: ctrl.signal,
      headers: { access_token: ASAAS_API_KEY, "Content-Type": "application/json", ...(init.headers || {}) } });
  } catch (e) {
    throw new AsaasError(`Sem resposta do Asaas (${(e as Error).name})`, 0, null, true);
  } finally { clearTimeout(t); }
  const text = await res.text();
  let body: any = null; try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 300) }; }
  if (!res.ok) {
    const msg = body?.errors?.[0]?.description || `Asaas ${res.status}`;
    throw new AsaasError(msg, res.status, body, res.status >= 500 || res.status === 429);
  }
  return body;
}

async function logEvent(campaign_id: string | null, item_id: string | null, actor: string | null, action: string, detail: any = {}) {
  await admin.from("annuity_events").insert({ campaign_id, item_id, actor, action, detail });
}

async function notify(userId: string | null, title: string, message: string) {
  if (!userId) return;
  await admin.from("notifications").insert({ user_id: userId, title, message, type: "warning", link: "/admin/financeiro/anuidade" });
}

async function signedDistrato(clientId: string): Promise<boolean> {
  const { data } = await admin.from("contracts").select("id").eq("user_id", clientId)
    .ilike("document_type", "distrato%").eq("signature_status", "signed").limit(1);
  return !!data?.length;
}

// ─────────────────────────── VARREDURA ───────────────────────────
async function scanStep(c: any): Promise<boolean> {
  const from = c.scan_cursor;
  const { data: claimed } = await admin.from("annuity_campaigns")
    .update({ scan_cursor: from + PAGE }).eq("id", c.id).eq("scan_cursor", from).eq("scan_done", false).select("id");
  if (!claimed?.length) return false; // outro worker pegou esta página

  const { data: profs, error } = await admin.from("profiles")
    .select("id, full_name, email, cpf_cnpj, cpf, cnpj").order("created_at", { ascending: true }).order("id")
    .range(from, from + PAGE - 1);
  if (error) { await admin.from("annuity_campaigns").update({ scan_cursor: from }).eq("id", c.id); throw error; }
  const list = profs || [];
  const ids = list.map((p) => p.id);
  const stats = { ...(c.scan_stats || {}) };
  const cfg = campSettings(c);
  if (ids.length) {
    const [{ data: roles }, { data: contr }, { data: anuContr }, { data: procs }] = await Promise.all([
      admin.from("user_roles").select("user_id").in("user_id", ids),
      admin.from("contracts").select("id, user_id, document_type, signature_status, signed_at").in("user_id", ids),
      admin.from("contracts").select("id, user_id").in("user_id", ids).eq("document_type", "contract")
        .eq("signature_status", "signed").ilike("contract_html", `%${cfg.clause_keyword}%`),
      admin.from("brand_processes").select("user_id, brand_name, pipeline_stage").in("user_id", ids),
    ]);
    const staff = new Set((roles || []).map((r) => r.user_id));
    const rows: any[] = [];
    const docs = list.map((p) => digits(p.cpf_cnpj || p.cnpj || p.cpf)).filter((d) => d.length >= 11);
    const { data: dupRows } = docs.length
      ? await admin.from("annuity_items").select("doc_digits, client_name").eq("exercicio", c.exercicio).in("doc_digits", docs)
      : { data: [] as any[] };
    const seenDocs = new Map<string, string>((dupRows || []).map((r: any) => [r.doc_digits, r.client_name]));

    for (const p of list) {
      if (staff.has(p.id)) { stats.equipe = (stats.equipe || 0) + 1; continue; }
      const cs = (contr || []).filter((x) => x.user_id === p.id);
      const ps = (procs || []).filter((x) => x.user_id === p.id);
      if (!cs.length && !ps.length) { stats.sem_vinculo = (stats.sem_vinculo || 0) + 1; continue; }
      const doc = digits(p.cpf_cnpj || p.cnpj || p.cpf);
      const signedMain = cs.filter((x) => x.document_type === "contract" && x.signature_status === "signed")
        .sort((a, b) => String(b.signed_at).localeCompare(String(a.signed_at)));
      const anu = (anuContr || []).find((x) => x.user_id === p.id);
      const hasDistrato = cs.some((x) => String(x.document_type).startsWith("distrato") && x.signature_status === "signed");
      const inDistratoStage = ps.some((x) => x.pipeline_stage === "distrato");
      let eligibility = "eligible"; let reason: string | null = null; let gen = "scheduled";
      if (hasDistrato) { eligibility = "excluded"; reason = "Cliente excluído: distrato assinado."; gen = "excluded"; }
      else if (inDistratoStage) { eligibility = "review"; reason = "Cartão na etapa Distrato sem distrato assinado no CRM."; }
      else if (!signedMain.length) { eligibility = "review"; reason = "Sem contrato assinado no CRM."; }
      else if (cfg.require_clause && !anu) { eligibility = "review"; reason = "Cláusula de anuidade não localizada no contrato assinado."; }
      else if (!validEmail(p.email)) { eligibility = "review"; reason = "E-mail de faturamento ausente ou inválido."; }
      else if (doc.length !== 11 && doc.length !== 14) { eligibility = "review"; reason = "CPF/CNPJ ausente ou inválido (necessário para o Asaas)."; }
      else if (seenDocs.has(doc)) { eligibility = "review"; reason = `Possível cadastro duplicado (mesmo CPF/CNPJ de ${seenDocs.get(doc) || "outro cliente"}).`; }
      if (eligibility === "review") gen = "review";
      if (doc.length >= 11 && !seenDocs.has(doc)) seenDocs.set(doc, p.full_name || p.email || "");
      stats[eligibility] = (stats[eligibility] || 0) + 1;
      rows.push({
        campaign_id: c.id, exercicio: c.exercicio, client_id: p.id, client_name: p.full_name, client_email: p.email?.trim() || null,
        doc_digits: doc || null, contract_id: anu?.id || signedMain[0]?.id || null,
        brands: [...new Set(ps.map((x) => x.brand_name).filter(Boolean))].slice(0, 20),
        amount_cents: c.amount_cents, eligibility, reason, generation_status: gen,
        contract_ref_date: `${c.exercicio}-12-05`,
      });
    }
    if (rows.length) {
      const { error: insErr } = await admin.from("annuity_items").upsert(rows, { onConflict: "exercicio,client_id", ignoreDuplicates: true });
      if (insErr) { await admin.from("annuity_campaigns").update({ scan_cursor: from }).eq("id", c.id); throw insErr; }
    }
  }
  stats.varridos = (stats.varridos || 0) + list.length;
  const done = list.length < PAGE;
  await admin.from("annuity_campaigns").update({
    scan_stats: stats, scan_done: done, last_scan_at: new Date().toISOString(),
    ...(done && c.status === "scanning" ? { status: "scheduled" } : {}),
  }).eq("id", c.id);
  if (done) await logEvent(c.id, null, null, "scan_done", stats);
  return !done;
}

// ─────────────────────────── E-MAIL ───────────────────────────
async function sendItemEmail(c: any, item: any, actor: string | null): Promise<string> {
  const today = nowSaoPaulo().date;
  if (await signedDistrato(item.client_id)) {
    await admin.from("annuity_items").update({ email_status: "not_sent", eligibility: "review", reason: "Distrato assinado após a emissão — boleto em análise." }).eq("id", item.id);
    await logEvent(c.id, item.id, actor, "email_blocked_distrato");
    return "blocked";
  }
  if (item.invoice_id) {
    const { data: inv } = await admin.from("invoices").select("status").eq("id", item.invoice_id).maybeSingle();
    const s = String(inv?.status || "").toUpperCase();
    if (PAID.includes(s) || DEAD.includes(s)) {
      await admin.from("annuity_items").update({ email_status: "not_sent", last_error: `E-mail não enviado: cobrança ${PAID.includes(s) ? "já paga" : "cancelada"}.` }).eq("id", item.id);
      return "skipped";
    }
  }
  if (item.due_date && item.due_date < today) {
    await admin.from("annuity_items").update({ email_status: "failed", last_error: "Boleto venceu sem comunicação. Ajuste o vencimento da mesma cobrança no Asaas antes de reenviar." }).eq("id", item.id);
    return "blocked";
  }
  if (!RESEND_API_KEY) {
    await admin.from("annuity_items").update({ email_status: "failed", last_error: "Serviço de e-mail não configurado." }).eq("id", item.id);
    return "failed";
  }
  const ok = item.__test ? true : (await admin.rpc("annuity_reserve_email")).data;
  if (ok !== true) { await admin.from("annuity_items").update({ email_status: "queued" }).eq("id", item.id); return "quota"; }

  let mail;
  try {
    mail = buildAnnuityEmail(campSettings(c), { exercicio: c.exercicio, nome: item.client_name, periodo: c.period_label, vencimento: item.due_date, link: item.boleto_url, valorCents: item.amount_cents, marcas: item.brands });
  } catch (e) {
    await admin.from("annuity_items").update({ email_status: "failed", last_error: (e as Error).message }).eq("id", item.id);
    return "failed";
  }
  await admin.from("annuity_items").update({ email_status: "sending" }).eq("id", item.id);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `anuidade-${item.id}-${item.attempts}-${today}` },
      body: JSON.stringify({ from: fromOf(campSettings(c)), to: [item.client_email], reply_to: [campSettings(c).reply_to], subject: mail.subject, html: mail.html, text: mail.text }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.message || `Falha no envio (${res.status})`);
    await admin.from("annuity_items").update({ email_status: "accepted", email_sent_at: new Date().toISOString(), last_error: null }).eq("id", item.id);
    await logEvent(c.id, item.id, actor, "email_accepted", { provider_id: body?.id, subject: mail.subject });
    return "accepted";
  } catch (e) {
    await admin.from("annuity_items").update({ email_status: "failed", last_error: `Cobrança gerada. Falha no envio do e-mail: ${(e as Error).message}` }).eq("id", item.id);
    await logEvent(c.id, item.id, actor, "email_failed", { error: (e as Error).message });
    return "failed";
  }
}

// ─────────────────────────── COBRANÇA ───────────────────────────
async function ensureCustomer(clientId: string): Promise<string> {
  const { data: p } = await admin.from("profiles").select("full_name, email, cpf_cnpj, cpf, cnpj, asaas_customer_id, phone").eq("id", clientId).single();
  if (p?.asaas_customer_id) return p.asaas_customer_id;
  const doc = digits(p?.cpf_cnpj || p?.cnpj || p?.cpf);
  const found = await asaas(`/customers?cpfCnpj=${doc}`);
  let id = found?.data?.find((x: any) => !x.deleted)?.id;
  if (!id) {
    const created = await asaas("/customers", { method: "POST", body: JSON.stringify({
      name: p?.full_name, cpfCnpj: doc, email: p?.email, mobilePhone: digits(p?.phone) || undefined, notificationDisabled: true }) });
    id = created.id;
  }
  await admin.from("profiles").update({ asaas_customer_id: id }).eq("id", clientId);
  return id;
}

const extRef = (item: any) => `anuidade:${item.exercicio}:${item.client_id}`;

async function attachPayment(c: any, item: any, pay: any, actor: string | null, source: string) {
  const { data: inv } = await admin.from("invoices").upsert({
    user_id: item.client_id, asaas_invoice_id: pay.id, asaas_customer_id: pay.customer, contract_id: item.contract_id,
    description: pay.description, amount: pay.value, status: String(pay.status || "PENDING").toLowerCase(), due_date: pay.dueDate,
    payment_method: "boleto", invoice_url: pay.invoiceUrl || pay.bankSlipUrl, originado_pelo_crm: true, origem: "anuidade",
    ultima_sincronizacao_asaas: new Date().toISOString(),
  }, { onConflict: "asaas_invoice_id" }).select("id").single();
  const emitted = String(pay.dateCreated || nowSaoPaulo().date).slice(0, 10);
  await admin.from("annuity_items").update({
    generation_status: "generated", asaas_payment_id: pay.id, invoice_id: inv?.id || null, boleto_url: pay.invoiceUrl || pay.bankSlipUrl,
    emitted_at: emitted, due_date: pay.dueDate, financial_status: "pending", lease_until: null, last_error: null,
  }).eq("id", item.id);
  await logEvent(c.id, item.id, actor, source, { asaas_payment_id: pay.id, dueDate: pay.dueDate, value: pay.value });
  return { ...item, asaas_payment_id: pay.id, invoice_id: inv?.id, boleto_url: pay.invoiceUrl || pay.bankSlipUrl, due_date: pay.dueDate, emitted_at: emitted };
}

async function findExisting(item: any) {
  const r = await asaas(`/payments?externalReference=${encodeURIComponent(extRef(item))}`);
  return (r?.data || []).find((p: any) => !p.deleted && p.status !== "DELETED") || null;
}

async function processItem(c: any, item: any) {
  if (await signedDistrato(item.client_id)) {
    await admin.from("annuity_items").update({ eligibility: "excluded", generation_status: "excluded", reason: "Cliente excluído: distrato assinado.", lease_until: null }).eq("id", item.id);
    await logEvent(c.id, item.id, null, "excluded_distrato_revalidation");
    return;
  }
  try {
    const customer = await ensureCustomer(item.client_id);
    let pay = await findExisting(item);
    if (!pay) {
      const today = nowSaoPaulo().date;
      pay = await asaas("/payments", { method: "POST", body: JSON.stringify({
        customer, billingType: "BOLETO", value: Number((item.amount_cents / 100).toFixed(2)),
        dueDate: calcAnnuityDueDate(today, campSettings(c).due_days, campSettings(c).weekend_shift),
        description: boletoDescription(campSettings(c), c.exercicio, c.period_label, item.brands),
        externalReference: extRef(item) }) });
    }
    const updated = await attachPayment(c, item, pay, null, "generated");
    await sendItemEmail(c, { ...updated, attempts: item.attempts }, null);
  } catch (e) {
    const err = e as AsaasError;
    if (err.uncertain) {
      await admin.from("annuity_items").update({ generation_status: "reconciling", last_error: "Resultado em verificação. Aguarde antes de gerar manualmente.", lease_until: null }).eq("id", item.id);
      await logEvent(c.id, item.id, null, "reconciling", { error: err.message });
    } else {
      await admin.from("annuity_items").update({ generation_status: "failed", last_error: `Cobrança não gerada: ${err.message}`, lease_until: null }).eq("id", item.id);
      await logEvent(c.id, item.id, null, "generation_failed", { error: err.message, status: err.status });
      await notify(c.created_by, "Anuidade não gerada", `Não foi possível gerar a anuidade de ${item.client_name}. Gere a cobrança manualmente no Asaas e vincule-a aqui.`);
    }
  }
}

async function reconcileItem(c: any, item: any, actor: string | null) {
  try {
    const pay = await findExisting(item);
    if (pay) { const u = await attachPayment(c, item, pay, actor, "reconciled_found"); if (u.email_status !== "accepted") await sendItemEmail(c, u, actor); return "found"; }
    await admin.from("annuity_items").update({ generation_status: "failed", last_error: "Confirmado: a cobrança não foi criada no Asaas. Necessária nova tentativa ou geração manual." }).eq("id", item.id);
    await logEvent(c.id, item.id, actor, "reconciled_absent");
    return "absent";
  } catch (e) { return `pending: ${(e as Error).message}`; }
}

// ─────────────────────────── TICK ───────────────────────────
async function tick(): Promise<boolean> {
  const started = Date.now();
  let more = false;
  const { data: camps } = await admin.from("annuity_campaigns").select("*").in("status", ["scanning", "scheduled", "running"]);
  const { date: today, hour } = nowSaoPaulo();
  for (const c0 of camps || []) {
    let c = c0;
    while (!c.scan_done && Date.now() - started < BUDGET_MS) {
      const cont = await scanStep(c);
      const { data: fresh } = await admin.from("annuity_campaigns").select("*").eq("id", c.id).single();
      c = fresh; if (!cont) break;
    }
    if (!c.scan_done) { more = true; continue; }
    // Reconciliação de resultados incertos
    const { data: rec } = await admin.from("annuity_items").select("*").eq("campaign_id", c.id).eq("generation_status", "reconciling").limit(20);
    for (const it of rec || []) { if (Date.now() - started > BUDGET_MS) break; await reconcileItem(c, it, null); }
    if (today < c.start_date || hour < c.daily_hour) continue;
    if (c.status !== "running") await admin.from("annuity_campaigns").update({ status: "running" }).eq("id", c.id);
    // E-mails que ficaram na fila por cota
    const { data: queued } = await admin.from("annuity_items").select("*").eq("campaign_id", c.id).eq("generation_status", "generated").eq("email_status", "queued").limit(20);
    for (const it of queued || []) { if (Date.now() - started > BUDGET_MS) { more = true; break; } if (await sendItemEmail(c, it, null) === "quota") break; }
    while (Date.now() - started < BUDGET_MS) {
      const { data: batch } = await admin.rpc("annuity_claim_items", { p_campaign: c.id, p_limit: Math.min(10, c.daily_limit) });
      if (!batch?.length) break;
      for (const it of batch) await processItem(c, it);
      more = true;
    }
    const { count } = await admin.from("annuity_items").select("id", { count: "exact", head: true })
      .eq("campaign_id", c.id).in("generation_status", ["scheduled", "processing", "reconciling"]);
    if (!count) await admin.from("annuity_campaigns").update({ status: "completed" }).eq("id", c.id);
  }
  return more;
}

function chain() {
  const p = fetch(`${SUPABASE_URL}/functions/v1/annuity?action=tick`, {
    method: "POST", headers: { "Content-Type": "application/json", apikey: ANON_KEY }, body: JSON.stringify({ action: "tick" }),
  }).catch(() => null);
  // @ts-ignore EdgeRuntime existe no runtime Supabase
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(p);
}

// ─────────────────────────── HTTP ───────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const action: string = body.action || url.searchParams.get("action") || "";
  try {
    if (action === "tick") {
      if (!ASAAS_API_KEY) return json({ error: "Integração Asaas não configurada" }, 503);
      const more = await tick();
      if (more) chain();
      return json({ ok: true, more });
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
    const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await asUser.auth.getUser();
    const user = u?.user;
    if (!user) return json({ error: "Sessão inválida" }, 401);
    const { data: allowed } = await admin.rpc("has_financial_permission", { _user_id: user.id });
    if (allowed !== true) return json({ error: "Sem permissão financeira para esta operação" }, 403);

    const loadItem = async () => {
      const { data: item } = await admin.from("annuity_items").select("*").eq("id", body.item_id).single();
      if (!item) throw new Error("Item não encontrado");
      const { data: c } = await admin.from("annuity_campaigns").select("*").eq("id", item.campaign_id).single();
      return { item, c };
    };

    switch (action) {
      case "start": {
        const ex = Number(body.exercicio);
        if (!Number.isInteger(ex) || ex < 2026 || ex > 2100) return json({ error: "Exercício inválido" }, 400);
        if (!ASAAS_API_KEY) return json({ error: "Integração Asaas não configurada" }, 503);
        const { data: existing } = await admin.from("annuity_campaigns").select("*").eq("exercicio", ex).maybeSingle();
        let c = existing;
        if (!c) {
          const { data, error } = await admin.from("annuity_campaigns").insert({
            exercicio: ex, status: "scanning", start_date: campaignStartDate(ex), period_label: `Exercício ${ex}`,
            contract_reference_date: `${ex}-12-05`, created_by: user.id,
          }).select("*").single();
          if (error) throw error; c = data;
          await logEvent(c.id, null, user.id, "campaign_started", { exercicio: ex });
        } else if (["paused", "cancelled", "completed", "draft"].includes(c.status)) {
          const status = c.scan_done ? "scheduled" : "scanning";
          await admin.from("annuity_campaigns").update({ status }).eq("id", c.id);
          await logEvent(c.id, null, user.id, "campaign_resumed_by_generate", { from: c.status });
        }
        chain();
        return json({ ok: true, campaign_id: c.id, start_date: c.start_date });
      }
      case "rescan": {
        await admin.from("annuity_campaigns").update({ scan_cursor: 0, scan_done: false, scan_stats: {}, status: "scanning" }).eq("id", body.campaign_id);
        await logEvent(body.campaign_id, null, user.id, "rescan");
        chain(); return json({ ok: true });
      }
      case "pause": case "resume": case "cancel": {
        const { data: c } = await admin.from("annuity_campaigns").select("*").eq("id", body.campaign_id).single();
        const status = action === "pause" ? "paused" : action === "cancel" ? "cancelled" : (c.scan_done ? "scheduled" : "scanning");
        await admin.from("annuity_campaigns").update({ status }).eq("id", c.id);
        await logEvent(c.id, null, user.id, action, { reason: body.reason || null });
        if (action === "resume") chain();
        return json({ ok: true, status });
      }
      case "config": {
        const patch: any = {};
        if (body.start_date && /^\d{4}-\d{2}-\d{2}$/.test(body.start_date)) patch.start_date = body.start_date;
        if (Number.isInteger(body.daily_hour) && body.daily_hour >= 0 && body.daily_hour <= 23) patch.daily_hour = body.daily_hour;
        if (Number.isInteger(body.daily_limit) && body.daily_limit >= 1 && body.daily_limit <= 200) patch.daily_limit = body.daily_limit;
        if (Number.isInteger(body.amount_cents) && body.amount_cents > 0) patch.amount_cents = body.amount_cents;
        if (typeof body.period_label === "string" && body.period_label.trim()) patch.period_label = body.period_label.trim().slice(0, 80);
        await admin.from("annuity_campaigns").update(patch).eq("id", body.campaign_id);
        if (patch.amount_cents) await admin.from("annuity_items").update({ amount_cents: patch.amount_cents })
          .eq("campaign_id", body.campaign_id).in("generation_status", ["scheduled", "review"]);
        await logEvent(body.campaign_id, null, user.id, "config_updated", patch);
        return json({ ok: true });
      }
      case "approve": case "exclude": {
        const { item, c } = await loadItem();
        if (item.asaas_payment_id) return json({ error: "Item já possui cobrança vinculada" }, 409);
        const patch = action === "approve"
          ? { eligibility: "eligible", generation_status: "scheduled", reason: `Aprovado manualmente: ${body.reason || "sem motivo"}` }
          : { eligibility: "excluded", generation_status: "excluded", reason: `Excluído manualmente: ${body.reason || "sem motivo"}` };
        await admin.from("annuity_items").update(patch).eq("id", item.id);
        await logEvent(c.id, item.id, user.id, action, { reason: body.reason || null });
        return json({ ok: true });
      }
      case "retry": {
        const { item, c } = await loadItem();
        if (item.generation_status === "reconciling") return json({ error: "Resultado em verificação. Aguarde a reconciliação antes de tentar novamente." }, 409);
        if (item.asaas_payment_id) return json({ error: "Já existe cobrança. Use Reenviar e-mail." }, 409);
        await admin.from("annuity_items").update({ generation_status: "scheduled", last_error: null, manual_by: null, manual_at: null }).eq("id", item.id);
        await logEvent(c.id, item.id, user.id, "retry"); chain();
        return json({ ok: true });
      }
      case "reconcile": {
        const { item, c } = await loadItem();
        return json({ ok: true, result: await reconcileItem(c, item, user.id) });
      }
      case "manual_start": {
        const { item, c } = await loadItem();
        if (item.generation_status === "reconciling") return json({ error: "Resultado em verificação. Não gere manualmente ainda." }, 409);
        if (item.asaas_payment_id) return json({ error: "Já existe cobrança vinculada." }, 409);
        await admin.from("annuity_items").update({ generation_status: "manual", manual_by: user.id, manual_at: new Date().toISOString() }).eq("id", item.id);
        await logEvent(c.id, item.id, user.id, "manual_reserved");
        return json({ ok: true });
      }
      case "link_manual": {
        const { item, c } = await loadItem();
        const pid = String(body.payment_id || "").trim();
        if (!/^pay_[A-Za-z0-9]+$/.test(pid)) return json({ error: "Informe um ID de cobrança Asaas válido (pay_...)" }, 400);
        if (item.asaas_payment_id && item.asaas_payment_id !== pid) return json({ error: "Este cliente já possui outra cobrança vinculada." }, 409);
        const { data: other } = await admin.from("annuity_items").select("id").eq("asaas_payment_id", pid).neq("id", item.id).maybeSingle();
        if (other) return json({ error: "Esta cobrança já está vinculada a outro cliente." }, 409);
        const pay = await asaas(`/payments/${pid}`);
        const { data: prof } = await admin.from("profiles").select("asaas_customer_id").eq("id", item.client_id).single();
        const problems: string[] = [];
        if (pay.deleted || DEAD.includes(String(pay.status))) problems.push("cobrança cancelada/removida");
        if (prof?.asaas_customer_id && pay.customer !== prof.asaas_customer_id) problems.push("cliente do Asaas diferente do cadastro");
        if (Math.round(Number(pay.value) * 100) !== item.amount_cents) problems.push(`valor ${pay.value} diferente de ${(item.amount_cents / 100).toFixed(2)}`);
        if (problems.length && !body.force) return json({ error: `Conferência falhou: ${problems.join("; ")}.`, problems }, 422);
        if (!prof?.asaas_customer_id) await admin.from("profiles").update({ asaas_customer_id: pay.customer }).eq("id", item.client_id);
        await attachPayment(c, item, pay, user.id, "manual_linked");
        if (body.email_sent_in_asaas) {
          await admin.from("annuity_items").update({ email_status: "manual_sent", email_sent_at: new Date().toISOString() }).eq("id", item.id);
          await logEvent(c.id, item.id, user.id, "email_registered_manual");
        }
        return json({ ok: true, warnings: problems });
      }
      case "resend": {
        const { item, c } = await loadItem();
        if (!item.asaas_payment_id) return json({ error: "Sem cobrança gerada para reenviar." }, 409);
        const r = await sendItemEmail(c, item, user.id);
        return json({ ok: r === "accepted", result: r });
      }
      case "preview": {
        const { data: c } = await admin.from("annuity_campaigns").select("*").eq("id", body.campaign_id).maybeSingle();
        const ex = c?.exercicio || Number(body.exercicio) || new Date().getFullYear();
        let item: any = null;
        if (body.item_id) ({ item } = await loadItem());
        const today = nowSaoPaulo().date;
        const mail = buildAnnuityEmail({ exercicio: ex, nome: item?.client_name || "Nome do Cliente", periodo: c?.period_label || `Exercício ${ex}`,
          vencimento: item?.due_date || calcAnnuityDueDate(today), link: item?.boleto_url || "https://www.asaas.com/i/exemplo", valorCents: item?.amount_cents || c?.amount_cents || 39800 });
        return json({ ok: true, ...mail, sample: !item?.boleto_url });
      }
      case "test_email": {
        const to = String(body.to || "").trim();
        if (!validEmail(to)) return json({ error: "E-mail interno inválido" }, 400);
        const today = nowSaoPaulo().date;
        const ex = Number(body.exercicio) || new Date().getFullYear();
        const mail = buildAnnuityEmail({ exercicio: ex, nome: "Teste interno", periodo: `Exercício ${ex}`, vencimento: calcAnnuityDueDate(today), link: "https://www.webmarcas.net", valorCents: 39800 });
        const res = await fetch("https://api.resend.com/emails", { method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: FROM, to: [to], reply_to: [REPLY_TO], subject: `[TESTE] ${mail.subject}`, html: mail.html, text: mail.text }) });
        if (!res.ok) return json({ error: `Falha no envio de teste (${res.status})` }, 502);
        await logEvent(null, null, user.id, "test_email", { to });
        return json({ ok: true });
      }
      default: return json({ error: "Ação inválida" }, 400);
    }
  } catch (e) {
    console.error("annuity error", e);
    return json({ error: (e as Error).message || "Erro inesperado" }, 500);
  }
});
