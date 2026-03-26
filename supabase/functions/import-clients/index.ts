import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ClientToImport {
  email: string;
  full_name?: string;
  phone?: string;
  company_name?: string;
  cpf_cnpj?: string;
  cpf?: string;
  cnpj?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  origin?: string;
  priority?: string;
  contract_value?: number;
  brand_name?: string;
}

interface ProcessResult {
  status: 'imported' | 'updated' | 'skipped' | 'error';
  email: string;
  message?: string;
}

// ── Find existing profile by cascading criteria ──────────────────────────
async function findExistingProfile(
  supabaseAdmin: ReturnType<typeof createClient>,
  client: ClientToImport,
): Promise<{ id: string } | null> {
  const email = client.email?.toLowerCase().trim();

  // 1. By email
  if (email) {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (data) return data;
  }

  // 2. By CPF (digits only)
  const cpfDigits = (client.cpf || client.cpf_cnpj || '').replace(/\D/g, '');
  if (cpfDigits.length === 11) {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('cpf', cpfDigits)
      .maybeSingle();
    if (data) return data;
  }

  // 3. By CNPJ (digits only)
  const cnpjDigits = (client.cnpj || client.cpf_cnpj || '').replace(/\D/g, '');
  if (cnpjDigits.length === 14) {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('cnpj', cnpjDigits)
      .maybeSingle();
    if (data) return data;
  }

  // 4. By full_name (case-insensitive)
  if (client.full_name && client.full_name.trim().length >= 3) {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('full_name', client.full_name.trim())
      .maybeSingle();
    if (data) return data;
  }

  return null;
}

// ── Build merge update: only non-empty values overwrite ──────────────────
function buildMergeUpdate(client: ClientToImport) {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (client.full_name) update.full_name = client.full_name;
  if (client.phone) update.phone = client.phone;
  if (client.company_name) update.company_name = client.company_name;
  if (client.cpf_cnpj) update.cpf_cnpj = client.cpf_cnpj;
  if (client.cpf) update.cpf = client.cpf;
  if (client.cnpj) update.cnpj = client.cnpj;
  if (client.address) update.address = client.address;
  if (client.neighborhood) update.neighborhood = client.neighborhood;
  if (client.city) update.city = client.city;
  if (client.state) update.state = client.state;
  if (client.zip_code) update.zip_code = client.zip_code;
  return update;
}

