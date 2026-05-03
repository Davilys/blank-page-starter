-- Enable extensions for cron sync
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Track last synced UID per (account, folder) for incremental IMAP sync
CREATE TABLE IF NOT EXISTS public.email_sync_state (
  account_id uuid NOT NULL,
  folder text NOT NULL,
  last_uid bigint NOT NULL DEFAULT 0,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, folder)
);

ALTER TABLE public.email_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage email_sync_state" ON public.email_sync_state;
CREATE POLICY "Admins manage email_sync_state"
ON public.email_sync_state FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Make sure email_inbox supports new folders (text column already permits any value).
-- Realtime: enable changes streaming on email_inbox.
ALTER TABLE public.email_inbox REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'email_inbox'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.email_inbox';
  END IF;
END$$;
