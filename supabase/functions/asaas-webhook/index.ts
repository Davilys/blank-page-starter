import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
};

// Asaas webhook event types
type AsaasPaymentStatus = 
  | 'PENDING'
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'OVERDUE'
  | 'REFUNDED'
  | 'RECEIVED_IN_CASH'
  | 'REFUND_REQUESTED'
  | 'REFUND_IN_PROGRESS'
  | 'CHARGEBACK_REQUESTED'
  | 'CHARGEBACK_DISPUTE'
  | 'AWAITING_CHARGEBACK_REVERSAL'
  | 'DUNNING_REQUESTED'
  | 'DUNNING_RECEIVED'
  | 'AWAITING_RISK_ANALYSIS';

interface AsaasPaymentEvent {
  event: string;
  payment: {
    id: string;
    customer: string;
    value: number;
    netValue: number;
    status: AsaasPaymentStatus;
    billingType: string;
    confirmedDate?: string;
    paymentDate?: string;
    clientPaymentDate?: string;
    invoiceUrl?: string;
    externalReference?: string;
    description?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight
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

    const webhookData: AsaasPaymentEvent = await req.json();
    
    console.log('Received Asaas webhook:', JSON.stringify(webhookData));

    const { event, payment } = webhookData;

    if (!payment || !payment.id) {
      console.log('No payment data in webhook');
      return new Response(
        JSON.stringify({ success: true, message: 'No payment to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const paymentId = payment.id;
    const paymentStatus = payment.status;

    console.log(`Processing payment ${paymentId} with status ${paymentStatus}`);

    // STEP 1: Always try to update invoice first (most common case)
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('asaas_invoice_id', paymentId)
      .maybeSingle();

    if (invoice) {
      const invoiceStatus = getInvoiceStatus(paymentStatus);
      const paymentDate = payment.paymentDate || payment.confirmedDate || 
        ((invoiceStatus === 'confirmed' || invoiceStatus === 'received') ? new Date().toISOString().split('T')[0] : null);
      
      await supabaseAdmin
        .from('invoices')
        .update({
          status: invoiceStatus,
          payment_date: paymentDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoice.id);
      
      console.log(`Updated invoice ${invoice.id} to status ${invoiceStatus}`);

      // PONTO 1: Atualizar pipeline_stage para pagamento_ok (invoice com user_id)
      if ((paymentStatus === 'RECEIVED' || paymentStatus === 'CONFIRMED' || paymentStatus === 'RECEIVED_IN_CASH') && invoice.user_id) {
        await supabaseAdmin
          .from('brand_processes')
          .update({ pipeline_stage: 'pagamento_ok', updated_at: new Date().toISOString() })
          .eq('user_id', invoice.user_id)
          .eq('pipeline_stage', 'assinou_contrato');

        console.log('[webhook] Pipeline stage updated to pagamento_ok for user:', invoice.user_id);
      }

      // If payment is confirmed → send email + multichannel notification
      if ((paymentStatus === 'RECEIVED' || paymentStatus === 'CONFIRMED' || paymentStatus === 'RECEIVED_IN_CASH') && invoice.user_id) {
        try {
          const profile = await supabaseAdmin
            .from('profiles')
            .select('email, full_name, phone')
            .eq('id', invoice.user_id)
            .single();

          const prof = profile.data;

          // Email via trigger-email-automation
          if (prof?.email) {
            fetch(`${SUPABASE_URL}/functions/v1/trigger-email-automation`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
              body: JSON.stringify({
                trigger_event: 'payment_received',
                data: {
                  nome: prof.full_name || 'Cliente',
                  email: prof.email,
                  valor: String(invoice.amount || ''),
                  descricao: invoice.description,
                  data_pagamento: paymentDate,
                  base_url: 'https://webmarcas.net',
                }
              })
            }).catch(e => console.error('[webhook] email error:', e));
            console.log('Payment received email triggered for:', prof.email);
          }

          // SMS + WhatsApp + CRM via multichannel motor
          fetch(`${SUPABASE_URL}/functions/v1/send-multichannel-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
            body: JSON.stringify({
              event_type: 'pagamento_confirmado',
              channels: ['crm', 'sms', 'whatsapp'],
              recipient: {
                nome: prof?.full_name || 'Cliente',
                email: prof?.email   || '',
                phone: prof?.phone   || '',
                user_id: invoice.user_id,
              },
              data: {
                valor: String(invoice.amount || ''),
                marca: invoice.description || '',
              },
            }),
          }).catch(e => console.error('[webhook] multichannel error:', e));

          console.log('[webhook] Multichannel pagamento_confirmado dispatched for user:', invoice.user_id);
        } catch (notifError) {
          console.error('Error sending payment confirmation notifications:', notifError);
        }
      }

      // If no contract linked, just return success
      if (!invoice.contract_id) {
        return new Response(
          JSON.stringify({ success: true, message: 'Invoice updated successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // STEP 2: Find the contract associated with this payment
    const { data: contract, error: contractError } = await supabaseAdmin
      .from('contracts')
      .select('*, leads(*)')
      .eq('asaas_payment_id', paymentId)
      .maybeSingle();

    if (contractError || !contract) {
      console.log('Contract not found for payment:', paymentId);
      
      // If we already updated the invoice above, return success
      if (invoice) {
        return new Response(
          JSON.stringify({ success: true, message: 'Invoice updated, no contract linked' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'No invoice or contract found for this payment' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Handle payment status changes
    if (paymentStatus === 'RECEIVED' || paymentStatus === 'CONFIRMED' || paymentStatus === 'RECEIVED_IN_CASH') {
      console.log('Payment confirmed! Processing conversion...');

      // Get lead data
      const lead = contract.leads;
      
      if (!lead) {
        console.log('No lead associated with contract');
        return new Response(
          JSON.stringify({ success: false, message: 'No lead found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Check if already processed (user already created)
      if (contract.user_id) {
        console.log('Contract already has a user, updating status only');

        // PONTO 3: Atualizar pipeline para pagamento_ok (already processed)
        await supabaseAdmin
          .from('brand_processes')
          .update({ pipeline_stage: 'pagamento_ok', updated_at: new Date().toISOString() })
          .eq('user_id', contract.user_id)
          .eq('pipeline_stage', 'assinou_contrato');

        console.log('[webhook] Pipeline updated to pagamento_ok for existing user:', contract.user_id);
        
        // Update invoice status
        await supabaseAdmin
          .from('invoices')
          .update({
            status: 'confirmed',
            payment_date: payment.paymentDate || payment.confirmedDate || new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
          })
          .eq('asaas_invoice_id', paymentId);

        return new Response(
          JSON.stringify({ success: true, message: 'Already processed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Parse data from lead and contract
      const personalData = {
        fullName: lead.full_name,
        cpf: lead.cpf_cnpj || '',
        email: lead.email,
        phone: lead.phone || '',
        cep: lead.zip_code || '',
        address: lead.address || '',
        neighborhood: '',
        city: lead.city || '',
        state: lead.state || '',
      };

      // Extract brand name from contract description or notes
      const brandName = extractBrandName(contract.subject || contract.description || lead.notes || '');
      const businessArea = extractBusinessArea(lead.notes || '');

      const brandData = {
        brandName: brandName,
        businessArea: businessArea,
        hasCNPJ: (lead.cpf_cnpj?.length || 0) > 11,
        cnpj: (lead.cpf_cnpj?.length || 0) > 11 ? lead.cpf_cnpj : '',
        companyName: lead.company_name || '',
      };

      // Call confirm-payment to create user, profile, process, etc.
      const confirmResponse = await fetch(`${SUPABASE_URL}/functions/v1/confirm-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          leadId: lead.id,
          contractId: contract.id,
          paymentId: paymentId,
          asaasCustomerId: payment.customer,
          personalData,
          brandData,
          paymentValue: contract.contract_value || payment.value,
          paymentMethod: getPaymentMethod(payment.billingType),
          contractHtml: contract.contract_html,
          signatureData: {
            ip: contract.signature_ip || 'Webhook Asaas',
            userAgent: contract.signature_user_agent || 'Asaas Webhook',
            signedAt: contract.signed_at || new Date().toISOString(),
          },
        }),
      });

      const confirmResult = await confirmResponse.json();
      console.log('Confirm payment result:', JSON.stringify(confirmResult));

      if (confirmResult.success) {
        // Update invoice to paid
        await supabaseAdmin
          .from('invoices')
          .update({
            status: 'confirmed',
            payment_date: payment.paymentDate || payment.confirmedDate || new Date().toISOString().split('T')[0],
            user_id: confirmResult.userId,
            updated_at: new Date().toISOString(),
          })
          .eq('asaas_invoice_id', paymentId);

        // PONTO 2: Atualizar pipeline para pagamento_ok (novo usuario via confirm-payment)
        if (confirmResult.userId) {
          await supabaseAdmin
            .from('brand_processes')
            .update({ pipeline_stage: 'pagamento_ok', updated_at: new Date().toISOString() })
            .eq('user_id', confirmResult.userId)
            .in('pipeline_stage', ['protocolado', 'assinou_contrato']);

          console.log('[webhook] Pipeline updated to pagamento_ok for new user:', confirmResult.userId);
        }

        console.log('Payment fully processed!');

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Payment confirmed and user created',
            userId: confirmResult.userId,
            processId: confirmResult.processId,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      } else {
        console.error('Error in confirm-payment:', confirmResult.error);
        return new Response(
          JSON.stringify({ success: false, error: confirmResult.error }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    }

    // Handle other status changes
    if (paymentStatus === 'OVERDUE') {
      await supabaseAdmin
        .from('invoices')
        .update({ status: 'overdue', updated_at: new Date().toISOString() })
        .eq('asaas_invoice_id', paymentId);

      // Multichannel notification for overdue (CRM + SMS + WhatsApp + Email)
      try {
        const userId = invoice?.user_id;
        if (userId) {
          const { data: profile } = await supabaseAdmin
            .from('profiles').select('email, full_name, phone').eq('id', userId).single();

          if (profile) {
            // Email automation
            if (profile.email) {
              fetch(`${SUPABASE_URL}/functions/v1/trigger-email-automation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
                body: JSON.stringify({
                  trigger_event: 'payment_overdue',
                  data: {
                    nome: profile.full_name || 'Cliente',
                    email: profile.email,
                    valor: String(invoice.amount || ''),
                    base_url: 'https://webmarcas.net',
                  }
                })
              }).catch(e => console.error('[webhook] overdue email error:', e));
            }

            // SMS + WhatsApp + CRM
            fetch(`${SUPABASE_URL}/functions/v1/send-multichannel-notification`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
              body: JSON.stringify({
                event_type: 'fatura_vencida',
                channels: ['crm', 'sms', 'whatsapp'],
                recipient: {
                  nome: profile.full_name || 'Cliente',
                  email: profile.email,
                  phone: profile.phone || '',
                  user_id: userId,
                },
                data: {
                  valor: String(invoice?.amount || ''),
                  marca: invoice?.description || '',
                },
              }),
            }).catch(e => console.error('[webhook] overdue multichannel error:', e));

            console.log('[webhook] Multichannel fatura_vencida dispatched for user:', userId);
          }
        }
      } catch (e) {
        console.error('Error sending overdue notifications:', e);
      }

      console.log('Payment overdue processed:', paymentId);
    }

    if (paymentStatus === 'REFUNDED' || paymentStatus === 'REFUND_REQUESTED') {
      await supabaseAdmin
        .from('invoices')
        .update({ status: 'refunded', updated_at: new Date().toISOString() })
        .eq('asaas_invoice_id', paymentId);
      
      console.log('Payment refunded:', paymentId);
    }

    return new Response(
      JSON.stringify({ success: true, message: `Processed event: ${event}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    console.error('Error in asaas-webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Helper functions
function getInvoiceStatus(asaasStatus: AsaasPaymentStatus): string {
  // Values allowed by check constraint: pending, confirmed, received, overdue, refunded, canceled
  const statusMap: Record<AsaasPaymentStatus, string> = {
    'PENDING': 'pending',
    'RECEIVED': 'received',         // Changed from 'paid' to 'received'
    'CONFIRMED': 'confirmed',       // Changed from 'paid' to 'confirmed'
    'RECEIVED_IN_CASH': 'received', // Changed from 'paid' to 'received'
    'OVERDUE': 'overdue',
    'REFUNDED': 'refunded',
    'REFUND_REQUESTED': 'pending',  // Changed to valid value
    'REFUND_IN_PROGRESS': 'pending',
    'CHARGEBACK_REQUESTED': 'pending',
    'CHARGEBACK_DISPUTE': 'pending',
    'AWAITING_CHARGEBACK_REVERSAL': 'pending',
    'DUNNING_REQUESTED': 'overdue',
    'DUNNING_RECEIVED': 'received', // Changed from 'paid' to 'received'
    'AWAITING_RISK_ANALYSIS': 'pending',
  };
  return statusMap[asaasStatus] || 'pending';
}

function getPaymentMethod(billingType: string): string {
  const methodMap: Record<string, string> = {
    'PIX': 'avista',
    'BOLETO': 'boleto3x',
    'CREDIT_CARD': 'cartao6x',
  };
  return methodMap[billingType] || 'avista';
}

function extractBrandName(text: string): string {
  // Try to extract brand name from "Registro de Marca: BRANDNAME" or "marca: BRANDNAME"
  const patterns = [
    /Registro de Marca:\s*(.+?)(?:\s*\||$)/i,
    /marca[:\s]+["']?([^"'|]+)["']?/i,
    /Marca:\s*(.+?)(?:\s*\||$)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return 'Marca não identificada';
}

function extractBusinessArea(text: string): string {
  // Try to extract business area from "Ramo: AREA" pattern
  const patterns = [
    /Ramo:\s*(.+?)(?:\s*\||$)/i,
    /ramo de atividade:\s*(.+?)(?:\s*\||$)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return 'Não especificado';
}
