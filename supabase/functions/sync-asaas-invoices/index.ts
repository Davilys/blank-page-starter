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

    // Fetch all pending/overdue invoices that have an asaas_invoice_id.
    // We include 'overdue' so faturas que foram reagendadas no Asaas voltem para 'pending'.
    const { data: pendingInvoices, error: fetchError } = await supabase
      .from('invoices')
      .select('id, asaas_invoice_id, status, amount, due_date, description, user_id')
      .in('status', ['pending', 'overdue'])
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
    let removed = 0;
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
          // Fatura não existe mais no Asaas (excluída) => cancelar localmente
          const notFound =
            asaasResponse.status === 404 ||
            (asaasResponse.status === 400 && /not\s*found|invalid|does\s*not\s*exist/i.test(errText));
          if (notFound) {
            const { error: cancelErr } = await supabase
              .from('invoices')
              .update({ status: 'cancelled', updated_at: new Date().toISOString() })
              .eq('id', invoice.id);
            if (cancelErr) {
              errors.push(`${invoice.id}: cancel failed - ${cancelErr.message}`);
            } else {
              removed++;
              console.log(`Invoice ${invoice.id} not found in Asaas -> cancelled`);
            }
          } else {
            errors.push(`${invoice.asaas_invoice_id}: ${asaasResponse.status}`);
          }
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }

        const asaasPayment = await asaasResponse.json();
        const asaasStatus = asaasPayment.status as string;

        // Se o Asaas devolveu status DELETED, cancela localmente
        if (asaasStatus === 'DELETED') {
          const { error: cancelErr } = await supabase
            .from('invoices')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', invoice.id);
          if (cancelErr) {
            errors.push(`${invoice.id}: cancel failed - ${cancelErr.message}`);
          } else {
            removed++;
            console.log(`Invoice ${invoice.id} DELETED in Asaas -> cancelled`);
          }
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }

        const asaasDueDate: string | null = asaasPayment.dueDate || null;
        const asaasValue: number | null =
          typeof asaasPayment.value === 'number' ? asaasPayment.value : null;
        const paymentDate = asaasPayment.paymentDate || asaasPayment.confirmedDate || null;

        // Always sync due_date and amount from Asaas (source of truth).
        // Map status; if Asaas says PENDING but the dueDate is in the past, keep 'pending'
        // (Asaas may not have flipped to OVERDUE yet) — and vice-versa, if previously OVERDUE
        // locally but Asaas now PENDING with dueDate in the future, status returns to 'pending'.
        let newStatus = mapAsaasStatus(asaasStatus);
        const todayStr = new Date().toISOString().slice(0, 10);
        if (asaasStatus === 'PENDING' && asaasDueDate && asaasDueDate >= todayStr) {
          newStatus = 'pending';
        }

        const updateData: Record<string, unknown> = {
          status: newStatus,
          updated_at: new Date().toISOString(),
        };
        if (asaasDueDate) updateData.due_date = asaasDueDate;
        if (asaasValue !== null) updateData.amount = asaasValue;
        if (paymentDate && (newStatus === 'confirmed' || newStatus === 'received')) {
          updateData.payment_date = paymentDate;
        }

        // Skip the write if nothing actually changed (avoid trigger churn)
        const noChange =
          newStatus === invoice.status &&
          (!asaasDueDate || asaasDueDate === (invoice as any).due_date) &&
          (asaasValue === null || Number(asaasValue) === Number(invoice.amount));
        if (noChange) {
          await new Promise((r) => setTimeout(r, 250));
          continue;
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
        removed,
        total: pendingInvoices.length,
        errors: errors.length > 0 ? errors : undefined,
        message: synced > 0
          ? `${synced} atualizada(s)${removed ? ` · ${removed} removida(s)` : ''} de ${pendingInvoices.length}`
          : removed > 0
            ? `${removed} fatura(s) removida(s) (não existem mais no Asaas)`
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
    'DELETED': 'cancelled',
  };
  return map[asaasStatus] || 'pending';
}
