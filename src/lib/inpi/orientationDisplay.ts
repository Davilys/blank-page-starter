/** Render structured AI output as plain text; never display JSON or HTML. */
export function orientationItemText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const row = value as Record<string, unknown>;
  const text = (key: string) => typeof row[key] === 'string' ? (row[key] as string).trim() : '';
  const title = text('titulo') || text('documento');
  const detail = text('descricao') || text('o_que_demonstra') || text('finalidade') || text('texto');
  const sources = Array.isArray(row.fontes) ? row.fontes.filter((x): x is string => typeof x === 'string').join(', ') : '';
  const body = [title, detail].filter(Boolean).join(' — ');
  return [body, sources ? `Fontes: ${sources}` : ''].filter(Boolean).join(' · ') || 'Item com formato não reconhecido. Atualize a análise.';
}
