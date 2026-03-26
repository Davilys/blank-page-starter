import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationPayload {
  event_type: string;
  channels?: Array<'crm' | 'sms' | 'whatsapp' | 'email'>;
  recipient?: {
    nome?: string;
    email?: string;
    phone?: string;
    user_id?: string;
  };
  user_id?: string;
  custom_message?: string;
  data?: {
    link?: string;
    valor?: string;
    marca?: string;
    mensagem_custom?: string;
    titulo?: string;
  };
  metadata?: Record<string, unknown>;
}

interface ChannelResult {
  success: boolean;
  response?: string;
  error?: string;
  attempts: number;
  skipped?: boolean;
  skip_reason?: string;
}

// ─── Message Builder ──────────────────────────────────────────────────────────

function buildMessage(event_type: string, data: NotificationPayload['data'], nome: string, customMessage?: string): string {
  // Priority: custom_message > data.mensagem_custom > template
  if (customMessage) return customMessage;
  if (data?.mensagem_custom) return data.mensagem_custom;

  const marca = data?.marca || 'sua marca';
  const link  = data?.link  || '';
  const valor = data?.valor ? `R$ ${data.valor}` : '';

  const map: Record<string, string> = {
    formulario_preenchido : `WebMarcas: Olá ${nome}, recebemos seu formulário para o registro de ${marca}. Em breve entraremos em contato!`,
    link_assinatura_gerado: `WebMarcas: Olá ${nome}, seu contrato para ${marca} está pronto para assinatura. Acesse: ${link}`,
    contrato_assinado     : `WebMarcas: Parabéns ${nome}! Seu contrato para ${marca} foi assinado com sucesso.`,
    cobranca_gerada       : `WebMarcas: Olá ${nome}, nova cobrança de ${valor} gerada para ${marca}. Acesse: ${link}`,
    fatura_vencida        : `WebMarcas: Atenção ${nome}! Sua fatura de ${valor} para ${marca} está vencida. Regularize em: ${link || 'webmarcas.net'}`,
    pagamento_confirmado  : `WebMarcas: Olá ${nome}, confirmamos o pagamento de ${valor} para ${marca}. Obrigado!`,
    manual                : `WebMarcas: ${customMessage || data?.mensagem_custom || 'Você tem uma nova notificação.'}`,
  };

  return map[event_type] ?? `WebMarcas: Olá ${nome}, você tem uma nova notificação.`;
}

function getTitulo(event_type: string, data?: NotificationPayload['data']): string {
  if (data?.titulo) return data.titulo;
  const map: Record<string, string> = {
    formulario_preenchido : 'Formulário recebido',
    link_assinatura_gerado: 'Contrato pronto para assinatura',
    contrato_assinado     : 'Contrato assinado com sucesso',
    cobranca_gerada       : 'Nova cobrança gerada',
    fatura_vencida        : 'Fatura vencida',
    pagamento_confirmado  : 'Pagamento confirmado',
    manual                : 'Nova notificação',
  };
  return map[event_type] ?? 'Nova notificação';
}

function getNotifType(event_type: string): string {
  const map: Record<string, string> = {
    formulario_preenchido : 'info',
    link_assinatura_gerado: 'info',
    contrato_assinado     : 'success',
    cobranca_gerada       : 'warning',
    fatura_vencida        : 'error',
    pagamento_confirmado  : 'success',
    manual                : 'info',
  };
  return map[event_type] ?? 'info';
}

// ─── Retry Wrapper ─────────────────────────────────────────────────────────────

async function withRetry(
  fn: () => Promise<{ success: boolean; response?: string; error?: string }>,
  maxAttempts = 3
): Promise<ChannelResult> {
  let last: { success: boolean; response?: string; error?: string } = { success: false, error: 'No attempts' };
  for (let i = 1; i <= maxAttempts; i++) {
    last = await fn();
    if (last.success) return { ...last, attempts: i };
    if (i < maxAttempts) await new Promise(r => setTimeout(r, 1000 * i));
  }
  return { ...last, attempts: maxAttempts };
}

