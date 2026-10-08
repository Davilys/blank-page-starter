// Regras puras da campanha de anuidade.
export const TZ = "America/Sao_Paulo";

export interface AnnuitySettings {
  amount_cents: number; due_days: number; weekend_shift: boolean;
  start_day: number; start_month: number; daily_hour: number; daily_limit: number;
  period_label_tpl: string; boleto_description_tpl: string;
  email_subject_tpl: string; email_body_tpl: string; email_button_label: string; email_footer: string;
  sender_name: string; reply_to: string; require_clause: boolean; clause_keyword: string;
}

export const DEFAULT_SETTINGS: AnnuitySettings = {
  amount_cents: 39800, due_days: 5, weekend_shift: true,
  start_day: 10, start_month: 12, daily_hour: 9, daily_limit: 200,
  period_label_tpl: "Exercício {{exercicio}}",
  boleto_description_tpl: "Anuidade contratual WebMarcas — {{periodo_referencia}}",
  email_subject_tpl: "WebMarcas | Anuidade {{exercicio}} — {{valor}}",
  email_body_tpl: `Olá, {{nome_cliente}}!

Conforme a cláusula 5.2 do seu contrato, a anuidade da WebMarcas é de {{valor}}, cobrada uma vez por ano. Ela se refere aos serviços de acompanhamento e vigilância da sua marca previstos na cláusula 10.1.

Referência: {{periodo_referencia}}
Vencimento deste boleto: {{data_vencimento}}

{{botao_boleto}}

Esta cobrança é da WebMarcas e não é uma taxa do INPI. Dúvidas? Responda a este e-mail.`,
  email_button_label: "Acessar boleto",
  email_footer: "Equipe WebMarcas\nola@webmarcas.net | (11) 91112-0225\nwww.webmarcas.net",
  sender_name: "WebMarcas", reply_to: "ola@webmarcas.net",
  require_clause: true, clause_keyword: "anuidade",
};

const int = (v: unknown, min: number, max: number, d: number) => {
  const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : d;
};
const str = (v: unknown, d: string, max = 5000) => (typeof v === "string" && v.trim() ? v.slice(0, max) : d);

/** Mescla e saneia configurações parciais sobre o padrão. */
export function mergeSettings(...parts: any[]): AnnuitySettings {
  const raw = Object.assign({}, ...parts.filter(Boolean));
  const D = DEFAULT_SETTINGS;
  return {
    amount_cents: int(raw.amount_cents, 500, 10_000_000, D.amount_cents),
    due_days: int(raw.due_days, 1, 60, D.due_days),
    weekend_shift: typeof raw.weekend_shift === "boolean" ? raw.weekend_shift : D.weekend_shift,
    start_day: int(raw.start_day, 1, 31, D.start_day),
    start_month: int(raw.start_month, 1, 12, D.start_month),
    daily_hour: int(raw.daily_hour, 0, 23, D.daily_hour),
    daily_limit: int(raw.daily_limit, 1, 200, D.daily_limit),
    period_label_tpl: str(raw.period_label_tpl, D.period_label_tpl, 120),
    boleto_description_tpl: str(raw.boleto_description_tpl, D.boleto_description_tpl, 400),
    email_subject_tpl: str(raw.email_subject_tpl, D.email_subject_tpl, 200),
    email_body_tpl: str(raw.email_body_tpl, D.email_body_tpl, 8000),
    email_button_label: str(raw.email_button_label, D.email_button_label, 60),
    email_footer: str(raw.email_footer, D.email_footer, 600),
    sender_name: str(raw.sender_name, D.sender_name, 60).replace(/[<>"]/g, ""),
    reply_to: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(raw.reply_to || "")) ? String(raw.reply_to) : D.reply_to,
    require_clause: typeof raw.require_clause === "boolean" ? raw.require_clause : D.require_clause,
    clause_keyword: str(raw.clause_keyword, D.clause_keyword, 60).replace(/[%_]/g, ""),
  };
}

/** Problemas que impedem salvar o modelo. */
export function validateSettings(s: AnnuitySettings): string[] {
  const p: string[] = [];
  if (!/\{\{\s*(link_boleto|botao_boleto)\s*\}\}/.test(s.email_body_tpl)) p.push("O texto do e-mail precisa conter {{botao_boleto}} ou {{link_boleto}}.");
  if (!/\{\{\s*nome_cliente\s*\}\}/.test(s.email_body_tpl)) p.push("O texto do e-mail precisa conter {{nome_cliente}}.");
  const unknown = [...(s.email_body_tpl + s.email_subject_tpl + s.boleto_description_tpl + s.period_label_tpl).matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)]
    .map((m) => m[1]).filter((v) => !VARS.includes(v));
  if (unknown.length) p.push(`Campos desconhecidos: ${[...new Set(unknown)].map((v) => `{{${v}}}`).join(", ")}.`);
  return p;
}

