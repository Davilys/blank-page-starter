ALTER TABLE public.inpi_case_documents
  ADD COLUMN IF NOT EXISTS vision_read_pages integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vision_model text,
  ADD COLUMN IF NOT EXISTS vision_notes text,
  ADD COLUMN IF NOT EXISTS vision_read_at timestamptz;

CREATE TABLE IF NOT EXISTS public.inpi_draft_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.inpi_resource_cases(id) ON DELETE CASCADE,
  resource_id uuid,
  content_hash text NOT NULL,
  documents_hash text,
  model text,
  prompt_version text,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  has_blocking boolean NOT NULL DEFAULT false,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inpi_draft_reviews TO authenticated;
GRANT ALL ON public.inpi_draft_reviews TO service_role;

ALTER TABLE public.inpi_draft_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage inpi draft reviews"
ON public.inpi_draft_reviews FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_inpi_draft_reviews_case ON public.inpi_draft_reviews(case_id, created_at DESC);

CREATE TRIGGER update_inpi_draft_reviews_updated_at
BEFORE UPDATE ON public.inpi_draft_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();