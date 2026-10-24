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

export function diasDesdePublicacao(pub: any, now: Date = new Date()): number | null {
  if (!pub?.data_publicacao_rpi) return null;
  const t = new Date(pub.data_publicacao_rpi).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / 86400000);
}

// Texto 1 afirma prazo de 60 dias a partir da publicacao (so dentro dele).
// Texto 2 afirma "39 dias desde a publicacao": so quando forem exatamente 39.
// Texto 3 nunca sai (debito nao confirmado).
export function textoSustentado(id: number, pub: any, now: Date = new Date()): boolean {
  const d = diasDesdePublicacao(pub, now);
  if (d === null) return false;
  if (id === 1) return d >= 0 && d <= 60;
  if (id === 2) return d === 39;
  return false;
}
