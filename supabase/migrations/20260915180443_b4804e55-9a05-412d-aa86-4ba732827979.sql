CREATE TABLE public.rpi_process_lookups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_number text NOT NULL UNIQUE,
  brand_name text,
  holder text,
  ncl_class text,
  current_status text,
  presentation text,
  nature text,
  class_status text,
  specification text,
  legal_representative text,
  priority_date text,
  filing_date text,
  grant_date text,
  expiry_date text,
  source_url text,
  source text,
  detail_status text,
  lookup_status text NOT NULL DEFAULT 'pending',
  queried_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rpi_process_lookups TO authenticated;
GRANT ALL ON public.rpi_process_lookups TO service_role;

ALTER TABLE public.rpi_process_lookups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view process lookups"
ON public.rpi_process_lookups FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_rpi_process_lookups_updated_at
BEFORE UPDATE ON public.rpi_process_lookups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.rpi_enrichment_field_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rpi_entry_id uuid NOT NULL REFERENCES public.rpi_entries(id) ON DELETE CASCADE,
  process_number text NOT NULL,
  field_name text NOT NULL,
  previous_value text,
  new_value text,
  applied_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rpi_enrichment_field_log_entry ON public.rpi_enrichment_field_log(rpi_entry_id);

GRANT SELECT ON public.rpi_enrichment_field_log TO authenticated;
GRANT ALL ON public.rpi_enrichment_field_log TO service_role;

ALTER TABLE public.rpi_enrichment_field_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view enrichment field log"
ON public.rpi_enrichment_field_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));