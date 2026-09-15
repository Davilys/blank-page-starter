// Sincronização GERAL com o Asaas: importa todos os clientes e todas as cobranças.
// Processa em blocos (o frontend pede bloco a bloco); cursor, trava e contadores ficam no banco,
// em public.asaas_full_sync_runs, para que a execução possa ser retomada.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeStatus } from "../_shared/statusCobranca.ts";

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

const BLOCO_CLIENTES = 20;      // clientes do Asaas por chamada
const PAGINA_COBRANCAS = 100;   // itens por página de /payments
const MAX_PAGINAS = 200;        // teto de segurança por cliente

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const digits = (v?: string | null) => (v || "").toString().replace(/\D/g, "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class AsaasTemporario extends Error {
  retryAfter: number;
  constructor(msg: string, retryAfter: number) {
    super(msg);
    this.retryAfter = retryAfter;
  }
}

async function asaasGet(path: string) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    headers: { access_token: ASAAS_API_KEY, "Content-Type": "application/json" },
  });
  const text = await res.text();
  if (res.status === 429 || res.status >= 500) {
    const ra = Number(res.headers.get("retry-after") || 0);
    throw new AsaasTemporario(`Asaas ${res.status}`, ra > 0 ? ra : 5);
  }
  if (!res.ok) throw new Error(`Asaas ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

type Admin = ReturnType<typeof createClient>;

/** Resolve (ou cria) o cliente do CRM correspondente a um customer do Asaas. */
async function resolverCliente(admin: Admin, cust: any): Promise<{ id: string | null; criado: boolean; vinculado: boolean; ambiguo: boolean }> {
  // 1) vínculo direto
  const { data: porId } = await admin
    .from("profiles").select("id").eq("asaas_customer_id", cust.id).maybeSingle();
  if (porId) return { id: porId.id as string, criado: false, vinculado: true, ambiguo: false };

  // 2) CPF/CNPJ exato, normalizado e único
  const doc = digits(cust.cpfCnpj);
  if (doc && (doc.length === 11 || doc.length === 14)) {
    const { data: porDoc } = await admin.rpc("profiles_by_doc_digits", { p_doc: doc });
    const candidatos = ((porDoc as any[]) || []).map((r: any) => r.id as string);
    if (candidatos.length === 1) {
      await admin.from("profiles").update({ asaas_customer_id: cust.id }).eq("id", candidatos[0]);
      return { id: candidatos[0], criado: false, vinculado: true, ambiguo: false };
    }
    if (candidatos.length > 1) return { id: null, criado: false, vinculado: false, ambiguo: true };
  }

  // 3) criar cliente novo (sem automações comerciais)
  const rawEmail = (cust.email || "").toString().toLowerCase().trim();
  const novoId = crypto.randomUUID();
  const emailFinal = rawEmail || `asaas-${cust.id}@webmarcas.local`;

  if (rawEmail) {
    const { data: existente } = await admin.from("profiles").select("id, asaas_customer_id").eq("email", rawEmail).maybeSingle();
    if (existente) {
      // e-mail nunca cria vínculo automático quando já existe outra conta Asaas ligada
      if (!existente.asaas_customer_id) {
        return { id: null, criado: false, vinculado: false, ambiguo: true };
      }
      return { id: null, criado: false, vinculado: false, ambiguo: true };
    }
  }

  const payload: Record<string, unknown> = {
    id: novoId,
    email: emailFinal,
    full_name: cust.name || "Cliente Asaas",
    phone: cust.mobilePhone || cust.phone || null,
    cpf_cnpj: cust.cpfCnpj || null,
    address: cust.address ? `${cust.address}${cust.addressNumber ? ", " + cust.addressNumber : ""}` : null,
    neighborhood: cust.province || null,
    city: cust.city || null,
    state: cust.state || null,
    zip_code: cust.postalCode || null,
    asaas_customer_id: cust.id,
    origin: "asaas-sync",
  };
  const { error } = await admin.from("profiles").insert(payload);
  if (error) throw new Error(`Falha ao criar cliente ${cust.id}: ${error.message}`);
  return { id: novoId, criado: true, vinculado: false, ambiguo: false };
}

/** Busca TODAS as páginas de cobranças de um customer. Lança AsaasTemporario em 429/5xx. */
async function coletarCobrancas(customerId: string): Promise<any[]> {
  const todas: any[] = [];
  let offset = 0;
  for (let p = 0; p < MAX_PAGINAS; p++) {
    const r = await asaasGet(`/payments?customer=${encodeURIComponent(customerId)}&limit=${PAGINA_COBRANCAS}&offset=${offset}`);
    const data = r?.data || [];
    todas.push(...data);
    const hasMore = r?.hasMore === true || data.length === PAGINA_COBRANCAS;
    if (!hasMore) break;
    offset += PAGINA_COBRANCAS;
    await sleep(150);
  }
  return todas;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

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
    const action = (body.action || "block").toString();

    // ───────── status / retomada ─────────
    if (action === "status") {
      const { data: run } = await admin
        .from("asaas_full_sync_runs").select("*").eq("status", "em_andamento")
        .order("started_at", { ascending: false }).limit(1).maybeSingle();
      const { data: ultima } = await admin
        .from("asaas_full_sync_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle();
      return json({ ok: true, run: run || null, ultima: ultima || null });
    }

    if (action === "cancel") {
      const { data: run } = await admin
        .from("asaas_full_sync_runs").select("*").eq("status", "em_andamento").maybeSingle();
      if (run) {
        await admin.from("asaas_full_sync_runs")
          .update({ status: "falha", etapa: "Interrompida pelo administrador", erro: "Interrompida", finished_at: new Date().toISOString() })
          .eq("id", run.id);
      }
      return json({ ok: true });
    }

    // ───────── início (ou retomada de execução já existente) ─────────
    if (action === "start") {
      const { data: emAndamento } = await admin
        .from("asaas_full_sync_runs").select("*").eq("status", "em_andamento")
        .order("started_at", { ascending: false }).limit(1).maybeSingle();
      if (emAndamento) {
        return json({ ok: true, retomada: true, run: emAndamento });
      }

      let total: number | null = null;
      try {
        const r = await asaasGet(`/customers?limit=1&offset=0`);
        total = typeof r?.totalCount === "number" ? r.totalCount : null;
      } catch (e) {
        if (e instanceof AsaasTemporario) return json({ ok: false, retry: true, retry_after: e.retryAfter, error: "Asaas indisponível no momento" }, 200);
        throw e;
      }

      const { data: criado, error } = await admin.from("asaas_full_sync_runs").insert({
        executed_by: user.id,
        total_clientes_asaas: total,
        etapa: "Preparando sincronização",
      }).select("*").single();
      if (error) {
        // corrida: outra execução acabou de começar
        const { data: existente } = await admin
          .from("asaas_full_sync_runs").select("*").eq("status", "em_andamento").maybeSingle();
        if (existente) return json({ ok: true, retomada: true, run: existente });
        throw error;
      }
      return json({ ok: true, retomada: false, run: criado });
    }

    // ───────── processamento de um bloco ─────────
    const syncRunId = (body.sync_run_id || "").toString();
    if (!syncRunId) return json({ error: "sync_run_id é obrigatório" }, 400);

    const { data: run } = await admin
      .from("asaas_full_sync_runs").select("*").eq("sync_run_id", syncRunId).maybeSingle();
    if (!run) return json({ error: "Execução não encontrada" }, 404);
    if (run.status !== "em_andamento") {
      return json({ ok: true, concluido: true, run });
    }

    const offsetPedido = Number.isFinite(Number(body.offset)) ? Number(body.offset) : run.cursor_offset;
    // Idempotência por sync_run_id + offset: bloco já aplicado não é reprocessado nem recontado.
    if (offsetPedido < run.cursor_offset) {
      return json({ ok: true, repetido: true, concluido: false, run, offset_proximo: run.cursor_offset });
    }
    const offset = run.cursor_offset;

    let clientes: any[] = [];
    try {
      const r = await asaasGet(`/customers?limit=${BLOCO_CLIENTES}&offset=${offset}`);
      clientes = r?.data || [];
      if (typeof r?.totalCount === "number" && r.totalCount !== run.total_clientes_asaas) {
        await admin.from("asaas_full_sync_runs").update({ total_clientes_asaas: r.totalCount }).eq("id", run.id);
        run.total_clientes_asaas = r.totalCount;
      }
    } catch (e) {
      if (e instanceof AsaasTemporario) {
        await admin.from("asaas_full_sync_runs")
          .update({ etapa: `Aguardando o Asaas responder (offset ${offset})` }).eq("id", run.id);
        return json({ ok: false, retry: true, retry_after: e.retryAfter, offset, run }, 200);
      }
      throw e;
    }

    // Nenhum cliente neste offset → fim (sem remover nada quando a base do Asaas volta vazia no 1º bloco)
    if (clientes.length === 0) {
      const finalizado = {
        status: "concluida",
        etapa: "Concluída",
        finished_at: new Date().toISOString(),
      };
      const { data: fim } = await admin.from("asaas_full_sync_runs").update(finalizado).eq("id", run.id).select("*").single();
      return json({ ok: true, concluido: true, run: fim });
    }

    const agora = new Date().toISOString();
    let clientesCriados = 0, clientesVinculados = 0, encontradas = 0, criadas = 0, atualizadas = 0, removidas = 0;
    const ambiguidades: string[] = [];

    for (const cust of clientes) {
      // 1) coleta completa deste cliente (nada é gravado antes de a coleta terminar)
      let cobrancas: any[];
      try {
        cobrancas = await coletarCobrancas(cust.id);
      } catch (e) {
        if (e instanceof AsaasTemporario) {
          // Bloco não confirmado: cursor NÃO avança, contadores deste bloco são descartados.
          await admin.from("asaas_full_sync_runs")
            .update({ etapa: `Aguardando o Asaas responder (cliente ${cust.id})` }).eq("id", run.id);
          return json({ ok: false, retry: true, retry_after: e.retryAfter, offset, run }, 200);
        }
        throw e;
      }

      // 2) cliente do CRM
      const resolvido = await resolverCliente(admin, cust);
      if (resolvido.ambiguo || !resolvido.id) {
        ambiguidades.push(cust.id);
        continue;
      }
      if (resolvido.criado) clientesCriados++;
      else if (resolvido.vinculado) clientesVinculados++;

      encontradas += cobrancas.length;

      // 3) conciliação
      const { data: locais } = await admin
        .from("invoices").select("id, asaas_invoice_id, sync_status, origem").eq("user_id", resolvido.id);
      const porAsaasId = new Map<string, any>();
      for (const l of locais || []) if (l.asaas_invoice_id) porAsaasId.set(l.asaas_invoice_id, l);

      const vistos = new Set<string>();
      for (const p of cobrancas) {
        vistos.add(p.id);
        const existente = porAsaasId.get(p.id);
        const registro: Record<string, unknown> = {
          user_id: resolvido.id,
          asaas_invoice_id: p.id,
          asaas_customer_id: cust.id,
          description: p.description || "Cobrança Asaas",
          amount: Number(p.value || 0),
          status: normalizeStatus(p.status),
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
          origem: existente?.origem === "acordo" ? "acordo" : "asaas",
        };
        if (existente) {
          const { error } = await admin.from("invoices").update(registro).eq("id", existente.id);
          if (error) throw new Error(`Falha ao atualizar cobrança ${p.id}: ${error.message}`);
          atualizadas++;
        } else {
          const { error } = await admin.from("invoices").insert(registro);
          if (error) throw new Error(`Falha ao criar cobrança ${p.id}: ${error.message}`);
          criadas++;
        }
      }

      // 4) removidas: só depois de TODAS as páginas deste cliente virem completas
      for (const l of locais || []) {
        if (!l.asaas_invoice_id || vistos.has(l.asaas_invoice_id)) continue;
        if (l.sync_status === "removida_asaas") continue;
        const { error } = await admin.from("invoices").update({
          sync_status: "removida_asaas",
          removida_em: agora,
          ultima_sincronizacao_asaas: agora,
        }).eq("id", l.id);
        if (error) throw new Error(`Falha ao marcar remoção ${l.id}: ${error.message}`);
        removidas++;
      }

      await sleep(120);
    }

    const concluido = clientes.length < BLOCO_CLIENTES;
    const { data: atualizado } = await admin.from("asaas_full_sync_runs").update({
      cursor_offset: offset + clientes.length,
      clientes_processados: (run.clientes_processados || 0) + clientes.length,
      clientes_criados: (run.clientes_criados || 0) + clientesCriados,
      clientes_vinculados: (run.clientes_vinculados || 0) + clientesVinculados,
      cobrancas_encontradas: (run.cobrancas_encontradas || 0) + encontradas,
      criadas: (run.criadas || 0) + criadas,
      atualizadas: (run.atualizadas || 0) + atualizadas,
      removidas: (run.removidas || 0) + removidas,
      ambiguidades: [...((run.ambiguidades as string[]) || []), ...ambiguidades].slice(0, 500),
      ultimo_bloco_aplicado: offset,
      etapa: concluido ? "Concluída" : "Conciliando cobranças",
      status: concluido ? "concluida" : "em_andamento",
      finished_at: concluido ? new Date().toISOString() : null,
    }).eq("id", run.id).select("*").single();

    return json({
      ok: true,
      concluido,
      offset_proximo: offset + clientes.length,
      bloco: { clientes: clientes.length, criadas, atualizadas, removidas, clientes_criados: clientesCriados, ambiguidades: ambiguidades.length },
      run: atualizado,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("sync-asaas-all error", msg);
    try {
      const syncRunId = "";
      await admin.from("asaas_full_sync_runs")
        .update({ status: "falha", erro: msg.slice(0, 500), etapa: "Falha", finished_at: new Date().toISOString() })
        .eq("status", "em_andamento");
      void syncRunId;
    } catch { /* log auxiliar */ }
    return json({ error: msg }, 500);
  }
});
