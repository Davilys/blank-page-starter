-- Durable queue for BotConversa's 10-second integration limit. The ingress
-- validates and stores the request before returning 202; pg_cron retries the
-- server-side worker if the first EdgeRuntime dispatch is interrupted.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.botconversa_contract_async_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  request_payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  callback_delivered_at timestamptz,
  -- BotConversa send_message exposes no verified idempotency key. Delivery is
  -- therefore at-least-once: a runtime loss after send and before completion
  -- can repeat the link message on retry; staff can audit this timestamp/state.
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_botconversa_contract_async_runnable
  ON public.botconversa_contract_async_jobs(status, updated_at)
  WHERE status IN ('pending', 'processing', 'failed');
ALTER TABLE public.botconversa_contract_async_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view BotConversa async jobs"
  ON public.botconversa_contract_async_jobs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- One worker atomically claims one runnable job. A processing lease recovers a
-- runtime terminated between claim and completion; five attempts dead-letter.
CREATE OR REPLACE FUNCTION public.claim_botconversa_contract_async_job()
RETURNS SETOF public.botconversa_contract_async_jobs
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.botconversa_contract_async_jobs AS job
  SET status = 'processing', attempt_count = job.attempt_count + 1,
      error_code = NULL, updated_at = now()
  WHERE job.id = (
    SELECT id FROM public.botconversa_contract_async_jobs
    WHERE attempt_count < 5 AND (
      status IN ('pending', 'failed') OR
      (status = 'processing' AND updated_at < now() - interval '2 minutes')
    )
    ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
  )
  RETURNING job.*;
$$;
REVOKE ALL ON FUNCTION public.claim_botconversa_contract_async_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_botconversa_contract_async_job() TO service_role;

-- PREVIEW-SANITIZED: contract worker cron intentionally disabled.

