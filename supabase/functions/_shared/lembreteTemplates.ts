// Textos dos lembretes (WhatsApp, e-mail e assunto). Puro TS: testável em vitest.
// D5 e acordo: TEXTOS AGUARDANDO APROVAÇÃO do titular; não afirmam encerramento/rescisão,
// que só existe nos contratos novos (ver cláusula 7.2). Alterar aqui muda os dois canais.
export type TipoLembrete = "d3" | "d0" | "vencido_d1" | "vencido_d3" | "vencido_d5";
export const TIPOS_LEMBRETE: TipoLembrete[] = ["d3", "d0", "vencido_d1", "vencido_d3", "vencido_d5"];
const primeiroNome = (n: string) => (n || "Cliente").split(" ")[0];
const svc = (s: string) => (s ? ` (${s})` : "");

export function buildWhatsApp(nome: string, quando: string, data: string, link: string, valor: string, tipo: TipoLembrete = "d0", servico = ""): string {
  const first = primeiroNome(nome);
  const linkBlock = link ? `\n🔗 ${link}\n` : "\n(entre em contato para receber o link)\n";
  if (tipo === "vencido_d1") return `Olá, *${first}*! 😊

Notamos que sua fatura de *${valor}*${svc(servico)}, com vencimento em *${data}*, ainda consta em aberto.

Se já pagou, por favor desconsidere — às vezes o banco leva um tempinho para compensar. 🙏

Se ainda não, segue o link para pagamento:
${linkBlock}
Qualquer dúvida estamos à disposição!

Equipe WebMarcas`;
  if (tipo === "vencido_d3") return `Olá, *${first}*.

Sua fatura de *${valor}*${svc(servico)} venceu em *${data}* e segue em aberto há 3 dias.

Pedimos que regularize o quanto antes para evitar a incidência de juros e multas previstos em contrato:
${linkBlock}
Se estiver com alguma dificuldade, fale com a gente — encontramos uma forma de resolver. 🤝

Equipe WebMarcas`;
  if (tipo === "vencido_d5") return `Olá, *${first}*.

Sua fatura de *${valor}*${svc(servico)} está vencida há 5 dias (vencimento em *${data}*).

A falta de pagamento pode prejudicar o andamento do seu processo e dos serviços contratados.

Para evitar isso, nosso jurídico pode autorizar um acordo parcelado com vencimento ajustado à sua realidade. Responda esta mensagem ou pague direto pelo link:
${linkBlock}
Equipe WebMarcas`;
  return `Olá, *${first}*!

Passando para lembrar que sua cobrança no valor de *${valor}*${svc(servico)} vence *${quando}* (${data}).

Para evitar juros e multas, você pode realizar o pagamento aqui:
${linkBlock}
Qualquer dúvida estamos à disposição 😊

Equipe WebMarcas`;
}

export const EMAIL_TITULO: Record<TipoLembrete, string> = {
  d3: "Lembrete de vencimento — WebMarcas",
  d0: "Lembrete de vencimento — WebMarcas",
  vencido_d1: "Fatura em aberto — WebMarcas",
  vencido_d3: "Regularização pendente — WebMarcas",
  vencido_d5: "Importante: sua fatura e seus serviços — WebMarcas",
};

function emailBody(tipo: TipoLembrete, first: string, valor: string, servico: string, data: string, quando: string): string {
  const s = svc(servico);
  if (tipo === "vencido_d1") return `<p>Olá, <strong>${first}</strong>!</p>
  <p>Notamos que sua fatura de <strong>${valor}</strong>${s}, com vencimento em <strong>${data}</strong>, ainda consta em aberto.</p>
  <p>Se você já pagou, por favor desconsidere — às vezes o banco leva um tempinho para compensar. 🙏</p>
  <p>Se ainda não, segue o link para pagamento:</p>`;
  if (tipo === "vencido_d3") return `<p>Olá, <strong>${first}</strong>.</p>
  <p>Sua fatura de <strong>${valor}</strong>${s} venceu em <strong>${data}</strong> e segue em aberto há 3 dias.</p>
  <p>Pedimos que regularize o quanto antes para evitar a incidência de juros e multas previstos em contrato:</p>`;
  if (tipo === "vencido_d5") return `<p>Olá, <strong>${first}</strong>.</p>
  <p>Sua fatura de <strong>${valor}</strong>${s} está vencida há 5 dias (vencimento em <strong>${data}</strong>).</p>
  <p>A falta de pagamento pode prejudicar o andamento do seu processo e dos serviços contratados.</p>
  <p>Para evitar isso, nosso jurídico pode autorizar um acordo parcelado com vencimento ajustado à sua realidade. Responda este e-mail ou pague direto pelo link:</p>`;
  return `<p>Olá, <strong>${first}</strong>!</p>
  <p>Passando para lembrar que sua cobrança no valor de <strong>${valor}</strong>${s} vence <strong>${quando}</strong> (${data}).</p>`;
}

export function buildEmailHtml(nome: string, quando: string, data: string, link: string, valor: string, tipo: TipoLembrete = "d0", servico = ""): string {
  const first = primeiroNome(nome);
  const ehVencido = tipo.startsWith("vencido_");
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;line-height:1.6">
  <h2 style="color:#0a3d62">${EMAIL_TITULO[tipo]}</h2>
  ${emailBody(tipo, first, valor, servico, data, quando)}
  ${ehVencido ? "" : "<p>Para evitar juros e multas, você pode realizar o pagamento aqui:</p>"}
  ${link ? `<p><a href="${link}" target="_blank" rel="noopener" style="background:#0a3d62;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Acessar fatura / boleto</a></p>` : `<p><em>Entre em contato para receber o link de pagamento.</em></p>`}
  <p>Qualquer dúvida estamos à disposição 😊</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:13px;color:#666">Atenciosamente,<br><strong>Equipe WebMarcas</strong><br>🌐 www.webmarcas.net · 📧 ola@webmarcas.net · 📱 (11) 91112-0225</p>
</div>`;
}

export function buildSubject(tipo: TipoLembrete, quando: string, data: string): string {
  const m: Record<TipoLembrete, string> = {
    d3: `Lembrete: sua fatura vence ${quando} (${data}) — WebMarcas`,
    d0: `Lembrete: sua fatura vence ${quando} (${data}) — WebMarcas`,
    vencido_d1: `Fatura em aberto — venceu ${data} — WebMarcas`,
    vencido_d3: `Regularização pendente — fatura vencida há 3 dias — WebMarcas`,
    vencido_d5: `Importante: fatura vencida há 5 dias — WebMarcas`,
  };
  return m[tipo];
}
