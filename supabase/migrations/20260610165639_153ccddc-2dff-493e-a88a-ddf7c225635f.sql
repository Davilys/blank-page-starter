
ALTER TABLE public.publicacao_cobranca_schedule
  ADD COLUMN IF NOT EXISTS last_notif_bucket text,
  ADD COLUMN IF NOT EXISTS last_notif_at timestamptz;