// ── Process a single client ──────────────────────────────────────────────
async function processClient(
  supabaseAdmin: ReturnType<typeof createClient>,
  client: ClientToImport,
  callerUserId: string,
): Promise<ProcessResult> {
  const email = client.email?.toLowerCase().trim();
  if (!email) return { status: 'skipped', email: '', message: 'Email vazio' };

  // ── Find existing profile by email / cpf / cnpj / name ─────────────────
  const existingProfile = await findExistingProfile(supabaseAdmin, client);

  if (existingProfile) {
    // Always update
    const mergeData = buildMergeUpdate(client);
    const { error } = await supabaseAdmin
      .from('profiles')
      .update(mergeData)
      .eq('id', existingProfile.id);

    if (error) return { status: 'error', email, message: `Erro ao atualizar: ${error.message}` };

    // Ensure brand_process exists in Jurídico > Protocolado
    const brandName = client.brand_name || client.company_name || client.full_name || email;
    await supabaseAdmin
      .from('brand_processes')
      .upsert({
        user_id: existingProfile.id,
        brand_name: brandName,
        status: 'em_andamento',
        pipeline_stage: 'protocolado',
      }, { onConflict: 'user_id,brand_name', ignoreDuplicates: true })
      .then(() => {/* ok */})
      .catch(() => {
        // Fallback: insert ignoring conflicts
        supabaseAdmin.from('brand_processes').insert({
          user_id: existingProfile.id,
          brand_name: brandName,
          status: 'em_andamento',
          pipeline_stage: 'protocolado',
        });
      });

    // Update client_funnel_type to juridico
    await supabaseAdmin
      .from('profiles')
      .update({ client_funnel_type: 'juridico' })
      .eq('id', existingProfile.id);

    // Remove from leads table if exists (client ≠ lead)
    await supabaseAdmin.from('leads').delete().eq('email', email);

    return { status: 'updated', email };
  }

  // ── New client ────────────────────────────────────────────────────────────
  // 1. Create Auth user (or recover existing orphaned auth user)
  let userId: string;

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: '123Mudar@',
    email_confirm: true,
    user_metadata: { full_name: client.full_name || email },
  });

  if (authError) {
    if (authError.message?.includes('already been registered')) {
      // User exists in Auth but has no profile – recover the ID
      // Use direct SQL lookup via RPC (bypasses listUsers pagination limit)
      const { data: authUserId, error: rpcError } = await supabaseAdmin.rpc('get_auth_user_id_by_email', { lookup_email: email });
      if (!authUserId) {
        return { status: 'error', email, message: `Usuário existe no Auth mas não foi localizado via RPC${rpcError ? ': ' + rpcError.message : ''}` };
      }
      userId = authUserId;
    } else {
      return { status: 'error', email, message: `Erro auth: ${authError.message}` };
    }
  } else if (!authData?.user) {
    return { status: 'error', email, message: 'Erro auth: usuário não retornado' };
  } else {
    userId = authData.user.id;
  }

  // 2. Upsert profile (trigger handle_new_user may have already created it)
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: userId,
      email,
      full_name: client.full_name || null,
      phone: client.phone || null,
      company_name: client.company_name || null,
      cpf_cnpj: client.cpf_cnpj || null,
      cpf: client.cpf || null,
      cnpj: client.cnpj || null,
      address: client.address || null,
      neighborhood: client.neighborhood || null,
      city: client.city || null,
      state: client.state || null,
      zip_code: client.zip_code || null,
      origin: 'import',
      priority: client.priority || 'medium',
      client_funnel_type: 'juridico',
      created_by: callerUserId,
      assigned_to: callerUserId,
    });

  if (profileError) {
    await supabaseAdmin
      .from('profiles')
      .update({
        full_name: client.full_name || null,
        phone: client.phone || null,
        company_name: client.company_name || null,
        cpf_cnpj: client.cpf_cnpj || null,
        cpf: client.cpf || null,
        cnpj: client.cnpj || null,
        address: client.address || null,
        neighborhood: client.neighborhood || null,
        city: client.city || null,
        state: client.state || null,
        zip_code: client.zip_code || null,
        origin: 'import',
        priority: client.priority || 'medium',
        client_funnel_type: 'juridico',
        created_by: callerUserId,
        assigned_to: callerUserId,
      })
      .eq('id', userId);
  }

  // 3. Assign 'user' role
  await supabaseAdmin
    .from('user_roles')
    .insert({ user_id: userId, role: 'user' })
    .then(() => {/* ok */})
    .catch(() => {/* ignore duplicate */});

  // 4. Create brand_process → Jurídico > Protocolado
  const brandName = client.brand_name || client.company_name || client.full_name || email;
  await supabaseAdmin
    .from('brand_processes')
    .insert({
      user_id: userId,
      brand_name: brandName,
      status: 'em_andamento',
      pipeline_stage: 'protocolado',
    });

  // Remove from leads table if exists (client ≠ lead)
  await supabaseAdmin.from('leads').delete().eq('email', email);

  return { status: 'imported', email };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: callerUser } } = await supabaseAuth.auth.getUser();
    if (!callerUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUser.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const clients: ClientToImport[] = body.clients;

    if (!clients || !Array.isArray(clients)) {
      return new Response(JSON.stringify({ error: 'Invalid payload: clients array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const BATCH_SIZE = 5;
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (let i = 0; i < clients.length; i += BATCH_SIZE) {
      const batch = clients.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(client => processClient(supabaseAdmin, client, callerUser.id))
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const r = result.value;
          if (r.status === 'imported') imported++;
          else if (r.status === 'updated') updated++;
          else if (r.status === 'skipped') skipped++;
          else {
            errors++;
            if (r.message) errorDetails.push(`${r.email}: ${r.message}`);
          }
        } else {
          errors++;
          errorDetails.push(`Erro inesperado: ${result.reason}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ imported, updated, skipped, errors, errorDetails }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('import-clients error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
