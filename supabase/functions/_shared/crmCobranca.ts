// Utilitários compartilhados do módulo Financeiro:
// identificação de cobranças originadas pelo CRM (anti-loop) e
// cancelamento auditável do boleto original no Asaas.

export const MOTIVOS = {
  cobranca: "COBRANÇA REALIZADA",
  negociacao: "NEGOCIAÇÃO REALIZADA",
  novo_boleto: "NOVO BOLETO GERADO",
  acordo: "ACORDO REALIZADO",
  outra: "OUTRA AÇÃO",
} as const;

export const PAID_STATUSES = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];
const CANCELAVEIS = ["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS", "AWAITING_CHARGEBACK_REVERSAL"];

export type CancelResult = {
  status: "cancelado" | "ja_cancelado" | "nao_aplicavel" | "falhou";
  asaas_status: string | null;
  http_status: number | null;
  response: unknown;
  message: string;
};

/**
 * Consulta o status atual da cobrança no Asaas e executa a operação de
 * cancelamento permitida para aquele status. Nunca devolve "cancelado" sem
 * confirmação explícita da API.
 */
export async function cancelarCobrancaAsaas(
  base: string,
  apiKey: string,
  paymentId: string,
): Promise<CancelResult> {
  if (!apiKey) {
    return { status: "falhou", asaas_status: null, http_status: null, response: null, message: "ASAAS_API_KEY ausente" };
  }
  const headers = { access_token: apiKey, "Content-Type": "application/json" };
  let current: any = null;
  let getStatus: number | null = null;
  try {
    const res = await fetch(`${base}/payments/${paymentId}`, { headers });
    getStatus = res.status;
    const text = await res.text();
    if (res.status === 404) {
      return { status: "ja_cancelado", asaas_status: "NOT_FOUND", http_status: 404, response: text.slice(0, 500), message: "Cobrança não existe mais no Asaas" };
    }
    if (!res.ok) {
      return { status: "falhou", asaas_status: null, http_status: res.status, response: text.slice(0, 500), message: `Falha ao consultar cobrança (${res.status})` };
    }
    current = text ? JSON.parse(text) : null;
  } catch (e) {
    return { status: "falhou", asaas_status: null, http_status: getStatus, response: String(e), message: "Erro de rede ao consultar o Asaas" };
  }

  const st = String(current?.status || "").toUpperCase();
  if (st === "DELETED") {
    return { status: "ja_cancelado", asaas_status: st, http_status: 200, response: { deleted: true }, message: "Cobrança já estava excluída no Asaas" };
  }
  if (PAID_STATUSES.includes(st)) {
    return { status: "nao_aplicavel", asaas_status: st, http_status: 200, response: { status: st }, message: "Cobrança já recebida/confirmada — só pode ser estornada manualmente" };
  }
  if (st === "REFUNDED" || st === "CHARGEBACK_REQUESTED" || st === "REFUND_REQUESTED") {
    return { status: "nao_aplicavel", asaas_status: st, http_status: 200, response: { status: st }, message: `Status ${st} não permite exclusão` };
  }
  if (!CANCELAVEIS.includes(st)) {
    return { status: "nao_aplicavel", asaas_status: st, http_status: 200, response: { status: st }, message: `Status ${st} não permite exclusão automática` };
  }

  try {
    const res = await fetch(`${base}/payments/${paymentId}`, { method: "DELETE", headers });
    const text = await res.text();
    let parsed: any = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text.slice(0, 500); }
    if (res.ok && (parsed?.deleted === true || parsed?.deleted === undefined)) {
      if (parsed?.deleted === true) {
        return { status: "cancelado", asaas_status: st, http_status: res.status, response: parsed, message: "Boleto original cancelado no Asaas" };
      }
      return { status: "falhou", asaas_status: st, http_status: res.status, response: parsed, message: "Asaas não confirmou a exclusão" };
    }
    return { status: "falhou", asaas_status: st, http_status: res.status, response: parsed, message: `Asaas recusou a exclusão (${res.status})` };
  } catch (e) {
    return { status: "falhou", asaas_status: st, http_status: null, response: String(e), message: "Erro de rede ao excluir no Asaas" };
  }
}

