
-- Marketing Intelligence tables

CREATE TABLE public.marketing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_pixel_id text,
  meta_business_id text,
  is_connected boolean NOT NULL DEFAULT false,
  last_sync timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage marketing_config"
  ON public.marketing_config FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_campaign_id text,
  campaign_name text NOT NULL,
  adset_name text,
  ad_name text,
  status text DEFAULT 'active',
  spend numeric DEFAULT 0,
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  leads_count integer DEFAULT 0,
  cpl numeric DEFAULT 0,
  revenue numeric DEFAULT 0,
  roi numeric DEFAULT 0,
  synced_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage marketing_campaigns"
  ON public.marketing_campaigns FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.marketing_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  fbclid text,
  meta_campaign_id text,
  meta_adset_id text,
  meta_ad_id text,
  revenue numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_attribution ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage marketing_attribution"
  ON public.marketing_attribution FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can insert marketing_attribution"
  ON public.marketing_attribution FOR INSERT
  WITH CHECK (true);
