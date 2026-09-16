/**
 * Configuração de modelo EXCLUSIVA das três modalidades de Recursos INPI:
 * indeferimento, cumprimento de exigência de mérito e manifestação à oposição.
 *
 * Regra de isolamento: a seleção do modelo acontece NO SERVIDOR, a partir da
 * modalidade validada. Qualquer outra modalidade (notificação extrajudicial,
 * resposta, procurador) e qualquer outro módulo continuam exatamente com o
 * modelo que já usavam. Nenhuma variável global é alterada.
 */

export const RECURSOS_INPI_MODALITIES = ['indeferimento', 'exigencia_merito', 'oposicao'] as const;
export type RecursosInpiModality = (typeof RECURSOS_INPI_MODALITIES)[number];

/** Modelo dedicado. Configurável por segredo, sem tocar em OPENAI_MODEL. */
export const RECURSOS_INPI_DEFAULT_MODEL = 'gpt-5.6-sol';

export interface ModelConfig {
  /** Identificador de API enviado à OpenAI. */
  model: string;
  /** Esforço de raciocínio da Responses API. */
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high';
  /** true quando a chamada pertence às três modalidades desta entrega. */
  dedicated: boolean;
}

export function isRecursosInpiModality(resourceType: unknown): resourceType is RecursosInpiModality {
  return typeof resourceType === 'string' &&
    (RECURSOS_INPI_MODALITIES as readonly string[]).includes(resourceType);
}

export function getRecursosInpiModel(): string {
  const configured = (Deno.env.get('RECURSOS_INPI_MODEL') || '').trim();
  return configured || RECURSOS_INPI_DEFAULT_MODEL;
}

/**
 * Resolve o modelo a partir da modalidade validada no servidor.
 * `legacyModel` é o modelo histórico do consumidor — preservado intacto para
 * todas as modalidades fora do escopo desta entrega.
 */
export function resolveModelConfig(
  resourceType: unknown,
  legacyModel: string,
  legacyEffort: ModelConfig['reasoningEffort'] = 'minimal',
): ModelConfig {
  if (isRecursosInpiModality(resourceType)) {
    // Raciocínio 'medium': 'high' consumia o mesmo orçamento do texto final e
    // truncava a peça (incomplete_details.reason = max_output_tokens).
    return { model: getRecursosInpiModel(), reasoningEffort: 'medium', dedicated: true };
  }
  return { model: legacyModel, reasoningEffort: legacyEffort, dedicated: false };
}

/** Mensagem de falha de configuração (nunca troca de família silenciosamente). */
export function modelConfigErrorMessage(model: string, detail?: string): string {
  return `O modelo dedicado de Recursos INPI (${model}) não está acessível nesta conta OpenAI. ` +
    `O trabalho foi preservado; nenhuma peça foi gerada com outro modelo. ` +
    `Peça ao administrador para verificar o acesso ao modelo.${detail ? ` Detalhe técnico: ${detail}` : ''}`;
}

/** Erros de modelo indisponível/desconhecido devolvidos pela OpenAI. */
export function isModelAccessError(status: number | undefined, body: string | undefined): boolean {
  if (!status) return false;
  if (status === 404) return true;
  if (status !== 400 && status !== 403) return false;
  const text = (body || '').toLowerCase();
  return text.includes('model') && (
    text.includes('does not exist') ||
    text.includes('do not have access') ||
    text.includes('not found') ||
    text.includes('unsupported') ||
    text.includes('invalid model')
  );
}

/**
 * Chamada mínima real de disponibilidade — sem qualquer conteúdo de cliente.
 */
export async function probeRecursosInpiModel(apiKey: string): Promise<{
  ok: boolean;
  model: string;
  status?: number;
  detail?: string;
  durationMs: number;
}> {
  const model = getRecursosInpiModel();
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input: [{ role: 'user', content: [{ type: 'input_text', text: 'ping' }] }],
        max_output_tokens: 16,
        reasoning: { effort: 'low' },
      }),
    });
    const durationMs = Date.now() - started;
    if (!resp.ok) {
      const detail = (await resp.text().catch(() => '')).slice(0, 300);
      return { ok: false, model, status: resp.status, detail, durationMs };
    }
    await resp.json().catch(() => null);
    return { ok: true, model, status: resp.status, durationMs };
  } catch (e) {
    return {
      ok: false,
      model,
      detail: e instanceof Error ? e.message : 'falha de rede',
      durationMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export interface AiCallLogEntry {
  resource_type: string;
  operation: string;
  model: string;
  dedicated_model: boolean;
  reasoning_effort: string;
  prompt_version: string;
  duration_ms: number;
  status: string;
  http_status?: number | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  correlation_id: string;
  case_id?: string | null;
  error_kind?: string | null;
}

/**
 * Registro de uso: modelo realmente utilizado, versão do prompt, operação,
 * duração, consumo e correlação. Nunca grava conteúdo nem segredos.
 */
export async function logAiCall(
  supabaseAdmin: { from: (t: string) => { insert: (v: unknown) => Promise<{ error: unknown }> } },
  entry: AiCallLogEntry,
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('inpi_ai_call_logs').insert(entry);
    if (error) console.warn('ai call log insert failed:', JSON.stringify(error).slice(0, 200));
  } catch (e) {
    console.warn('ai call log exception:', (e as Error).message);
  }
}
