CREATE TABLE public.annuity_settings (
  id integer PRIMARY KEY DEFAULT 1,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.annuity_settings TO authenticated;
GRANT ALL ON public.annuity_settings TO service_role;
ALTER TABLE public.annuity_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "annuity_settings_fin_read" ON public.annuity_settings FOR SELECT TO authenticated USING (public.has_financial_permission(auth.uid()));
CREATE TRIGGER annuity_settings_updated BEFORE UPDATE ON public.annuity_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.annuity_settings(id) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE public.annuity_campaigns ADD COLUMN settings jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.annuity_items ADD COLUMN is_test boolean NOT NULL DEFAULT false;