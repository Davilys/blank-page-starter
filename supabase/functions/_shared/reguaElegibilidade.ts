// Régua de cobrança: regras puras (testáveis em vitest, sem Deno/Supabase).
const norm = (s: string | null | undefined) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export type RegraAcordo = { numParcelas: number; jurosPct: number; total: number; parcela: number };

/** Boleto de exigência INPI de R$1.621 (acordo automático 5x com 10%). */
export function isExigencia1621(amount: number, description?: string | null): boolean {
  const d = norm(description);
  return Math.round(Number(amount) * 100) === 162100 && d.includes("exigencia") && d.includes("inpi") && !/parcela|acordo/.test(d);
}
/** Boleto de registro de marca de R$699 (acordo automático 3x com 10%). */
export function isRegistro699(amount: number, description?: string | null): boolean {
  const d = norm(description);
  return Math.round(Number(amount) * 100) === 69900 && d.includes("registro") && d.includes("marca") && !/parcela|acordo|exig/.test(d);
}
export function regraAcordo(amount: number, description?: string | null): RegraAcordo | null {
  let n = 0;
  if (isExigencia1621(amount, description)) n = 5;
  else if (isRegistro699(amount, description)) n = 3;
  else return null;
  const total = Math.round(Number(amount) * 1.1 * 100) / 100;
  return { numParcelas: n, jurosPct: 10, total, parcela: Math.round((total / n) * 100) / 100 };
}

/** Data (YYYY-MM-DD) no fuso de Brasília. */
export function dayBRT(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
/** Segunda a sábado, 08:00 até 17:59 BRT. */
export function businessHourBRT(d: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", hour12: false }).formatToParts(d);
  const wd = parts.find((p) => p.type === "weekday")!.value;
  const h = Number(parts.find((p) => p.type === "hour")!.value) % 24;
  return wd !== "Sun" && h >= 8 && h < 18;
}
/** Primeira parcela do acordo automático: hoje + 7 dias (BRT). */
export function primeiraParcelaAuto(d: Date = new Date()): string {
  const [y, m, day] = dayBRT(d).split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, day + 7));
  return x.toISOString().slice(0, 10);
}
