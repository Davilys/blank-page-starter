import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  contractValue,
  digits,
  renderStandardContract,
  validateBotConversaContractInput,
  type BotConversaContractInput,
} from '../_shared/botconversaContract.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

function safeEqual(left: string, right: string) {
  if (!left || !right || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function randomPassword() {
  return `${crypto.randomUUID()}Aa1!`;
}

function toSignatureUrl(token: string) {
  const configured = (Deno.env.get('SITE_URL') || '').replace(/\/+$/, '');
  const base = configured && !/lovable(app|project)\.com|localhost/i.test(configured) ? configured : 'https://webmarcas.net';
  return `${base}/assinar/${token}`;
}

async function resolveAddressFromCep(input: BotConversaContractInput): Promise<BotConversaContractInput> {
  const alreadyComplete = input.address.length >= 5 && input.neighborhood.length >= 2 &&
    input.city.length >= 2 && /^[A-Z]{2}$/.test(input.state);
  if (alreadyComplete) return input;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    let result: any = null;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits(input.cep)}/json/`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (response.ok) {
        const viaCep = await response.json();
        if (!viaCep?.erro) result = viaCep;
      }
    } catch {
      // BrasilAPI is used below as a second provider when ViaCEP is unavailable.
    }

    if (!result) {
      const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits(input.cep)}`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (response.status === 404) throw new Error('cep_not_found');
      if (!response.ok) throw new Error('cep_lookup_failed');
      const brasilApi = await response.json();
      result = {
        logradouro: brasilApi?.street,
        bairro: brasilApi?.neighborhood,
        localidade: brasilApi?.city,
        uf: brasilApi?.state,
      };
    }
    const street = typeof result?.logradouro === 'string' ? result.logradouro.trim() : '';
    const neighborhood = typeof result?.bairro === 'string' ? result.bairro.trim() : '';
    const city = typeof result?.localidade === 'string' ? result.localidade.trim() : '';
    const state = typeof result?.uf === 'string' ? result.uf.trim().toUpperCase() : '';
    if (!neighborhood || !city || !/^[A-Z]{2}$/.test(state)) throw new Error('cep_address_incomplete');
    return {
      ...input,
      // Rural and broad-range CEPs may identify the district/city but have no
      // street. Preserve the verified locality and explicitly mark this case.
      address: street ? `${street}, ${input.address_number}` : `Área Rural, nº ${input.address_number}`,
      neighborhood,
      city,
      state,
      cep: digits(input.cep),
    };
  } catch (error) {
    if (error instanceof Error && ['cep_not_found', 'cep_address_incomplete'].includes(error.message)) throw error;
    throw new Error('cep_lookup_failed');
  } finally {
    clearTimeout(timeout);
  }
}

function responseForExisting(request: any) {
  if (request.status === 'completed' && request.contract_id && request.signature_token) {
    return json({
      success: true,
      duplicate: true,
      data: {
        contract_id: request.contract_id,
        contract_number: request.contract_number,
        signature_url: toSignatureUrl(request.signature_token),
      },
    });
  }
  return null;
}

const PROCESSING_LEASE_MS = 60_000;

function isStaleProcessingRequest(updatedAt: string | null | undefined) {
  if (!updatedAt) return false;
  const timestamp = Date.parse(updatedAt);
  return Number.isFinite(timestamp) && Date.now() - timestamp > PROCESSING_LEASE_MS;
}

async function createOrFindProfile(supabase: any, input: BotConversaContractInput) {
  const cpf = digits(input.cpf);
  const { data: byEmail, error: emailError } = await supabase
    .from('profiles')
    .select('id, email, cpf_cnpj')
    .eq('email', input.email)
    .maybeSingle();
  if (emailError) throw new Error('profile_lookup_failed');
  const { data: byCpf, error: cpfError } = byEmail ? { data: null, error: null } : await supabase
    .from('profiles')
    .select('id, email, cpf_cnpj')
    .ilike('cpf_cnpj', `%${cpf}%`)
    .maybeSingle();
  if (cpfError) throw new Error('profile_lookup_failed');
  const existing = byEmail || byCpf;
  if (existing) {
    const { error } = await supabase.from('profiles').update({
      full_name: input.full_name,
      phone: input.phone,
      company_name: input.company_name,
      address: input.address,
      neighborhood: input.neighborhood,
      city: input.city,
      state: input.state,
      zip_code: input.cep,
      updated_at: new Date().toISOString(),
    }).eq('id', existing.id);
    if (error) throw new Error('profile_update_failed');
    return { userId: existing.id, isExisting: true };
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: randomPassword(),
    email_confirm: true,
    user_metadata: { full_name: input.full_name },
  });
  if (authError || !authData.user) {
    if (/already|exists|registered/i.test(authError?.message || '')) {
      const { data: racedProfile } = await supabase.from('profiles').select('id').eq('email', input.email).maybeSingle();
      if (racedProfile) return { userId: racedProfile.id, isExisting: true };
    }
    throw new Error('profile_create_failed');
  }
  const userId = authData.user.id;
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    email: input.email,
    full_name: input.full_name,
    phone: input.phone,
    cpf: input.cpf,
    cnpj: input.cnpj,
    cpf_cnpj: input.cpf,
    company_name: input.company_name,
    address: input.address,
    neighborhood: input.neighborhood,
    city: input.city,
    state: input.state,
    zip_code: input.cep,
    origin: 'botconversa_contract',
    client_funnel_type: 'comercial',
  });
  if (profileError) throw new Error('profile_create_failed');
  const { data: currentRole, error: roleReadError } = await supabase.from('user_roles')
    .select('user_id').eq('user_id', userId).eq('role', 'user').maybeSingle();
  if (roleReadError) throw new Error('profile_role_failed');
  if (!currentRole) {
    const { error: roleError } = await supabase.from('user_roles').insert({ user_id: userId, role: 'user' });
    if (roleError) throw new Error('profile_role_failed');
  }
  return { userId, isExisting: false };
}

