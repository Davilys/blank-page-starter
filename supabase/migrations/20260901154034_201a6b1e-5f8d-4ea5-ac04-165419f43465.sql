ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS provider_message_id text;

CREATE INDEX IF NOT EXISTS email_logs_client_sent_idx
  ON public.email_logs (client_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS email_logs_to_email_idx
  ON public.email_logs (lower(to_email));

-- Backfill seguro: só vincula quando existe EXATAMENTE um cliente com aquele e-mail.
WITH unicos AS (
  SELECT lower(trim(p.email)) AS email, (array_agg(p.id))[1] AS client_id
  FROM public.profiles p
  WHERE p.email IS NOT NULL AND trim(p.email) <> ''
  GROUP BY lower(trim(p.email))
  HAVING count(*) = 1
)
UPDATE public.email_logs l
SET client_id = u.client_id
FROM unicos u
WHERE l.client_id IS NULL
  AND lower(trim(l.to_email)) = u.email;