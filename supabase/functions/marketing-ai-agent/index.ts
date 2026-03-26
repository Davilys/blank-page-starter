import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { action, campaign_name, target_audience, objective, platform, campaigns_data } = await req.json();

    let systemPrompt = "";
    let userPrompt = "";

    if (action === "generate_ad") {
      systemPrompt = `Você é um especialista em marketing digital e copywriting para anúncios de registro de marcas no INPI (Brasil). 
Gere anúncios persuasivos e profissionais em português brasileiro.
Responda APENAS com o JSON no formato solicitado, sem texto adicional.`;

      userPrompt = `Gere um anúncio para Meta Ads (Facebook/Instagram).

Campanha: ${campaign_name || 'Registro de Marcas'}
Público-alvo: ${target_audience || 'Empreendedores e donos de empresas'}
Objetivo: ${objective || 'Gerar leads para consulta de viabilidade de marca'}

Retorne um JSON com:
{
  "headline": "título do anúncio (máx 40 caracteres)",
  "primary_text": "texto principal do anúncio (máx 125 caracteres)",
  "description": "descrição complementar (máx 90 caracteres)",
  "call_to_action": "texto do botão CTA",
  "variations": [
    {
      "headline": "variação 1 do título",
      "primary_text": "variação 1 do texto",
      "description": "variação 1 da descrição",
      "call_to_action": "CTA variação 1"
    },
    {
      "headline": "variação 2 do título",
      "primary_text": "variação 2 do texto",
      "description": "variação 2 da descrição",
      "call_to_action": "CTA variação 2"
    }
  ]
}`;
    } else if (action === "suggest_audiences") {
      systemPrompt = `Você é um especialista em segmentação de público para campanhas de marketing digital no Brasil, focado no nicho de registro de marcas e propriedade intelectual.
Responda APENAS com o JSON no formato solicitado.`;

      userPrompt = `Com base nos dados de campanhas existentes, sugira 5 segmentos de público-alvo para campanhas de registro de marcas no INPI.

${campaigns_data ? `Dados das campanhas atuais: ${JSON.stringify(campaigns_data)}` : 'Sem dados históricos ainda.'}

Retorne um JSON com:
{
  "audiences": [
    {
      "name": "nome do segmento",
      "description": "descrição detalhada do público",
      "interests": ["interesse1", "interesse2"],
      "estimated_reach": "estimativa de alcance",
      "confidence": 85
    }
  ]
}`;
    } else if (action === "optimize_report") {
      systemPrompt = `Você é um consultor de Growth Marketing especializado em otimização de campanhas pagas (Meta Ads) para empresas de registro de marcas no Brasil.
Analise os dados e gere um relatório executivo com ações concretas.
Responda APENAS com o JSON no formato solicitado.`;

      userPrompt = `Analise estas campanhas e gere um relatório de otimização:

${JSON.stringify(campaigns_data || [])}

Retorne um JSON com:
{
  "summary": "resumo executivo de 2-3 frases",
  "winners": [{"campaign": "nome", "reason": "motivo", "action": "ação sugerida"}],
  "losers": [{"campaign": "nome", "reason": "motivo", "action": "ação sugerida"}],
  "budget_suggestions": [{"campaign": "nome", "current": 0, "suggested": 0, "reason": "motivo"}],
  "audience_tips": ["dica1", "dica2"],
  "creative_tips": ["dica1", "dica2"],
  "predicted_improvement": "estimativa de melhoria em %"
}`;
    } else {
      return new Response(
        JSON.stringify({ error: "Ação inválida. Use: generate_ad, suggest_audiences, optimize_report" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 1200,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "Erro no serviço de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Try to parse JSON from the AI response
    let parsed;
    try {
      // Remove markdown code blocks if present
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { raw_response: content };
    }

    return new Response(
      JSON.stringify({ success: true, data: parsed, action }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Ad agent error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
