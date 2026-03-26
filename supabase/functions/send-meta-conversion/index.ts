import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function sha256Hash(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const metaAccessToken = Deno.env.get("META_ACCESS_TOKEN");
    const metaPixelId = Deno.env.get("META_PIXEL_ID");

    if (!metaAccessToken || !metaPixelId) {
      return new Response(
        JSON.stringify({ error: "META_ACCESS_TOKEN ou META_PIXEL_ID não configurados" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { event_name, email, phone, value, currency = "BRL", custom_data = {} } = body;

    if (!event_name) {
      return new Response(
        JSON.stringify({ error: "event_name é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build user_data with hashed PII
    const userData: Record<string, string> = {};
    if (email) userData.em = await sha256Hash(email);
    if (phone) userData.ph = await sha256Hash(phone.replace(/\D/g, ""));

    const eventData = {
      data: [
        {
          event_name,
          event_time: Math.floor(Date.now() / 1000),
          action_source: "website",
          user_data: userData,
          custom_data: {
            ...custom_data,
            ...(value !== undefined ? { value, currency } : {}),
          },
        },
      ],
    };

    const url = `https://graph.facebook.com/v19.0/${metaPixelId}/events?access_token=${metaAccessToken}`;

    const metaRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventData),
    });

    const result = await metaRes.json();

    if (result.error) {
      console.error("Meta Conversions API error:", result.error);
      return new Response(
        JSON.stringify({ error: result.error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, events_received: result.events_received }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Conversion error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
