ALTER TABLE public.rpi_entries ADD COLUMN IF NOT EXISTS auto_linked_at timestamptz;
ALTER TABLE public.rpi_entries ADD COLUMN IF NOT EXISTS auto_link_source text;
CREATE INDEX IF NOT EXISTS idx_brand_processes_process_number ON public.brand_processes (process_number);
CREATE INDEX IF NOT EXISTS idx_brand_processes_user_process ON public.brand_processes (user_id, process_number);