// ─── Link Extractor ───────────────────────────────────────────────────────────

const URL_REGEX = /https?:\/\/[^\s]+/g;

function extractLinks(text: string): { cleanText: string; links: string[] } {
  const links = text.match(URL_REGEX) || [];
  const cleanText = text.replace(URL_REGEX, '').replace(/\s+/g, ' ').trim();
  return { cleanText, links };
}

// ─── AI SMS Summarizer ────────────────────────────────────────────────────────

async function summarizeForSMS(message: string): Promise<string> {
  if (message.length <= 160) return message;

  const { cleanText, links } = extractLinks(message);
  const linkSpace = links.reduce((acc, l) => acc + l.length + 1, 0);
  const targetLen = Math.max(60, 155 - linkSpace);

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `Você é um compressor de SMS profissional. Resuma a mensagem em no máximo ${targetLen} caracteres.
REGRAS OBRIGATÓRIAS:
- Mantenha sempre "WebMarcas:" no início
- Preserve o nome do destinatário
- Preserve valores monetários (R$)
- Preserve nomes de marcas/produtos
- Não use abreviações que dificultem entendimento
- Não adicione comentários, apenas o texto resumido
- Responda SOMENTE o texto resumido, sem aspas`,
          },
          { role: 'user', content: cleanText },
        ],
        max_tokens: 80,
        temperature: 0.2,
      }),
    });

    if (!res.ok) throw new Error(`AI gateway HTTP ${res.status}`);

    const json = await res.json();
    const summary = (json.choices?.[0]?.message?.content as string | undefined)?.trim() || '';

    if (!summary) throw new Error('resposta vazia da IA');

    const final = links.length > 0 ? `${summary} ${links.join(' ')}` : summary;
    console.log(`[sms-ai] Resumo aplicado: ${message.length} → ${final.length} chars`);
    return final.substring(0, 160);

  } catch (err) {
    console.warn('[sms-ai] Resumo falhou, usando fallback manual:', err);
    if (links.length > 0) {
      const link = links[0];
      const spaceForLink = 160 - link.length - 1;
      return `${cleanText.substring(0, spaceForLink)} ${link}`;
    }
    return message.substring(0, 160);
  }
}

// ─── SMS via Zenvia ───────────────────────────────────────────────────────────

async function sendSMS(
  settings: Record<string, unknown>,
  phone: string,
  message: string
): Promise<{ success: boolean; response?: string; error?: string }> {
  if (!settings.enabled) return { success: false, error: 'SMS desativado' };
  
  const apiKey = (settings.api_key as string) || '';
  if (!apiKey) return { success: false, error: 'API Key Zenvia não configurada' };
  if (!phone)  return { success: false, error: 'Telefone não informado' };

  const normalized = phone.replace(/\D/g, '').replace(/^0/, '');
  const finalPhone  = normalized.startsWith('55') ? normalized : `55${normalized}`;

  const body = {
    from: { type: 'CHANNEL', number: (settings.sender_name as string) || 'WebMarcas' },
    to:   { type: 'SMS',     number: finalPhone },
    contents: [{ type: 'text', text: message.substring(0, 160) }],
  };

  try {
    const res = await fetch('https://api.zenvia.com/v2/channels/sms/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-TOKEN': apiKey },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return res.ok
      ? { success: true, response: text }
      : { success: false, error: `Zenvia HTTP ${res.status}: ${text}` };
  } catch (err: unknown) {
    return { success: false, error: (err as Error)?.message ?? 'Erro ao enviar SMS' };
  }
}

// ─── WhatsApp via BotConversa ─────────────────────────────────────────────────

