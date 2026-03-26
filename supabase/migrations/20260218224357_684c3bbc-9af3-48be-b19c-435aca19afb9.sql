
-- Garantir que notification_dispatch_logs existe com estrutura completa
CREATE TABLE IF NOT EXISTS public.notification_dispatch_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  channel text NOT NULL,
  recipient_phone text,
  recipient_email text,
  recipient_user_id uuid,
  status text NOT NULL DEFAULT 'failed',
  payload jsonb,
  response_body text,
  error_message text,
  attempts integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.notification_dispatch_logs ENABLE ROW LEVEL SECURITY;

-- Políticas
DROP POLICY IF EXISTS "Admins can view dispatch logs" ON public.notification_dispatch_logs;
CREATE POLICY "Admins can view dispatch logs"
  ON public.notification_dispatch_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service can insert dispatch logs" ON public.notification_dispatch_logs;
CREATE POLICY "Service can insert dispatch logs"
  ON public.notification_dispatch_logs FOR INSERT
  WITH CHECK (true);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_event ON public.notification_dispatch_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_channel ON public.notification_dispatch_logs(channel);
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_status ON public.notification_dispatch_logs(status);
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_created ON public.notification_dispatch_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_user ON public.notification_dispatch_logs(recipient_user_id);

-- Garantir que notifications tem coluna link (para CRM)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read boolean DEFAULT false;
