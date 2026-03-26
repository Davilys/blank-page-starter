
-- Tabela de fila de remarketing
CREATE TABLE public.lead_remarketing_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NULL,
  lead_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'pending',
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  subject text NULL,
  body text NULL
);

-- RLS
ALTER TABLE public.lead_remarketing_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage remarketing queue"
ON public.lead_remarketing_queue
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage remarketing queue"
ON public.lead_remarketing_queue
FOR ALL
USING (true)
WITH CHECK (true);

-- Index para o cron processor
CREATE INDEX idx_remarketing_queue_pending ON public.lead_remarketing_queue (status, scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_remarketing_queue_campaign ON public.lead_remarketing_queue (campaign_id);

-- Também garantir que a tabela lead_remarketing_campaigns existe com os campos necessários
-- Adicionar coluna channels e total_queued se não existirem
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lead_remarketing_campaigns' AND column_name = 'channels') THEN
    ALTER TABLE public.lead_remarketing_campaigns ADD COLUMN channels text[] DEFAULT '{email}'::text[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lead_remarketing_campaigns' AND column_name = 'total_queued') THEN
    ALTER TABLE public.lead_remarketing_campaigns ADD COLUMN total_queued integer DEFAULT 0;
  END IF;
END $$;
