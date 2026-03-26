import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get base URL from SITE_URL secret - REQUIRED
    const siteUrl = Deno.env.get("SITE_URL");
    if (!siteUrl) {
      console.error("SITE_URL secret not configured");
      return new Response(
        JSON.stringify({ error: "SITE_URL secret not configured. Please set it in Lovable Cloud secrets." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    console.log("Using SITE_URL:", siteUrl);

    // Find contracts expiring in 2 days that haven't been signed
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    const twoDaysFromNowEnd = new Date(twoDaysFromNow);
    twoDaysFromNowEnd.setHours(23, 59, 59, 999);
    
    const oneDayFromNow = new Date();
    oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);
    oneDayFromNow.setHours(23, 59, 59, 999);

    console.log("Checking for contracts expiring between", oneDayFromNow.toISOString(), "and", twoDaysFromNowEnd.toISOString());

    const { data: expiringContracts, error: contractsError } = await supabase
      .from("contracts")
      .select(`
        id,
        contract_number,
        subject,
        document_type,
        signature_token,
        signature_expires_at,
        signatory_name,
        user_id,
        lead_id,
        profiles:user_id (
          email,
          full_name
        ),
        leads:lead_id (
          email,
          full_name
        )
      `)
      .is("signed_at", null)
      .eq("signature_status", "pending")
      .not("signature_token", "is", null)
      .gte("signature_expires_at", oneDayFromNow.toISOString())
      .lte("signature_expires_at", twoDaysFromNowEnd.toISOString());

    if (contractsError) {
      console.error("Error fetching expiring contracts:", contractsError);
      throw contractsError;
    }

    console.log(`Found ${expiringContracts?.length || 0} contracts expiring in ~2 days`);

    if (!expiringContracts || expiringContracts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No expiring contracts found", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get default email account
    const { data: emailAccount, error: accountError } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("is_default", true)
      .single();

    if (accountError || !emailAccount) {
      console.error("No default email account configured");
      throw new Error("No default email account configured");
    }

    // Configure SMTP client
    const client = new SMTPClient({
      connection: {
        hostname: emailAccount.smtp_host,
        port: emailAccount.smtp_port,
        tls: emailAccount.smtp_port === 465,
        auth: {
          username: emailAccount.smtp_user,
          password: emailAccount.smtp_password,
        },
      },
    });

    const fromAddress = emailAccount.display_name 
      ? `${emailAccount.display_name} <${emailAccount.email_address}>`
      : emailAccount.email_address;

    let sentCount = 0;
    const errors: string[] = [];

    for (const contract of expiringContracts) {
      try {
        // Determine recipient email and name
        const profile = contract.profiles as any;
        const lead = contract.leads as any;
        const recipientEmail = profile?.email || lead?.email;
        const recipientName = contract.signatory_name || profile?.full_name || lead?.full_name || "Cliente";

        if (!recipientEmail) {
          console.log(`Skipping contract ${contract.id}: no recipient email`);
          continue;
        }

        // Check if reminder already sent (using audit log)
        const { data: existingReminder } = await supabase
          .from("signature_audit_log")
          .select("id")
          .eq("contract_id", contract.id)
          .eq("event_type", "expiration_reminder_sent")
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .single();

        if (existingReminder) {
          console.log(`Skipping contract ${contract.id}: reminder already sent in last 24h`);
          continue;
        }

        // Use SITE_URL for signature link
        const signatureLink = `${siteUrl}/assinar/${contract.signature_token}`;
        const expiresAt = new Date(contract.signature_expires_at);
        const formattedExpiry = expiresAt.toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        const documentTypeName = 
          contract.document_type === 'procuracao' ? 'Procuração' :
          contract.document_type === 'distrato_multa' ? 'Termo de Distrato' :
          contract.document_type === 'distrato_sem_multa' ? 'Termo de Distrato' :
          'Contrato';

        const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">⚠️ Lembrete de Assinatura</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="font-size: 16px; color: #333; margin: 0 0 20px;">
                Olá, <strong>${recipientName}</strong>!
              </p>
              
              <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #92400E; font-weight: bold;">
                  ⏰ Seu documento expira em breve!
                </p>
              </div>
              
              <p style="font-size: 14px; color: #666; margin: 20px 0;">
                Notamos que você ainda não assinou o documento <strong>"${documentTypeName}"</strong> 
                ${contract.subject ? `- ${contract.subject}` : ''}.
              </p>
              
              <p style="font-size: 14px; color: #666; margin: 20px 0;">
                O link de assinatura expira em: <br>
                <strong style="color: #DC2626; font-size: 16px;">${formattedExpiry}</strong>
              </p>
              
              <p style="font-size: 14px; color: #666; margin: 20px 0;">
                Após a expiração, será necessário solicitar um novo link de assinatura.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${signatureLink}" 
                   style="display: inline-block; background: linear-gradient(135deg, #16A34A 0%, #22C55E 100%); color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  ✍️ Assinar Documento Agora
                </a>
              </div>
              
              <p style="font-size: 12px; color: #999; margin: 20px 0; text-align: center;">
                Ou copie e cole este link no navegador:<br>
                <a href="${signatureLink}" style="color: #3B82F6; word-break: break-all;">${signatureLink}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="font-size: 12px; color: #6B7280; margin: 0;">
                WebMarcas Intelligence PI - CNPJ: 39.528.012/0001-29<br>
                Av. Prestes Maia, 241 - Centro, São Paulo - SP<br>
                <a href="${siteUrl}" style="color: #3B82F6;">Acessar Portal</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        // Send reminder email
        await client.send({
          from: fromAddress,
          to: [recipientEmail],
          subject: `⚠️ LEMBRETE: Seu documento expira em breve - ${documentTypeName}`,
          content: `Olá ${recipientName}, seu documento "${documentTypeName}" expira em ${formattedExpiry}. Acesse ${signatureLink} para assinar.`,
          html: htmlContent,
        });

        // Log the reminder in audit
        await supabase.from("signature_audit_log").insert({
          contract_id: contract.id,
          event_type: "expiration_reminder_sent",
          event_data: {
            recipient_email: recipientEmail,
            recipient_name: recipientName,
            expires_at: contract.signature_expires_at
          }
        });

        // Also log in email_logs
        await supabase.from("email_logs").insert({
          to_email: recipientEmail,
          from_email: emailAccount.email_address,
          subject: `⚠️ LEMBRETE: Seu documento expira em breve - ${documentTypeName}`,
          body: `Lembrete de assinatura para ${recipientName}`,
          html_body: htmlContent,
          status: "sent",
          trigger_type: "signature_expiration_reminder"
        });

        sentCount++;
        console.log(`Reminder sent to ${recipientEmail} for contract ${contract.id}`);
      } catch (err: any) {
        console.error(`Error processing contract ${contract.id}:`, err);
        errors.push(`Contract ${contract.id}: ${err.message}`);
      }
    }

    await client.close();

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${sentCount} reminder emails`,
        count: sentCount,
        total: expiringContracts.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in check-signature-expiration:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