async function createOrFindProcess(supabase: any, userId: string, input: BotConversaContractInput) {
  const { data: existing, error: lookupError } = await supabase.from('brand_processes')
    .select('id').eq('source_event_id', input.event_id).maybeSingle();
  if (lookupError) throw new Error('process_lookup_failed');
  if (existing?.id) return existing.id as string;
  const { data, error } = await supabase.from('brand_processes').insert({
    user_id: userId,
    brand_name: input.brand_name,
    business_area: input.business_area,
    status: 'em_andamento',
    pipeline_stage: 'assinou_contrato',
    source_event_id: input.event_id,
  }).select('id').single();
  if (error?.code === '23505') {
    const { data: raced, error: racedError } = await supabase.from('brand_processes')
      .select('id').eq('source_event_id', input.event_id).single();
    if (!racedError && raced?.id) return raced.id as string;
  }
  if (error) throw new Error('process_create_failed');
  return data.id as string;
}

async function standardTemplate(supabase: any) {
  const { data, error } = await supabase.from('contract_templates')
    .select('id, name, content')
    .eq('is_active', true)
    .ilike('name', '%registro de marca%')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error('template_read_failed');
  const template = (data || []).find((item: any) => /padr[ãa]o/i.test(item.name)) || data?.[0];
  if (!template?.content) throw new Error('template_not_found');
  return template;
}

