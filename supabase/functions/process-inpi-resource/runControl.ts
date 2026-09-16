/**
 * Controle de execução dos trabalhos de geração (Recursos INPI).
 * Sem dependência de runtime: pode ser testado fora do Deno.
 */

/** Uma execução é considerada morta quando o sinal de vida (heartbeat) para. */
export const STALE_RUN_MS = 3 * 60 * 1000;

export const INTERRUPTED_MESSAGE =
  'A geração foi interrompida antes de terminar. Nenhum documento ou orientação foi perdido — use "Tentar de novo" para retomar da etapa que parou.';

/** Um trabalho sem sinal de vida recente pode ser retomado; com sinal, não. */
export function isRunStale(
  job: { status?: string; heartbeat_at?: string | null; updated_at?: string | null; created_at?: string | null },
  now = Date.now(),
): boolean {
  if (job.status !== 'processing') return false;
  const ref = job.heartbeat_at || job.updated_at || job.created_at;
  if (!ref) return true;
  const ts = Date.parse(ref);
  if (Number.isNaN(ts)) return true;
  return now - ts > STALE_RUN_MS;
}

/** Assinatura da versão exata dos documentos ativos do caso. */
export function documentsSignature(
  docs: Array<{ id: string; doc_number: number; storage_path?: string | null; file_name?: string | null }>,
): string {
  return docs.map((d) => `${d.id}:${d.doc_number}:${d.storage_path || d.file_name || ''}`).join('|');
}
