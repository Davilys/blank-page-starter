-- Aprovação válida única por versão exata (texto + anexos + orientação)
CREATE UNIQUE INDEX IF NOT EXISTS inpi_case_approvals_unique_active
  ON public.inpi_case_approvals (case_id, approval_kind, content_hash, coalesce(documents_hash,''), coalesce(orientation_hash,''))
  WHERE invalidated_at IS NULL;

-- Revisão jurídica única por versão de texto + anexos
CREATE UNIQUE INDEX IF NOT EXISTS inpi_draft_reviews_unique_version
  ON public.inpi_draft_reviews (case_id, content_hash, coalesce(documents_hash,''));

-- Pacote de exportação único por versão
CREATE UNIQUE INDEX IF NOT EXISTS inpi_export_packages_unique_version
  ON public.inpi_export_packages (case_id, content_hash, coalesce(documents_hash,''));