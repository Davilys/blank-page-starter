// Espelho das regras puras de supabase/functions/annuity/rules.ts (para exibição e testes).
export function calcAnnuityDueDate(emission: string): string {
  const [y, m, d] = emission.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 5));
  const dow = dt.getUTCDay();
  const shift = dow === 5 ? 3 : dow === 6 ? 2 : dow === 0 ? 1 : 0;
  dt.setUTCDate(dt.getUTCDate() + shift);
  return dt.toISOString().slice(0, 10);
}

export const campaignStartDate = (exercicio: number) => `${exercicio}-12-10`;

export function todaySaoPaulo(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export const fmtBR = (iso?: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
