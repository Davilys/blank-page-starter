CREATE TABLE public.inpi_generation_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES public.inpi_resource_cases(id) ON DELETE CASCADE,
  owner_id UUID,
  resource_type TEXT NOT NULL,
  agent_name TEXT,
  agent_strategy TEXT,
  user_orientation TEXT,
  stage TEXT NOT NULL DEFAULT 'preparar',
  status TEXT NOT NULL DEFAULT 'processing',
  attempt INTEGER NOT NULL DEFAULT 0,
  extracted_data JSONB,
  pass1_content TEXT,
  result_content TEXT,
  error_message TEXT,
  error_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.inpi_generation_jobs TO authenticated;
GRANT ALL ON public.inpi_generation_jobs TO service_role;

ALTER TABLE public.inpi_generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam jobs de geracao INPI"
ON public.inpi_generation_jobs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX inpi_generation_jobs_active_case
ON public.inpi_generation_jobs (case_id)
WHERE status = 'processing';

CREATE INDEX inpi_generation_jobs_case_created
ON public.inpi_generation_jobs (case_id, created_at DESC);

CREATE TRIGGER update_inpi_generation_jobs_updated_at
BEFORE UPDATE ON public.inpi_generation_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();