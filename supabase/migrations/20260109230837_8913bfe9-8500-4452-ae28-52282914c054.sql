-- Create whatsapp_config table for BotConversa integration
CREATE TABLE public.whatsapp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key TEXT NOT NULL,
  company_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

-- RLS policy for admins only
CREATE POLICY "Admins can manage whatsapp config"
ON public.whatsapp_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create notification_logs table for multi-channel tracking
CREATE TABLE public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'platform')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT,
  recipient TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- RLS policy for admins
CREATE POLICY "Admins can manage notification logs"
ON public.notification_logs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add channels column to notifications table
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS channels JSONB DEFAULT '{"platform": true}'::jsonb;

-- Trigger for updated_at on whatsapp_config
CREATE TRIGGER update_whatsapp_config_updated_at
BEFORE UPDATE ON public.whatsapp_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();