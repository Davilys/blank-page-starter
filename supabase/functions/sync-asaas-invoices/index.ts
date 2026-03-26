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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');

    if (!ASAAS_API_KEY) {
      throw new Error('ASAAS_API_KEY not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all pending invoices that have an asaas_invoice_id
    const { data: pendingInvoices, error: fetchError } = await supabase
      .from('invoices')
      .select('id, asaas_invoice_id, status, amount, description, user_id')
      .eq('status', 'pending')
      .not('asaas_invoice_id', 'is', null);

    if (fetchError) {
      throw new Error(`Error fetching invoices: ${fetchError.message}`);
    }

    if (!pendingInvoices || pendingInvoices.length === 0) {
      return new Response(
        JSON.stringify({ success: true, synced: 0, total: 0, message: 'Nenhuma fatura pendente para sincronizar' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${pendingInvoices.length} pending invoices to sync`);

    let synced = 0;
    const errors: string[] = [];

    for (const invoice of pendingInvoices) {
      try {
        // Query Asaas API
        const asaasResponse = await fetch(
          `https://api.asaas.com/v3/payments/${invoice.asaas_invoice_id}`,
          {
            headers: {
              'access_token': ASAAS_API_KEY,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!asaasResponse.ok) {
          const errText = await asaasResponse.text();
          console.error(`Asaas API error for ${invoice.asaas_invoice_id}: ${asaasResponse.status} - ${errText}`);
          errors.push(`${invoice.asaas_invoice_id}: ${asaasResponse.status}`);
          continue;
        }

        const asaasPayment = await asaasResponse.json();
        const asaasStatus = asaasPayment.status as string;

        // If still PENDING in Asaas, skip
        if (asaasStatus === 'PENDING') {
          continue;
        }

        // Map Asaas status to local status
        const newStatus = mapAsaasStatus(asaasStatus);
        const paymentDate = asaasPayment.paymentDate || asaasPayment.confirmedDate || null;

        const updateData: Record<string, unknown> = {
          status: newStatus,
          updated_at: new Date().toISOString(),
        };

        if (paymentDate && (newStatus === 'confirmed' || newStatus === 'received')) {
          updateData.payment_date = paymentDate;
        }

        const { error: updateError } = await supabase
          .from('invoices')
          .update(updateData)
          .eq('id', invoice.id);

        if (updateError) {
          console.error(`Error updating invoice ${invoice.id}: ${updateError.message}`);
          errors.push(`${invoice.id}: ${updateError.message}`);
        } else {
          synced++;
          console.log(`Updated invoice ${invoice.id}: pending -> ${newStatus}`);

          // If payment confirmed, update pipeline stage
          if ((newStatus === 'confirmed' || newStatus === 'received') && invoice.user_id) {
            await supabase
              .from('brand_processes')
              .update({ pipeline_stage: 'pagamento_ok', updated_at: new Date().toISOString() })
              .eq('user_id', invoice.user_id)
              .eq('pipeline_stage', 'assinou_contrato');
          }
        }

        // Delay to avoid Asaas rate limiting (1 second between requests)
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(`Error processing invoice ${invoice.asaas_invoice_id}:`, err);
        errors.push(`${invoice.asaas_invoice_id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced,
        total: pendingInvoices.length,
        errors: errors.length > 0 ? errors : undefined,
        message: synced > 0
          ? `${synced} fatura(s) atualizada(s) de ${pendingInvoices.length} pendente(s)`
          : 'Nenhuma fatura precisou ser atualizada',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in sync-asaas-invoices:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

function mapAsaasStatus(asaasStatus: string): string {
  const map: Record<string, string> = {
    'RECEIVED': 'received',
    'CONFIRMED': 'confirmed',
    'RECEIVED_IN_CASH': 'received',
    'OVERDUE': 'overdue',
    'REFUNDED': 'refunded',
    'REFUND_REQUESTED': 'pending',
    'REFUND_IN_PROGRESS': 'pending',
    'CHARGEBACK_REQUESTED': 'pending',
    'CHARGEBACK_DISPUTE': 'pending',
    'AWAITING_CHARGEBACK_REVERSAL': 'pending',
    'DUNNING_REQUESTED': 'overdue',
    'DUNNING_RECEIVED': 'received',
    'AWAITING_RISK_ANALYSIS': 'pending',
  };
  return map[asaasStatus] || 'pending';
}