async function createContract(supabase: any, userId: string, processId: string, input: BotConversaContractInput) {
  const { data: existing, error: lookupError } = await supabase.from('contracts')
    .select('id, contract_number, signature_token')
    .eq('source_event_id', input.event_id).maybeSingle();
  if (lookupError) throw new Error('contract_lookup_failed');
  if (existing?.id && existing.signature_token) {
    return { id: existing.id, contractNumber: existing.contract_number, token: existing.signature_token };
  }
  const template = await standardTemplate(supabase);
  const now = new Date();
  const token = crypto.randomUUID();
  let expiresInDays = 7;
  const { data: settings } = await supabase.from('system_settings').select('value').eq('key', 'contracts').maybeSingle();
  if (Number.isInteger(settings?.value?.linkValidityDays) && settings.value.linkValidityDays > 0 && settings.value.linkValidityDays <= 90) expiresInDays = settings.value.linkValidityDays;
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  const contractNumber = `BOT-${now.getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const { data, error } = await supabase.from('contracts').insert({
    user_id: userId,
    process_id: processId,
    contract_number: contractNumber,
    contract_type: 'registro_marca',
    subject: `CONTRATO REGISTRO DE MARCA - ${input.brand_name.toUpperCase()}`,
    contract_value: contractValue(input.payment_method),
    plan_type: 'essencial',
    start_date: now.toISOString().slice(0, 10),
    template_id: template.id,
    contract_html: renderStandardContract(template.content, input, now),
    document_type: 'contract',
    signatory_name: input.full_name,
    signatory_cpf: input.cpf,
    signatory_cnpj: input.cnpj,
    payment_method: input.payment_method,
    custom_due_date: input.custom_due_date,
    signature_status: 'not_signed',
    signature_token: token,
    signature_expires_at: expiresAt.toISOString(),
    visible_to_client: true,
    suggested_classes: input.suggested_classes?.length
      ? { classes: input.suggested_classes, selected: [input.suggested_classes[0]] }
      : null,
    source_event_id: input.event_id,
  }).select('id, contract_number').single();
  if (error?.code === '23505') {
    const { data: raced, error: racedError } = await supabase.from('contracts')
      .select('id, contract_number, signature_token')
      .eq('source_event_id', input.event_id).single();
    if (!racedError && raced?.id && raced.signature_token) {
      return { id: raced.id, contractNumber: raced.contract_number, token: raced.signature_token };
    }
  }
  if (error || !data) throw new Error('contract_create_failed');
  const { error: auditError } = await supabase.from('signature_audit_log').insert({
    contract_id: data.id,
    event_type: 'link_generated',
    event_data: { source: 'botconversa', expires_at: expiresAt.toISOString(), expires_in_days: expiresInDays },
  });
  if (auditError) throw new Error('signature_audit_failed');
  return { id: data.id, contractNumber: data.contract_number, token };
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);
  const secret = Deno.env.get('BOTCONVERSA_CONTRACT_WEBHOOK_SECRET') || '';
  const received = req.headers.get('x-botconversa-contract-secret') || '';
  if (!secret || !safeEqual(received, secret)) return json({ error: 'Não autorizado' }, 401);
  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: 'Corpo JSON inválido' }, 400); }
  const parsed = validateBotConversaContractInput(body);
  if (!parsed.data) return json({ error: 'Dados inválidos', fields: parsed.errors }, 422);
  let input = parsed.data;
  if (input.flow_name !== '1- AT FINAL SEMANA' || input.agent_name !== 'Fernanda Atendimento') {
    return json({ error: 'Origem do fluxo não autorizada' }, 403);
  }
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Configuração do servidor indisponível' }, 500);
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  let requestId = '';
  try {
    input = await resolveAddressFromCep(input);
    const { data: existing, error: existingError } = await supabase.from('botconversa_contract_requests')
      .select('id, status, attempt_count, contract_id, contract_number, signature_token, user_id, process_id, updated_at')
      .eq('event_id', input.event_id).maybeSingle();
    if (existingError) throw new Error('request_lookup_failed');
    if (existing) {
      const response = responseForExisting(existing);
      if (response) return response;
      const canResume = existing.status === 'failed'
        || (existing.status === 'processing' && isStaleProcessingRequest(existing.updated_at));
      if (!canResume) return json({ error: 'Solicitação já está em processamento. Aguarde e não envie novamente.' }, 409);
      requestId = existing.id;
      let claim = supabase.from('botconversa_contract_requests').update({
        status: 'processing', error_code: null, attempt_count: (existing.attempt_count || 0) + 1, updated_at: new Date().toISOString(),
      }).eq('id', requestId).eq('status', existing.status);
      if (existing.status === 'processing') claim = claim.eq('updated_at', existing.updated_at);
      const { data: claimed, error } = await claim.select('id').maybeSingle();
      if (error || !claimed) return json({ error: 'Solicitação não pode ser retomada agora' }, 409);
    } else {
      const { data: created, error } = await supabase.from('botconversa_contract_requests').insert({
        event_id: input.event_id, source: 'botconversa', flow_name: input.flow_name,
        agent_name: input.agent_name, status: 'processing', attempt_count: 1,
      }).select('id').single();
      if (error?.code === '23505') return json({ error: 'Solicitação já está em processamento. Aguarde e não envie novamente.' }, 409);
      if (error || !created) throw new Error('request_create_failed');
      requestId = created.id;
    }
    let request = await supabase.from('botconversa_contract_requests').select('status, user_id, process_id, contract_id, contract_number, signature_token').eq('id', requestId).single();
    if (request.error) throw new Error('request_read_failed');
    let userId = request.data.user_id as string | null;
    let processId = request.data.process_id as string | null;
    let contractId = request.data.contract_id as string | null;
    let contractNumber = request.data.contract_number as string | null;
    let signatureToken = request.data.signature_token as string | null;
    if (!userId) {
      const profile = await createOrFindProfile(supabase, input);
      userId = profile.userId;
      const { error } = await supabase.from('botconversa_contract_requests').update({ user_id: userId, updated_at: new Date().toISOString() }).eq('id', requestId);
      if (error) throw new Error('request_update_failed');
    }
    if (!processId) {
      processId = await createOrFindProcess(supabase, userId, input);
      const { error } = await supabase.from('botconversa_contract_requests').update({
        process_id: processId, updated_at: new Date().toISOString(),
      }).eq('id', requestId);
      if (error) throw new Error('request_update_failed');
    }
    if (!contractId) {
      const contract = await createContract(supabase, userId, processId, input);
      contractId = contract.id;
      contractNumber = contract.contractNumber;
      signatureToken = contract.token;
      const { error } = await supabase.from('botconversa_contract_requests').update({
        contract_id: contractId, contract_number: contractNumber, signature_token: signatureToken, updated_at: new Date().toISOString(),
      }).eq('id', requestId);
      if (error) throw new Error('request_update_failed');
    }
    if (request.data.status !== 'completed') {
      const { error: completedError } = await supabase.from('botconversa_contract_requests').update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', requestId);
      if (completedError) throw new Error('request_complete_failed');
    }
    // A freshly created contract receives 201. Replays return the same signature URL
    // without creating another process or contract.
    return json({ success: true, data: { contract_id: contractId, contract_number: contractNumber, signature_url: toSignatureUrl(signatureToken!), recipient_name: input.full_name } }, 201);
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : 'unexpected_error';
    console.error('BotConversa contract webhook failed', { requestId, errorCode });
    if (requestId) await supabase.from('botconversa_contract_requests').update({ status: 'failed', error_code: errorCode, updated_at: new Date().toISOString() }).eq('id', requestId).eq('status', 'processing');
    return json({ error: 'Não foi possível criar o contrato neste momento.', code: errorCode }, 500);
  }
});
