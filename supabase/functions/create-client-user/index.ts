import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a random temporary password
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Normalize CPF/CNPJ by removing all non-digit characters
function normalizeCpfCnpj(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/\D/g, '');
  return normalized.length > 0 ? normalized : null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      email,
      full_name,
      phone,
      company_name,
      cpf_cnpj,
      cpf,
      cnpj,
      address,
      neighborhood,
      city,
      state,
      zip_code,
      brand_name,
      business_area,
      client_funnel_type, // NEW: 'comercial' or 'juridico'
    } = await req.json();

    // Validate required fields
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!full_name) {
      return new Response(
        JSON.stringify({ error: 'Nome é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Normalize CPF/CNPJ for consistent lookup
    const normalizedCpfCnpj = normalizeCpfCnpj(cpf_cnpj);

    // PRIORITY 1: Check if client already exists by CPF/CNPJ (primary unique key)
    let existingProfile = null;
    
    if (normalizedCpfCnpj) {
      const { data: profileByCpf } = await supabase
        .from('profiles')
        .select('id, email, full_name, cpf_cnpj')
        .eq('cpf_cnpj', cpf_cnpj) // Check with formatted version
        .maybeSingle();
      
      if (!profileByCpf) {
        // Also check normalized version (digits only)
        const { data: profileByNormalizedCpf } = await supabase
          .from('profiles')
          .select('id, email, full_name, cpf_cnpj')
          .ilike('cpf_cnpj', `%${normalizedCpfCnpj}%`)
          .maybeSingle();
        
        existingProfile = profileByNormalizedCpf;
      } else {
        existingProfile = profileByCpf;
      }
    }

    // PRIORITY 2: If not found by CPF, check by email
    if (!existingProfile) {
      const { data: profileByEmail } = await supabase
        .from('profiles')
        .select('id, email, full_name, cpf_cnpj')
        .eq('email', email)
        .maybeSingle();
      
      existingProfile = profileByEmail;
    }

    // If existing profile found, return it and optionally create new process
    if (existingProfile) {
      console.log(`Found existing client by CPF/email: ${existingProfile.email} (${existingProfile.id})`);
      
      // Update profile with any new information (except CPF which is unique)
      await supabase
        .from('profiles')
        .update({
          full_name: full_name || existingProfile.full_name,
          phone: phone || undefined,
          company_name: company_name || undefined,
          address: address || undefined,
          neighborhood: neighborhood || undefined,
          city: city || undefined,
          state: state || undefined,
          zip_code: zip_code || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingProfile.id);

      // Create new brand process if brand name is provided
      let processId = null;
      if (brand_name) {
        const { data: processData, error: processError } = await supabase
          .from('brand_processes')
          .insert({
            user_id: existingProfile.id,
            brand_name,
            business_area: business_area || null,
          status: 'em_andamento',
          pipeline_stage: client_funnel_type === 'comercial' ? 'assinou_contrato' : 'protocolado',
          })
          .select('id')
          .single();

        if (processError) {
          console.error('Error creating brand process for existing user:', processError);
        } else {
          processId = processData?.id;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          userId: existingProfile.id,
          processId,
          isExisting: true,
          message: 'Cliente já cadastrado. Novo processo vinculado ao cadastro existente.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No existing profile - create new user
    // Fixed password - welcome email sent after contract signing
    const tempPassword = '123Mudar@';

    // Create user in auth.users
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name,
      }
    });

    if (authError || !authData.user) {
      console.error('Error creating auth user:', authError);
      return new Response(
        JSON.stringify({ error: authError?.message || 'Erro ao criar usuário' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authData.user.id;

    // Update/insert profile with complete data
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email,
        full_name,
        phone: phone || null,
        company_name: company_name || null,
        cpf: cpf || null,
        cnpj: cnpj || null,
        cpf_cnpj: cpf || cpf_cnpj || null, // Keep legacy field
        address: address || null,
        neighborhood: neighborhood || null,
        city: city || null,
        state: state || null,
        zip_code: zip_code || null,
        origin: 'form_checkout',
        client_funnel_type: client_funnel_type || 'juridico', // NEW: default to juridico
      });

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Profile might be auto-created by trigger, try update
      await supabase
        .from('profiles')
        .update({
          full_name,
          phone: phone || null,
          company_name: company_name || null,
          cpf: cpf || null,
          cnpj: cnpj || null,
          cpf_cnpj: cpf || cpf_cnpj || null, // Keep legacy field
          address: address || null,
          neighborhood: neighborhood || null,
          city: city || null,
          state: state || null,
          zip_code: zip_code || null,
          origin: 'form_checkout',
          client_funnel_type: client_funnel_type || 'juridico', // NEW: default to juridico
        })
        .eq('id', userId);
    }

    // Create brand process if brand name is provided
    let processId = null;
    if (brand_name) {
      const { data: processData, error: processError } = await supabase
        .from('brand_processes')
        .insert({
          user_id: userId,
          brand_name,
          business_area: business_area || null,
        status: 'em_andamento',
        pipeline_stage: client_funnel_type === 'comercial' ? 'assinou_contrato' : 'protocolado',
        })
        .select('id')
        .single();

      if (processError) {
        console.error('Error creating brand process:', processError);
      } else {
        processId = processData?.id;
      }
    }

    // Assign 'user' role
    await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role: 'user',
      });

    console.log(`Created new client: ${email} (${userId})`);

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        processId,
        isExisting: false,
        tempPassword, // Only for admin reference if needed
        message: 'Cliente criado com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in create-client-user:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