/**
 * Dado um lote de asaas_payment_id, devolve o subconjunto que tem origem no
 * CRM (parcela de negociação/renegociação, fatura marcada, ou dívida já
 * tratada em cobranca_tratamentos). Sempre consultado por lote — nunca
 * carrega tabelas inteiras, então não depende do limite de 1.000 linhas.
 */
export async function getCrmOriginSet(admin: any, ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const clean = Array.from(new Set((ids || []).filter(Boolean)));
  if (clean.length === 0) return out;

  const CHUNK = 200;
  for (let i = 0; i < clean.length; i += CHUNK) {
    const chunk = clean.slice(i, i + CHUNK);
    const [pd, pr, inv, cv, tratNovo, tratOrig, tratLista] = await Promise.all([
      admin.from("parcelas_devedor").select("asaas_payment_id").in("asaas_payment_id", chunk),
      admin.from("parcelas_renegociadas").select("asaas_payment_id").in("asaas_payment_id", chunk),
      admin.from("invoices").select("asaas_invoice_id").eq("originado_pelo_crm", true).in("asaas_invoice_id", chunk),
      admin.from("cobrancas_vencidas").select("asaas_payment_id").eq("originado_pelo_crm", true).in("asaas_payment_id", chunk),
      admin.from("cobranca_tratamentos").select("nova_cobranca_asaas_id").in("nova_cobranca_asaas_id", chunk),
      admin.from("cobranca_tratamentos").select("asaas_payment_id_original").in("asaas_payment_id_original", chunk),
      admin.from("cobranca_tratamentos").select("novos_boletos_asaas_ids").overlaps("novos_boletos_asaas_ids", chunk),
    ]);
    const chunkSet = new Set(chunk);
    for (const r of pd.data || []) out.add(r.asaas_payment_id);
    for (const r of pr.data || []) out.add(r.asaas_payment_id);
    for (const r of inv.data || []) out.add(r.asaas_invoice_id);
    for (const r of cv.data || []) out.add(r.asaas_payment_id);
    for (const r of tratNovo.data || []) out.add(r.nova_cobranca_asaas_id);
    for (const r of tratOrig.data || []) out.add(r.asaas_payment_id_original);
    for (const r of tratLista.data || []) {
      for (const id of r.novos_boletos_asaas_ids || []) if (chunkSet.has(id)) out.add(id);
    }
  }
  return out;
}

/** Registra (de forma idempotente) o tratamento de uma dívida no histórico. */
export async function registrarTratamento(admin: any, row: Record<string, unknown>) {
  const { error } = await admin
    .from("cobranca_tratamentos")
    .upsert(row, { onConflict: "asaas_payment_id_original,crm_action_id", ignoreDuplicates: false });
  if (error) console.error("registrarTratamento falhou", error, row);
  return !error;
}

/**
 * Reserva atômica: marca as dívidas como tratadas ANTES de criar qualquer boleto.
 * Só devolve as linhas que este processo conseguiu reservar (tratada_em era NULL),
 * então duas ações simultâneas sobre o mesmo cliente nunca geram dois acordos.
 */
export async function reservarParcelas(admin: any, parcelas: any[], crmActionId: string, userId: string) {
  const ids = parcelas.map((p) => p.id).filter(Boolean);
  if (ids.length === 0) return [] as any[];
  const { data, error } = await admin
    .from("cobrancas_vencidas")
    .update({ tratada_em: new Date().toISOString(), tratada_por: userId, crm_action_id: crmActionId, updated_at: new Date().toISOString() })
    .in("id", ids)
    .is("tratada_em", null)
    .select("id");
  if (error) throw error;
  const reservados = new Set((data || []).map((r: any) => r.id));
  return parcelas.filter((p) => reservados.has(p.id));
}

/** Desfaz a reserva quando nenhum boleto pôde ser criado. */
export async function liberarParcelas(admin: any, parcelas: any[], crmActionId: string) {
  const ids = parcelas.map((p) => p.id).filter(Boolean);
  if (ids.length === 0) return;
  await admin
    .from("cobrancas_vencidas")
    .update({ tratada_em: null, tratada_por: null, crm_action_id: null, updated_at: new Date().toISOString() })
    .in("id", ids)
    .eq("crm_action_id", crmActionId);
}
