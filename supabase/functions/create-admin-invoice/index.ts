import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API_URL = "https://api.asaas.com/v3";

interface InvoiceRequest {
  user_id: string;
  process_id?: string;
  description: string;
  payment_method: 'pix' | 'boleto' | 'cartao';
  payment_type: 'avista' | 'parcelado';
  installments?: number;
  total_value: number;
  due_date: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!ASAAS_API_KEY) {
      throw new Error('ASAAS_API_KEY not configured');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration missing');
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const rawData = await req.json();
    // Support both field naming conventions
    const invoiceData = {
      ...rawData,
      user_id: rawData.user_id || rawData.clientId,
      total_value: rawData.total_value || rawData.value,
      due_date: rawData.due_date || rawData.dueDate,
      payment_method: rawData.payment_method || (rawData.billingType === 'BOLETO' ? 'boleto' : rawData.billingType === 'PIX' ? 'pix' : 'boleto'),
    } as InvoiceRequest;
    console.log('Creating admin invoice:', JSON.stringify(invoiceData));

    // ========================================
    // STEP 1: Get client profile
    // ========================================
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', invoiceData.user_id)
      .single();

    if (profileError || !profile) {
      throw new Error('Cliente não encontrado');
    }

    console.log('Found client:', profile.full_name);

    // ========================================
    // STEP 2: Find or create customer in Asaas
    // ========================================
    const rawCpfCnpj = profile.cpf_cnpj?.replace(/\D/g, '') || '';
    // Validate: CPF must have 11 digits, CNPJ must have 14 digits
    const cpfCnpj = (rawCpfCnpj.length === 11 || rawCpfCnpj.length === 14) ? rawCpfCnpj : '';
    
    // If no valid CPF/CNPJ, create local-only invoice (skip Asaas)
    if (!cpfCnpj) {
      console.log('CPF/CNPJ ausente ou inválido (valor bruto:', rawCpfCnpj, ') — criando fatura local');
      console.log('No CPF/CNPJ — creating local-only invoice');

      const paymentMethodLabel = invoiceData.payment_method === 'pix' ? 'PIX' : 
                                 invoiceData.payment_method === 'boleto' ? 'Boleto' : 'Cartão';

      const { data: invoice, error: invoiceError } = await supabaseAdmin
        .from('invoices')
        .insert({
          user_id: invoiceData.user_id,
          process_id: invoiceData.process_id || null,
          description: invoiceData.description,
          amount: invoiceData.total_value,
          due_date: invoiceData.due_date,
          status: 'pending',
          payment_method: `${paymentMethodLabel} (À Vista)`,
        })
        .select('id')
        .single();

      if (invoiceError) {
        console.error('Error creating local invoice:', invoiceError);
        throw new Error('Erro ao salvar fatura no banco de dados');
      }

      return new Response(
        JSON.stringify({
          success: true,
          invoice_id: invoice?.id,
          asaas_payment_id: null,
          status: 'PENDING_LOCAL',
          billing_type: paymentMethodLabel,
          installments: 1,
          value: invoiceData.total_value,
          due_date: invoiceData.due_date,
          invoice_url: null,
          bank_slip_url: null,
          pix_qr_code: null,
          pix_code: null,
          warning: 'Cliente sem CPF/CNPJ — fatura criada localmente sem cobrança Asaas.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    let customerId: string;

    // Check if customer exists
    const existingCustomerResponse = await fetch(
      `${ASAAS_API_URL}/customers?cpfCnpj=${cpfCnpj}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'access_token': ASAAS_API_KEY,
        },
      }
    );

    const existingCustomerData = await existingCustomerResponse.json();

    if (existingCustomerData.data && existingCustomerData.data.length > 0) {
      customerId = existingCustomerData.data[0].id;
      console.log('Found existing Asaas customer:', customerId);
      
      if (!profile.asaas_customer_id) {
        await supabaseAdmin
          .from('profiles')
          .update({ asaas_customer_id: customerId })
          .eq('id', invoiceData.user_id);
      }
    } else {
      const customerPayload = {
        name: profile.company_name || profile.full_name || profile.email,
        cpfCnpj: cpfCnpj,
        email: profile.email,
        mobilePhone: profile.phone?.replace(/\D/g, '') || '',
        address: profile.address || '',
        postalCode: profile.zip_code?.replace(/\D/g, '') || '',
        externalReference: `webmarcas_${invoiceData.user_id}`,
        notificationDisabled: false,
      };

      console.log('Creating customer:', JSON.stringify(customerPayload));

      const customerResponse = await fetch(`${ASAAS_API_URL}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': ASAAS_API_KEY,
        },
        body: JSON.stringify(customerPayload),
      });

      const customerData = await customerResponse.json();
      console.log('Customer response:', JSON.stringify(customerData));

      if (customerData.errors) {
        throw new Error(`Erro ao criar cliente no Asaas: ${JSON.stringify(customerData.errors)}`);
      }

      customerId = customerData.id;
      
      await supabaseAdmin
        .from('profiles')
        .update({ asaas_customer_id: customerId })
        .eq('id', invoiceData.user_id);

      console.log('Created new Asaas customer:', customerId);
    }

    // ========================================
    // STEP 3: Determine billing type and installments
    // ========================================
    let billingType: string;
    let installmentCount = 1;
    let installmentValue = invoiceData.total_value;

    if (invoiceData.payment_method === 'pix') {
      billingType = 'PIX';
      installmentCount = 1;
    } else if (invoiceData.payment_method === 'boleto') {
      billingType = 'BOLETO';
      if (invoiceData.payment_type === 'parcelado' && invoiceData.installments && invoiceData.installments > 1) {
        installmentCount = invoiceData.installments;
        installmentValue = Math.ceil((invoiceData.total_value / installmentCount) * 100) / 100;
      }
    } else if (invoiceData.payment_method === 'cartao') {
      billingType = 'CREDIT_CARD';
      if (invoiceData.payment_type === 'parcelado' && invoiceData.installments && invoiceData.installments > 1) {
        installmentCount = invoiceData.installments;
        installmentValue = Math.ceil((invoiceData.total_value / installmentCount) * 100) / 100;
      }
    } else {
      billingType = 'UNDEFINED';
    }

    // ========================================
    // STEP 4: Create payment in Asaas
    // ========================================
    const paymentPayload: Record<string, unknown> = {
      customer: customerId,
      billingType: billingType,
      value: invoiceData.total_value,
      dueDate: invoiceData.due_date,
      description: invoiceData.description,
      externalReference: `admin_invoice_${Date.now()}`,
    };

    if (installmentCount > 1 && billingType !== 'PIX') {
      paymentPayload.installmentCount = installmentCount;
      paymentPayload.installmentValue = installmentValue;
    }

    console.log('Creating payment:', JSON.stringify(paymentPayload));

    const paymentResponse = await fetch(`${ASAAS_API_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY,
      },
      body: JSON.stringify(paymentPayload),
    });

    const paymentData = await paymentResponse.json();
    console.log('Payment response:', JSON.stringify(paymentData));

    if (paymentData.errors) {
      throw new Error(`Erro ao criar cobrança no Asaas: ${JSON.stringify(paymentData.errors)}`);
    }

    const paymentId = paymentData.id;

    // ========================================
    // STEP 5: Get PIX QR Code if applicable
    // ========================================
    let pixQrCode = null;
    let pixCode = null;
    
    if (billingType === 'PIX') {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const qrCodeResponse = await fetch(
        `${ASAAS_API_URL}/payments/${paymentId}/pixQrCode`,
        {
          headers: {
            'Content-Type': 'application/json',
            'access_token': ASAAS_API_KEY,
          },
        }
      );

      const qrCodeData = await qrCodeResponse.json();
      console.log('QR Code response:', JSON.stringify(qrCodeData));

      if (qrCodeData.encodedImage && qrCodeData.payload) {
        pixQrCode = qrCodeData.encodedImage;
        pixCode = qrCodeData.payload;
      }
    }

    // ========================================
    // STEP 6: Create invoice in database
    // ========================================
    const paymentMethodLabel = invoiceData.payment_method === 'pix' ? 'PIX' : 
                               invoiceData.payment_method === 'boleto' ? 'Boleto' : 'Cartão';
    const installmentLabel = installmentCount > 1 ? ` (${installmentCount}x)` : ' (À Vista)';

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .insert({
        user_id: invoiceData.user_id,
        process_id: invoiceData.process_id || null,
        description: invoiceData.description,
        amount: invoiceData.total_value,
        due_date: invoiceData.due_date,
        status: 'pending',
        asaas_invoice_id: paymentId,
        invoice_url: paymentData.invoiceUrl,
        boleto_code: paymentData.nossoNumero || null,
        pix_code: pixCode,
        payment_method: `${paymentMethodLabel}${installmentLabel}`,
      })
      .select('id')
      .single();

    if (invoiceError) {
      console.error('Error creating invoice in database:', invoiceError);
      throw new Error('Erro ao salvar fatura no banco de dados');
    }

    console.log('Created invoice:', invoice?.id);

    // ========================================
    // STEP 7: Return response
    // ========================================
    return new Response(
      JSON.stringify({
        success: true,
        invoice_id: invoice?.id,
        asaas_payment_id: paymentId,
        status: paymentData.status,
        billing_type: billingType,
        installments: installmentCount,
        value: paymentData.value,
        due_date: paymentData.dueDate,
        invoice_url: paymentData.invoiceUrl,
        bank_slip_url: paymentData.bankSlipUrl,
        pix_qr_code: pixQrCode,
        pix_code: pixCode,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    console.error('Error in create-admin-invoice:', error);
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
