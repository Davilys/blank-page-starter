-- Prevent duplicate processes and contracts when BotConversa retries after a
-- timeout or after the edge function fails between two persistence steps.
ALTER TABLE public.brand_processes
  ADD COLUMN IF NOT EXISTS source_event_id text;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS source_event_id text;

ALTER TABLE public.botconversa_contract_requests
  ADD COLUMN IF NOT EXISTS process_id uuid REFERENCES public.brand_processes(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_brand_processes_source_event_id
  ON public.brand_processes(source_event_id)
  WHERE source_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_contracts_source_event_id
  ON public.contracts(source_event_id)
  WHERE source_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_botconversa_contract_requests_process
  ON public.botconversa_contract_requests(process_id)
  WHERE process_id IS NOT NULL;
