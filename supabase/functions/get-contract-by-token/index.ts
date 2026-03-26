import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch contract by token
    const { data: contract, error } = await supabase
      .from('contracts')
      .select(`
        id,
        subject,
        contract_html,
        document_type,
        signatory_name,
        signatory_cpf,
        signatory_cnpj,
        signature_status,
        signature_expires_at,
        client_signature_image,
        contractor_signature_image,
        blockchain_hash,
        blockchain_timestamp,
        blockchain_tx_id,
        blockchain_network,
        signature_ip,
        payment_method,
        suggested_classes,
        contract_value
      `)
      .eq('signature_token', token)
      .single();

    if (error || !contract) {
      console.error('Contract not found:', error);
      return new Response(
        JSON.stringify({ error: 'Documento não encontrado ou link inválido' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token has expired
    if (contract.signature_expires_at) {
      const expiresAt = new Date(contract.signature_expires_at);
      if (expiresAt < new Date()) {
        return new Response(
          JSON.stringify({ error: 'Link de assinatura expirado' }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Log access event
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await supabase
      .from('signature_audit_log')
      .insert({
        contract_id: contract.id,
        event_type: 'link_accessed',
        event_data: { token_prefix: token.substring(0, 8) + '...' },
        ip_address: clientIP,
        user_agent: userAgent,
      });

    return new Response(
      JSON.stringify({ contract }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in get-contract-by-token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
