import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contractId } = await req.json();

    if (!contractId) {
      return new Response(
        JSON.stringify({ error: 'contractId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const asaasApiKey = Deno.env.get('ASAAS_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const ASAAS_BASE_URL = 'https://api.asaas.com/v3';

    // Fetch contract with user profile
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('*, profiles:user_id(id, full_name, email, phone, cpf_cnpj, cpf, cnpj, address, city, state, zip_code)')
      .eq('id', contractId)
      .single();

    if (contractError || !contract) {
      console.error('Contract not found:', contractError);
      return new Response(
        JSON.stringify({ error: 'Contrato não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const profile = (contract as any).profiles;
    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Perfil do cliente não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cpfCnpj = profile.cpf || profile.cnpj || profile.cpf_cnpj || '';
    const cleanCpfCnpj = cpfCnpj.replace(/[^\d]/g, '');

    if (!cleanCpfCnpj) {
      return new Response(
        JSON.stringify({ error: 'CPF/CNPJ do cliente não encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Find or create customer in Asaas
    let asaasCustomerId = '';

    // Search existing customer
    const searchResponse = await fetch(`${ASAAS_BASE_URL}/customers?cpfCnpj=${cleanCpfCnpj}`, {
      headers: { 'access_token': asaasApiKey },
    });
    const searchData = await searchResponse.json();

    if (searchData.data && searchData.data.length > 0) {
      asaasCustomerId = searchData.data[0].id;
      console.log('Found existing Asaas customer:', asaasCustomerId);
    } else {
      // Create new customer
      const createCustomerResponse = await fetch(`${ASAAS_BASE_URL}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': asaasApiKey,
        },
        body: JSON.stringify({
          name: profile.full_name || 'Cliente',
          email: profile.email || undefined,
          phone: profile.phone?.replace(/\D/g, '') || undefined,
          cpfCnpj: cleanCpfCnpj,
        }),
      });

      const customerData = await createCustomerResponse.json();
      if (customerData.errors) {
        console.error('Error creating Asaas customer:', customerData.errors);
        return new Response(
          JSON.stringify({ error: 'Erro ao criar cliente no Asaas', details: customerData.errors }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      asaasCustomerId = customerData.id;
      console.log('Created new Asaas customer:', asaasCustomerId);
    }

    // 2. Create monthly subscription (R$ 59.00)
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(10); // Day 10
    const nextDueDate = nextMonth.toISOString().split('T')[0];

    const brandName = contract.subject?.replace(/^.*?-\s*/, '') || 'Marca';

    const subscriptionResponse = await fetch(`${ASAAS_BASE_URL}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': asaasApiKey,
      },
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: 'BOLETO',
        value: 59.00,
        cycle: 'MONTHLY',
        nextDueDate,
        description: `Plano de Monitoramento e Manutenção - ${brandName}`,
        externalReference: contractId,
      }),
    });

    const subscriptionData = await subscriptionResponse.json();

    if (subscriptionData.errors) {
      console.error('Error creating subscription:', subscriptionData.errors);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar assinatura recorrente', details: subscriptionData.errors }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Created Asaas subscription:', subscriptionData.id);

    // 3. Update contract with Asaas reference
    await supabase
      .from('contracts')
      .update({ asaas_payment_id: subscriptionData.id })
      .eq('id', contractId);

    // 4. Create first invoice record internally
    await supabase
      .from('invoices')
      .insert({
        user_id: contract.user_id,
        contract_id: contractId,
        amount: 59.00,
        due_date: nextDueDate,
        status: 'pending',
        description: `Mensalidade - Plano de Monitoramento e Manutenção - ${brandName}`,
        payment_method: 'boleto',
        asaas_invoice_id: subscriptionData.id,
      } as any);

    console.log('Monitoring subscription created successfully for contract:', contractId);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          subscriptionId: subscriptionData.id,
          customerId: asaasCustomerId,
          nextDueDate,
          value: 59.00,
          cycle: 'MONTHLY',
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in create-monitoring-subscription:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
