/**
 * Leitura barata do fluxo (SSE) da IA.
 *
 * A resposta chega em dezenas de milhares de eventos. Fazer JSON.parse do
 * objeto inteiro em cada evento estoura o orçamento de CPU do runtime e o
 * servidor é encerrado no meio da geração ("CPU Time exceeded").
 *
 * Os eventos de texto — a esmagadora maioria — são resolvidos por leitura
 * direta do campo "delta", sem JSON.parse do objeto. Os demais eventos
 * (conclusão, recusa, erro) continuam pelo caminho normal.
 */

const TEXT_DELTA = '{"type":"response.output_text.delta"';

/**
 * Devolve o texto do evento de delta, ou null quando o evento não é um delta
 * de texto (aí o chamador faz o parse completo).
 */
export function fastTextDelta(payload: string): string | null {
  if (!payload.startsWith(TEXT_DELTA)) return null;
  const at = payload.indexOf('"delta":"');
  if (at < 0) return null;
  const start = at + 9;
  let i = start;
  let escaped = false;
  for (; i < payload.length; i++) {
    const code = payload.charCodeAt(i);
    if (escaped) { escaped = false; continue; }
    if (code === 92) { escaped = true; continue; } // \
    if (code === 34) break; // "
  }
  if (i >= payload.length) return null; // evento truncado: parse normal decide
  const raw = payload.slice(start, i);
  if (raw.indexOf('\\') < 0) return raw;
  try { return JSON.parse(`"${raw}"`) as string; } catch { return null; }
}
