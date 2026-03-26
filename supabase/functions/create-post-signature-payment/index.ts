import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API_URL = "https://api.asaas.com/v3";

// Default pricing values (fallback if not configured in system_settings)
const DEFAULT_PRICING = {
  basePrice: 699,
  cardInstallments: 6,
  cardInstallmentValue: 199,
  boletoInstallments: 3,
  boletoInstallmentValue: 399,
};

serve(async (req) => {
  // Handle CORS preflight
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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Asaas API key
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    if (!ASAAS_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ASAAS_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch dynamic pricing from system_settings
    const { data: pricingData } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'pricing')
      .maybeSingle();

    const pricing = pricingData?.value || DEFAULT_PRICING;
    console.log('Using pricing config:', JSON.stringify(pricing));

    // Fetch contract with user profile (including custom_due_date)
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select(`
        *,
        profiles:user_id (
          id,
          full_name,
          email,
          phone,
          cpf_cnpj,
          address,
          city,
          state,
          zip_code
        )
      `)
      .eq('id', contractId)
      .single();

    if (contractError || !contract) {
      console.error('Contract fetch error:', contractError);
      return new Response(
        JSON.stringify({ error: 'Contrato não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const profile = contract.profiles;
    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Perfil do cliente não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paymentMethod = contract.payment_method || 'avista';
    
    // CORREÇÃO: Usar o valor do contrato salvo no banco (já calculado com múltiplas marcas)
    const savedContractValue = contract.contract_value;
    
    // Check if this is a recurring promotional payment
    const isRecurringPromotional = paymentMethod === 'recorrente_promocional';
    const isRecurringBoleto = paymentMethod === 'recorrente_boleto';
    const isRecurringCartao = paymentMethod === 'recorrente_cartao';
    const isAnyRecurring = isRecurringPromotional || isRecurringBoleto || isRecurringCartao;
    
    // Determine payment configuration based on method using dynamic pricing
    let billingType: string;
    let totalValue: number;
    let installmentCount: number;
    let installmentValue: number;

    switch (paymentMethod) {
      case 'cartao6x':
        billingType = 'CREDIT_CARD';
        installmentCount = pricing.cardInstallments || DEFAULT_PRICING.cardInstallments;
        if (savedContractValue && savedContractValue > 0) {
          totalValue = savedContractValue;
          installmentValue = Math.round(totalValue / installmentCount * 100) / 100;
        } else {
          installmentValue = pricing.cardInstallmentValue || DEFAULT_PRICING.cardInstallmentValue;
          totalValue = installmentCount * installmentValue;
        }
        break;
      case 'boleto3x':
        billingType = 'BOLETO';
        installmentCount = pricing.boletoInstallments || DEFAULT_PRICING.boletoInstallments;
        if (savedContractValue && savedContractValue > 0) {
          totalValue = savedContractValue;
          installmentValue = Math.round(totalValue / installmentCount * 100) / 100;
        } else {
          installmentValue = pricing.boletoInstallmentValue || DEFAULT_PRICING.boletoInstallmentValue;
          totalValue = installmentCount * installmentValue;
        }
        break;
      case 'recorrente_promocional':
      case 'recorrente_boleto':
      case 'recorrente_cartao':
        billingType = isRecurringCartao ? 'CREDIT_CARD' : 'BOLETO';
        installmentCount = 1;
        totalValue = savedContractValue && savedContractValue > 0 ? savedContractValue : 0;
        installmentValue = totalValue;
        break;
      case 'avista':
      default:
        billingType = 'PIX';
        installmentCount = 1;
        if (savedContractValue && savedContractValue > 0) {
          totalValue = savedContractValue;
        } else {
          totalValue = pricing.basePrice || DEFAULT_PRICING.basePrice;
        }
        installmentValue = totalValue;
        break;
    }

    console.log(`Contract saved value: ${savedContractValue}`);
    console.log(`Calculated total: ${totalValue}, installments: ${installmentCount}x${installmentValue}`);

    console.log(`=== PAYMENT CONFIG ===`);
    console.log(`Contract ID: ${contractId}`);
    console.log(`Payment Method: ${paymentMethod}`);
    console.log(`Billing Type: ${billingType}`);
    console.log(`Total Value: ${totalValue}`);
    console.log(`Installments: ${installmentCount || 1}x ${installmentValue || totalValue}`);

    // For credit card, return the data needed for the frontend form
    if (paymentMethod === 'cartao6x') {
      // Check if customer already exists in Asaas
      let customerId = null;
      
      // Search for existing customer by CPF/CNPJ
      const cpfCnpj = profile.cpf_cnpj?.replace(/\D/g, '') || '';
      if (cpfCnpj) {
        const searchResponse = await fetch(`${ASAAS_API_URL}/customers?cpfCnpj=${cpfCnpj}`, {
          headers: {
            'access_token': ASAAS_API_KEY,
            'Content-Type': 'application/json',
          },
        });
        const searchData = await searchResponse.json();
        if (searchData.data && searchData.data.length > 0) {
          customerId = searchData.data[0].id;
          console.log('Found existing Asaas customer:', customerId);
        }
      }

      // Create customer if not exists
      if (!customerId) {
        const customerPayload = {
          name: profile.full_name || 'Cliente',
          email: profile.email,
          phone: profile.phone?.replace(/\D/g, '') || '',
          cpfCnpj: cpfCnpj,
          postalCode: profile.zip_code?.replace(/\D/g, '') || '',
          address: profile.address || '',
          addressNumber: 'S/N',
          province: profile.city || '',
          notificationDisabled: false,
        };

        const customerResponse = await fetch(`${ASAAS_API_URL}/customers`, {
          method: 'POST',
          headers: {
            'access_token': ASAAS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(customerPayload),
        });

        const customerData = await customerResponse.json();
        
        if (!customerResponse.ok) {
          console.error('Asaas customer error:', customerData);
          return new Response(
            JSON.stringify({ error: 'Erro ao criar cliente no Asaas', details: customerData }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        customerId = customerData.id;
        console.log('Created Asaas customer:', customerId);
      }

      // Create internal invoice record for credit card
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          user_id: profile.id,
          process_id: contract.process_id || null,
          amount: totalValue,
          status: 'pending',
          due_date: dueDate.toISOString().split('T')[0],
          description: `Registro de Marca - ${contract.subject || 'Contrato'}`,
          payment_method: 'CREDIT_CARD',
          asaas_customer_id: customerId,
        })
        .select()
        .single();

      if (invoiceError) {
        console.error('Invoice creation error:', invoiceError);
        return new Response(
          JSON.stringify({ error: 'Erro ao criar fatura interna', details: invoiceError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Created invoice: ${invoice.id} for customer: ${customerId}`);

      return new Response(
        JSON.stringify({
          success: true,
          paymentMethod: 'cartao6x',
          requiresCreditCardForm: true,
          data: {
            customerId,
            invoiceId: invoice.id,
            contractId,
            value: totalValue,
            installmentCount,
            installmentValue,
            dueDate: dueDate.toISOString().split('T')[0],
            holderName: profile.full_name || '',
            holderEmail: profile.email || '',
            holderCpfCnpj: cpfCnpj,
            holderPostalCode: profile.zip_code?.replace(/\D/g, '') || '',
            holderPhone: profile.phone?.replace(/\D/g, '') || '',
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // RECURRING PAYMENTS (Subscription via Asaas)
    // ========================================
    if (isAnyRecurring && totalValue > 0) {
      // Create or find customer first
      let customerId = null;
      const cpfCnpj = profile.cpf_cnpj?.replace(/\D/g, '') || '';
      
      if (cpfCnpj) {
        const searchResponse = await fetch(`${ASAAS_API_URL}/customers?cpfCnpj=${cpfCnpj}`, {
          headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
        });
        const searchData = await searchResponse.json();
        if (searchData.data && searchData.data.length > 0) {
          customerId = searchData.data[0].id;
        }
      }

      if (!customerId) {
        const customerPayload = {
          name: profile.full_name || 'Cliente',
          email: profile.email,
          phone: profile.phone?.replace(/\D/g, '') || '',
          cpfCnpj: cpfCnpj,
          postalCode: profile.zip_code?.replace(/\D/g, '') || '',
          address: profile.address || '',
          addressNumber: 'S/N',
          province: profile.city || '',
          notificationDisabled: false,
        };

        const customerResponse = await fetch(`${ASAAS_API_URL}/customers`, {
          method: 'POST',
          headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify(customerPayload),
        });

        const customerData = await customerResponse.json();
        if (!customerResponse.ok) {
          console.error('Asaas customer error:', customerData);
          return new Response(
            JSON.stringify({ error: 'Erro ao criar cliente no Asaas', details: customerData }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        customerId = customerData.id;
      }

      // Create Asaas subscription (recurring monthly)
      const nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + 3);
      const dueDateString = contract.custom_due_date || nextDueDate.toISOString().split('T')[0];

      const subscriptionPayload = {
        customer: customerId,
        billingType,
        value: totalValue,
        nextDueDate: dueDateString,
        cycle: 'MONTHLY',
        description: `Assinatura Recorrente - ${contract.subject || 'Contrato'}`,
        externalReference: contractId,
      };

      console.log('Creating Asaas subscription:', JSON.stringify(subscriptionPayload));

      const subscriptionResponse = await fetch(`${ASAAS_API_URL}/subscriptions`, {
        method: 'POST',
        headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(subscriptionPayload),
      });

      const subscriptionData = await subscriptionResponse.json();

      if (!subscriptionResponse.ok) {
        console.error('Asaas subscription error:', subscriptionData);
        return new Response(
          JSON.stringify({ error: 'Erro ao criar assinatura recorrente no Asaas', details: subscriptionData }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Asaas subscription created:', subscriptionData.id);

      // Create internal invoice record
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          user_id: profile.id,
          process_id: contract.process_id || null,
          amount: totalValue,
          status: 'pending',
          due_date: dueDateString,
          description: `Assinatura Recorrente - ${contract.subject || 'Contrato'}`,
          asaas_invoice_id: subscriptionData.id,
          payment_method: billingType,
          asaas_customer_id: customerId,
        })
        .select()
        .single();

      if (invoiceError) {
        console.error('Invoice creation error:', invoiceError);
      }

      // Update profile with asaas_customer_id
      await supabase
        .from('profiles')
        .update({ asaas_customer_id: customerId })
        .eq('id', profile.id);

      return new Response(
        JSON.stringify({
          success: true,
          paymentMethod,
          requiresCreditCardForm: false,
          isRecurring: true,
          data: {
            subscriptionId: subscriptionData.id,
            invoiceId: invoice?.id,
            value: totalValue,
            cycle: 'MONTHLY',
            nextDueDate: dueDateString,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For PIX and Boleto, create Asaas payment directly
    // First, create or find customer
    let customerId = null;
    const cpfCnpj = profile.cpf_cnpj?.replace(/\D/g, '') || '';
    
    if (cpfCnpj) {
      const searchResponse = await fetch(`${ASAAS_API_URL}/customers?cpfCnpj=${cpfCnpj}`, {
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json',
        },
      });
      const searchData = await searchResponse.json();
      if (searchData.data && searchData.data.length > 0) {
        customerId = searchData.data[0].id;
      }
    }

    if (!customerId) {
      const customerPayload = {
        name: profile.full_name || 'Cliente',
        email: profile.email,
        phone: profile.phone?.replace(/\D/g, '') || '',
        cpfCnpj: cpfCnpj,
        postalCode: profile.zip_code?.replace(/\D/g, '') || '',
        address: profile.address || '',
        addressNumber: 'S/N',
        province: profile.city || '',
        notificationDisabled: false,
      };

      const customerResponse = await fetch(`${ASAAS_API_URL}/customers`, {
        method: 'POST',
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customerPayload),
      });

      const customerData = await customerResponse.json();
      if (!customerResponse.ok) {
        console.error('Asaas customer error:', customerData);
        return new Response(
          JSON.stringify({ error: 'Erro ao criar cliente no Asaas', details: customerData }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      customerId = customerData.id;
    }

    // Create payment in Asaas
    // Use custom_due_date from contract if admin specified one, otherwise default to 3 days
    let dueDateString: string;
    if (contract.custom_due_date) {
      // Admin specified a custom due date for PIX/Boleto
      dueDateString = contract.custom_due_date;
      console.log(`Using admin-specified custom due date: ${dueDateString}`);
    } else {
      // Default: 3 days from now
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      dueDateString = dueDate.toISOString().split('T')[0];
      console.log(`Using default due date (3 days): ${dueDateString}`);
    }

    const paymentPayload: Record<string, any> = {
      customer: customerId,
      billingType,
      value: paymentMethod === 'boleto3x' ? installmentValue : totalValue,
      dueDate: dueDateString,
      description: `Registro de Marca - ${contract.subject || 'Contrato'}`,
      externalReference: contractId,
    };

    // For boleto installments
    if (paymentMethod === 'boleto3x') {
      paymentPayload.installmentCount = installmentCount;
      paymentPayload.installmentValue = installmentValue;
    }

    const paymentResponse = await fetch(`${ASAAS_API_URL}/payments`, {
      method: 'POST',
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentPayload),
    });

    const paymentData = await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error('Asaas payment error:', paymentData);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar cobrança no Asaas', details: paymentData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Asaas payment created:', paymentData.id);

    // Fetch PIX QR code if applicable
    let pixQrCode = null;
    let pixPayload = null;
    if (billingType === 'PIX') {
      try {
        const pixResponse = await fetch(`${ASAAS_API_URL}/payments/${paymentData.id}/pixQrCode`, {
          headers: {
            'access_token': ASAAS_API_KEY,
            'Content-Type': 'application/json',
          },
        });
        const pixData = await pixResponse.json();
        if (pixResponse.ok) {
          pixQrCode = pixData.encodedImage;
          pixPayload = pixData.payload;
        }
      } catch (e) {
        console.error('Error fetching PIX QR code:', e);
      }
    }

    // Create internal invoice record
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        user_id: profile.id,
        process_id: contract.process_id || null,
        amount: totalValue,
        status: 'pending',
        due_date: dueDateString,
        description: `Registro de Marca - ${contract.subject || 'Contrato'}`,
        asaas_invoice_id: paymentData.id,
        invoice_url: paymentData.invoiceUrl,
        pix_code: pixPayload,
        payment_method: billingType,
        asaas_customer_id: customerId,
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('Invoice creation error:', invoiceError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        paymentMethod,
        requiresCreditCardForm: false,
        data: {
          paymentId: paymentData.id,
          invoiceId: invoice?.id,
          invoiceUrl: paymentData.invoiceUrl,
          bankSlipUrl: paymentData.bankSlipUrl,
          pixQrCode,
          pixPayload,
          value: totalValue,
          dueDate: dueDateString,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in create-post-signature-payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});