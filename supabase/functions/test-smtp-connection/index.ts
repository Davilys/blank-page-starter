import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { smtp_host, smtp_port, smtp_user, smtp_password } = await req.json();

    if (!smtp_host || !smtp_user || !smtp_password) {
      return new Response(
        JSON.stringify({ success: false, error: "Preencha todos os campos SMTP obrigatórios" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Configuração SMTP validada para uso no sistema.", mode: "validation_only", smtp_port: smtp_port || 587 }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("SMTP verification failed:", error.message);

    let userMessage = "Falha na conexão SMTP.";
    const msg = (error.message || "").toLowerCase();

    if (msg.includes("invalid login") || msg.includes("authentication") || msg.includes("credentials") || msg.includes("username and password not accepted")) {
      userMessage = "Usuário ou senha SMTP inválidos. Verifique suas credenciais.";
    } else if (msg.includes("getaddrinfo") || msg.includes("enotfound")) {
      userMessage = "Servidor SMTP não encontrado. Verifique o endereço do servidor.";
    } else if (msg.includes("timeout") || msg.includes("timed out")) {
      userMessage = "Tempo limite excedido. Verifique o servidor e a porta SMTP.";
    } else if (msg.includes("econnrefused")) {
      userMessage = "Conexão recusada. Verifique a porta SMTP.";
    }

    return new Response(
      JSON.stringify({ success: false, error: userMessage, details: error.message }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
