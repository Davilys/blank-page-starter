// Lembretes automáticos de assinatura (24h / 48h / último dia).
// Módulo puro: usado pela Edge Function e pelos testes (vitest).

export const SIGNATURE_LINK_DAYS = 3;
const HOUR = 3600_000;
const BRT_OFFSET = -3 * HOUR; // São Paulo, sem horário de verão

/** Ajusta para a janela 8h–20h de São Paulo (fora dela, próximo 8h). */
export function adjustToWindow(d: Date): Date {
  const local = new Date(d.getTime() + BRT_OFFSET);
  const h = local.getUTCHours();
  if (h >= 8 && h < 20) return d;
  const target = new Date(local);
  if (h >= 20) target.setUTCDate(target.getUTCDate() + 1);
  target.setUTCHours(8, 0, 0, 0);
  return new Date(target.getTime() - BRT_OFFSET);
}

/** Horários dos 3 lembretes a partir da geração do link e do vencimento. */
export function scheduleFollowups(generatedAt: Date, expiresAt: Date): Date[] {
  const s1 = adjustToWindow(new Date(generatedAt.getTime() + 24 * HOUR));
  const s2 = adjustToWindow(new Date(generatedAt.getTime() + 48 * HOUR));
  let s3 = adjustToWindow(new Date(expiresAt.getTime() - 10 * HOUR));
  if (s3.getTime() > expiresAt.getTime() - 30 * 60_000) {
    // Sem horário útil antes de vencer: 19h do dia anterior ao vencimento.
    const local = new Date(expiresAt.getTime() + BRT_OFFSET);
    local.setUTCDate(local.getUTCDate() - 1);
    local.setUTCHours(19, 0, 0, 0);
    s3 = new Date(local.getTime() - BRT_OFFSET);
  }
  if (s3 <= s2) s3 = new Date(Math.min(s2.getTime() + HOUR, expiresAt.getTime() - 30 * 60_000));
  return [s1, s2, s3];
}

export interface FollowupData {
  nome: string;
  documento: string;
  marca: string;
  link: string;
  valor?: string | null; // vazio em procuração
}

const first = (n: string) => (n || 'Cliente').trim().split(/\s+/)[0];

export function buildFollowupWhatsApp(step: 1 | 2 | 3, d: FollowupData): string {
  const nome = first(d.nome);
  const marca = d.marca || 'sua marca';
  if (step === 1) return `Olá, ${nome}! 😊
Seu ${d.documento} da marca *${marca}* já está pronto e falta só sua assinatura para darmos andamento.
✍️ Leva menos de 1 minuto: ${d.link}
Equipe WebMarcas`;
  if (step === 2) return `${nome}, sua marca *${marca}* ainda não está protegida. ⚠️
Enquanto o contrato não é assinado, outra pessoa pode pedir o mesmo nome no INPI antes de você.
✍️ Assine agora: ${d.link}
Equipe WebMarcas`;
  const valor = d.valor ? ` e as condições/valor de ${d.valor} serão encerrados` : ' e as condições serão encerradas';
  return `⏰ ${nome}, último aviso: o link do seu ${d.documento} *vence hoje*.
Se não for assinado hoje, o contrato será cancelado${valor}.
✍️ Assine agora: ${d.link}
Equipe WebMarcas`;
}

export function buildFollowupEmail(step: 1 | 2 | 3, d: FollowupData): { subject: string; html: string } {
  const nome = first(d.nome);
  const marca = d.marca || 'sua marca';
  const subjects = {
    1: `Seu ${d.documento} está pronto — falta só sua assinatura`,
    2: `${marca}: sua marca ainda não está protegida`,
    3: `Último dia: seu ${d.documento} vence hoje`,
  } as const;
  const paragraphs: Record<1 | 2 | 3, string[]> = {
    1: [
      `Preparamos com cuidado o seu <strong>${d.documento}</strong> para o registro da marca <strong>${marca}</strong>, e agora falta apenas um passo: a sua assinatura.`,
      `Assim que você assinar, nossa equipe já dá andamento ao processo junto ao INPI. A assinatura é eletrônica, tem validade jurídica e leva menos de 1 minuto.`,
    ],
    2: [
      `A marca <strong>${marca}</strong> ainda não está protegida. Enquanto o ${d.documento} não é assinado, não conseguimos protocolar o pedido no INPI.`,
      `No registro de marcas vale a regra de quem pede primeiro. Se outra pessoa solicitar um nome igual ou parecido antes de você, sua marca pode ficar impedida.`,
      `Garanta sua prioridade assinando agora.`,
    ],
    3: [
      `Este é o <strong>último aviso</strong>: o link de assinatura do seu ${d.documento} da marca <strong>${marca}</strong> vence <strong>hoje</strong>.`,
      `Se não for assinado hoje, o contrato será cancelado automaticamente${d.valor ? ` e as condições e o valor de <strong>${d.valor}</strong> serão encerrados` : ' e as condições oferecidas serão encerradas'}.`,
      `Para manter tudo como combinado, basta clicar no botão abaixo e assinar.`,
    ],
  };
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;line-height:1.6">
  <h2 style="color:#005fe6;margin:0 0 16px">${subjects[step]}</h2>
  <p>Olá, <strong>${nome}</strong>!</p>
  ${paragraphs[step].map((p) => `<p>${p}</p>`).join('\n  ')}
  <p style="text-align:center;margin:28px 0"><a href="${d.link}" style="display:inline-block;background:#005fe6;color:#ffffff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:bold">✍️ Assinar agora</a></p>
  <p style="font-size:13px;color:#6b7280">Depois da assinatura, você recebe a confirmação por e-mail e nossa equipe inicia o registro.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="font-size:13px;color:#6b7280">Atenciosamente,<br><strong>Equipe WebMarcas</strong><br>🌐 www.webmarcas.net · 📱 WhatsApp (11) 91112-0225</p>
</div>`;
  return { subject: subjects[step], html };
}

export function documentName(type: string | null | undefined): string {
  if (type === 'procuracao') return 'procuração';
  if (type === 'distrato_multa' || type === 'distrato_sem_multa') return 'distrato';
  return 'contrato';
}
