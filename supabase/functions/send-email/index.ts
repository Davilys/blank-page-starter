import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=denonext";
// @deno-types="npm:@types/nodemailer@6.4.14"
import nodemailer from "npm:nodemailer@6.9.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailAttachment {
  url: string;
  filename: string;
}

interface EmailRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  html?: string;
  from?: string;
  attachments?: EmailAttachment[];
  account_id?: string; // When provided, send via user's SMTP
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, cc, bcc, subject, body, html, attachments, account_id }: EmailRequest = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create professional HTML content
    const htmlContent = html || `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px;">
  ${body}
</body>
</html>`;

    // ===== PATH 1: Send via user's SMTP (appears in their Outlook/Sent) =====
    if (account_id) {
      const { data: emailAccount, error: accError } = await supabase
        .from("email_accounts")
        .select("*")
        .eq("id", account_id)
        .single();

      if (accError || !emailAccount) {
        console.error("Email account not found:", accError);
        return new Response(
          JSON.stringify({ error: "Conta de email não encontrada" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (!emailAccount.smtp_host || !emailAccount.smtp_user || !emailAccount.smtp_password) {
        return new Response(
          JSON.stringify({ error: "SMTP não configurado para esta conta" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log("Sending via SMTP:", emailAccount.smtp_host, emailAccount.smtp_port);

      const smtpPort = emailAccount.smtp_port || 587;
      const transporter = nodemailer.createTransport({
        host: emailAccount.smtp_host,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: emailAccount.smtp_user,
          pass: emailAccount.smtp_password,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
      });

      const displayName = emailAccount.display_name || emailAccount.email_address;
      const fromAddress = `${displayName} <${emailAccount.email_address}>`;

      const smtpAttachments = attachments?.map(att => ({
        filename: att.filename,
        path: att.url,
      }));

      const info = await transporter.sendMail({
        from: fromAddress,
        to: to.join(", "),
        cc: cc?.join(", "),
        bcc: bcc?.join(", "),
        subject: subject,
        html: htmlContent,
        attachments: smtpAttachments,
      });

      console.log("Email sent via SMTP:", info.messageId);

      return new Response(
        JSON.stringify({ success: true, message: "Email enviado via SMTP", id: info.messageId }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ===== PATH 2: Send via Resend (system/automated emails) =====
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch default email account for display name only
    const { data: emailAccount } = await supabase
      .from("email_accounts")
      .select("email_address, display_name")
      .eq("is_default", true)
      .single();

    const VERIFIED_FROM_DOMAIN = 'webmarcas.net';
    const VERIFIED_FROM_EMAIL = `noreply@${VERIFIED_FROM_DOMAIN}`;
    const displayName = emailAccount?.display_name || 'WebMarcas';
    const fromAddress = `${displayName} <${VERIFIED_FROM_EMAIL}>`;

    console.log("Sending email via Resend to:", to);
    console.log("From:", fromAddress);

    const resendAttachments = attachments && attachments.length > 0
      ? attachments.map((att) => ({
          filename: att.filename,
          path: att.url,
        }))
      : undefined;

    // Call Resend API directly via fetch (avoids esm.sh canvas.node issue)
    const resendPayload: Record<string, unknown> = {
      from: fromAddress,
      to,
      subject,
      html: htmlContent,
    };
    if (cc && cc.length > 0) resendPayload.cc = cc;
    if (bcc && bcc.length > 0) resendPayload.bcc = bcc;
    if (resendAttachments && resendAttachments.length > 0) resendPayload.attachments = resendAttachments;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    const resendBody = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend API error:", resendBody);
      const error = resendBody;
      return new Response(
        JSON.stringify({ error: error.message || "Resend error" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const data = resendBody;


    console.log("Email sent successfully via Resend:", data);

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully", id: data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
