import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ConfirmPaymentRequest {
  leadId?: string;
  contractId?: string;
  paymentId?: string;
  asaasCustomerId?: string;
  personalData: {
    fullName: string;
    cpf: string;
    email: string;
    phone: string;
    cep: string;
    address: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  brandData: {
    brandName: string;
    businessArea: string;
    hasCNPJ: boolean;
    cnpj: string;
    companyName: string;
  };
  paymentValue: number;
  paymentMethod: string;
  contractHtml?: string;
  signatureData?: {
    ip: string;
    userAgent: string;
    signedAt: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration missing');
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const data: ConfirmPaymentRequest = await req.json();
    const { 
      leadId, 
      contractId, 
      paymentId, 
      asaasCustomerId,
      personalData, 
      brandData, 
      paymentValue, 
      paymentMethod,
      contractHtml,
      signatureData 
    } = data;

    console.log('Confirming payment for:', personalData.fullName);

    const cpfCnpj = brandData.hasCNPJ && brandData.cnpj 
      ? brandData.cnpj.replace(/\D/g, '') 
      : personalData.cpf.replace(/\D/g, '');

    // ========================================
    // STEP 1: Find existing user (user creation moved to sign-contract-blockchain)
    // ========================================
    let userId: string | null = null;

    // Check if user already exists by email
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', personalData.email)
      .maybeSingle();

    if (existingProfile) {
      userId = existingProfile.id;
      console.log('Found existing user via profile:', userId);
    } else {
      // Try creating a new auth user
      const tempPassword = '123Mudar@';
      
      const { data: newUser, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email: personalData.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: personalData.fullName,
          phone: personalData.phone,
        },
      });

      if (userError) {
        // If email already exists in auth but not in profiles, look up via auth
        if (userError.message?.includes('already been registered')) {
          const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ filter: personalData.email, perPage: 1 });
          const foundUser = usersData?.users?.find(u => u.email === personalData.email);
          if (foundUser) {
            userId = foundUser.id;
            console.log('Found existing auth user after conflict:', userId);
          } else {
            console.error('Error creating user and could not find existing:', userError);
            throw new Error(`Erro ao criar usuário: ${userError.message}`);
          }
        } else {
          console.error('Error creating user:', userError);
          throw new Error(`Erro ao criar usuário: ${userError.message}`);
        }
      } else {
        userId = newUser.user?.id || null;
        console.log('Created new user:', userId);
      }

      // Assign 'user' role
      if (userId) {
        await supabaseAdmin.from('user_roles').insert({
          user_id: userId,
          role: 'user',
        }).then(() => {}).catch(() => {});
      }
    }

    if (!userId) {
      throw new Error('Não foi possível criar ou encontrar o usuário');
    }

    // ========================================
    // STEP 2: Create/Update profile
    // ========================================
    const { data: existingProfileById } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (existingProfileById) {
      // Update existing profile
      await supabaseAdmin
        .from('profiles')
        .update({
          full_name: personalData.fullName,
          email: personalData.email,
          phone: personalData.phone,
          cpf_cnpj: cpfCnpj,
          company_name: brandData.hasCNPJ ? brandData.companyName : null,
          address: personalData.address,
          city: personalData.city,
          state: personalData.state,
          zip_code: personalData.cep,
          asaas_customer_id: asaasCustomerId || null,
          origin: 'site',
          priority: 'high',
          contract_value: paymentValue,
          last_contact: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
      console.log('Updated profile:', userId);
    } else {
      // Create new profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: userId,
          full_name: personalData.fullName,
          email: personalData.email,
          phone: personalData.phone,
          cpf_cnpj: cpfCnpj,
          company_name: brandData.hasCNPJ ? brandData.companyName : null,
          address: personalData.address,
          city: personalData.city,
          state: personalData.state,
          zip_code: personalData.cep,
          asaas_customer_id: asaasCustomerId || null,
          origin: 'site',
          priority: 'high',
          contract_value: paymentValue,
          last_contact: new Date().toISOString(),
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
      } else {
        console.log('Created profile:', userId);
      }
    }

    // ========================================
    // STEP 3: Create Brand Process
    // ========================================
    const { data: processData, error: processError } = await supabaseAdmin
      .from('brand_processes')
      .insert({
        user_id: userId,
        brand_name: brandData.brandName,
        business_area: brandData.businessArea,
        status: 'em_andamento',
        pipeline_stage: 'protocolado',
        notes: `Origem: Site | Pagamento: ${paymentMethod} | Valor: R$ ${paymentValue}`,
      })
      .select('id')
      .single();

    if (processError) {
      console.error('Error creating brand process:', processError);
    } else {
      console.log('Created brand process:', processData?.id);
    }

    const processId = processData?.id || null;

    // ========================================
    // STEP 4: Update Contract with user and signature
    // ========================================
    if (contractId) {
      const updateData: Record<string, unknown> = {
        user_id: userId,
        process_id: processId,
        signature_status: 'signed',
        signed_at: signatureData?.signedAt || new Date().toISOString(),
        signature_ip: signatureData?.ip || null,
        signature_user_agent: signatureData?.userAgent || null,
      };

      if (contractHtml) {
        updateData.contract_html = contractHtml;
      }

      await supabaseAdmin
        .from('contracts')
        .update(updateData)
        .eq('id', contractId);

      console.log('Updated contract with signature:', contractId);

      // Fetch blockchain_hash for verification URL
      let blockchainHash = '';
      try {
        const { data: contractRecord } = await supabaseAdmin
          .from('contracts')
          .select('blockchain_hash')
          .eq('id', contractId)
          .maybeSingle();
        blockchainHash = contractRecord?.blockchain_hash || '';
      } catch (hashErr) {
        console.error('Error fetching blockchain_hash:', hashErr);
      }

      const PRODUCTION_DOMAIN = 'https://webmarcas.net';

      // Trigger contract_signed email automation
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/trigger-email-automation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            trigger_event: 'contract_signed',
            lead_id: leadId || null,
            data: {
              nome: personalData.fullName,
              email: personalData.email,
              marca: brandData.brandName,
              data_assinatura: new Date().toLocaleDateString('pt-BR'),
              hash_contrato: contractId.substring(0, 12).toUpperCase(),
              ip_assinatura: signatureData?.ip || 'N/A',
              base_url: PRODUCTION_DOMAIN,
              verification_url: blockchainHash
                ? `${PRODUCTION_DOMAIN}/verificar-contrato?hash=${blockchainHash}`
                : '',
              link_area_cliente: `${PRODUCTION_DOMAIN}/cliente/documentos`,
            },
          }),
        });
        console.log('Triggered contract_signed email automation');
      } catch (emailError) {
        console.error('Error triggering contract_signed email:', emailError);
      }
    }

    // ========================================
    // STEP 5: Create Invoice
    // ========================================
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    const { data: invoiceData, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .insert({
        user_id: userId,
        process_id: processId,
        description: `Registro de marca: ${brandData.brandName}`,
        amount: paymentValue,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'pending',
        asaas_invoice_id: paymentId || null,
        payment_method: paymentMethod === 'avista' ? 'pix' : paymentMethod === 'cartao6x' ? 'credit_card' : 'boleto',
      })
      .select('id')
      .single();

    if (invoiceError) {
      console.error('Error creating invoice:', invoiceError);
    } else {
      console.log('Created invoice:', invoiceData?.id);
    }

    // ========================================
    // STEP 6: Update Lead as converted
    // ========================================
    if (leadId) {
      await supabaseAdmin
        .from('leads')
        .update({
          status: 'convertido',
          converted_at: new Date().toISOString(),
          converted_to_client_id: userId,
        })
        .eq('id', leadId);

      console.log('Lead converted to client:', leadId);
    }

    // ========================================
    // STEP 7: Create welcome notification
    // ========================================
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        title: 'Bem-vindo à WebMarcas!',
        message: `Seu contrato para registro da marca "${brandData.brandName}" foi assinado com sucesso. Acompanhe o processo pelo painel.`,
        type: 'success',
        link: '/cliente/processos',
      });

    // ========================================
    // STEP 8: Create initial process event
    // ========================================
    if (processId) {
      await supabaseAdmin
        .from('process_events')
        .insert({
          process_id: processId,
          title: 'Contrato Assinado',
          description: 'Contrato de prestação de serviços assinado digitalmente.',
          event_type: 'contract',
          event_date: new Date().toISOString(),
        });
    }

    // ========================================
    // STEP 9: Return response
    // ========================================
    return new Response(
      JSON.stringify({
        success: true,
        userId,
        profileId: userId,
        processId,
        invoiceId: invoiceData?.id || null,
        message: 'Cliente criado com sucesso!',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    console.error('Error in confirm-payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
