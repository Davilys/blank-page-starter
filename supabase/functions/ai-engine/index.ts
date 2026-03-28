import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AIProvider {
  id: string;
  name: string;
  provider_type: string;
  api_key: string | null;
  model: string;
  is_active: boolean;
  is_fallback: boolean;
}

// ─── Call provider ────────────────────────────────
async function callProvider(
  provider: AIProvider,
  messages: { role: string; content: string }[],
  options?: { temperature?: number; max_tokens?: number }
): Promise<{ content: string; responseTime: number }> {
  const start = Date.now();

  if (provider.provider_type === "lovable") {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.max_tokens,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Lovable AI error ${resp.status}: ${txt}`);
    }

    const data = await resp.json();
    return {
      content: data.choices?.[0]?.message?.content || "",
      responseTime: Date.now() - start,
    };
  }

  if (provider.provider_type === "openai") {
    const apiKey = provider.api_key || Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("API key not configured");

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.max_tokens,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`OpenAI error ${resp.status}: ${txt}`);
    }

    const data = await resp.json();
    return {
      content: data.choices?.[0]?.message?.content || "",
      responseTime: Date.now() - start,
    };
  }

  if (provider.provider_type === "gemini") {
    const apiKey = provider.api_key;
    if (!apiKey) throw new Error("Gemini API key not configured");

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: messages.map((m) => ({
            role: m.role === "assistant" ? "model" : m.role === "system" ? "user" : m.role,
            parts: [{ text: m.content }],
          })),
          generationConfig: {
            temperature: options?.temperature ?? 0.7,
            maxOutputTokens: options?.max_tokens || 4096,
          },
        }),
      }
    );

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Gemini error ${resp.status}: ${txt}`);
    }

    const data = await resp.json();
    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
      responseTime: Date.now() - start,
    };
  }

  if (provider.provider_type === "deepseek") {
    const apiKey = provider.api_key;
    if (!apiKey) throw new Error("DeepSeek API key not configured");

    const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.max_tokens,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`DeepSeek error ${resp.status}: ${txt}`);
    }

    const data = await resp.json();
    return {
      content: data.choices?.[0]?.message?.content || "",
      responseTime: Date.now() - start,
    };
  }

  throw new Error(`Unsupported provider: ${provider.provider_type}`);
}

// ─── Log usage ────────────────────────────────────
async function logUsage(
  supabaseAdmin: any,
  provider: string,
  module: string,
  taskType: string | null,
  success: boolean,
  errorMessage: string | null,
  responseTimeMs: number | null
) {
  try {
    await supabaseAdmin.from("ai_usage_logs").insert({
      provider,
      module,
      task_type: taskType,
      success,
      error_message: errorMessage,
      response_time_ms: responseTimeMs,
    });
  } catch (e) {
    console.error("Failed to log AI usage:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const body = await req.json();
    const { action, messages, module, taskType, providerId, options } = body;

    // ─── Test action ──────────────────────
    if (action === "test") {
      const { data: provider, error } = await supabaseAdmin
        .from("ai_providers")
        .select("*")
        .eq("id", providerId)
        .single();

      if (error || !provider) {
        return new Response(
          JSON.stringify({ success: false, error: "Provider not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const result = await callProvider(provider, [
          { role: "user", content: "Responda apenas: OK" },
        ]);
        await logUsage(supabaseAdmin, provider.name, "test", "connection_test", true, null, result.responseTime);
        return new Response(
          JSON.stringify({ success: true, responseTime: result.responseTime }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err: any) {
        await logUsage(supabaseAdmin, provider.name, "test", "connection_test", false, err.message, null);
        return new Response(
          JSON.stringify({ success: false, error: err.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ─── Generate action ──────────────────
    if (action === "generate") {
      // Get active provider
      const { data: activeProvider } = await supabaseAdmin
        .from("ai_providers")
        .select("*")
        .eq("is_active", true)
        .single();

      if (!activeProvider) {
        return new Response(
          JSON.stringify({ error: "No active AI provider configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const result = await callProvider(activeProvider, messages, options);
        await logUsage(
          supabaseAdmin,
          activeProvider.name,
          module || "unknown",
          taskType || null,
          true,
          null,
          result.responseTime
        );
        return new Response(
          JSON.stringify({ content: result.content, provider: activeProvider.name, responseTime: result.responseTime }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (primaryError: any) {
        console.error("Primary AI failed:", primaryError.message);
        await logUsage(supabaseAdmin, activeProvider.name, module || "unknown", taskType, false, primaryError.message, null);

        // Try fallback
        const { data: fallbackProvider } = await supabaseAdmin
          .from("ai_providers")
          .select("*")
          .eq("is_fallback", true)
          .neq("id", activeProvider.id)
          .single();

        if (fallbackProvider) {
          try {
            const result = await callProvider(fallbackProvider, messages, options);
            await logUsage(supabaseAdmin, fallbackProvider.name, module || "unknown", taskType, true, null, result.responseTime);
            return new Response(
              JSON.stringify({
                content: result.content,
                provider: fallbackProvider.name,
                responseTime: result.responseTime,
                usedFallback: true,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          } catch (fallbackError: any) {
            await logUsage(supabaseAdmin, fallbackProvider.name, module || "unknown", taskType, false, fallbackError.message, null);
          }
        }

        return new Response(
          JSON.stringify({ error: `AI failed: ${primaryError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'test' or 'generate'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("ai-engine error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
