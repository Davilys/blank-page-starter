
-- Tabela de campanhas de remarketing para clientes
CREATE TABLE public.client_remarketing_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'custom',
  subject text,
  body text,
  target_status text[] DEFAULT '{}',
  channels text[] DEFAULT '{email}',
  status text NOT NULL DEFAULT 'rascunho',
  total_sent integer DEFAULT 0,
  total_opened integer DEFAULT 0,
  total_queued integer DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_at timestamp with time zone,
  scheduled_at timestamp with time zone
);

ALTER TABLE public.client_remarketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage client remarketing campaigns"
  ON public.client_remarketing_campaigns FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Tabela de fila de remarketing para clientes
CREATE TABLE public.client_remarketing_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid REFERENCES public.client_remarketing_campaigns(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'pending',
  scheduled_for timestamp with time zone NOT NULL DEFAULT now(),
  sent_at timestamp with time zone,
  error_message text,
  subject text,
  body text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.client_remarketing_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage client remarketing queue"
  ON public.client_remarketing_queue FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage client remarketing queue"
  ON public.client_remarketing_queue FOR ALL
  USING (true)
  WITH CHECK (true);
