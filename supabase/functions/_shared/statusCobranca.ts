// Fonte única de verdade para classificação de status de cobrança (Asaas + faturas internas).
// O mesmo mapeamento existe em src/lib/financeiro/statusCobranca.ts (frontend) e é validado por teste.

export type ClassificacaoCobranca = "pago" | "a_vencer" | "vencido" | "inativo";

export const STATUS_PAGO = [
  "received",
  "confirmed",
  "received_in_cash",
  "dunning_received",
  "paid",
];

export const STATUS_VENCIDO = ["overdue", "dunning_requested"];

export const STATUS_INATIVO = [
  "canceled",
  "cancelled",
  "deleted",
  "removida_asaas",
  "refunded",
  "refund_requested",
  "refund_in_progress",
  "chargeback",
  "chargeback_requested",
  "chargeback_dispute",
  "awaiting_chargeback_reversal",
];

export function normalizeStatus(status?: string | null): string {
  return (status || "").toString().trim().toLowerCase();
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Classifica uma cobrança. `syncStatus` marca cobranças que sumiram do Asaas.
 */
export function classificarCobranca(input: {
  status?: string | null;
  due_date?: string | null;
  sync_status?: string | null;
}): ClassificacaoCobranca {
  const sync = normalizeStatus(input.sync_status);
  if (sync && sync !== "ativa") return "inativo";

  const s = normalizeStatus(input.status);
  if (STATUS_PAGO.includes(s)) return "pago";
  if (STATUS_INATIVO.includes(s)) return "inativo";
  if (STATUS_VENCIDO.includes(s)) return "vencido";

  const due = (input.due_date || "").slice(0, 10);
  if (due && due < hoje()) return "vencido";
  return "a_vencer";
}

export function contaNoTotalAtivo(c: ClassificacaoCobranca): boolean {
  return c === "a_vencer" || c === "vencido";
}
