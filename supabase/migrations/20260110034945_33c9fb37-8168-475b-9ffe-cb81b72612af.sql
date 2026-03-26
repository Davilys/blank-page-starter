-- Create system_settings table for general configurations
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage settings
CREATE POLICY "Admins can manage settings" ON public.system_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Insert default settings
INSERT INTO public.system_settings (key, value) VALUES
  ('company', '{"name": "WebMarcas", "phone": "", "email": "contato@webmarcas.net", "cnpj": "", "address": ""}'),
  ('whatsapp', '{"number": "", "enabled": true, "welcome_message": "Olá! Como posso ajudar?"}'),
  ('business_hours', '{"weekdays": "09:00-18:00", "saturday": "09:00-13:00", "sunday": "Fechado"}'),
  ('asaas', '{"environment": "sandbox", "enabled": false}'),
  ('perfex', '{"url": "", "enabled": false, "auto_sync": false}');