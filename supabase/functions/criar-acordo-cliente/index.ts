import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cancelarCobrancaAsaas, registrarTratamento, MOTIVOS, PAID_STATUSES } from "../_shared/crmCobranca.ts";

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

const FINANCEIRO_WEBHOOK =
  "https://new-backend.botconversa.com.br/api/v1/webhooks-automation/catch/17504/Z6cCNjvBc9uv/";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

/** Soma meses preservando o dia; quando o dia não existe, usa o último dia do mês. */
function addMonthsKeepDay(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const targetMonthIndex = m - 1 + months;
  const year = y + Math.floor(targetMonthIndex / 12);
  const month = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Divide o total em centavos igualmente; a diferença fica na última parcela. */
function dividirCentavos(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const arr = Array.from({ length: n }, () => base);
  arr[n - 1] = total - base * (n - 1);
  return arr;
}

async function asaas(path: string, init: RequestInit = {}) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    ...init,
    headers: { access_token: ASAAS_API_KEY, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const text = await res.text();
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text.slice(0, 400) }; }
  if (!res.ok) {
    const err: any = new Error(`Asaas ${res.status} ${init.method || "GET"} ${path}`);
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
  return parsed;
}

/** Resumo enxuto da resposta do Asaas para auditoria (sem tokens/segredos). */
const resumoAsaas = (p: any) => p ? {
  id: p.id, status: p.status, value: p.value, dueDate: p.dueDate,
  invoiceUrl: p.invoiceUrl || null, bankSlipUrl: p.bankSlipUrl || null,
} : null;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    if (!ASAAS_API_KEY) return json({ error: "Integração Asaas não configurada" }, 503);

    // ── Autenticação + permissão financeira ───────────────────────────────
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
    const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await asUser.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Sessão inválida" }, 401);

    const { data: allowed } = await admin.rpc("has_financial_permission", { _user_id: user.id });
    if (allowed !== true) return json({ error: "Sem permissão financeira para esta operação" }, 403);

    const body = await req.json().catch(() => ({}));
    const action: string = body.action || "criar";
    const sessionInfo = {
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      user_agent: (req.headers.get("user-agent") || "").slice(0, 200) || null,
    };

    // ══════════════════════════ RETRY DO CANCELAMENTO ══════════════════════
    if (action === "retry-cancelamento") {
      const acordoId: string = body.acordo_id;
      if (!acordoId) return json({ error: "acordo_id é obrigatório" }, 400);
      const { data: acordo } = await admin.from("acordos_cliente").select("*").eq("id", acordoId).maybeSingle();
      if (!acordo) return json({ error: "Acordo não encontrado" }, 404);
      if (acordo.cancelamento_status === "cancelado" || acordo.cancelamento_status === "ja_cancelado") {
        return json({ success: true, already: true, cancelamento_status: acordo.cancelamento_status });
      }
      if (!acordo.asaas_payment_id_original) return json({ error: "Cobrança original sem identificador no Asaas" }, 400);

      const cancel = await cancelarCobrancaAsaas(ASAAS_BASE, ASAAS_API_KEY, acordo.asaas_payment_id_original);
      const ok = cancel.status === "cancelado" || cancel.status === "ja_cancelado";
      await admin.from("acordos_cliente").update({
        cancelamento_status: cancel.status,
        cancelamento_resposta: { message: cancel.message, asaas_status: cancel.asaas_status, http_status: cancel.http_status },
        cancelamento_em: new Date().toISOString(),
        status: ok ? "ativo" : acordo.status,
        auditoria: { ...(acordo.auditoria || {}), retry_cancelamento: [
          ...((acordo.auditoria || {}).retry_cancelamento || []),
          { em: new Date().toISOString(), por: user.id, resultado: cancel.status, ...sessionInfo },
        ] },
      }).eq("id", acordoId);

      if (ok && acordo.invoice_original_id) {
        await admin.from("invoices").update({ status: "cancelled", acordo_id: acordoId }).eq("id", acordo.invoice_original_id);
      }
      return json({ success: ok, cancelamento_status: cancel.status, message: cancel.message });
    }

    // ══════════════════════════ ENVIO DO ACORDO ════════════════════════════
    if (action === "enviar-acordo") {
      const acordoId: string = body.acordo_id;
      const confirmarIncompleto: boolean = !!body.confirmar_incompleto;
      if (!acordoId) return json({ error: "acordo_id é obrigatório" }, 400);

      const { data: acordo } = await admin.from("acordos_cliente").select("*").eq("id", acordoId).maybeSingle();
      if (!acordo) return json({ error: "Acordo não encontrado" }, 404);
      if (acordo.status !== "ativo" && !confirmarIncompleto) {
        return json({ error: "Acordo ainda não está ativo", needs_confirmation: true }, 409);
      }
      const cancelOk = acordo.cancelamento_status === "cancelado" || acordo.cancelamento_status === "ja_cancelado";
      if (!cancelOk && !confirmarIncompleto) {
        return json({ error: "A cobrança original ainda não foi cancelada no Asaas", needs_confirmation: true }, 409);
      }

      const { data: parcelas } = await admin.from("acordo_parcelas")
        .select("*").eq("acordo_id", acordoId).order("numero_parcela");

      let nome = acordo.cliente_nome || "Cliente";
      let email = "", phone = "";
      if (acordo.user_id) {
        const { data: prof } = await admin.from("profiles").select("full_name,email,phone").eq("id", acordo.user_id).maybeSingle();
        if (prof) { nome = prof.full_name || nome; email = prof.email || ""; phone = prof.phone || ""; }
      }

      const linhas = (parcelas || []).map((p: any) =>
        `Parcela ${p.numero_parcela}/${acordo.num_parcelas} — ${brl(Number(p.valor_centavos))} — vence ${fmtDate(p.data_vencimento)}${p.invoice_url ? `\n${p.invoice_url}` : ""}`);
      const waMsg = `Olá, *${nome.split(" ")[0]}*!

Seu acordo foi registrado com sucesso. ✅

💰 Valor total: *${brl(Number(acordo.total_centavos))}*
📈 Juros aplicados: *${Number(acordo.juros_percentual)}%* (${brl(Number(acordo.juros_centavos))})
🗓️ Parcelas: *${acordo.num_parcelas}x*

${linhas.join("\n\n")}

Qualquer dúvida é só responder por aqui.

Atenciosamente,
Equipe WebMarcas`;

      const linhasHtml = (parcelas || []).map((p: any) =>
        `<li><strong>Parcela ${p.numero_parcela}/${acordo.num_parcelas}</strong> — ${brl(Number(p.valor_centavos))} — vence ${fmtDate(p.data_vencimento)}${p.invoice_url ? ` — <a href="${p.invoice_url}" target="_blank" rel="noopener">acessar boleto</a>` : ""}</li>`).join("");
      const emailHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;line-height:1.6">
  <h2 style="color:#0a3d62">Acordo registrado — WebMarcas</h2>
  <p>Olá, <strong>${nome.split(" ")[0]}</strong>!</p>
  <p>Seu acordo foi registrado com sucesso.</p>
  <p><strong>Valor total:</strong> ${brl(Number(acordo.total_centavos))}<br>
     <strong>Juros aplicados:</strong> ${Number(acordo.juros_percentual)}% (${brl(Number(acordo.juros_centavos))})<br>
     <strong>Parcelas:</strong> ${acordo.num_parcelas}x</p>
  <ul>${linhasHtml}</ul>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:13px;color:#666">Atenciosamente,<br><strong>Equipe WebMarcas</strong><br>🌐 www.webmarcas.net · 📧 ola@webmarcas.net</p>
</div>`;

      const channels: string[] = [];
      if (phone) channels.push("whatsapp");
      if (email) channels.push("email");
      if (channels.length === 0) return json({ error: "Cliente sem telefone e sem e-mail cadastrados" }, 400);

      const { data: notif, error: notifErr } = await admin.functions.invoke("send-multichannel-notification", {
        body: {
          event_type: "manual",
          channels,
          recipient: { nome, email, phone },
          custom_message: waMsg,
          custom_html: emailHtml,
          custom_subject: `Acordo registrado — ${acordo.num_parcelas}x — WebMarcas`,
          data: { marca: "seu acordo" },
          whatsapp_webhook_override: FINANCEIRO_WEBHOOK,
        },
      });

      await admin.from("acordos_cliente").update({
        enviado_em: new Date().toISOString(),
        enviado_canais: channels,
        auditoria: { ...(acordo.auditoria || {}), envios: [
          ...((acordo.auditoria || {}).envios || []),
          { em: new Date().toISOString(), por: user.id, canais: channels, erro: notifErr?.message || null, incompleto: !cancelOk, ...sessionInfo },
        ] },
      }).eq("id", acordoId);

      if (acordo.user_id) {
        await admin.from("client_activities").insert({
          user_id: acordo.user_id, admin_id: user.id, activity_type: "acordo_enviado",
          description: `Acordo enviado por ${channels.join(" e ")}`,
          metadata: { acordo_id: acordoId, canais: channels, erro: notifErr?.message || null },
        });
      }

      return json({
        success: true,
        channels,
        whatsapp: channels.includes("whatsapp") ? (notifErr ? "falhou" : "enviado") : "sem telefone cadastrado",
        email: channels.includes("email") ? (notifErr ? "falhou" : "enviado") : "sem e-mail cadastrado",
      });
    }

    // ══════════════════════════ CRIAÇÃO DO ACORDO ══════════════════════════
    if (action !== "criar") return json({ error: "Ação desconhecida" }, 400);

    const invoiceId: string = body.invoice_id;
    const crmActionId: string = body.crm_action_id;
    const numParcelas = Number(body.num_parcelas);
    const jurosPercentual = Number(body.juros_percentual);
    const primeiraData: string = body.primeira_parcela_data;
    const previewTotalCentavos = body.preview_total_centavos != null ? Number(body.preview_total_centavos) : null;

    if (!invoiceId) return json({ error: "invoice_id é obrigatório" }, 400);
    if (!crmActionId) return json({ error: "crm_action_id é obrigatório" }, 400);
    if (!Number.isInteger(numParcelas) || numParcelas < 1 || numParcelas > 24) {
      return json({ error: "Quantidade de parcelas inválida (1 a 24)" }, 400);
    }
    if (!Number.isFinite(jurosPercentual) || jurosPercentual < 0 || jurosPercentual > 200) {
      return json({ error: "Percentual de juros inválido" }, 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(primeiraData || "")) {
      return json({ error: "Data da primeira parcela inválida" }, 400);
    }

    // Idempotência forte: mesma requisição repetida devolve o acordo existente.
    const { data: existente } = await admin.from("acordos_cliente")
      .select("*").eq("crm_action_id", crmActionId).maybeSingle();
    if (existente) {
      return json({ success: existente.status === "ativo", duplicated: true, acordo_id: existente.id, status: existente.status });
    }

    // Um único acordo ativo/processando por fatura original.
    const { data: ativo } = await admin.from("acordos_cliente")
      .select("id, status, bloqueado_por_pendencia")
      .eq("invoice_original_id", invoiceId)
      .in("status", ["processando", "ativo", "falha_pendente"])
      .maybeSingle();
    if (ativo) {
      return json({
        error: ativo.status === "falha_pendente"
          ? "Existe uma pendência de cancelamento nesta cobrança. Resolva antes de gerar um novo acordo."
          : "Esta cobrança já possui um acordo em andamento.",
        acordo_id: ativo.id,
      }, 409);
    }

    const { data: invoice } = await admin.from("invoices")
      .select("id, user_id, amount, due_date, status, description, asaas_invoice_id, asaas_customer_id, profiles:user_id(full_name,email,phone,cpf_cnpj)")
      .eq("id", invoiceId).maybeSingle();
    if (!invoice) return json({ error: "Fatura não encontrada" }, 404);
    if (!invoice.asaas_invoice_id) return json({ error: "Fatura sem vínculo com o Asaas" }, 400);

    // 1. Reconsulta a situação real no Asaas
    let original: any;
    try {
      original = await asaas(`/payments/${invoice.asaas_invoice_id}`);
    } catch (e: any) {
      return json({ error: "Não foi possível consultar a cobrança no Asaas", status: e.status || null }, 502);
    }
    const stOriginal = String(original?.status || "").toUpperCase();
    if (PAID_STATUSES.includes(stOriginal)) {
      await admin.from("invoices").update({
        status: "paid",
        payment_date: original.paymentDate || original.clientPaymentDate || new Date().toISOString().slice(0, 10),
      }).eq("id", invoiceId);
      return json({ error: "Esta cobrança já consta como paga no Asaas — acordo não permitido", asaas_status: stOriginal }, 409);
    }
    if (["DELETED", "REFUNDED", "REFUND_REQUESTED", "REFUND_IN_PROGRESS", "CHARGEBACK_REQUESTED"].includes(stOriginal)) {
      return json({ error: `Cobrança com situação ${stOriginal} no Asaas — acordo não permitido`, asaas_status: stOriginal }, 409);
    }

    const customerId = original.customer || invoice.asaas_customer_id;
    if (!customerId) return json({ error: "Cliente sem cadastro no Asaas" }, 400);

    // 2. Cálculo definitivo em centavos inteiros
    const valorOriginalCentavos = Math.round(Number(original.value ?? invoice.amount) * 100);
    if (!Number.isFinite(valorOriginalCentavos) || valorOriginalCentavos <= 0) {
      return json({ error: "Valor da cobrança inválido" }, 400);
    }
    const jurosCentavos = Math.round(valorOriginalCentavos * (jurosPercentual / 100));
    const totalCentavos = valorOriginalCentavos + jurosCentavos;
    const valores = dividirCentavos(totalCentavos, numParcelas);
    if (valores.some((v) => v <= 0)) {
      return json({ error: "Parcelas com valor zerado — reduza a quantidade de parcelas" }, 400);
    }
    const datas = Array.from({ length: numParcelas }, (_, i) => addMonthsKeepDay(primeiraData, i));

    const profile: any = (invoice as any).profiles || {};
    const clienteNome = profile.full_name || original.customerName || "Cliente";

    const { data: acordo, error: acErr } = await admin.from("acordos_cliente").insert({
      crm_action_id: crmActionId,
      invoice_original_id: invoiceId,
      asaas_payment_id_original: invoice.asaas_invoice_id,
      user_id: invoice.user_id,
      cliente_nome: clienteNome,
      asaas_customer_id: customerId,
      valor_original_centavos: valorOriginalCentavos,
      juros_percentual: jurosPercentual,
      juros_centavos: jurosCentavos,
      total_centavos: totalCentavos,
      num_parcelas: numParcelas,
      primeira_parcela_data: primeiraData,
      billing_type: "BOLETO",
      status: "processando",
      created_by: user.id,
      auditoria: {
        preview_total_centavos: previewTotalCentavos,
        backend_total_centavos: totalCentavos,
        preview_divergente: previewTotalCentavos != null && previewTotalCentavos !== totalCentavos,
        asaas_original: resumoAsaas(original),
        sessao: sessionInfo,
        criado_por: user.id,
      },
    }).select().single();
    if (acErr) {
      if ((acErr as any).code === "23505") {
        return json({ error: "Já existe um acordo para esta cobrança." }, 409);
      }
      throw acErr;
    }

    // 3. Cria as parcelas no Asaas
    const criadas: any[] = [];
    const tentativas: any[] = [];
    let falha: string | null = null;
    for (let i = 0; i < numParcelas; i++) {
      try {
        const pay = await asaas("/payments", {
          method: "POST",
          body: JSON.stringify({
            customer: customerId,
            billingType: "BOLETO",
            dueDate: datas[i],
            value: Number((valores[i] / 100).toFixed(2)),
            description: `Acordo ${i + 1}/${numParcelas} — ${(invoice.description || "débito em aberto").slice(0, 100)}`.slice(0, 500),
            externalReference: `acordo:${acordo.id}:${i + 1}`,
          }),
        });
        await admin.from("acordo_parcelas").insert({
          acordo_id: acordo.id,
          numero_parcela: i + 1,
          valor_centavos: valores[i],
          data_vencimento: datas[i],
          asaas_payment_id: pay.id,
          status: pay.status || "PENDING",
          invoice_url: pay.invoiceUrl || null,
          link_boleto: pay.bankSlipUrl || null,
        });
        criadas.push(pay);
        tentativas.push({ parcela: i + 1, ok: true, resposta: resumoAsaas(pay) });
      } catch (e: any) {
        falha = `Falha ao criar a parcela ${i + 1}: ${e?.body?.errors?.[0]?.description || e.message}`;
        tentativas.push({ parcela: i + 1, ok: false, status: e.status || null, erro: String(e?.body?.errors?.[0]?.description || e.message).slice(0, 300) });
        break;
      }
    }

    // 3b. Falha parcial → compensação: cancela o que já foi criado, nunca cancela a original
    if (falha) {
      const compensacoes: any[] = [];
      let pendencia = false;
      for (const pay of criadas) {
        const c = await cancelarCobrancaAsaas(ASAAS_BASE, ASAAS_API_KEY, pay.id);
        const ok = c.status === "cancelado" || c.status === "ja_cancelado";
        if (!ok) pendencia = true;
        compensacoes.push({ asaas_payment_id: pay.id, status: c.status, message: c.message });
        await admin.from("acordo_parcelas")
          .update({ compensacao_status: c.status, compensacao_resposta: { message: c.message, asaas_status: c.asaas_status }, status: ok ? "CANCELLED" : "COMPENSACAO_PENDENTE" })
          .eq("acordo_id", acordo.id).eq("asaas_payment_id", pay.id);
      }
      await admin.from("acordos_cliente").update({
        status: pendencia ? "falha_pendente" : "falha_criacao",
        bloqueado_por_pendencia: pendencia,
        compensacao_resultado: { compensacoes, motivo: falha },
        auditoria: { ...(acordo.auditoria || {}), tentativas },
      }).eq("id", acordo.id);

      return json({
        error: falha,
        acordo_id: acordo.id,
        parcelas_compensadas: compensacoes.length,
        compensacoes,
        pendencia_critica: pendencia,
        aviso: pendencia
          ? "ALERTA CRÍTICO: parcelas criadas no Asaas não puderam ser canceladas. Resolva manualmente antes de tentar um novo acordo."
          : "Nenhuma cobrança foi cancelada — a fatura original continua ativa.",
      }, 502);
    }

    // 4. Validações antes de tocar na cobrança original
    const { data: salvas } = await admin.from("acordo_parcelas").select("*").eq("acordo_id", acordo.id);
    const somaSalva = (salvas || []).reduce((s: number, p: any) => s + Number(p.valor_centavos), 0);
    const todasComId = (salvas || []).every((p: any) => !!p.asaas_payment_id);
    const integro = (salvas || []).length === numParcelas && criadas.length === numParcelas && somaSalva === totalCentavos && todasComId;

    let cancel: any = { status: "nao_executado", message: "Validação de integridade falhou — cobrança original preservada" };
    if (integro) {
      let aindaAberta = true;
      try {
        const recheck = await asaas(`/payments/${invoice.asaas_invoice_id}`);
        const st = String(recheck?.status || "").toUpperCase();
        aindaAberta = !PAID_STATUSES.includes(st) && st !== "DELETED";
      } catch { aindaAberta = true; }
      if (aindaAberta) {
        cancel = await cancelarCobrancaAsaas(ASAAS_BASE, ASAAS_API_KEY, invoice.asaas_invoice_id);
      } else {
        cancel = { status: "nao_aplicavel", message: "Cobrança original já não estava em aberto no Asaas" };
      }
    }
    const cancelOk = cancel.status === "cancelado" || cancel.status === "ja_cancelado" || cancel.status === "nao_aplicavel";
    const agora = new Date().toISOString();

    await admin.from("acordos_cliente").update({
      status: integro && cancelOk ? "ativo" : "falha_pendente",
      bloqueado_por_pendencia: !(integro && cancelOk),
      cancelamento_status: cancel.status,
      cancelamento_resposta: { message: cancel.message, asaas_status: cancel.asaas_status ?? null, http_status: cancel.http_status ?? null },
      cancelamento_em: agora,
      auditoria: { ...(acordo.auditoria || {}), tentativas, integridade: { soma_centavos: somaSalva, total_centavos: totalCentavos, todas_com_id: todasComId } },
    }).eq("id", acordo.id);

    // 5. Dados locais
    if (cancelOk && cancel.status !== "nao_aplicavel") {
      await admin.from("invoices").update({ status: "cancelled", acordo_id: acordo.id, updated_at: agora }).eq("id", invoiceId);
    } else {
      await admin.from("invoices").update({ acordo_id: acordo.id, updated_at: agora }).eq("id", invoiceId);
    }

    for (const pay of criadas) {
      await admin.from("invoices").update({
        originado_pelo_crm: true,
        acordo_id: acordo.id,
        crm_action_id: crmActionId,
        cobranca_origem_id: invoice.asaas_invoice_id,
      }).eq("asaas_invoice_id", pay.id);
    }

    await registrarTratamento(admin, {
      crm_action_id: crmActionId,
      tipo_acao: "acordo",
      motivo: MOTIVOS.acordo,
      cliente_nome: clienteNome,
      cliente_cpf_cnpj: profile.cpf_cnpj || null,
      cliente_user_id: invoice.user_id,
      asaas_customer_id: customerId,
      invoice_original_id: invoiceId,
      asaas_payment_id_original: invoice.asaas_invoice_id,
      valor_original: valorOriginalCentavos / 100,
      vencimento_original: invoice.due_date,
      nova_cobranca_asaas_id: criadas[0]?.id || null,
      novo_boleto_url: criadas[0]?.invoiceUrl || criadas[0]?.bankSlipUrl || null,
      novo_vencimento: datas[0],
      novo_valor: valores[0] / 100,
      cancelamento_status: cancel.status,
      cancelamento_resposta: { message: cancel.message, asaas_status: cancel.asaas_status ?? null },
      cancelamento_em: agora,
      status_negociacao: integro && cancelOk ? "ativa" : "pendente",
      responsavel_id: user.id,
      observacao: `Acordo ${numParcelas}x com ${jurosPercentual}% de juros — total ${brl(totalCentavos)}`,
      novos_boletos_asaas_ids: criadas.map((c) => c.id),
      updated_at: agora,
    });

    if (invoice.user_id) {
      await admin.from("client_activities").insert({
        user_id: invoice.user_id, admin_id: user.id, activity_type: "acordo_criado",
        description: `Acordo de ${numParcelas}x criado — total ${brl(totalCentavos)} (juros ${jurosPercentual}%)`,
        metadata: {
          acordo_id: acordo.id, crm_action_id: crmActionId,
          valor_original: valorOriginalCentavos / 100, juros_percentual: jurosPercentual,
          juros: jurosCentavos / 100, total: totalCentavos / 100, num_parcelas: numParcelas,
          asaas_ids: criadas.map((c) => c.id), cancelamento: cancel.status, sessao: sessionInfo,
        },
      });
    }

    return json({
      success: integro && cancelOk,
      acordo_id: acordo.id,
      parcelas_criadas: criadas.length,
      total_centavos: totalCentavos,
      juros_centavos: jurosCentavos,
      cancelamento_status: cancel.status,
      cancelamento_ok: cancelOk,
      aviso: cancelOk ? null : `As parcelas foram criadas, mas a cobrança original NÃO foi cancelada no Asaas (${cancel.message}). Use "Tentar cancelar novamente".`,
    });
  } catch (e) {
    console.error("criar-acordo-cliente error", e instanceof Error ? e.message : String(e));
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
