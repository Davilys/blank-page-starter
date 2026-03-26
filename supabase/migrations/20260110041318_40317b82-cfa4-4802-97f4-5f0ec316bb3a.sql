-- Add new configuration entries for expanded settings
INSERT INTO system_settings (key, value) VALUES
  ('api_keys', '{"system_key": null, "zapier_webhook": "", "n8n_webhook": "", "make_webhook": "", "openai_key": ""}'),
  ('webhooks', '[]'),
  ('appearance', '{"theme": "system", "primaryColor": "#0066CC", "customCss": ""}'),
  ('contracts', '{"linkValidityDays": 7, "requireSignature": true, "blockchainEnabled": true}'),
  ('processes', '{"stages": [{"id": "analise", "name": "Análise", "color": "#3B82F6"}, {"id": "enviado", "name": "Enviado INPI", "color": "#8B5CF6"}, {"id": "exigencia", "name": "Exigência", "color": "#F59E0B"}, {"id": "publicado", "name": "Publicado", "color": "#10B981"}, {"id": "registrado", "name": "Registrado", "color": "#06B6D4"}]}'),
  ('financial', '{"currency": "BRL", "inpiFee": 355, "dueDays": 7, "cashDiscount": 5, "maxInstallments": 12}'),
  ('backup', '{"lastExport": null, "autoBackup": false}')
ON CONFLICT (key) DO NOTHING;