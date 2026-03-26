
-- Add last_notification_sent_at to publicacoes_marcas for notification dedup
ALTER TABLE public.publicacoes_marcas 
ADD COLUMN IF NOT EXISTS last_notification_sent_at timestamp with time zone DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN public.publicacoes_marcas.last_notification_sent_at IS 'Timestamp of last automated notification sent for this publication, used for dedup';
