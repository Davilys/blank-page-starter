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
    const { 
      contractId, 
      channels = ['email'], 
      baseUrl: clientBaseUrl,
      overrideContact, // Optional: { email, phone, name } for new clients
    } = await req.json();
    
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

    // Fetch contract and user details
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select(`
        id,
        subject,
        signature_token,
        signature_expires_at,
        document_type,
        signatory_name,
        user_id,
        profiles:user_id (
          email,
          phone,
          full_name
        )
      `)
      .eq('id', contractId)
      .single();

    if (contractError || !contract) {
      console.error('Contract not found:', contractError);
      return new Response(
        JSON.stringify({ error: 'Contrato não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!contract.signature_token) {
      return new Response(
        JSON.stringify({ error: 'Link de assinatura não gerado. Gere o link primeiro.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const profile = contract.profiles as any;
    
    // Use override contact if provided (for newly created clients), otherwise use profile
    const recipientEmail = overrideContact?.email || profile?.email;
    const recipientPhone = overrideContact?.phone || profile?.phone;
    const recipientName = overrideContact?.name || contract.signatory_name || profile?.full_name || 'Cliente';
    
    // Production domain — always use this to avoid broken links from preview environments
    const PRODUCTION_DOMAIN = 'https://webmarcas.net';

    const isPreviewUrl = (url: string) =>
      url.includes('lovableproject.com') ||
      url.includes('lovable.app') ||
      url.includes('localhost');

    const rawSiteUrl = Deno.env.get('SITE_URL') || '';
    const siteUrlIsValid = rawSiteUrl && !isPreviewUrl(rawSiteUrl);
    const clientBaseUrlIsValid = clientBaseUrl && !isPreviewUrl(clientBaseUrl);

    const resolvedBase = siteUrlIsValid ? rawSiteUrl : (clientBaseUrlIsValid ? clientBaseUrl : PRODUCTION_DOMAIN);

    // Strip trailing slash to prevent double-slash (e.g. https://domain.com//assinar/)
    const baseUrl = resolvedBase.replace(/\/+$/, '');
    const signatureUrl = `${baseUrl}/assinar/${contract.signature_token}`;
    
    const documentTypeName = contract.document_type === 'procuracao' ? 'Procuração' :
                             contract.document_type === 'distrato_multa' ? 'Distrato' :
                             contract.document_type === 'distrato_sem_multa' ? 'Distrato' :
                             'Documento';

    const results: { channel: string; success: boolean; error?: string }[] = [];

    // Send via Email
    if (channels.includes('email') && recipientEmail) {
      try {
        // Fetch signature_request template from email_templates
        const { data: emailTemplate } = await supabase
          .from('email_templates')
          .select('*')
          .eq('trigger_event', 'signature_request')
          .eq('is_active', true)
          .single();

        const expirationDate = contract.signature_expires_at
          ? new Date(contract.signature_expires_at).toLocaleDateString('pt-BR')
          : '7 dias';

        let emailSubject: string;
        let emailBody: string;

        if (emailTemplate) {
          // Use customizable template from database
          emailSubject = emailTemplate.subject
            .replace(/\{\{nome\}\}/g, recipientName)
            .replace(/\{\{nome_cliente\}\}/g, recipientName)
            .replace(/\{\{marca\}\}/g, contract.subject || '')
            .replace(/\{\{documento_tipo\}\}/g, documentTypeName)
            .replace(/\{\{link_assinatura\}\}/g, signatureUrl)
            .replace(/\{\{data_expiracao\}\}/g, expirationDate);

          emailBody = emailTemplate.body
            .replace(/\{\{nome\}\}/g, recipientName)
            .replace(/\{\{nome_cliente\}\}/g, recipientName)
            .replace(/\{\{marca\}\}/g, contract.subject || '')
            .replace(/\{\{documento_tipo\}\}/g, documentTypeName)
            .replace(/\{\{link_assinatura\}\}/g, signatureUrl)
            .replace(/\{\{data_expiracao\}\}/g, expirationDate);
        } else {
          // Fallback: default content if template is missing or inactive
          emailSubject = `[WebMarcas] ${documentTypeName} pendente de assinatura - ${contract.subject}`;
          emailBody = `<div style="font-family: Arial, sans-serif; padding: 20px;">
<p>Olá <strong>${recipientName}</strong>,</p>
<p>Você possui um documento pendente de assinatura eletrônica:</p>
<p>📄 <strong>${documentTypeName}</strong>: ${contract.subject}</p>
<p><a href="${signatureUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">✍️ Assinar Documento</a></p>
<p style="color:#e74c3c;">⚠️ Este link expira em ${expirationDate}.</p>
<p>A assinatura eletrônica tem validade jurídica conforme Lei 14.063/2020.</p>
<hr/>
<p style="font-size:13px;color:#888;">📞 (11) 4200-1656 | 📧 contato@webmarcas.com.br</p>
</div>`;
        }

        // Call send-email directly (uses Resend - no SMTP dependency)
        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            to: [recipientEmail],
            subject: emailSubject,
            html: emailBody,
          }),
        });

        const emailResult = await emailResponse.json().catch(() => ({}));
        console.log('Email send result:', emailResult);

        results.push({ 
          channel: 'email', 
          success: emailResponse.ok,
          error: emailResponse.ok ? undefined : (emailResult?.error || 'Erro ao enviar email')
        });
      } catch (emailError) {
        console.error('Email error:', emailError);
        results.push({ channel: 'email', success: false, error: 'Erro ao enviar email' });
      }
    }

    // Send via WhatsApp (Evolution API)
    if (channels.includes('whatsapp') && recipientPhone) {
      try {
        // Fetch WhatsApp config
        const { data: whatsappConfig } = await supabase
          .from('whatsapp_config')
          .select('*')
          .eq('is_active', true)
          .single();

        if (whatsappConfig && whatsappConfig.server_url && whatsappConfig.api_key) {
          const phoneNumber = recipientPhone.replace(/\D/g, '');
          const formattedPhone = phoneNumber.startsWith('55') ? phoneNumber : `55${phoneNumber}`;

          const message = `🔔 *WebMarcas - Documento Pendente*

Olá ${recipientName}!

Você possui um documento pendente de assinatura:
📄 *${documentTypeName}*: ${contract.subject}

Clique para assinar:
${signatureUrl}

⚠️ Link válido até ${new Date(contract.signature_expires_at!).toLocaleDateString('pt-BR')}

Dúvidas? (11) 4200-1656`;

          const whatsappResponse = await fetch(
            `${whatsappConfig.server_url}/message/sendText/${whatsappConfig.instance_name}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': whatsappConfig.api_key,
              },
              body: JSON.stringify({
                number: formattedPhone,
                text: message,
              }),
            }
          );

          results.push({ 
            channel: 'whatsapp', 
            success: whatsappResponse.ok,
            error: whatsappResponse.ok ? undefined : 'Erro ao enviar WhatsApp'
          });
        } else {
          results.push({ channel: 'whatsapp', success: false, error: 'WhatsApp não configurado' });
        }
      } catch (whatsappError) {
        console.error('WhatsApp error:', whatsappError);
        results.push({ channel: 'whatsapp', success: false, error: 'Erro ao enviar WhatsApp' });
      }
    }

    // Log event
    await supabase
      .from('signature_audit_log')
      .insert({
        contract_id: contractId,
        event_type: 'signature_request_sent',
        event_data: {
          channels,
          results,
          recipient_email: recipientEmail,
          recipient_phone: recipientPhone,
        },
      });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          results,
          signatureUrl,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in send-signature-request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
