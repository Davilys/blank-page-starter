import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")!;
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

async function asaas(path: string, init: RequestInit = {}) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    ...init,
    headers: {
      "access_token": ASAAS_API_KEY,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  if (!res.ok) {
    throw new Error(`Asaas ${res.status} ${path}: ${text.slice(0, 500)}`);
  }
  return data;
}

function daysBetween(dueISO: string): number {
  const due = new Date(dueISO + "T00:00:00Z").getTime();
  const now = Date.now();
  return Math.floor((now - due) / (1000 * 60 * 60 * 24));
}

/**
 * Próximo dia 20 a partir de uma data de referência.
 * Se hoje já passou do dia 20, vai para o mês seguinte.
 */
function nextDay20(from: Date): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 20));
  if (from.getUTCDate() > 20) {
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return d;
}

function addMonthsKeepDay20(base: Date, months: number): Date {
  const d = new Date(base.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  d.setUTCDate(20);
  return d;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!ASAAS_API_KEY) return json({ error: "ASAAS_API_KEY not configured" }, 500);

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.slice(7);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden: admin only" }, 403);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";

    // ────────────── SYNC OVERDUE ──────────────
    if (action === "sync-overdue") {
      let offset = 0;
      const limit = 100;
      let total = 0;
      let kept = 0;
      const customerCache = new Map<string, any>();
      const minOverdueDays = 60;

      while (true) {
        const page = await asaas(`/payments?status=OVERDUE&limit=${limit}&offset=${offset}`);
        const items: any[] = page?.data || [];
        if (items.length === 0) break;
        total += items.length;

        for (const p of items) {
          const due = p.dueDate as string;
          if (!due) continue;
          const dias = daysBetween(due);
          if (dias <= minOverdueDays) continue;

          let cust = customerCache.get(p.customer);
          if (!cust && p.customer) {
            try {
              cust = await asaas(`/customers/${p.customer}`);
              customerCache.set(p.customer, cust);
            } catch (e) {
              console.warn("customer fetch failed", p.customer, e);
            }
          }

          await admin.from("cobrancas_vencidas").upsert({
            asaas_payment_id: p.id,
            asaas_customer_id: p.customer,
            cliente_nome: cust?.name || null,
            cliente_cpf_cnpj: cust?.cpfCnpj || null,
            cliente_email: cust?.email || null,
            valor: p.value || 0,
            data_vencimento: due,
            dias_atraso: dias,
            descricao: p.description || null,
            status: "pendente_renegociacao",
            bucket: "d60",
            updated_at: new Date().toISOString(),
          }, { onConflict: "asaas_payment_id" });

          kept++;
        }

        if (items.length < limit) break;
        offset += limit;
      }

      return json({ success: true, total_overdue: total, kept_over_60d: kept });
    }

    // ────────────── SYNC OVERDUE 30 (≤30 dias) ──────────────
    if (action === "sync-overdue-30") {
      let offset = 0;
      const limit = 100;
      let total = 0;
      let kept = 0;
      const customerCache = new Map<string, any>();

      while (true) {
        const page = await asaas(`/payments?status=OVERDUE&limit=${limit}&offset=${offset}`);
        const items: any[] = page?.data || [];
        if (items.length === 0) break;
        total += items.length;

        for (const p of items) {
          const due = p.dueDate as string;
          if (!due) continue;
          const dias = daysBetween(due);
          if (dias < 1 || dias > 30) continue;

          let cust = customerCache.get(p.customer);
          if (!cust && p.customer) {
            try {
              cust = await asaas(`/customers/${p.customer}`);
              customerCache.set(p.customer, cust);
            } catch (e) { console.warn("customer fetch failed", p.customer, e); }
          }

          await admin.from("cobrancas_vencidas").upsert({
            asaas_payment_id: p.id,
            asaas_customer_id: p.customer,
            cliente_nome: cust?.name || null,
            cliente_cpf_cnpj: cust?.cpfCnpj || null,
            cliente_email: cust?.email || null,
            valor: p.value || 0,
            data_vencimento: due,
            dias_atraso: dias,
            descricao: p.description || null,
            status: "pendente_renegociacao",
            bucket: "d30",
            updated_at: new Date().toISOString(),
          }, { onConflict: "asaas_payment_id" });

          kept++;
        }

        if (items.length < limit) break;
        offset += limit;
      }

      return json({ success: true, total_overdue: total, kept_under_30d: kept });
    }

    // ────────────── LIST GROUPED ──────────────
    if (action === "list-debtors-grouped") {
      const { data, error } = await admin
        .from("cobrancas_vencidas")
        .select("*")
        .eq("status", "pendente_renegociacao")
        .eq("bucket", "d60")
        .order("cliente_nome", { ascending: true });
      if (error) throw error;

      const groups = new Map<string, any>();
      for (const row of data || []) {
        const key = (row.cliente_cpf_cnpj || row.asaas_customer_id || row.cliente_nome || "sem-id") as string;
        if (!groups.has(key)) {
          groups.set(key, {
            key,
            cliente_nome: row.cliente_nome,
            cliente_cpf_cnpj: row.cliente_cpf_cnpj,
            cliente_email: row.cliente_email,
            asaas_customer_id: row.asaas_customer_id,
            parcelas: [],
            total: 0,
          });
        }
        const g = groups.get(key);
        g.parcelas.push(row);
        g.total += Number(row.valor) || 0;
      }

      const result = Array.from(groups.values()).map((g) => {
        const total = round2(g.total);
        const acrescimo = round2(total * 0.10);
        const novoTotal = round2(total + acrescimo);
        const valorParcela = round2(novoTotal / 5);
        // datas dos próximos 5 dias 20
        const first = nextDay20(new Date());
        const datas = [0, 1, 2, 3, 4].map((i) => fmtDate(addMonthsKeepDay20(first, i)));
        return {
          ...g,
          qtd_parcelas: g.parcelas.length,
          total_original: total,
          acrescimo,
          novo_total: novoTotal,
          valor_parcela: valorParcela,
          datas_parcelas: datas,
        };
      });

      return json({ success: true, debtors: result });
    }

    // ────────────── LIST GROUPED 30 (≤30 dias) ──────────────
    if (action === "list-debtors-30-grouped") {
      const { data, error } = await admin
        .from("cobrancas_vencidas")
        .select("*")
        .eq("status", "pendente_renegociacao")
        .eq("bucket", "d30")
        .order("cliente_nome", { ascending: true });
      if (error) throw error;

      const groups = new Map<string, any>();
      for (const row of data || []) {
        const key = (row.cliente_cpf_cnpj || row.asaas_customer_id || row.cliente_nome || "sem-id") as string;
        if (!groups.has(key)) {
          groups.set(key, {
            key,
            cliente_nome: row.cliente_nome,
            cliente_cpf_cnpj: row.cliente_cpf_cnpj,
            cliente_email: row.cliente_email,
            asaas_customer_id: row.asaas_customer_id,
            parcelas: [],
            total: 0,
          });
        }
        const g = groups.get(key);
        g.parcelas.push(row);
        g.total += Number(row.valor) || 0;
      }

      const result = Array.from(groups.values()).map((g) => {
        const total = round2(g.total);
        const acrescimo = round2(total * 0.10);
        const novoTotal = round2(total + acrescimo);
        const valorParcela = round2(novoTotal / 3);
        const first = nextDay20(new Date());
        const datas = [0, 1, 2].map((i) => fmtDate(addMonthsKeepDay20(first, i)));
        return {
          ...g,
          qtd_parcelas: g.parcelas.length,
          total_original: total,
          acrescimo,
          novo_total: novoTotal,
          valor_parcela: valorParcela,
          datas_parcelas: datas,
          cobrar_data: fmtDate(first),
        };
      });

      return json({ success: true, debtors: result });
    }

    // ────────────── NEGOCIAR / COBRAR DEVEDOR (≤30d) ──────────────
    if (action === "negociar-devedor" || action === "cobrar-devedor") {
      const body = await req.json();
      const { cliente_cpf_cnpj, asaas_customer_id, observacao } = body || {};
      if (!asaas_customer_id) return json({ error: "asaas_customer_id obrigatório" }, 400);

      let q = admin.from("cobrancas_vencidas").select("*")
        .eq("status", "pendente_renegociacao").eq("bucket", "d30");
      if (cliente_cpf_cnpj) q = q.eq("cliente_cpf_cnpj", cliente_cpf_cnpj);
      else q = q.eq("asaas_customer_id", asaas_customer_id);
      const { data: parcelas, error: pErr } = await q;
      if (pErr) throw pErr;
      if (!parcelas || parcelas.length === 0) return json({ error: "Nenhuma parcela pendente" }, 400);

      const cliente = parcelas[0];
      const totalOriginal = round2(parcelas.reduce((s, p) => s + (Number(p.valor) || 0), 0));
      const isNegociar = action === "negociar-devedor";
      const acrescimo = isNegociar ? round2(totalOriginal * 0.10) : 0;
      const novoTotal = round2(totalOriginal + acrescimo);
      const numParcelas = isNegociar ? 3 : 1;
      const baseParcela = round2(novoTotal / numParcelas);
      const valores: number[] = [];
      for (let i = 0; i < numParcelas - 1; i++) valores.push(baseParcela);
      valores.push(round2(novoTotal - baseParcela * (numParcelas - 1)));

      const first = nextDay20(new Date());
      const datas = Array.from({ length: numParcelas }, (_, i) => fmtDate(addMonthsKeepDay20(first, i)));

      const motivoBase = isNegociar
        ? `Negociação 3x de ${parcelas.length} parcela(s) vencida(s) - ${cliente.cliente_nome || ""}. Original R$ ${totalOriginal.toFixed(2)} + 10% (R$ ${acrescimo.toFixed(2)}) = R$ ${novoTotal.toFixed(2)}.${observacao ? " Obs: " + observacao : ""}`
        : `Cobrança única (sem taxa) de ${parcelas.length} parcela(s) - ${cliente.cliente_nome || ""}. Total R$ ${totalOriginal.toFixed(2)}.`;

      const { data: neg, error: nErr } = await admin.from("negociacoes_devedor").insert({
        cliente_nome: cliente.cliente_nome,
        cliente_cpf_cnpj: cliente_cpf_cnpj || null,
        asaas_customer_id,
        tipo: isNegociar ? "negociar" : "cobrar",
        valor_original_total: totalOriginal,
        valor_acrescimo: acrescimo,
        valor_total: novoTotal,
        parcelas_originais_ids: parcelas.map((p) => p.asaas_payment_id),
        motivo_cobranca: motivoBase,
        observacao: observacao || null,
        created_by: userId,
      }).select().single();
      if (nErr) throw nErr;

      const created: any[] = [];
      for (let i = 0; i < numParcelas; i++) {
        try {
          const payment = await asaas("/payments", {
            method: "POST",
            body: JSON.stringify({
              customer: asaas_customer_id,
              billingType: "BOLETO",
              dueDate: datas[i],
              value: valores[i],
              description: (isNegociar
                ? `Negociação ${i + 1}/${numParcelas} - ${cliente.cliente_nome || ""}`
                : `Cobrança única - ${cliente.cliente_nome || ""}`).slice(0, 500),
              externalReference: `${isNegociar ? "neg" : "cob"}:${neg.id}:${i + 1}`,
            }),
          });
          await admin.from("parcelas_devedor").insert({
            negociacao_id: neg.id,
            numero_parcela: i + 1,
            asaas_payment_id: payment.id,
            valor: valores[i],
            data_vencimento: datas[i],
            status: payment.status || "PENDING",
            link_boleto: payment.bankSlipUrl || null,
            invoice_url: payment.invoiceUrl || null,
            motivo_cobranca: motivoBase,
          });
          created.push(payment);
        } catch (e) {
          console.error("Falha ao criar parcela devedor", i + 1, e);
          await admin.from("parcelas_devedor").insert({
            negociacao_id: neg.id,
            numero_parcela: i + 1,
            valor: valores[i],
            data_vencimento: datas[i],
            status: "ERROR",
            motivo_cobranca: `${motivoBase} | ERRO: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
      }

      await admin
        .from("cobrancas_vencidas")
        .update({ status: isNegociar ? "renegociada" : "cobrada", updated_at: new Date().toISOString() })
        .in("id", parcelas.map((p) => p.id));

      const primeiraFaturaUrl = created[0]?.invoiceUrl || created[0]?.bankSlipUrl || null;
      let clienteEmail: string | null = cliente.cliente_email || null;
      let clienteTelefone: string | null = null;
      try {
        if (cliente_cpf_cnpj) {
          const { data: prof } = await admin
            .from("profiles").select("email, phone").eq("cpf_cnpj", cliente_cpf_cnpj).maybeSingle();
          if (prof) { clienteEmail = clienteEmail || prof.email || null; clienteTelefone = prof.phone || null; }
        }
        if ((!clienteEmail || !clienteTelefone) && asaas_customer_id) {
          const cust = await asaas(`/customers/${asaas_customer_id}`).catch(() => null);
          if (cust) {
            clienteEmail = clienteEmail || cust.email || null;
            clienteTelefone = clienteTelefone || cust.mobilePhone || cust.phone || null;
          }
        }
      } catch (e) { console.warn("resolve contato falhou", e); }

      return json({
        success: true,
        negociacao_id: neg.id,
        tipo: isNegociar ? "negociar" : "cobrar",
        parcelas_criadas: created.length,
        primeira_fatura_url: primeiraFaturaUrl,
        valor_original: totalOriginal,
        valor_acrescimo: acrescimo,
        valor_total: novoTotal,
        cliente_nome: cliente.cliente_nome || null,
        cliente_email: clienteEmail,
        cliente_telefone: clienteTelefone,
      });
    }

    // ────────────── RENEGOTIATE ──────────────
    if (action === "renegotiate") {
      const body = await req.json();
      const { cliente_cpf_cnpj, asaas_customer_id, observacao } = body || {};
      if (!asaas_customer_id) return json({ error: "asaas_customer_id obrigatório" }, 400);

      // pega parcelas vencidas desse cliente
      let q = admin.from("cobrancas_vencidas").select("*").eq("status", "pendente_renegociacao");
      if (cliente_cpf_cnpj) q = q.eq("cliente_cpf_cnpj", cliente_cpf_cnpj);
      else q = q.eq("asaas_customer_id", asaas_customer_id);
      const { data: parcelas, error: pErr } = await q;
      if (pErr) throw pErr;
      if (!parcelas || parcelas.length === 0) return json({ error: "Nenhuma parcela pendente" }, 400);

      const totalOriginal = round2(parcelas.reduce((s, p) => s + (Number(p.valor) || 0), 0));
      const acrescimo = round2(totalOriginal * 0.10);
      const novoTotal = round2(totalOriginal + acrescimo);
      const baseParcela = round2(novoTotal / 5);
      // ajuste de centavos na última parcela
      const valores = [baseParcela, baseParcela, baseParcela, baseParcela, round2(novoTotal - baseParcela * 4)];

      const first = nextDay20(new Date());
      const datas = [0, 1, 2, 3, 4].map((i) => fmtDate(addMonthsKeepDay20(first, i)));

      const cliente = parcelas[0];
      const motivoBase = `Renegociação de ${parcelas.length} parcela(s) vencida(s) do cliente ${cliente.cliente_nome || ""} (${cliente_cpf_cnpj || asaas_customer_id}). ` +
        `Valor original somado: R$ ${totalOriginal.toFixed(2)}. Acréscimo de 10%: R$ ${acrescimo.toFixed(2)}. ` +
        `Novo total: R$ ${novoTotal.toFixed(2)} dividido em 5x de R$ ${baseParcela.toFixed(2)} (vencimento sempre no dia 20). ` +
        `Parcelas originais agrupadas: ${parcelas.map((p) => `${p.asaas_payment_id} (R$ ${Number(p.valor).toFixed(2)} venc. ${p.data_vencimento})`).join("; ")}.` +
        (observacao ? ` Observação: ${observacao}` : "");

      // cria registro de renegociação
      const { data: reneg, error: rErr } = await admin.from("renegociacoes").insert({
        cliente_nome: cliente.cliente_nome,
        cliente_cpf_cnpj: cliente_cpf_cnpj || null,
        asaas_customer_id,
        valor_original_total: totalOriginal,
        valor_acrescimo: acrescimo,
        valor_renegociado: novoTotal,
        parcelas_originais_ids: parcelas.map((p) => p.asaas_payment_id),
        motivo_cobranca: motivoBase,
        observacao: observacao || null,
        created_by: userId,
      }).select().single();
      if (rErr) throw rErr;

      // gera 5 boletos no Asaas
      const created: any[] = [];
      for (let i = 0; i < 5; i++) {
        const motivoParcela = `${motivoBase} | Parcela ${i + 1}/5 - vencimento ${datas[i]} - valor R$ ${valores[i].toFixed(2)}`;
        try {
          const payment = await asaas("/payments", {
            method: "POST",
            body: JSON.stringify({
              customer: asaas_customer_id,
              billingType: "BOLETO",
              dueDate: datas[i],
              value: valores[i],
              description: `Renegociação ${i + 1}/5 - ${cliente.cliente_nome || ""}`.slice(0, 500),
              externalReference: `reneg:${reneg.id}:${i + 1}`,
            }),
          });
          await admin.from("parcelas_renegociadas").insert({
            renegociacao_id: reneg.id,
            numero_parcela: i + 1,
            asaas_payment_id: payment.id,
            valor: valores[i],
            data_vencimento: datas[i],
            status: payment.status || "PENDING",
            link_boleto: payment.bankSlipUrl || null,
            invoice_url: payment.invoiceUrl || null,
            motivo_cobranca: motivoParcela,
          });
          created.push(payment);
        } catch (e) {
          console.error("Falha ao criar parcela", i + 1, e);
          await admin.from("parcelas_renegociadas").insert({
            renegociacao_id: reneg.id,
            numero_parcela: i + 1,
            valor: valores[i],
            data_vencimento: datas[i],
            status: "ERROR",
            motivo_cobranca: `${motivoParcela} | ERRO: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
      }

      // marca parcelas originais como renegociadas
      await admin
        .from("cobrancas_vencidas")
        .update({ status: "renegociada", updated_at: new Date().toISOString() })
        .in("id", parcelas.map((p) => p.id));

      // ── extra info para o front disparar notificação ──
      const primeiraFaturaUrl = created[0]?.invoiceUrl || created[0]?.bankSlipUrl || null;
      const diasMax = parcelas.reduce((mx, p) => {
        if (!p.data_vencimento) return mx;
        const d = daysBetween(p.data_vencimento);
        return d > mx ? d : mx;
      }, 0);

      // tentar resolver email/telefone do cliente
      let clienteEmail: string | null = cliente.cliente_email || null;
      let clienteTelefone: string | null = (cliente as any).cliente_telefone || null;
      try {
        if (cliente_cpf_cnpj) {
          const { data: prof } = await admin
            .from("profiles")
            .select("email, phone")
            .eq("cpf_cnpj", cliente_cpf_cnpj)
            .maybeSingle();
          if (prof) {
            clienteEmail = clienteEmail || prof.email || null;
            clienteTelefone = clienteTelefone || prof.phone || null;
          }
        }
        if ((!clienteEmail || !clienteTelefone) && asaas_customer_id) {
          const cust = await asaas(`/customers/${asaas_customer_id}`).catch(() => null);
          if (cust) {
            clienteEmail = clienteEmail || cust.email || null;
            clienteTelefone = clienteTelefone || cust.mobilePhone || cust.phone || null;
          }
        }
      } catch (e) {
        console.warn("resolve cliente contato falhou", e);
      }

      return json({
        success: true,
        renegociacao_id: reneg.id,
        parcelas_criadas: created.length,
        primeira_fatura_url: primeiraFaturaUrl,
        valor_debito_original: totalOriginal,
        dias_vencimento_max: diasMax,
        cliente_nome: cliente.cliente_nome || null,
        cliente_email: clienteEmail,
        cliente_telefone: clienteTelefone,
      });
    }

    // ────────────── REFRESH STATUS ──────────────
    if (action === "refresh-installment-status") {
      const { data: parcelas } = await admin
        .from("parcelas_renegociadas")
        .select("id, asaas_payment_id")
        .not("asaas_payment_id", "is", null)
        .neq("status", "RECEIVED");
      let updated = 0;
      for (const p of parcelas || []) {
        try {
          const pay = await asaas(`/payments/${p.asaas_payment_id}`);
          await admin.from("parcelas_renegociadas").update({
            status: pay.status,
            link_boleto: pay.bankSlipUrl || null,
            invoice_url: pay.invoiceUrl || null,
            updated_at: new Date().toISOString(),
          }).eq("id", p.id);
          updated++;
        } catch (e) { console.warn("refresh fail", p.id, e); }
      }
      return json({ success: true, updated });
    }

    // ────────────── TEST CONNECTION ──────────────
    if (action === "test-connection") {
      const me = await asaas(`/myAccount`);
      return json({ success: true, env: ASAAS_ENV, account: { name: me?.name, email: me?.email } });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("asaas-debtors-api error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});