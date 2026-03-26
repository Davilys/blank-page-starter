
-- AI Generated Ads storage
CREATE TABLE public.marketing_generated_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name TEXT,
  platform TEXT NOT NULL DEFAULT 'meta',
  target_audience TEXT,
  objective TEXT,
  headline TEXT NOT NULL,
  primary_text TEXT NOT NULL,
  description TEXT,
  call_to_action TEXT,
  generated_by TEXT DEFAULT 'lovable_ai',
  status TEXT DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- A/B Test tracking
CREATE TABLE public.marketing_ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name TEXT NOT NULL,
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'running',
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  winner_variant TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- A/B Test variants
CREATE TABLE public.marketing_ab_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID REFERENCES public.marketing_ab_tests(id) ON DELETE CASCADE NOT NULL,
  variant_name TEXT NOT NULL,
  headline TEXT,
  primary_text TEXT,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  leads INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  spend NUMERIC DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  cpl NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI Audience suggestions
CREATE TABLE public.marketing_audience_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_type TEXT NOT NULL DEFAULT 'interest',
  name TEXT NOT NULL,
  description TEXT,
  estimated_reach TEXT,
  confidence_score NUMERIC DEFAULT 0,
  source TEXT DEFAULT 'ai_analysis',
  is_applied BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.marketing_generated_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_ab_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_audience_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage marketing_generated_ads" ON public.marketing_generated_ads FOR ALL TO authenticated USING (public.has_current_user_role('admin'::app_role));
CREATE POLICY "Admins manage marketing_ab_tests" ON public.marketing_ab_tests FOR ALL TO authenticated USING (public.has_current_user_role('admin'::app_role));
CREATE POLICY "Admins manage marketing_ab_variants" ON public.marketing_ab_variants FOR ALL TO authenticated USING (public.has_current_user_role('admin'::app_role));
CREATE POLICY "Admins manage marketing_audience_suggestions" ON public.marketing_audience_suggestions FOR ALL TO authenticated USING (public.has_current_user_role('admin'::app_role));
