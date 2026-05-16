ALTER TABLE public.email_inbox ADD COLUMN IF NOT EXISTS is_alias BOOLEAN DEFAULT false;
ALTER TABLE public.email_sync_state
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS consecutive_errors INTEGER DEFAULT 0;