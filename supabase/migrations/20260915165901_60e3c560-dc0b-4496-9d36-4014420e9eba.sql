
-- rpi_uploads: prévia, progresso e estatísticas
ALTER TABLE public.rpi_uploads
  ADD COLUMN IF NOT EXISTS is_preview boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parse_progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS parse_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_file_url text,
  ADD COLUMN IF NOT EXISTS total_mentions integer;

-- rpi_entries: auditoria de ocorrências e dados estruturais
ALTER TABLE public.rpi_entries
  ADD COLUMN IF NOT EXISTS occurrences_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS occurrences jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS relation_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS relation_primary text,
  ADD COLUMN IF NOT EXISTS relation_confidence numeric,
  ADD COLUMN IF NOT EXISTS is_destituicao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_nomeacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_substituicao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS procurador_anterior text,
  ADD COLUMN IF NOT EXISTS procurador_novo text,
  ADD COLUMN IF NOT EXISTS needs_human_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS deposit_date date,
  ADD COLUMN IF NOT EXISTS concession_date date,
  ADD COLUMN IF NOT EXISTS validity_date date,
  ADD COLUMN IF NOT EXISTS natureza text,
  ADD COLUMN IF NOT EXISTS apresentacao text,
  ADD COLUMN IF NOT EXISTS situacao_atual text,
  ADD COLUMN IF NOT EXISTS apostila text,
  ADD COLUMN IF NOT EXISTS titulares jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS requerentes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS procuradores jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dispatches jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS protocols jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ncl_specifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS vienna_classes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS field_sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS match_candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS process_block_hash text,
  ADD COLUMN IF NOT EXISTS source_file_ref text,
  ADD COLUMN IF NOT EXISTS enrichment_status text NOT NULL DEFAULT 'pendente';

CREATE UNIQUE INDEX IF NOT EXISTS rpi_entries_upload_process_uidx
  ON public.rpi_entries (rpi_upload_id, process_number);

CREATE INDEX IF NOT EXISTS rpi_entries_relation_primary_idx ON public.rpi_entries (relation_primary);
CREATE INDEX IF NOT EXISTS rpi_entries_enrichment_status_idx ON public.rpi_entries (enrichment_status);

-- Fila de complementação individual
CREATE TABLE IF NOT EXISTS public.rpi_enrichment_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rpi_entry_id uuid NOT NULL REFERENCES public.rpi_entries(id) ON DELETE CASCADE,
  process_number text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rpi_enrichment_queue_entry_uidx ON public.rpi_enrichment_queue (rpi_entry_id);
CREATE INDEX IF NOT EXISTS rpi_enrichment_queue_status_idx ON public.rpi_enrichment_queue (status, next_attempt_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rpi_enrichment_queue TO authenticated;
GRANT ALL ON public.rpi_enrichment_queue TO service_role;

ALTER TABLE public.rpi_enrichment_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam fila de enriquecimento"
  ON public.rpi_enrichment_queue FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_rpi_enrichment_queue_updated_at
  BEFORE UPDATE ON public.rpi_enrichment_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
