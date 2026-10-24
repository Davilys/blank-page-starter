// Paginação KEYSET (cursor) para consultas PostgREST ordenadas por (created_at DESC, id ASC).
//
// Por que não offset+count: offset deriva sob mutação concorrente — com count=1500,
// página 1 = ids 1..1000, uma inserção no topo faz a página 2 (offset 1000) reler
// id 1000 (duplicado) e omitir id 1500, encerrando em "sucesso" com lista errada;
// delete+insert mantendo o count omite sem erro algum. Count exato NÃO ancora deriva
// de offsets. Keyset resolve: cada página pede registros APÓS o cursor
// (created_at, id) da última linha lida — posições não dependem de deslocamento.
//
// GARANTIAS: sem duplicados e sem omissões por deriva de offset, mesmo com
// inserções/deleções durante a leitura.
// LIMITES REAIS (declarados, não escondidos):
//  - linha inserida ANTES da posição do cursor (ex.: created_at mais novo que o já lido)
//    não entra nesta carga — aparece na próxima; isso é coerente (ela não existia quando a leitura passou).
//  - linha deletada antes de o cursor alcançá-la simplesmente não aparece (não existe mais) — sem erro.
//  - se created_at de uma linha MUDAR durante a leitura, ela pode duplicar ou sumir;
//    created_at é imutável na prática deste CRM. Não usar este helper para ordenações mutáveis.
//  - não é snapshot transacional do conteúdo das linhas.
// Fim de dados = página vazia. Página curta não-vazia NÃO é tratada como fim
// (servidor pode capar abaixo de pageSize): o tamanho observado vira o novo pageSize
// e a leitura continua até página vazia. Ranges fora do conjunto nunca são emitidos.
// ESCOPO: validado apenas para a consulta de Leads (created_at DESC, id ASC).
// Não generalizar para outras telas sem revisão.
export const PAGE_SIZE = 1000;

export interface PageResult<T> {
  data: T[] | null;
  error: unknown;
}

export interface KeysetCursor {
  created_at: string;
  id: string;
}

export async function fetchAllKeyset<T = unknown>(
  fetchPage: (cursor: KeysetCursor | null, limit: number) => PromiseLike<PageResult<T>>,
  getCursor: (row: T) => KeysetCursor,
  pageSize: number = PAGE_SIZE,
  maxPages = 1000,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new TypeError(`fetchAllKeyset: pageSize deve ser inteiro positivo, recebeu ${pageSize}`);
  }
  if (!Number.isInteger(maxPages) || maxPages <= 0) {
    throw new TypeError(`fetchAllKeyset: maxPages deve ser inteiro positivo, recebeu ${maxPages}`);
  }

  const all: T[] = [];
  let cursor: KeysetCursor | null = null;
  let size = pageSize;
  let pages = 0;

  for (;;) {
    if (pages >= maxPages) {
      throw new Error(`fetchAllKeyset: limite de ${maxPages} páginas atingido com ${all.length} linhas lidas — resultado INCOMPLETO`);
    }
    const { data, error } = await fetchPage(cursor, size);
    if (error) throw error;
    const batch = data ?? [];
    if (batch.length === 0) break; // fim real: nada após o cursor
    all.push(...batch);
    cursor = getCursor(batch[batch.length - 1]);
    if (batch.length < size) size = batch.length; // cap do servidor menor que pageSize: adapta e continua
    pages++;
  }
  return all;
}
