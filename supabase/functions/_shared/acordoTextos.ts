// Textos aprovados pelo titular (24/10/2026) para a mensagem de acordo/parcelamento.
// WhatsApp = versão curta com negrito nativo; E-mail = versão integral com <strong>.
export type AcordoTextoDados = { nome: string; valor: string; dias: number; dataPrimeira: string; n: number; link: string };
const primeiroNome = (n: string) => (n || "Cliente").split(" ")[0];

export function buildAcordoWhatsApp(d: AcordoTextoDados): string {
  return `Oi ${primeiroNome(d.nome)}! Tudo bem?

Consegui uma condição especial pra você não perder o seu processo de registro de marca 👇

✅ Parcelamos o débito *${d.valor}* em aberto há ${d.dias} dias, em até *${d.n}x* no boleto!
📅 Primeira parcela só dia *${d.dataPrimeira}*: ${d.link}

Assim você *mantém seu contrato ativo e evita qualquer risco de cancelamento* 🚨

Só para confirma aqui ja liberei essa condição pra você, combinado... 👍`;
}
export function buildAcordoEmailHtml(d: AcordoTextoDados): string {
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;line-height:1.6">
  <p>Oi ${primeiroNome(d.nome)}! Tudo bem?</p>
  <p>Consegui uma condição especial pra você não perder o seu processo de registro de marca 👇</p>
  <p>✅ Parcelamos o débito <strong>${d.valor}</strong> em aberto há ${d.dias} dias, em até <strong>${d.n}x</strong> no boleto!<br>
  📅 Primeira parcela só dia <strong>${d.dataPrimeira}</strong>${d.link ? `, <a href="${d.link}" target="_blank" rel="noopener">segue fatura</a>` : ""}</p>
  <p>Assim você <strong>mantém seu contrato ativo e evita qualquer risco de cancelamento</strong> 🚨</p>
  <p>Nosso objetivo é garantir que sua marca continue protegida e em andamento no INPI.</p>
  <p>Só para confirma aqui ja liberei essa condição pra você, combinado... 👍</p>
</div>`;
}
