
-- Marketing Data Warehouse: Ads table (ad-level data from Meta/Google)
CREATE TABLE public.marketing_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'meta',
  meta_ad_id TEXT,
  meta_adset_id TEXT,
  ad_name TEXT,
  adset_name TEXT,
  status TEXT DEFAULT 'active',
  spend NUMERIC DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  leads_count INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  cpc NUMERIC DEFAULT 0,
  cpm NUMERIC DEFAULT 0,
  cpl NUMERIC DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(meta_ad_id)
);

-- Marketing Data Warehouse: Daily performance snapshots
CREATE TABLE public.marketing_ad_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  ad_id UUID REFERENCES public.marketing_ads(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'meta',
  date DATE NOT NULL,
  spend NUMERIC DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  leads_count INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  cpc NUMERIC DEFAULT 0,
  cpm NUMERIC DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ad_id, date)
);

-- Marketing Data Warehouse: Conversions tracking
CREATE TABLE public.marketing_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID,
  client_id UUID,
  contract_id UUID,
  invoice_id UUID,
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  ad_id UUID REFERENCES public.marketing_ads(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  event_value NUMERIC DEFAULT 0,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  fbclid TEXT,
  gclid TEXT,
  attribution_model TEXT DEFAULT 'last_click',
  platform TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Marketing Budget Alerts
CREATE TABLE public.marketing_budget_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  threshold_value NUMERIC NOT NULL,
  current_value NUMERIC DEFAULT 0,
  is_triggered BOOLEAN DEFAULT false,
  triggered_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add new columns to marketing_campaigns for enhanced tracking
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'meta';
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS ctr NUMERIC DEFAULT 0;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS cpc NUMERIC DEFAULT 0;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS cpm NUMERIC DEFAULT 0;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS conversions INTEGER DEFAULT 0;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS daily_budget NUMERIC DEFAULT 0;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS monthly_budget_limit NUMERIC DEFAULT 0;

-- Add new columns to marketing_attribution for enhanced tracking
ALTER TABLE public.marketing_attribution ADD COLUMN IF NOT EXISTS gclid TEXT;
ALTER TABLE public.marketing_attribution ADD COLUMN IF NOT EXISTS landing_page TEXT;
ALTER TABLE public.marketing_attribution ADD COLUMN IF NOT EXISTS referrer TEXT;
ALTER TABLE public.marketing_attribution ADD COLUMN IF NOT EXISTS attribution_model TEXT DEFAULT 'last_click';
ALTER TABLE public.marketing_attribution ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;
ALTER TABLE public.marketing_attribution ADD COLUMN IF NOT EXISTS contract_id UUID;
ALTER TABLE public.marketing_attribution ADD COLUMN IF NOT EXISTS invoice_id UUID;

-- Add Google Ads config to marketing_config
ALTER TABLE public.marketing_config ADD COLUMN IF NOT EXISTS google_ads_customer_id TEXT;
ALTER TABLE public.marketing_config ADD COLUMN IF NOT EXISTS google_ads_connected BOOLEAN DEFAULT false;
ALTER TABLE public.marketing_config ADD COLUMN IF NOT EXISTS sync_interval_minutes INTEGER DEFAULT 60;
ALTER TABLE public.marketing_config ADD COLUMN IF NOT EXISTS budget_alert_enabled BOOLEAN DEFAULT true;

-- RLS for new tables
ALTER TABLE public.marketing_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_ad_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_budget_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage marketing_ads" ON public.marketing_ads FOR ALL TO authenticated USING (public.has_current_user_role('admin'::app_role));
CREATE POLICY "Admins can manage marketing_ad_performance" ON public.marketing_ad_performance FOR ALL TO authenticated USING (public.has_current_user_role('admin'::app_role));
CREATE POLICY "Admins can manage marketing_conversions" ON public.marketing_conversions FOR ALL TO authenticated USING (public.has_current_user_role('admin'::app_role));
CREATE POLICY "Admins can manage marketing_budget_alerts" ON public.marketing_budget_alerts FOR ALL TO authenticated USING (public.has_current_user_role('admin'::app_role));