export const VARS = ["nome_cliente", "valor", "exercicio", "periodo_referencia", "data_vencimento", "link_boleto", "botao_boleto", "marcas"];

export function nowSaoPaulo(d: Date = new Date()): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, hour: Number(g("hour")) };
}

/** Emissão + N dias corridos; com ajuste, sexta/sábado/domingo passam para a segunda seguinte. */
export function calcAnnuityDueDate(emission: string, dueDays = 5, weekendShift = true): string {
  const [y, m, d] = emission.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dueDays));
  if (weekendShift) {
    const dow = dt.getUTCDay();
    dt.setUTCDate(dt.getUTCDate() + (dow === 5 ? 3 : dow === 6 ? 2 : dow === 0 ? 1 : 0));
  }
  return dt.toISOString().slice(0, 10);
}

export const campaignStartDate = (exercicio: number, s: AnnuitySettings = DEFAULT_SETTINGS) => {
  const last = new Date(Date.UTC(exercicio, s.start_month, 0)).getUTCDate();
  return `${exercicio}-${String(s.start_month).padStart(2, "0")}-${String(Math.min(s.start_day, last)).padStart(2, "0")}`;
};

export const fmtBR = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
export const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export interface EmailVars { exercicio: number; nome: string; periodo: string; vencimento: string; link: string; valorCents: number; marcas?: string[] }

export function renderText(tpl: string, vals: Record<string, string>) {
  return tpl.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k) => (k in vals ? vals[k] : m));
}

export const periodLabel = (s: AnnuitySettings, exercicio: number) => renderText(s.period_label_tpl, { exercicio: String(exercicio) });

export function boletoDescription(s: AnnuitySettings, exercicio: number, periodo: string, marcas: string[] = []) {
  return renderText(s.boleto_description_tpl, { exercicio: String(exercicio), periodo_referencia: periodo, marcas: marcas.join(", ") || "—" }).slice(0, 500);
}

export function buildAnnuityEmail(s: AnnuitySettings, v: EmailVars) {
  const missing = Object.entries({ nome: v.nome, periodo: v.periodo, vencimento: v.vencimento, link: v.link })
    .filter(([, val]) => !val || !String(val).trim()).map(([k]) => k);
  if (missing.length) throw new Error(`Campos obrigatórios ausentes no e-mail: ${missing.join(", ")}`);
  const vals: Record<string, string> = {
    nome_cliente: v.nome, valor: brl(v.valorCents), exercicio: String(v.exercicio), periodo_referencia: v.periodo,
    data_vencimento: fmtBR(v.vencimento), link_boleto: v.link, marcas: (v.marcas || []).join(", ") || "sua marca",
  };
  const subject = renderText(s.email_subject_tpl, vals).replace(/[\r\n]+/g, " ").trim();
  const textBody = renderText(s.email_body_tpl, { ...vals, botao_boleto: `${s.email_button_label}: ${v.link}` });
  const text = `${textBody}\n\n${s.email_footer}`;

  const button = `<p style="margin:0 0 22px;text-align:center"><a href="${esc(v.link)}" style="display:inline-block;background:#005fe6;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:12px">${esc(s.email_button_label)}</a></p>`;
  const htmlVals: Record<string, string> = {};
  for (const [k, val] of Object.entries(vals)) htmlVals[k] = `<strong>${esc(val)}</strong>`;
  htmlVals.nome_cliente = `<strong>${esc(v.nome)}</strong>`;
  htmlVals.link_boleto = `<a href="${esc(v.link)}" style="color:#005fe6">${esc(v.link)}</a>`;
  const paragraphs = s.email_body_tpl.split(/\n\s*\n/).map((para) => {
    if (/^\s*\{\{\s*botao_boleto\s*\}\}\s*$/.test(para)) return button;
    const safe = esc(para).replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k) => k === "botao_boleto" ? button : (htmlVals[k] ?? m));
    return `<p style="margin:0 0 14px">${safe.replace(/\n/g, "<br>")}</p>`;
  }).join("\n");
  const footer = esc(s.email_footer).replace(/\n/g, "<br>");
  const html = `<!doctype html><html><body style="margin:0;background:#f4f6fa;font-family:'Public Sans',Arial,sans-serif;color:#0f1d3a">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e3e8f0">
<tr><td style="background:#005fe6;padding:20px 28px;color:#ffffff;font-size:20px;font-weight:800;letter-spacing:.3px">WebMarcas</td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.6">${paragraphs}</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #e3e8f0;font-size:13px;color:#53607a">${footer}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}
