import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-publication-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: secretSetting } = await admin.from('system_settings').select('value').eq('key', 'publication_webhook_secret').maybeSingle();
  const expectedSecret = (secretSetting?.value as any)?.secret || '';
  const suppliedSecret = req.headers.get('x-publication-webhook-secret');
  if (suppliedSecret !== expectedSecret) {
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const bearer = req.headers.get('Authorization') || '';
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: bearer } }, auth: { persistSession: false } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Não autorizado' }, 401);
    const { data: role } = await admin.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!role) return json({ error: 'Acesso restrito à equipe' }, 403);
  }
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const clientId = typeof body.client_id === 'string' ? body.client_id : '';
  const ids = Array.isArray(body.document_ids) ? body.document_ids.filter((x: unknown): x is string => typeof x === 'string').slice(0, 30) : [];
  if (!clientId || ids.length === 0) return json({ error: 'Cliente e arquivos são obrigatórios' }, 422);
  const [{ data: profile }, { data: docs, error: docsError }] = await Promise.all([
    admin.from('profiles').select('id, full_name, phone').eq('id', clientId).single(),
    admin.from('documents').select('id, name, file_url, mime_type, file_size').eq('user_id', clientId).in('id', ids),
  ]);
  if (docsError || !profile) return json({ error: 'Cliente ou documentos não encontrados' }, 404);
  if (!profile.phone) return json({ error: 'Cliente sem telefone cadastrado' }, 422);
  if (!docs || docs.length !== ids.length) return json({ error: 'Um ou mais arquivos não pertencem a este cliente' }, 422);
  const arquivos = docs.map((d: any) => ({ nome: d.name, url: d.file_url, tipo: d.mime_type || 'application/octet-stream', tamanho: d.file_size || 0 }));
  const eventId = `publicacao-documentos-${clientId}-${crypto.randomUUID()}`;
  const message = `Olá, ${profile.full_name || 'cliente'}. Enviamos ${arquivos.length} documento(s) referente(s) à atualização do seu processo. Confira os arquivos abaixo e, se precisar, agende um atendimento com nossa equipe.`;
  // This action must be isolated from the generic CRM notification webhook,
  // which belongs to the Atendimento company. Never fall back to that config.
  const { data: settings } = await admin
    .from('system_settings')
    .select('value')
    .eq('key', 'botconversa_financeiro_publicacao')
    .maybeSingle();
  const config = (settings?.value || {}) as Record<string, unknown>;
  const webhookUrl = typeof config.webhook_url === 'string' ? config.webhook_url : '';
  if (config.enabled !== true || !webhookUrl) {
    return json({ error: 'Webhook Financeiro/Publicação Inicial não configurado' }, 503);
  }
  const normalizedPhone = String(profile.phone).replace(/\D/g, '').replace(/^0/, '');
  const telefone = normalizedPhone.startsWith('55') ? normalizedPhone : `55${normalizedPhone}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof config.auth_token === 'string' && config.auth_token) headers.Authorization = `Bearer ${config.auth_token}`;
  const webhookResponse = await fetch(webhookUrl, { method: 'POST', headers, body: JSON.stringify({ telefone, nome: profile.full_name || 'Cliente', mensagem: message, tipo_notificacao: 'publicacao_documentos', arquivos: JSON.stringify(arquivos), quantidade_arquivos: String(arquivos.length), client_id: clientId, event_id: eventId, process_id: body.process_id || '', publication_id: body.publication_id || '' }) });
  if (!webhookResponse.ok) {
    const detail = (await webhookResponse.text()).replace(/\s+/g, ' ').trim().slice(0, 300);
    return json({ error: `Webhook recusou o envio (HTTP ${webhookResponse.status})${detail ? `: ${detail}` : ''}` }, 502);
  }
  return json({ success: true, event_id: eventId, quantity: arquivos.length, files: arquivos.map((f: any) => f.nome) });
});
