
-- ============================================================
-- Notification Dispatch Logs table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notification_dispatch_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  channel text NOT NULL,
  recipient_phone text,
  recipient_email text,
  recipient_user_id uuid,
  status text NOT NULL DEFAULT 'pending',
  payload jsonb,
  response_body text,
  error_message text,
  attempts integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_dispatch_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage dispatch logs"
  ON public.notification_dispatch_logs
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert dispatch logs"
  ON public.notification_dispatch_logs
  FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- Insert default system_settings for BotConversa and SMS
-- only if they don't already exist
-- ============================================================
INSERT INTO public.system_settings (key, value)
VALUES
  ('sms_provider', '{"enabled": false, "provider": "zenvia", "api_key": "", "sender_name": "WebMarcas", "test_phone": ""}'),
  ('botconversa', '{"enabled": false, "webhook_url": "", "auth_token": "", "test_phone": ""}'),
  ('email_provider', '{"enabled": true, "provider": "resend", "api_key": "", "from_email": "noreply@webmarcas.net", "from_name": "WebMarcas"}')
ON CONFLICT DO NOTHING;
