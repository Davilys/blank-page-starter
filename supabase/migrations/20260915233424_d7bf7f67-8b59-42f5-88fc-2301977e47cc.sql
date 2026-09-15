ALTER TABLE public.inpi_case_documents
  ADD COLUMN IF NOT EXISTS conversion_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS conversion_notes text,
  ADD COLUMN IF NOT EXISTS converted_page_count integer,
  ADD COLUMN IF NOT EXISTS interpreted_pages integer,
  ADD COLUMN IF NOT EXISTS unreadable_pages integer,
  ADD COLUMN IF NOT EXISTS processing_confirmed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.inpi_export_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.inpi_resource_cases(id) ON DELETE CASCADE,
  resource_id uuid,
  draft_version_id uuid REFERENCES public.inpi_draft_versions(id) ON DELETE SET NULL,
  approval_id uuid REFERENCES public.inpi_case_approvals(id) ON DELETE SET NULL,
  content_hash text,
  documents_hash text,
  is_complete boolean NOT NULL DEFAULT false,
  is_draft_stamped boolean NOT NULL DEFAULT true,
  total_annexes integer NOT NULL DEFAULT 0,
  total_pages integer,
  manifest jsonb NOT NULL DEFAULT '[]'::jsonb,
  failed_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  file_name text,
  generated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inpi_export_packages TO authenticated;
GRANT ALL ON public.inpi_export_packages TO service_role;

ALTER TABLE public.inpi_export_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage inpi export packages"
ON public.inpi_export_packages FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_inpi_export_packages_updated_at
BEFORE UPDATE ON public.inpi_export_packages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_inpi_export_packages_case ON public.inpi_export_packages(case_id);