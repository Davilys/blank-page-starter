
-- Garante que a coluna unique constraint existe para key em system_settings (para ON CONFLICT funcionar)
-- Upsert configs padrão para integrações novas
INSERT INTO public.system_settings (key, value) VALUES
  ('email_provider', '{"enabled": true, "provider": "resend", "api_key": "", "from_email": "noreply@webmarcas.net", "from_name": "WebMarcas"}'::jsonb),
  ('openai_config', '{"enabled": true, "api_key": ""}'::jsonb),
  ('inpi_sync', '{"enabled": true, "sync_interval_hours": 24, "last_sync_at": null}'::jsonb)
ON CONFLICT (key) DO NOTHING;
