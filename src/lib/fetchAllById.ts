// Paginação KEYSET por id ASC para consultas PostgREST sem ordenação estável própria
// ou cuja ordenação de exibição é reaplicada no cliente (ex.: PublicacaoTab).
//
// MOTIVO: PostgREST aplica max_rows=1000 por request (config do projeto, medido).
// Query sem .range() retorna NO MÁXIMO 1000 linhas SEM ERRO — tabelas maiores
// truncam silenciosamente (publicacoes_marcas=2125, brand_processes=3313 em 2026-10-24).
//
// Por que keyset por id e não offset: id é único e imutável — páginas "após o cursor"
// não derivam com inserções/deleções concorrentes. Offset relê/omite sob mutação.
// Ordenação mutável (ex.: proximo_prazo_critico) NÃO pode ser cursor: por isso o
// cursor é sempre id, e a ordem de exibição é reaplicada no cliente depois da carga.
//
// GARANTIAS: sem duplicados e sem omissões por deriva; linha inserida com id maior
// durante a leitura entra nesta carga; deletada antes de o cursor passar não aparece.
// LIMITES: não é snapshot transacional; ids devem ser únicos e ordenáveis (uuid ok).
// Fim de dados = página vazia; página curta adapta pageSize e continua (cap do servidor).
export interface IdPageResult<T> {
  data: T[] | null;
  error: unknown;
}

export async function fetchAllById<T extends { id: string }>(
  fetchPage: (afterId: string | null, limit: number) => PromiseLike<IdPageResult<T>>,
  pageSize = 1000,
  maxPages = 1000,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new TypeError(`fetchAllById: pageSize deve ser inteiro positivo, recebeu ${pageSize}`);
  }
  const all: T[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  let size = pageSize;
  for (let pages = 0; ; pages++) {
    if (pages >= maxPages) {
      throw new Error(`fetchAllById: limite de ${maxPages} páginas atingido com ${all.length} linhas — resultado INCOMPLETO`);
    }
    const { data, error } = await fetchPage(cursor, size);
    if (error) throw error;
    const batch = data ?? [];
    if (batch.length === 0) break;
    for (const row of batch) {
      // guarda de deriva: se o servidor repetir uma linha (mutação durante a leitura),
      // dedupe por id mantém a primeira ocorrência sem inflar a lista.
      if (!seen.has(row.id)) { seen.add(row.id); all.push(row); }
    }
    cursor = batch[batch.length - 1].id;
    if (batch.length < size) size = batch.length;
  }
  return all;
}

// Comparador equivalente a PostgREST: order('proximo_prazo_critico', ascending, nullsFirst:false).
// Usado para reaplicar no cliente a ordem que a query original pedia ao banco,
// depois que a carga passa a ser por id. nulls por último; empate estável por id.
export function comparePrazoCriticoAscNullsLast(
  a: { proximo_prazo_critico: string | null; id: string },
  b: { proximo_prazo_critico: string | null; id: string },
): number {
  const pa = a.proximo_prazo_critico, pb = b.proximo_prazo_critico;
  if (pa === null && pb === null) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  if (pa === null) return 1;
  if (pb === null) return -1;
  if (pa !== pb) return pa < pb ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
