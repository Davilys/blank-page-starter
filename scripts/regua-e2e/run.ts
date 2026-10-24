Deno.env.set("SUPABASE_URL","http://fake"); Deno.env.set("SUPABASE_SERVICE_ROLE_KEY","svc"); Deno.env.set("CRON_SECRET","s3cret"); Deno.env.set("ASAAS_API_KEY","k");
import { DB } from "/tmp/e2e/fakesb.ts";
import * as std from "/tmp/e2e/std.ts";
const RealDate = Date; const FIXED = new RealDate("2026-10-24T14:00:00Z").getTime();
(globalThis as any).Date = class extends RealDate { constructor(...a: any[]) { if (a.length) super(...(a as [any])); else super(FIXED); } static now() { return FIXED; } };
const calls: string[] = []; let asaasStatus = "PENDING"; let criarErr = false;
(globalThis as any).fetch = async (url: string, init: any) => {
  const u = String(url); const body = init?.body ? JSON.parse(init.body) : null;
  if (u.includes("/payments/")) { calls.push("asaas:GET"); return new Response(JSON.stringify({ status: asaasStatus }), { status: 200 }); }
  if (u.includes("/functions/v1/")) { const fn = u.split("/functions/v1/")[1]; calls.push(`fn:${fn}:${body.action ?? body.tipo}`); (globalThis as any).last = { fn, body, headers: init.headers };
    if (fn === "criar-acordo-cliente" && body.action === "criar") return new Response(JSON.stringify(criarErr ? { error: "boom" } : { success: true, acordo_id: "ac1" }), { status: criarErr ? 400 : 200 });
    return new Response(JSON.stringify({ success: true, channels: ["whatsapp", "email"] }), { status: 200 }); }
  throw new Error("fetch inesperado " + u);
};
await import("/home/sandbox/work/supabase/functions/regua-cobranca-processar/index.ts");
const h = (std as any).handler;
const call = async (secret?: string) => { const r = await h(new Request("http://x", { method: "POST", headers: secret ? { "x-cron-secret": secret } : {} })); return [r.status, await r.json()]; };
let fail = 0; const ok = (c: boolean, m: string) => { console.log(c ? "OK  " : "FAIL", m); if (!c) fail++; };
const reset = (tipo: string, cfg: any, inv: any = {}) => {
  calls.length = 0; DB.tables = { system_settings: [{ key: "regua_cobranca", value: cfg }], invoices: [{ id: "i1", amount: 699, description: "Registro de marca", status: "overdue", due_date: "2026-09-01", asaas_invoice_id: "pay1", acordo_id: null, sync_status: "ativa", ...inv }], acordos_cliente: [], cobranca_fila: [{ id: "f1", invoice_id: "i1", tipo, status: "processando", tentativas: 1 }] };
  DB.rpc = { claim_cobranca_fila: () => [DB.tables.cobranca_fila[0]], classificar_situacao_cobranca: () => "vencidas" };
};
const on = { lembretes_ativo: true, acordo_auto_ativo: true, dry_run: false };
let [s] = await call(); ok(s === 401, "sem segredo = 401");
[s] = await call("errado"); ok(s === 401, "segredo errado = 401");
reset("vencido_d1", { ...on, dry_run: true }); let [, r] = await call("s3cret"); ok(r.reason === "dry_run" && calls.length === 0, "dry-run não envia nada");
reset("vencido_d1", on); asaasStatus = "PENDING"; [, r] = await call("s3cret"); ok(r.status === "enviado" && calls.join() === "asaas:GET,fn:lembrar-fatura-vencendo:vencido_d1", "D1 pendente: reconfere Asaas e envia: " + calls.join());
reset("vencido_d3", on); asaasStatus = "RECEIVED"; [, r] = await call("s3cret"); ok(r.status === "cancelado" && !calls.some((c) => c.startsWith("fn:")), "pago no Asaas: cancela, não envia");
reset("vencido_d1", { ...on, lembretes_ativo: false }); asaasStatus = "PENDING"; [, r] = await call("s3cret"); ok(r.status === "cancelado" && calls.length === 0, "flag lembretes OFF: cancela");
reset("acordo_auto", on); asaasStatus = "OVERDUE"; criarErr = false; [, r] = await call("s3cret");
const L = (globalThis as any).last;
ok(r.status === "enviado" && calls.join() === "asaas:GET,fn:criar-acordo-cliente:criar,fn:criar-acordo-cliente:enviar-acordo", "acordo 699: Asaas, criar, enviar: " + calls.join());
reset("acordo_auto", on, { amount: 1621, description: "Exigência INPI marca X" }); asaasStatus = "OVERDUE"; await call("s3cret");
ok(calls.length === 3, "acordo 1621 ok");
reset("acordo_auto", on); asaasStatus = "OVERDUE"; await call("s3cret");
// captura corpo do criar
(globalThis as any).fetch = ((orig) => async (u: string, i: any) => { if (String(u).includes("criar-acordo") && JSON.parse(i.body).action === "criar") (globalThis as any).criarBody = JSON.parse(i.body); return orig(u, i); })((globalThis as any).fetch);
reset("acordo_auto", on, { amount: 1621, description: "Exigência INPI marca X" }); await call("s3cret");
const cb = (globalThis as any).criarBody; ok(cb.num_parcelas === 5 && cb.juros_percentual === 10 && cb.preview_total_centavos === 178310 && cb.crm_action_id === "regua-auto:i1" && /^\d{4}-\d{2}-\d{2}$/.test(cb.primeira_parcela_data), "corpo do acordo 1621: 5x/10%/178310/id idempotente " + JSON.stringify(cb));
reset("acordo_auto", on, { amount: 800, description: "Registro de marca" }); await call("s3cret"); ok(!calls.some((c) => c.startsWith("fn:")), "valor fora da regra: não cria acordo");
reset("acordo_auto", on, { acordo_id: "x" }); await call("s3cret"); ok(!calls.some((c) => c.startsWith("fn:")), "parcela de acordo: sem acordo auto");
reset("acordo_auto", on); asaasStatus = "OVERDUE"; criarErr = true; [, r] = await call("s3cret"); ok(r.status === "erro" && !calls.some((c) => c.endsWith("enviar-acordo")), "falha ao criar: erro, não envia, sem retry automático");
reset("acordo_auto", on); asaasStatus = "RECEIVED"; criarErr = false; await call("s3cret"); ok(!calls.some((c) => c.startsWith("fn:")), "acordo: paga no Asaas = não cria");
reset("vencido_d1", on, {}); DB.rpc.classificar_situacao_cobranca = () => "recebidas"; await call("s3cret"); ok(!calls.some((c) => c.startsWith("fn:")), "classificador diz paga: cancela");
console.log(fail ? "FALHAS: " + fail : "TODOS OK"); Deno.exit(fail ? 1 : 0);
