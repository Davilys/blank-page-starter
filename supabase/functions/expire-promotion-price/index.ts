import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Novo texto da cláusula 5.1 após expiração da promoção
const NEW_CLAUSE_51 = `5.1 Os pagamentos à CONTRATADA serão efetuados conforme a opção escolhida pelo CONTRATANTE:

• Pagamento à vista: R$ 1.194,00 (mil cento e noventa e quatro reais).
• Pagamento parcelado via boleto bancário: 3 (três) parcelas de R$ 398,00 (trezentos e noventa e oito reais).
• Pagamento parcelado via cartão de crédito: 6 (seis) parcelas de R$ 199,00 (cento e noventa e nove reais) sem incidência de juros.

`;

// Função para atualizar a cláusula 5.1 no contract_html
function updateContractClause51(contractHtml: string): string {
  if (!contractHtml) return contractHtml;
  
  // Regex para encontrar a cláusula 5.1 existente (até 5.2)
  const clause51Regex = /5\.1 Os pagamentos à CONTRATADA[\s\S]*?(?=5\.2 Taxas do INPI)/;
  
  // Verifica se o regex encontra match
  if (clause51Regex.test(contractHtml)) {
    return contractHtml.replace(clause51Regex, NEW_CLAUSE_51);
  }
  
  // Se não encontrar match, retorna o HTML original
  console.log('[expire-promotion-price] Clause 5.1 pattern not found in contract_html');
  return contractHtml;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse request body for optional test mode
    let testMode = false;
    try {
      const body = await req.json();
      testMode = body?.test_mode === true;
    } catch {
      // No body or invalid JSON - proceed normally
    }

    console.log(`[expire-promotion-price] Starting execution. Test mode: ${testMode}`);

    // Find all eligible contracts:
    // - contract_value = 699.00 (promotional price)
    // - payment_method = 'avista' (cash/upfront payment)
    // - signature_status = 'not_signed' (unsigned)
    // - signed_at IS NULL (double check)
    // - asaas_payment_id IS NULL (not paid)
    const { data: contracts, error: fetchError } = await supabase
      .from('contracts')
      .select('id, contract_number, contract_value, payment_method, signature_status, contract_html')
      .eq('contract_value', 699.00)
      .eq('payment_method', 'avista')
      .eq('signature_status', 'not_signed')
      .is('signed_at', null)
      .is('asaas_payment_id', null);

    if (fetchError) {
      console.error('[expire-promotion-price] Error fetching contracts:', fetchError);
      throw new Error(`Failed to fetch contracts: ${fetchError.message}`);
    }

    const eligibleContracts = contracts || [];
    console.log(`[expire-promotion-price] Found ${eligibleContracts.length} eligible contracts`);

    if (eligibleContracts.length === 0) {
      // Log the execution even if no contracts were updated
      await supabase.from('promotion_expiration_logs').insert({
        contracts_updated: 0,
        contract_ids: [],
        status: 'success'
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'No eligible contracts found',
          updated_count: 0,
          contracts_updated: [],
          test_mode: testMode
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const NEW_VALUE = 1194.00;
    const NEW_PAYMENT_METHOD = 'boleto3x';
    const updatedContractIds: string[] = [];
    const updatedContractNumbers: string[] = [];
    const errors: string[] = [];

    // Update each contract individually for safety
    for (const contract of eligibleContracts) {
      if (testMode) {
        // In test mode, don't actually update - just log what would be updated
        console.log(`[expire-promotion-price] TEST MODE: Would update contract ${contract.contract_number} from ${contract.contract_value} to ${NEW_VALUE}, payment_method to ${NEW_PAYMENT_METHOD}`);
        updatedContractIds.push(contract.id);
        updatedContractNumbers.push(contract.contract_number || contract.id);
        continue;
      }

      // Prepare update payload
      const updatePayload: {
        contract_value: number;
        payment_method: string;
        contract_html?: string;
      } = {
        contract_value: NEW_VALUE,
        payment_method: NEW_PAYMENT_METHOD
      };

      // Update contract_html if it exists
      if (contract.contract_html) {
        const updatedHtml = updateContractClause51(contract.contract_html);
        updatePayload.contract_html = updatedHtml;
        console.log(`[expire-promotion-price] Updated contract_html for contract ${contract.contract_number}`);
      }

      const { error: updateError } = await supabase
        .from('contracts')
        .update(updatePayload)
        .eq('id', contract.id)
        // Additional safety checks in the update query
        .eq('contract_value', 699.00)
        .eq('signature_status', 'not_signed')
        .is('signed_at', null);

      if (updateError) {
        console.error(`[expire-promotion-price] Error updating contract ${contract.id}:`, updateError);
        errors.push(`Contract ${contract.contract_number}: ${updateError.message}`);
      } else {
        console.log(`[expire-promotion-price] Successfully updated contract ${contract.contract_number}: value=${NEW_VALUE}, payment_method=${NEW_PAYMENT_METHOD}`);
        updatedContractIds.push(contract.id);
        updatedContractNumbers.push(contract.contract_number || contract.id);
      }
    }

    // Log the execution
    const logStatus = errors.length > 0 ? 'partial_success' : 'success';
    await supabase.from('promotion_expiration_logs').insert({
      contracts_updated: updatedContractIds.length,
      contract_ids: updatedContractIds,
      status: testMode ? 'test_run' : logStatus
    });

    const response = {
      success: true,
      message: testMode 
        ? `Test mode: ${updatedContractIds.length} contracts would be updated`
        : `Successfully updated ${updatedContractIds.length} contracts`,
      updated_count: updatedContractIds.length,
      contracts_updated: updatedContractNumbers,
      new_value: NEW_VALUE,
      new_payment_method: NEW_PAYMENT_METHOD,
      test_mode: testMode,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('[expire-promotion-price] Execution completed:', response);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[expire-promotion-price] Unexpected error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