async function sendWhatsApp(
  settings: Record<string, unknown>,
  phone: string,
  nome: string,
  message: string,
  extraData: Record<string, string>
): Promise<{ success: boolean; response?: string; error?: string }> {
  if (!settings.enabled) return { success: false, error: 'WhatsApp desativado' };

  const webhookUrl = (settings.webhook_url as string) || '';
  if (!webhookUrl) return { success: false, error: 'URL do Webhook BotConversa não configurada' };
  if (!phone)      return { success: false, error: 'Telefone não informado' };

  const normalized = phone.replace(/\D/g, '').replace(/^0/, '');
  const finalPhone  = normalized.startsWith('55') ? normalized : `55${normalized}`;

  const payload = { telefone: finalPhone, nome: nome || 'Cliente', mensagem: message, ...extraData };
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const authToken = (settings.auth_token as string) || '';
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  try {
    const res = await fetch(webhookUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
    const text = await res.text();
    return res.ok
      ? { success: true, response: text }
      : { success: false, error: `BotConversa HTTP ${res.status}: ${text}` };
  } catch (err: unknown) {
    return { success: false, error: (err as Error)?.message ?? 'Erro ao enviar WhatsApp' };
  }
}

// ─── Log Dispatch ─────────────────────────────────────────────────────────────

async function logDispatch(
  supabase: ReturnType<typeof createClient>,
  event_type: string,
  channel: string,
  status: 'sent' | 'failed',
  payload: Record<string, unknown>,
  recipient_phone?: string,
  recipient_email?: string,
  recipient_user_id?: string,
  error_message?: string,
  response_body?: string,
  attempts = 1,
) {
  try {
    await supabase.from('notification_dispatch_logs').insert({
      event_type, channel, status, payload,
      recipient_phone:   recipient_phone   || null,
      recipient_email:   recipient_email   || null,
      recipient_user_id: recipient_user_id || null,
      error_message:     error_message     || null,
      response_body:     response_body     || null,
      attempts,
    });
  } catch (e) {
    console.error('[log-dispatch] Error logging:', e);
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const payload: NotificationPayload = await req.json();
    const { event_type, data } = payload;
    // Normalize channels: filter out 'email' (handled separately) and ensure valid set
    const rawChannels = payload.channels || ['crm', 'sms', 'whatsapp'];
    const channels = rawChannels.filter(c => ['crm', 'sms', 'whatsapp'].includes(c)) as Array<'crm' | 'sms' | 'whatsapp'>;

    if (!event_type) {
      return new Response(JSON.stringify({ error: 'event_type é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl        = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase           = createClient(supabaseUrl, supabaseServiceKey);

    // ── Load channel settings ──────────────────────────────────────────────────
    const [smsRow, botRow] = await Promise.all([
      supabase.from('system_settings').select('value').eq('key', 'sms_provider').maybeSingle(),
      supabase.from('system_settings').select('value').eq('key', 'botconversa').maybeSingle(),
    ]);

    const smsSettings = (smsRow.data?.value as Record<string, unknown>) ?? { enabled: false };
    const botSettings = (botRow.data?.value as Record<string, unknown>) ?? { enabled: false };

    // ── Resolve recipient ──────────────────────────────────────────────────────
    // Support multiple payload shapes:
    // 1. { recipient: { nome, phone, email, user_id } }
    // 2. { user_id: "..." } (top-level)
    // 3. Both combined
    const incomingRecipient = payload.recipient || {};
    const userId = incomingRecipient.user_id || payload.user_id;
    
    let resolvedNome  = incomingRecipient.nome  || '';
    let resolvedPhone = incomingRecipient.phone || '';
    let resolvedEmail = incomingRecipient.email || '';
    let resolvedUserId = userId || '';

    // If we have a user_id but missing name/phone, fetch from profiles
    if (userId && (!resolvedNome || !resolvedPhone)) {
      const { data: profile } = await supabase
        .from('profiles').select('phone, full_name, email').eq('id', userId).maybeSingle();
      if (profile) {
        if (!resolvedNome)  resolvedNome  = profile.full_name || 'Cliente';
        if (!resolvedPhone) resolvedPhone = profile.phone || '';
        if (!resolvedEmail) resolvedEmail = profile.email || '';
      }
    }

    if (!resolvedNome) resolvedNome = 'Cliente';

    // ── Build message ──────────────────────────────────────────────────────────
    const safeData = data || {};
    const message = buildMessage(event_type, safeData, resolvedNome, payload.custom_message);
    const results: Record<string, ChannelResult> = {};
    const rawPayload = payload as unknown as Record<string, unknown>;

    console.log(`[multichannel] Processing event=${event_type}, channels=${channels.join(',')}, user=${resolvedUserId}, phone=${resolvedPhone || 'N/A'}`);

    // ── CRM ───────────────────────────────────────────────────────────────────
    if (channels.includes('crm')) {
      if (resolvedUserId) {
        try {
          const titulo = getTitulo(event_type, safeData);
          const { error } = await supabase.from('notifications').insert({
            user_id: resolvedUserId,
            title: titulo,
            message,
            type: getNotifType(event_type),
            read: false,
            link: safeData.link || null,
          });
          const status = error ? 'failed' : 'sent';
          results.crm = { success: !error, error: error?.message, attempts: 1 };
          await logDispatch(supabase, event_type, 'crm', status, rawPayload,
            undefined, resolvedEmail, resolvedUserId, error?.message);
        } catch (e: unknown) {
          results.crm = { success: false, error: (e as Error).message, attempts: 1 };
          await logDispatch(supabase, event_type, 'crm', 'failed', rawPayload,
            undefined, resolvedEmail, resolvedUserId, (e as Error).message);
        }
      } else {
        results.crm = { success: false, error: 'user_id não fornecido', attempts: 0, skipped: true, skip_reason: 'sem user_id' };
      }
    }

    // ── SMS ───────────────────────────────────────────────────────────────────
    if (channels.includes('sms')) {
      if (!resolvedPhone) {
        results.sms = { success: false, error: 'Telefone não informado', attempts: 0, skipped: true, skip_reason: 'sem phone' };
        await logDispatch(supabase, event_type, 'sms', 'failed', rawPayload,
          undefined, resolvedEmail, resolvedUserId, 'Telefone não informado', undefined, 0);
      } else {
        const smsMessage = await summarizeForSMS(message);
        const smsSummarized = smsMessage !== message;
        const smsResult = await withRetry(() => sendSMS(smsSettings, resolvedPhone, smsMessage));
        results.sms = { ...smsResult, ...(smsSummarized ? { summarized: true, original_length: message.length, sms_length: smsMessage.length } as any : {}) };
        await logDispatch(supabase, event_type, 'sms',
          smsResult.success ? 'sent' : 'failed',
          { ...rawPayload, sms_message_summarized: smsSummarized, sms_final_message: smsMessage },
          resolvedPhone, resolvedEmail, resolvedUserId,
          smsResult.error, smsResult.response, smsResult.attempts);
      }
    }

    // ── WhatsApp (BotConversa) ────────────────────────────────────────────────
    if (channels.includes('whatsapp')) {
      if (!resolvedPhone) {
        results.whatsapp = { success: false, error: 'Telefone não informado', attempts: 0, skipped: true, skip_reason: 'sem phone' };
        await logDispatch(supabase, event_type, 'whatsapp', 'failed', rawPayload,
          undefined, resolvedEmail, resolvedUserId, 'Telefone não informado', undefined, 0);
      } else {
        const extra: Record<string, string> = {
          tipo_notificacao: event_type,
          ...(safeData.link  ? { link:  safeData.link  } : {}),
          ...(safeData.marca ? { marca: safeData.marca } : {}),
          ...(safeData.valor ? { valor: safeData.valor } : {}),
        };
        const waResult = await withRetry(() => sendWhatsApp(botSettings, resolvedPhone, resolvedNome, message, extra));
        results.whatsapp = waResult;
        await logDispatch(supabase, event_type, 'whatsapp',
          waResult.success ? 'sent' : 'failed', rawPayload,
          resolvedPhone, resolvedEmail, resolvedUserId,
          waResult.error, waResult.response, waResult.attempts);
      }
    }

    console.log(`[multichannel] event=${event_type} phone=${resolvedPhone || 'N/A'}`, JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, event_type, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    console.error('[multichannel] Fatal error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);
