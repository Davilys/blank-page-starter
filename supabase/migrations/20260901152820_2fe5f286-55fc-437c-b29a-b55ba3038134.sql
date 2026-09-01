ALTER TABLE public.cobranca_tratamentos
  ADD COLUMN IF NOT EXISTS novos_boletos_asaas_ids text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS cobranca_tratamentos_novos_ids_idx
  ON public.cobranca_tratamentos USING gin (novos_boletos_asaas_ids);

-- Segurança: configurações sensíveis só para admins
DROP POLICY IF EXISTS "Authenticated users can read system settings" ON public.system_settings;

CREATE POLICY "Authenticated users can read non-sensitive settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR key NOT IN (
    'api_keys','email_provider','sms_provider','openai_config','deepseek_config',
    'botconversa','asaas','inpi','inpi_sync','webhooks','whatsapp','backup','ai_active_provider'
  )
);