// Regras puras da campanha de anuidade (espelhadas em src/lib/annuity.ts).
export const TZ = "America/Sao_Paulo";

/** Data civil (YYYY-MM-DD) e hora atuais em São Paulo. */
export function nowSaoPaulo(d: Date = new Date()): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, hour: Number(g("hour")) };
}

/** Emissão + 5 dias corridos; sexta, sábado ou domingo passam para a segunda seguinte. */
export function calcAnnuityDueDate(emission: string): string {
  const [y, m, d] = emission.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 5));
  const dow = dt.getUTCDay();
  const shift = dow === 5 ? 3 : dow === 6 ? 2 : dow === 0 ? 1 : 0;
  dt.setUTCDate(dt.getUTCDate() + shift);
  return dt.toISOString().slice(0, 10);
}

/** Início da campanha: 10 de dezembro do exercício selecionado. */
export const campaignStartDate = (exercicio: number) => `${exercicio}-12-10`;

export const fmtBR = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
export const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export interface EmailVars { exercicio: number; nome: string; periodo: string; vencimento: string; link: string; valorCents: number }

export function buildAnnuityEmail(v: EmailVars) {
  const missing = Object.entries({ nome: v.nome, periodo: v.periodo, vencimento: v.vencimento, link: v.link })
    .filter(([, val]) => !val || !String(val).trim()).map(([k]) => k);
  if (missing.length) throw new Error(`Campos obrigatórios ausentes no e-mail: ${missing.join(", ")}`);
  const valor = brl(v.valorCents);
  const subject = `WebMarcas | Anuidade ${v.exercicio} — ${valor}`;
  const text = `Olá, ${v.nome}!

Conforme a cláusula 5.2 do seu contrato, a anuidade da WebMarcas é de ${valor}, cobrada uma vez por ano. Ela se refere aos serviços de acompanhamento e vigilância da sua marca previstos na cláusula 10.1.

Referência: ${v.periodo}
Vencimento deste boleto: ${fmtBR(v.vencimento)}

Acessar boleto: ${v.link}

Esta cobrança é da WebMarcas e não é uma taxa do INPI. Dúvidas? Responda a este e-mail.

Equipe WebMarcas
ola@webmarcas.net | (11) 91112-0225
www.webmarcas.net`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f6fa;font-family:'Public Sans',Arial,sans-serif;color:#0f1d3a">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e3e8f0">
<tr><td style="background:#005fe6;padding:20px 28px;color:#ffffff;font-size:20px;font-weight:800;letter-spacing:.3px">WebMarcas</td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.6">
<p style="margin:0 0 14px">Olá, <strong>${esc(v.nome)}</strong>!</p>
<p style="margin:0 0 14px">Conforme a cláusula 5.2 do seu contrato, a anuidade da WebMarcas é de <strong>${valor}</strong>, cobrada uma vez por ano. Ela se refere aos serviços de acompanhamento e vigilância da sua marca previstos na cláusula 10.1.</p>
<p style="margin:0 0 6px">Referência: <strong>${esc(v.periodo)}</strong></p>
<p style="margin:0 0 22px">Vencimento deste boleto: <strong>${fmtBR(v.vencimento)}</strong></p>
<p style="margin:0 0 22px;text-align:center"><a href="${esc(v.link)}" style="display:inline-block;background:#005fe6;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:12px">Acessar boleto</a></p>
<p style="margin:0 0 14px;font-size:13px;color:#53607a">Esta cobrança é da WebMarcas e não é uma taxa do INPI. Dúvidas? Responda a este e-mail.</p>
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #e3e8f0;font-size:13px;color:#53607a">Equipe WebMarcas<br>ola@webmarcas.net | (11) 91112-0225<br><a href="https://www.webmarcas.net" style="color:#005fe6">www.webmarcas.net</a></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}
