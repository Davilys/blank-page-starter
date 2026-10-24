// Guardas de execucao dos avisos de publicacoes (sem alterar os textos).
export function dentroHorarioComercial(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '-1');
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(wd) && h >= 10 && h < 18;
}

// Envia somente quando o cadastro sustenta o que os textos afirmam:
// processo em exigencia, com data de publicacao, e cliente que nao desistiu.
export function cadastroSustentaTexto(pub: any, schedule: any): boolean {
  if (!pub || !pub.data_publicacao_rpi) return false;
  if (!/exig/i.test(String(pub.status || ''))) return false;
  const cs = String(schedule?.cumprimento_status ?? pub.cumprimento_status ?? '').toLowerCase();
  if (cs === 'desistiu' || cs === 'aguardando_pagamento') return false;
  return true;
}
