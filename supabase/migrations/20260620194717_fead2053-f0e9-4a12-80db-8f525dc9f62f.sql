ALTER TABLE public.inpi_resource_evidences
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'evidence';

ALTER TABLE public.inpi_resource_evidences
  DROP CONSTRAINT IF EXISTS inpi_resource_evidences_kind_check;

ALTER TABLE public.inpi_resource_evidences
  ADD CONSTRAINT inpi_resource_evidences_kind_check
  CHECK (kind IN ('brand_logo','inpi_consulta','evidence'));