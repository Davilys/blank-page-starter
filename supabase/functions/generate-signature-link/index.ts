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
    const { contractId, expiresInDays: requestedDays, baseUrl: clientBaseUrl } = await req.json();
    
    if (!contractId) {
      return new Response(
        JSON.stringify({ error: 'contractId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Production domain — always use this to avoid broken links from preview environments
    const PRODUCTION_DOMAIN = 'https://webpatentes.com.br';

    // Determine base URL with multiple safeguards:
    // 1. Use SITE_URL only if it's NOT a preview/lovable domain (admin may have misconfigured it)
    // 2. Use clientBaseUrl only if it's NOT a preview domain
    // 3. Always fall back to the hardcoded production domain
    const isPreviewUrl = (url: string) =>
      url.includes('lovableproject.com') ||
      url.includes('lovable.app') ||
      url.includes('localhost');

    const rawSiteUrl = Deno.env.get('SITE_URL') || '';
    const siteUrlIsValid = rawSiteUrl && !isPreviewUrl(rawSiteUrl);

    const clientBaseUrlIsValid = clientBaseUrl && !isPreviewUrl(clientBaseUrl);

    const resolvedBase = siteUrlIsValid ? rawSiteUrl : (clientBaseUrlIsValid ? clientBaseUrl : PRODUCTION_DOMAIN);

    // Strip trailing slash to prevent double-slash in URLs (e.g. https://domain.com//assinar/)
    const baseUrl = resolvedBase.replace(/\/+$/, '');

    console.log('Using base URL:', baseUrl, '| rawSiteUrl:', rawSiteUrl, '| clientBaseUrl was:', clientBaseUrl);

    // Read configured validity from system_settings
    let configuredDays = 7;
    try {
      const { data: settingsRow } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'contracts')
        .single();
      if (settingsRow?.value?.linkValidityDays) {
        configuredDays = settingsRow.value.linkValidityDays;
      }
    } catch (e) {
      console.warn('Could not read contract settings, using default 7 days');
    }

    // Use explicitly provided value if given, otherwise use configured value
    const expiresInDays = requestedDays ?? configuredDays;

    console.log('Signature link expiration:', { requestedDays, configuredDays, finalDays: expiresInDays });

    // Generate unique token
    const token = crypto.randomUUID();
    
    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Update contract with signature token
    const { data: contract, error } = await supabase
      .from('contracts')
      .update({
        signature_token: token,
        signature_expires_at: expiresAt.toISOString(),
      })
      .eq('id', contractId)
      .select('id, subject, user_id')
      .single();

    if (error) {
      console.error('Error updating contract:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar link de assinatura', details: error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log event
    await supabase
      .from('signature_audit_log')
      .insert({
        contract_id: contractId,
        event_type: 'link_generated',
        event_data: {
          expires_at: expiresAt.toISOString(),
          expires_in_days: expiresInDays,
        },
      });

    // Build public URL
    const signatureUrl = `${baseUrl}/assinar/${token}`;

    console.log('Signature link generated:', { contractId, token: token.substring(0, 8) + '...', expiresAt });

    // Multichannel notification: link gerado
    try {
      if (contract.user_id) {
        const { data: profile } = await supabase.from('profiles').select('email, full_name, phone').eq('id', contract.user_id).single();
        if (profile) {
          await fetch(`${supabaseUrl}/functions/v1/send-multichannel-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
            body: JSON.stringify({
              event_type: 'link_assinatura_gerado',
              channels: ['crm', 'sms', 'whatsapp'],
              recipient: { nome: profile.full_name || 'Cliente', email: profile.email, phone: profile.phone || '', user_id: contract.user_id },
              data: { link: signatureUrl, marca: contract.subject || '' },
            }),
          });
        }
      }
    } catch (e) { console.error('Error sending signature link multichannel notification:', e); }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          token,
          url: signatureUrl,
          expiresAt: expiresAt.toISOString(),
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in generate-signature-link:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
