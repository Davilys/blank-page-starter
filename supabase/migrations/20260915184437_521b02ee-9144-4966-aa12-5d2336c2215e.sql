-- Additive columns for message parsing/reprocessing
ALTER TABLE public.email_inbox
  ADD COLUMN IF NOT EXISTS raw_source text,
  ADD COLUMN IF NOT EXISTS thread_id text,
  ADD COLUMN IF NOT EXISTS in_reply_to text,
  ADD COLUMN IF NOT EXISTS references_ids text,
  ADD COLUMN IF NOT EXISTS parse_status text NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS parse_error text,
  ADD COLUMN IF NOT EXISTS parser_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reprocessed_at timestamptz,
  ADD COLUMN IF NOT EXISTS original_backup jsonb;

CREATE INDEX IF NOT EXISTS idx_email_inbox_thread ON public.email_inbox(account_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_email_inbox_account_folder_date ON public.email_inbox(account_id, folder, received_at DESC);

-- Sync state hardening
ALTER TABLE public.email_sync_state
  ADD COLUMN IF NOT EXISTS uidvalidity bigint,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz;

-- Per-account auto reply toggle (default true preserves current behaviour)
ALTER TABLE public.email_accounts
  ADD COLUMN IF NOT EXISTS auto_reply_enabled boolean NOT NULL DEFAULT true;

-- Sync run history
CREATE TABLE IF NOT EXISTS public.email_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  result text NOT NULL DEFAULT 'running',
  trigger_source text NOT NULL DEFAULT 'cron',
  new_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  folders jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  error_summary text,
  recommended_action text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_sync_runs TO authenticated;
GRANT ALL ON public.email_sync_runs TO service_role;
ALTER TABLE public.email_sync_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins view email sync runs" ON public.email_sync_runs;
CREATE POLICY "Admins view email sync runs" ON public.email_sync_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_email_sync_runs_account ON public.email_sync_runs(account_id, started_at DESC);

-- Failed-message reprocess queue
CREATE TABLE IF NOT EXISTS public.email_reprocess_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  folder text NOT NULL,
  imap_uid bigint NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, folder, imap_uid)
);
GRANT SELECT ON public.email_reprocess_queue TO authenticated;
GRANT ALL ON public.email_reprocess_queue TO service_role;
ALTER TABLE public.email_reprocess_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins view email reprocess queue" ON public.email_reprocess_queue;
CREATE POLICY "Admins view email reprocess queue" ON public.email_reprocess_queue
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_email_reprocess_pending ON public.email_reprocess_queue(status, next_attempt_at);