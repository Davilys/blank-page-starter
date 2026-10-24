CREATE TABLE public.signature_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  step smallint NOT NULL,
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  results jsonb,
  token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, step)
);
GRANT SELECT ON public.signature_followups TO authenticated;
GRANT ALL ON public.signature_followups TO service_role;
ALTER TABLE public.signature_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view signature followups" ON public.signature_followups FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX signature_followups_due ON public.signature_followups (scheduled_at) WHERE status = 'pending';
CREATE TRIGGER trg_signature_followups_updated BEFORE UPDATE ON public.signature_followups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();