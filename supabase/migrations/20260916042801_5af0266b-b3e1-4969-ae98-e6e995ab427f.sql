ALTER TABLE public.inpi_generation_jobs
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS run_token uuid,
  ADD COLUMN IF NOT EXISTS prepared_files jsonb;

UPDATE public.inpi_generation_jobs
SET status = 'error',
    error_code = 'interrompido',
    error_message = 'A geração foi interrompida antes de terminar. Nenhum documento ou orientação foi perdido — use "Tentar de novo" para retomar da etapa que parou.',
    run_token = NULL,
    updated_at = now()
WHERE id IN ('2621ccf6-65c9-4d8b-8dc3-46f160ed96f6', '75309d5f-55dc-4130-bfca-7f22c1c8fcf0')
  AND status = 'processing';