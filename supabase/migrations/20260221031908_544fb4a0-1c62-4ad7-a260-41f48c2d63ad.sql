
CREATE TABLE public.channel_notification_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage channel notification templates"
ON public.channel_notification_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_channel_notification_templates_updated_at
BEFORE UPDATE ON public.channel_notification_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
