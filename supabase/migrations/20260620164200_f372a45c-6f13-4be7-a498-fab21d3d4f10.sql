
CREATE TABLE public.inpi_resource_evidences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES public.inpi_resources(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  page_number INTEGER,
  source_file_name TEXT,
  mime_type TEXT NOT NULL DEFAULT 'image/png',
  caption TEXT,
  ocr_text TEXT,
  placement TEXT NOT NULL DEFAULT 'annex' CHECK (placement IN ('inline','annex')),
  display_order INTEGER NOT NULL DEFAULT 0,
  included BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inpi_resource_evidences_resource ON public.inpi_resource_evidences(resource_id, display_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inpi_resource_evidences TO authenticated;
GRANT ALL ON public.inpi_resource_evidences TO service_role;

ALTER TABLE public.inpi_resource_evidences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all evidences"
  ON public.inpi_resource_evidences
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_inpi_resource_evidences_updated_at
  BEFORE UPDATE ON public.inpi_resource_evidences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Admins read evidence files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'inpi-resource-evidence' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins upload evidence files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'inpi-resource-evidence' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update evidence files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'inpi-resource-evidence' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete evidence files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'inpi-resource-evidence' AND public.has_role(auth.uid(), 'admin'));
