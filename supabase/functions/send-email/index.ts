import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

interface ResendAttachment {
  filename: string;
  path: string;
}

async function sendWithResendApi(payload: {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  attachments?: ResendAttachment[];
  reply_to?: string[];
}) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    throw new Error("Email service not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawBody = await response.text();
  let parsedBody: Record<string, unknown> | null = null;

  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = null;
    }
  }

  if (!response.ok) {
    throw new Error(
      (parsedBody?.message as string | undefined) ||
      (parsedBody?.error as string | undefined) ||
      rawBody ||
      "Failed to send email"
    );
  }

  return parsedBody;
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

    const accountQuery = account_id
      ? supabase
          .from("email_accounts")
          .select("email_address, display_name")
          .eq("id", account_id)
          .maybeSingle()
      : supabase
          .from("email_accounts")
          .select("email_address, display_name")
          .eq("is_default", true)
          .maybeSingle();

    const { data: emailAccount, error: emailAccountError } = await accountQuery;

    if (account_id && (emailAccountError || !emailAccount)) {
      return new Response(
        JSON.stringify({ error: "Conta de email não encontrada" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

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

    const data = await sendWithResendApi({
      from: fromAddress,
      to: to,
      cc: cc,
      bcc: bcc,
      subject: subject,
      html: htmlContent,
      ...(emailAccount?.email_address ? { reply_to: [emailAccount.email_address] } : {}),
      ...(resendAttachments && resendAttachments.length > 0 ? { attachments: resendAttachments } : {}),
    });

    console.log("Email sent successfully via Resend:", data);

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully", id: data?.id ?? data?.data?.id ?? null }),
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
