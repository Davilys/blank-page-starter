import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TriggerRequest {
  trigger_event: string;
  lead_id?: string;
  create_lead?: boolean;
  data: {
    nome?: string;
    email?: string;
    marca?: string;
    phone?: string;
    data_assinatura?: string;
    hash_contrato?: string;
    ip_assinatura?: string;
    verification_url?: string;
    link_assinatura?: string;
    data_expiracao?: string;
    base_url?: string;
    senha?: string;
    login_url?: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { trigger_event, lead_id, create_lead, data }: TriggerRequest = await req.json();
    
    console.log(`Processing email automation for trigger: ${trigger_event}`);
    console.log('Data received:', JSON.stringify(data, null, 2));

    // Initialize Resend client
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resend = new Resend(resendApiKey);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine app_url — always falls back to production domain (never returns 500)
    const PRODUCTION_DOMAIN = 'https://webmarcas.net';
    const rawSiteUrl = Deno.env.get('SITE_URL') || '';
    const isPreviewUrl = (url: string) =>
      !url || url.includes('lovable.app') || url.includes('localhost') || url.includes('127.0.0.1');
    const appUrl = data.base_url ||
      (rawSiteUrl && !isPreviewUrl(rawSiteUrl) ? rawSiteUrl : PRODUCTION_DOMAIN);
    console.log('Using app URL:', appUrl);

    let actualLeadId = lead_id;

    // Handle lead creation for form_started
    if (create_lead && trigger_event === 'form_started' && data.email) {
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id')
        .eq('email', data.email)
        .single();

      if (existingLead) {
        actualLeadId = existingLead.id;
        await supabase
          .from('leads')
          .update({ 
            form_started_at: new Date().toISOString(),
            full_name: data.nome,
            phone: data.phone || null,
          })
          .eq('id', existingLead.id)
          .is('form_started_at', null);
      } else {
        const { data: newLead, error: leadError } = await supabase
          .from('leads')
          .insert({
            full_name: data.nome || 'Lead',
            email: data.email,
            phone: data.phone || null,
            form_started_at: new Date().toISOString(),
            status: 'novo',
            origin: 'site',
            company_name: data.marca || null,
          })
          .select('id')
          .single();

        if (leadError) {
          console.error('Error creating lead:', leadError);
        } else {
          actualLeadId = newLead?.id;
          console.log('Created lead:', actualLeadId);
        }
      }
    }

    // Fetch active template for the event
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('trigger_event', trigger_event)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      console.log(`No active template found for trigger: ${trigger_event}`);
      return new Response(
        JSON.stringify({ success: false, message: 'No active template found for this trigger' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found template: ${template.name}`);

    // Fetch default email account for from address
    const { data: emailAccount } = await supabase
      .from('email_accounts')
      .select('email_address, display_name')
      .eq('is_default', true)
      .single();

    // Replace template variables
    let subject = template.subject;
    let body = template.body;

    const replacements: Record<string, string> = {
      '{{nome}}': data.nome || '',
      '{{nome_cliente}}': data.nome || '',
      '{{email}}': data.email || '',
      '{{marca}}': data.marca || 'Sua Marca',
      '{{nome_marca}}': data.marca || 'Sua Marca',
      '{{data_assinatura}}': data.data_assinatura || new Date().toLocaleDateString('pt-BR'),
      '{{hash_contrato}}': data.hash_contrato || '',
      '{{ip_assinatura}}': data.ip_assinatura || '',
      '{{verification_url}}': data.verification_url || '',
      '{{link_assinatura}}': data.link_assinatura || '',
      '{{data_expiracao}}': data.data_expiracao || '',
      '{{app_url}}': appUrl,
      '{{link_area_cliente}}': data.login_url || `${appUrl}/cliente/login`,
      '{{login_url}}': data.login_url || `${appUrl}/cliente/login`,
      '{{senha}}': data.senha || '',
      '{{numero_processo}}': '',
    };

    for (const [key, value] of Object.entries(replacements)) {
      subject = subject.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
      body = body.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    // Check recipient email
    if (!data.email) {
      console.error('No recipient email provided');
      return new Response(
        JSON.stringify({ error: 'Email do destinatário não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine from address
    const fromAddress = emailAccount?.display_name 
      ? `${emailAccount.display_name} <${emailAccount.email_address}>`
      : emailAccount?.email_address || "WebMarcas <noreply@webmarcas.net>";

    // Wrap body in professional HTML template
    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  ${body}
</body>
</html>`;

    console.log("Sending email via Resend to:", data.email);
    console.log("From:", fromAddress);

    // Send email via Resend API
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: fromAddress,
      to: [data.email],
      subject: subject,
      html: htmlContent,
    });

    if (emailError) {
      console.error("Resend API error:", emailError);
      return new Response(
        JSON.stringify({ error: emailError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Email sent successfully to ${data.email}`, emailData);

    // Log the email
    const { error: logError } = await supabase
      .from('email_logs')
      .insert({
        from_email: emailAccount?.email_address || 'noreply@webmarcas.net',
        to_email: data.email,
        subject: subject,
        body: body.replace(/<[^>]*>/g, '').substring(0, 500),
        html_body: body,
        status: 'sent',
        trigger_type: trigger_event,
        template_id: template.id,
        related_lead_id: actualLeadId || null,
      });

    if (logError) {
      console.error('Error logging email:', logError);
    }

    // ── MULTICHANNEL HOOK: SMS + WhatsApp (aditivo, nunca bloqueia resposta) ──
    try {
      const eventTypeMap: Record<string, string> = {
        form_started     : 'formulario_preenchido',
        signature_request: 'link_assinatura_gerado',
        contract_signed  : 'contrato_assinado',
        payment_received : 'pagamento_confirmado',
        payment_overdue  : 'fatura_vencida',
      };
      const mappedEvent = eventTypeMap[trigger_event];
      // Skip events that don't map to multichannel (user_created, etc.)
      if (mappedEvent) {
        const phone = (data as Record<string, unknown>).phone as string || '';

        // Fetch phone from DB if missing and lead_id provided
        let resolvedPhone = phone;
        if (!resolvedPhone && actualLeadId) {
          const { data: lead } = await supabase.from('leads').select('phone').eq('id', actualLeadId).maybeSingle();
          resolvedPhone = (lead as Record<string, unknown> | null)?.phone as string || '';
        }

        fetch(`${supabaseUrl}/functions/v1/send-multichannel-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            event_type: mappedEvent,
            channels: ['sms', 'whatsapp'], // Email already sent above — no duplication
            recipient: {
              nome:  data.nome  || 'Cliente',
              email: data.email || '',
              phone: resolvedPhone,
            },
            data: {
              marca: data.marca         || '',
              link:  data.link_assinatura || '',
            },
          }),
        }).catch(e => console.error('[trigger-email] SMS/WA dispatch error:', e));
        console.log(`[trigger-email] SMS+WhatsApp dispatched for event: ${mappedEvent}, phone: ${resolvedPhone || 'N/A'}`);
      }
    } catch (multiErr) {
      console.error('[trigger-email] Error in SMS/WhatsApp hook:', multiErr);
    }
    // ── END MULTICHANNEL HOOK ─────────────────────────────────────────────────

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email sent successfully',
        template: template.name,
        to: data.email,
        id: emailData?.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in trigger-email-automation:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
