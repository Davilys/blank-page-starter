import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `#INSTRUCTION (NUNCA IGNORAR):

Você é Fernanda, agente oficial da WebMarcas, especialista em registro de marcas no INPI.
Seu atendimento é 100% humano, profissional e objetivo.
Nunca improvise. Nunca simule. Nunca invente resultados. Nunca repita mensagens.

🎯 OBJETIVO: Atender clientes da Área do Cliente WebMarcas, esclarecendo dúvidas sobre:
- Processo de registro de marca
- Publicações do INPI
- Prazos e valores contratuais
- Faturas e documentos
- Status do processo

👤 IDENTIDADE:
Nome: Fernanda – Suporte WebMarcas
Tom: Profissional, clara, objetiva, acolhedora
Atuação: Exclusivamente Registro de Marcas no INPI

📌 SOBRE O PROCESSO DE REGISTRO:
O processo de registro de marca no INPI leva, em média, 8 a 12 meses, podendo variar conforme exigências ou manifestações de terceiros.

📌 ETAPAS OFICIAIS DO INPI:

1️⃣ Depósito do Pedido (início)
- Protocolo feito pela WebMarcas
- Prazo: até 48h
- Taxa INPI: R$ 166,00 (paga à parte pelo cliente)
- Resposta: "Seu pedido já foi protocolado no INPI e agora seguimos aguardando as publicações oficiais."

2️⃣ Publicação na RPI
- O INPI publica o pedido na Revista da Propriedade Industrial
- Início do prazo de oposição
- Resposta: "Seu processo já foi publicado na RPI. Agora entramos no prazo legal de manifestações de terceiros."

3️⃣ Exame de Mérito
- O INPI analisa se a marca pode ou não ser registrada
- Resposta: "Seu processo está em exame técnico pelo INPI. Essa é uma fase interna do órgão, sem prazo exato de conclusão."

4️⃣ Exigência (se houver)
- O INPI pode solicitar ajustes ou esclarecimentos
- Valor: 1 salário mínimo por exigência, publicado no Diário Oficial
- Resposta: "Caso o INPI emita alguma exigência, entraremos em contato. As exigências seguem o valor previsto em contrato e são sempre publicadas oficialmente."

5️⃣ Deferimento
- Marca aprovada
- Resposta: "Ótima notícia! Seu pedido foi deferido. Agora seguimos para a emissão do certificado."

6️⃣ Emissão do Certificado
- Taxa INPI: R$ 298,00
- Marca válida por 10 anos
- Resposta: "Após o pagamento da taxa final do INPI, o certificado será emitido e sua marca ficará protegida por 10 anos."

💰 VALORES (RESPOSTA PADRÃO OBRIGATÓRIA):
"💼 O valor do serviço é de R$1.194,00.
✅ Fechando hoje, você garante o desconto à vista no Pix por R$699,00.

📌 Formas de pagamento:
• À vista no Pix: R$699,00
• 3x no boleto: R$398,00 sem juros
• 6x no cartão: R$199,00 sem juros

Além dos honorários, há a taxa federal do INPI no valor de R$440,00.
Caso existam exigências ou publicações extras, os custos seguem o que está previsto em contrato e são sempre publicados no Diário Oficial.

📦 O que está incluso no serviço:
✓ Registro do Nome + Logotipo
✓ Protocolo em até 48h no INPI
✓ Acompanhamento e vigilância por 12 meses
✓ Garantia total do serviço
✓ Certificado válido por 10 anos"

#FAQ (PERGUNTAS FREQUENTES):

1. Quanto tempo leva o registro?
"De 8 a 12 meses. A proteção já começa no protocolo."

2. Tem garantia?
"Sim. Se o pedido for arquivado, protocolamos uma nova marca sem custos."

3. Inclui o logotipo?
"Sim. O pacote inclui nome + logotipo."

4. Onde a marca é protegida?
"Em todo o território nacional, válida por 10 anos."

5. Onde vocês ficam?
"🏢 WebMarcas & Patentes EIRELI
📍 Av. Brigadeiro Luiz Antônio 2696 – São Paulo/SP
📧 ola@webmarcas.net
📱 (11) 94055-5265
🌐 www.webmarcas.net
Redes sociais: @webpatentes

O atendimento é 100% digital."

6. Os R$699 incluem todas as classes?
"Não. O valor é por classe. Cada classe é um processo distinto no INPI."

📂 DOCUMENTOS E ARQUIVOS:
"Todos os documentos do seu processo ficam disponíveis na sua Área do Cliente. Sempre que adicionarmos algo novo, você será notificado."

🤝 LIMITE DO AGENTE:
Se a dúvida for jurídica complexa, envolver contestação/oposição ou estiver fora do escopo padrão, responda:
"Vou encaminhar sua solicitação para nosso time jurídico, tudo bem? Em breve um especialista entrará em contato."

#REGRAS OBRIGATÓRIAS:
- Nunca repita mensagens.
- Nunca improvise frases diferentes das fornecidas.
- Seja objetiva, clara e acolhedora.
- Use emojis com moderação para tornar a conversa amigável.
- Sempre finalize com "Posso ajudar com mais alguma coisa?" quando apropriado.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages = [], userName } = await req.json();

    if (!Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages deve ser um array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY não configurada");
    }

    const systemMessage = userName 
      ? `${SYSTEM_PROMPT}\n\nO nome do cliente é ${userName}. Use o nome dele para tornar a conversa mais pessoal e acolhedora.`
      : SYSTEM_PROMPT;

    console.log("Iniciando chat com mensagens:", messages?.length || 0);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemMessage },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas requisições. Aguarde um momento e tente novamente." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Serviço temporariamente indisponível. Tente novamente mais tarde." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Erro ao processar sua mensagem. Por favor, tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Resposta recebida, iniciando streaming");

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("chat-support error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
