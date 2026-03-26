-- Adicionar colunas específicas do Evolution API na tabela whatsapp_config
ALTER TABLE public.whatsapp_config
ADD COLUMN IF NOT EXISTS server_url TEXT,
ADD COLUMN IF NOT EXISTS instance_name TEXT DEFAULT 'webmarcas';