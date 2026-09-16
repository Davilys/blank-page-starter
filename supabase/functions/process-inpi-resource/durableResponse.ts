/** Short provider calls with a durable checkpoint. Never keep an Edge worker
 * alive while the model reasons. A lost POST acknowledgement is not retried:
 * doing so could buy the same generation twice. */
export type AIResult = { content: string; error?: string; status?: number; errorKind?: string };
export type Checkpoint = {
  fingerprint: string; response_id?: string | null; created_at: string;
  result?: AIResult | null;
};
export interface ResponseStore {
  read(): Promise<Checkpoint | null>;
  reserve(fingerprint: string): Promise<boolean>;
  save(patch: Partial<Checkpoint>): Promise<void>;
}
export const pending = (): AIResult => ({ content: '', error: 'A IA está processando.', status: 202, errorKind: 'provider_pending' });
const failure = (error: string, errorKind: string, status = 502): AIResult => ({ content: '', error, errorKind, status });

export function parseProviderResponse(data: any): AIResult {
  if (data?.status === 'queued' || data?.status === 'in_progress') return pending();
  if (data?.status !== 'completed') {
    return failure(data?.status === 'incomplete'
      ? `Resposta incompleta da IA (${data?.incomplete_details?.reason || 'sem motivo'}). A peça não foi concluída.`
      : 'A IA não confirmou a conclusão da resposta.', data?.status === 'incomplete' ? 'truncated' : 'provider_failed');
  }
  let content = '';
  for (const item of data.output || []) {
    if (item.type !== 'message') continue;
    for (const part of item.content || []) {
      if (part.type === 'refusal') return failure('O modelo recusou a geração.', 'refusal', 422);
      if (part.type === 'output_text' && typeof part.text === 'string') content += part.text;
    }
  }
  return content.trim() ? { content } : failure('A IA concluiu sem devolver texto.', 'empty');
}

export async function advanceResponse(
  apiKey: string, request: Record<string, unknown>, store: ResponseStore,
  transport: typeof fetch = fetch, now = Date.now(),
): Promise<AIResult> {
  const payload = JSON.stringify({ ...request, stream: false, background: true, store: true });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  const fingerprint = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  let row = await store.read();
  if (row && row.fingerprint !== fingerprint) return failure('O conteúdo do caso mudou. Inicie uma nova geração para a versão atual.', 'version_changed', 409);
  if (row?.result) return row.result;
  let submit = false;
  if (!row) {
    submit = await store.reserve(fingerprint);
    if (!submit) return pending();
    row = { fingerprint, created_at: new Date(now).toISOString() };
  }
  if (!submit && !row.response_id) {
    return now - Date.parse(row.created_at) < 60000 ? pending()
      : failure('Não foi possível confirmar o recebimento da geração pela IA. A solicitação não será reenviada automaticamente para evitar cobrança duplicada.', 'submission_unknown');
  }
  let response: Response;
  try {
    response = await transport(submit ? 'https://api.openai.com/v1/responses'
      : `https://api.openai.com/v1/responses/${encodeURIComponent(row.response_id!)}`, {
      method: submit ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: submit ? payload : undefined,
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    // GET is safe to repeat. POST might already have been accepted.
    return submit ? failure('O envio à IA não teve confirmação. Nenhum reenvio automático foi feito.', 'submission_unknown') : pending();
  }
  if (!response.ok) {
    if (!submit && (response.status === 429 || response.status >= 500)) return pending();
    const result = failure(`A IA recusou a operação (HTTP ${response.status}).`, response.status === 401 || response.status === 403 ? 'model_config' : 'provider_http', response.status);
    await store.save({ result });
    return result;
  }
  let data: any;
  try { data = await response.json(); } catch { return failure('Resposta ilegível do provedor de IA.', 'provider_invalid'); }
  if (typeof data.id !== 'string' || !data.id.startsWith('resp_') || (!submit && data.id !== row.response_id)) {
    return failure('Identificador da resposta da IA inválido.', 'provider_invalid');
  }
  // Save the id BEFORE interpreting content. A worker restart will retrieve it.
  if (submit) await store.save({ response_id: data.id });
  const result = parseProviderResponse(data);
  if (result.errorKind === 'provider_pending' && now - Date.parse(row.created_at) > 30 * 60000) {
    return failure('A IA excedeu o prazo de acompanhamento desta geração.', 'provider_timeout', 504);
  }
  if (result.errorKind !== 'provider_pending') await store.save({ result });
  return result;
}

export function responseStore(db: any, jobId: string, operation: string): ResponseStore {
  const query = () => db.from('inpi_generation_responses');
  return {
    async read() {
      const { data, error } = await query().select('*').eq('job_id', jobId).eq('operation', operation).maybeSingle();
      if (error) throw new Error('Não foi possível consultar o checkpoint da IA.');
      return data;
    },
    async reserve(fingerprint) {
      const { error } = await query().insert({ job_id: jobId, operation, fingerprint });
      if (error?.code === '23505') return false;
      if (error) throw new Error('Não foi possível reservar a geração da IA.');
      return true;
    },
    async save(patch) {
      const { data, error } = await query().update(patch).eq('job_id', jobId).eq('operation', operation).select('job_id').maybeSingle();
      if (error || !data) throw new Error('Não foi possível salvar o checkpoint da IA.');
    },
  };
}
