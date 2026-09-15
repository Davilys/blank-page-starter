// Conciliação real das cobranças de um cliente com o Asaas.
// Etapa 1: coleta completa (todas as contas, todas as páginas) em memória.
// Etapa 2: só se a coleta foi 100% bem-sucedida, aplica upserts e marcações no banco.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { classificarCobranca, contaNoTotalAtivo, normalizeStatus } from "../_shared/statusCobranca.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") || "";
const ASAAS_ENV = (Deno.env.get("ASAAS_ENV") || "production").toLowerCase();
const ASAAS_BASE = ASAAS_ENV === "sandbox"
  ? "https://api-sandbox.asaas.com/v3"
  : "https://api.asaas.com/v3";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const digits = (v?: string | null) => (v || "").toString().replace(/\D/g, "");

async function asaasGet(path: string) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    headers: { access_token: ASAAS_API_KEY, "Content-Type": "application/json" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Asaas ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

type Totais = { pago: number; a_vencer: number; vencido: number; total_ativo: number; count_pago: number; count_a_vencer: number; count_vencido: number };

function somar(rows: any[]): Totais {
  const t: Totais = { pago: 0, a_vencer: 0, vencido: 0, total_ativo: 0, count_pago: 0, count_a_vencer: 0, count_vencido: 0 };
  for (const r of rows) {
    const c = classificarCobranca({ status: r.status, due_date: r.due_date, sync_status: r.sync_status });
    const v = Number(r.amount || 0);
    if (c === "pago") { t.pago += v; t.count_pago++; }
    else if (c === "vencido") { t.vencido += v; t.count_vencido++; }
    else if (c === "a_vencer") { t.a_vencer += v; t.count_a_vencer++; }
    if (contaNoTotalAtivo(c)) t.total_ativo += v;
  }
  return t;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const started = Date.now();
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const syncRunId = crypto.randomUUID();

  try {
    if (!ASAAS_API_KEY) return json({ error: "Integração Asaas não configurada" }, 503);

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
    const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await asUser.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Sessão inválida" }, 401);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (isAdmin !== true) return json({ error: "Apenas administradores" }, 403);
    const { data: canFinance } = await admin.rpc("has_financial_permission", { _user_id: user.id });
    if (canFinance !== true) return json({ error: "Sem permissão financeira para esta operação" }, 403);

    const body = await req.json().catch(() => ({}));
    const clientId = (body.client_id || "").toString().trim();
    if (!clientId) return json({ error: "client_id é obrigatório" }, 400);

    const { data: profile } = await admin
      .from("profiles").select("id, email, cpf_cnpj, cpf, cnpj, asaas_customer_id, full_name")
      .eq("id", clientId).maybeSingle();
    if (!profile) return json({ error: "Cliente não encontrado" }, 404);

    // ───────── Totais ANTES (para o relatório comparativo) ─────────
    const { data: antesRows } = await admin
      .from("invoices").select("id, amount, status, due_date, sync_status, asaas_invoice_id")
      .eq("user_id", clientId);
    const totaisAntes = somar(antesRows || []);

    // ───────── 1) Contas Asaas autorizadas ─────────
    // Vínculo principal: asaas_customer_id do perfil e das faturas já sincronizadas.
    const customerIds = new Set<string>();
    if (profile.asaas_customer_id) customerIds.add(profile.asaas_customer_id);
    const { data: invCustomers } = await admin
      .from("invoices").select("asaas_customer_id").eq("user_id", clientId).not("asaas_customer_id", "is", null);
    for (const r of invCustomers || []) if (r.asaas_customer_id) customerIds.add(r.asaas_customer_id);

    // CPF/CNPJ só vincula quando há correspondência exata e ÚNICA.
    const ambiguidades: string[] = [];
    const doc = digits(profile.cpf_cnpj) || digits(profile.cnpj) || digits(profile.cpf);
    if (doc && (doc.length === 11 || doc.length === 14)) {
      try {
        const r = await asaasGet(`/customers?cpfCnpj=${encodeURIComponent(doc)}&limit=100`);
        const found = (r?.data || []).map((c: any) => c.id).filter(Boolean);
        const novos = found.filter((id: string) => !customerIds.has(id));
        if (novos.length === 1) customerIds.add(novos[0]);
        else if (novos.length > 1) ambiguidades.push(...novos);
      } catch (e) {
        console.warn("falha na busca por CPF/CNPJ", String(e));
        // Busca de vínculo é auxiliar: não invalida a sincronização das contas já conhecidas.
      }
    }
    // E-mail NÃO vincula automaticamente (e-mails podem ser repetidos/compartilhados).

    if (!profile.asaas_customer_id && customerIds.size === 1) {
      await admin.from("profiles").update({ asaas_customer_id: Array.from(customerIds)[0] }).eq("id", clientId);
    }

    if (customerIds.size === 0) {
      await admin.from("asaas_sync_logs").insert({
        client_id: clientId, executed_by: user.id, sync_run_id: syncRunId,
        customer_ids: [], ambiguous_customer_ids: ambiguidades,
        totais_antes: totaisAntes, totais_depois: totaisAntes,
        sucesso: true, incompleta: false, duracao_ms: Date.now() - started,
      });
      return json({
        ok: true, sync_run_id: syncRunId, customer_ids: [], ambiguidades,
        totais_antes: totaisAntes, totais_depois: totaisAntes,
        criadas: 0, atualizadas: 0, removidas: 0, encontradas: 0,
        sincronizado_em: new Date().toISOString(),
        aviso: "Nenhuma conta Asaas vinculada a este cliente.",
      });
    }

    // ───────── 2) Coleta completa (em memória) ─────────
    const coletadas: any[] = [];
    let coletaCompleta = true;
    let erroColeta: string | null = null;

    for (const cid of customerIds) {
      let offset = 0;
      const limit = 100;
      for (let page = 0; page < 100; page++) {
        try {
          const r = await asaasGet(`/payments?customer=${encodeURIComponent(cid)}&limit=${limit}&offset=${offset}`);
          const data = r?.data || [];
          for (const p of data) coletadas.push({ ...p, __customer: cid });
          const hasMore = r?.hasMore === true || data.length === limit;
          if (!hasMore) break;
          offset += limit;
        } catch (e) {
          coletaCompleta = false;
          erroColeta = e instanceof Error ? e.message : String(e);
          break;
        }
      }
      if (!coletaCompleta) break;
    }

    // ───────── 3) Validação: nada é gravado/removido com coleta parcial ─────────
    if (!coletaCompleta) {
      await admin.from("asaas_sync_logs").insert({
        client_id: clientId, executed_by: user.id, sync_run_id: syncRunId,
        customer_ids: Array.from(customerIds), ambiguous_customer_ids: ambiguidades,
        total_encontradas: coletadas.length,
        totais_antes: totaisAntes, totais_depois: totaisAntes,
        sucesso: false, incompleta: true, erro: erroColeta?.slice(0, 500),
        duracao_ms: Date.now() - started,
      });
      return json({
        ok: false, incompleta: true, sync_run_id: syncRunId,
        error: "Sincronização incompleta: o Asaas não respondeu a todas as páginas. Nenhum dado foi alterado.",
        detalhe: erroColeta?.slice(0, 300) || null,
        totais_antes: totaisAntes,
      }, 502);
    }

    // ───────── 4) Conciliação ─────────
    const agora = new Date().toISOString();
    const locais = (antesRows || []) as any[];
    const porAsaasId = new Map<string, any>();
    for (const l of locais) if (l.asaas_invoice_id) porAsaasId.set(l.asaas_invoice_id, l);

    let criadas = 0, atualizadas = 0, removidas = 0;
    const idsVistos = new Set<string>();

    for (const p of coletadas) {
      idsVistos.add(p.id);
      const statusLocal = normalizeStatus(p.status);
      const registro: Record<string, unknown> = {
        user_id: clientId,
        asaas_invoice_id: p.id,
        asaas_customer_id: p.__customer,
        description: p.description || "Cobrança Asaas",
        amount: Number(p.value || 0),
        status: statusLocal,
        asaas_status_raw: p.status || null,
        due_date: p.dueDate || null,
        payment_date: p.paymentDate || p.confirmedDate || null,
        payment_method: p.billingType ? String(p.billingType).toLowerCase() : null,
        invoice_url: p.invoiceUrl || null,
        boleto_code: p.bankSlipUrl || null,
        payment_link: p.invoiceUrl || null,
        sync_status: "ativa",
        removida_em: null,
        ultima_sincronizacao_asaas: agora,
        origem: "asaas",
      };

      const existente = porAsaasId.get(p.id);
      if (existente) {
        // Não sobrescreve origem de parcelas de acordo.
        const { data: parcela } = await admin
          .from("acordo_parcelas").select("id").eq("asaas_payment_id", p.id).maybeSingle();
        if (parcela) registro.origem = "acordo";
        const { error } = await admin.from("invoices").update(registro).eq("id", existente.id);
        if (error) throw new Error(`Falha ao atualizar fatura ${existente.id}: ${error.message}`);
        atualizadas++;
      } else {
        const { error } = await admin.from("invoices").insert(registro);
        if (error) throw new Error(`Falha ao criar fatura ${p.id}: ${error.message}`);
        criadas++;
      }
    }

    // Cobranças locais com ID do Asaas que não existem mais lá → removidas (histórico preservado).
    for (const l of locais) {
      if (!l.asaas_invoice_id || idsVistos.has(l.asaas_invoice_id)) continue;
      if (l.sync_status === "removida_asaas") continue;
      const { error } = await admin.from("invoices").update({
        sync_status: "removida_asaas",
        removida_em: agora,
        ultima_sincronizacao_asaas: agora,
      }).eq("id", l.id);
      if (error) throw new Error(`Falha ao marcar remoção da fatura ${l.id}: ${error.message}`);
      removidas++;
    }

    // ───────── 5) Totais DEPOIS ─────────
    const { data: depoisRows } = await admin
      .from("invoices").select("id, amount, status, due_date, sync_status")
      .eq("user_id", clientId);
    const totaisDepois = somar(depoisRows || []);

    await admin.from("asaas_sync_logs").insert({
      client_id: clientId, executed_by: user.id, sync_run_id: syncRunId,
      customer_ids: Array.from(customerIds), ambiguous_customer_ids: ambiguidades,
      total_encontradas: coletadas.length,
      total_criadas: criadas, total_atualizadas: atualizadas, total_removidas: removidas,
      totais_antes: totaisAntes, totais_depois: totaisDepois,
      sucesso: true, incompleta: false, duracao_ms: Date.now() - started,
    });

    await admin.from("client_activities").insert({
      user_id: clientId,
      activity_type: "sincronizacao_asaas",
      description: `Sincronização com o Asaas: ${customerIds.size} conta(s), ${coletadas.length} cobrança(s) — ${criadas} criada(s), ${atualizadas} atualizada(s), ${removidas} removida(s) da lista ativa.`,
      admin_id: user.id,
    }).select().maybeSingle();

    return json({
      ok: true,
      sync_run_id: syncRunId,
      customer_ids: Array.from(customerIds),
      ambiguidades,
      encontradas: coletadas.length,
      criadas, atualizadas, removidas,
      totais_antes: totaisAntes,
      totais_depois: totaisDepois,
      sincronizado_em: agora,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("sync-asaas-client-invoices error", msg);
    await admin.from("asaas_sync_logs").insert({
      client_id: (await req.clone().json().catch(() => ({})))?.client_id || "00000000-0000-0000-0000-000000000000",
      sync_run_id: syncRunId, sucesso: false, incompleta: true,
      erro: msg.slice(0, 500), duracao_ms: Date.now() - started,
    }).then(() => {}, () => {});
    return json({ error: msg }, 500);
  }
});
