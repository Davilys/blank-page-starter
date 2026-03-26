
-- 1. Tornar process_id e client_id nullable
ALTER TABLE publicacoes_marcas ALTER COLUMN process_id DROP NOT NULL;
ALTER TABLE publicacoes_marcas ALTER COLUMN client_id DROP NOT NULL;

-- 2. Adicionar colunas de rastreamento RPI
ALTER TABLE publicacoes_marcas ADD COLUMN IF NOT EXISTS rpi_entry_id uuid UNIQUE;
ALTER TABLE publicacoes_marcas ADD COLUMN IF NOT EXISTS brand_name_rpi text;
ALTER TABLE publicacoes_marcas ADD COLUMN IF NOT EXISTS process_number_rpi text;
