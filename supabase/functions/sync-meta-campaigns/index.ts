import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const metaAccessToken = Deno.env.get("META_ACCESS_TOKEN");

    if (!metaAccessToken) {
      return new Response(
        JSON.stringify({ error: "META_ACCESS_TOKEN não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get marketing config
    const { data: config } = await supabase
      .from("marketing_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!config?.meta_business_id) {
      return new Response(
        JSON.stringify({ error: "Meta Business ID não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const businessId = config.meta_business_id;

    // Fetch campaigns from Meta Graph API
    const campaignsUrl = `https://graph.facebook.com/v19.0/act_${businessId}/campaigns?fields=id,name,status,insights.date_preset(last_30d){spend,impressions,clicks,actions}&access_token=${metaAccessToken}`;
    
    const campaignsRes = await fetch(campaignsUrl);
    const campaignsData = await campaignsRes.json();

    if (campaignsData.error) {
      console.error("Meta API error:", campaignsData.error);
      return new Response(
        JSON.stringify({ error: campaignsData.error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const campaigns = campaignsData.data || [];
    let synced = 0;

    for (const campaign of campaigns) {
      const insights = campaign.insights?.data?.[0] || {};
      const leadActions = (insights.actions || []).find(
        (a: any) => a.action_type === "lead"
      );
      const leadsCount = leadActions ? parseInt(leadActions.value) : 0;
      const spend = parseFloat(insights.spend || "0");
      const cpl = leadsCount > 0 ? spend / leadsCount : 0;

      await supabase.from("marketing_campaigns").upsert(
        {
          meta_campaign_id: campaign.id,
          campaign_name: campaign.name,
          status: campaign.status?.toLowerCase() || "unknown",
          spend,
          impressions: parseInt(insights.impressions || "0"),
          clicks: parseInt(insights.clicks || "0"),
          leads_count: leadsCount,
          cpl: Math.round(cpl * 100) / 100,
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "meta_campaign_id" }
      );
      synced++;
    }

    // Update last sync
    await supabase
      .from("marketing_config")
      .update({ last_sync: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", config.id);

    return new Response(
      JSON.stringify({ success: true, synced }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
