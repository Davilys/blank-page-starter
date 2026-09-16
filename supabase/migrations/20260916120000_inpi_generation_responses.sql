-- Only the generation service can write provider checkpoints. No client files,
-- prompts, API keys or raw provider payloads are stored here.
CREATE TABLE IF NOT EXISTS public.inpi_generation_responses (
  job_id uuid NOT NULL REFERENCES public.inpi_generation_jobs(id) ON DELETE CASCADE,
  operation text NOT NULL CHECK (operation IN ('extracao', 'pass1', 'pass2')),
  fingerprint text NOT NULL,
  response_id text,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, operation)
);
ALTER TABLE public.inpi_generation_responses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inpi_generation_responses FROM anon, authenticated;
GRANT ALL ON public.inpi_generation_responses TO service_role;

-- Reloads/two tabs must not create two drafts for one completed generation.
ALTER TABLE public.inpi_resources ADD COLUMN IF NOT EXISTS generation_job_id uuid
  REFERENCES public.inpi_generation_jobs(id);
CREATE UNIQUE INDEX IF NOT EXISTS inpi_resources_generation_job_unique
  ON public.inpi_resources(generation_job_id) WHERE generation_job_id IS NOT NULL;
