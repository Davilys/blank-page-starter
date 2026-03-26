
-- Add linking_method column to track how publications were linked to clients
ALTER TABLE public.publicacoes_marcas 
ADD COLUMN IF NOT EXISTS linking_method TEXT DEFAULT 'manual';

-- Add stale_since column to detect stalled processes
ALTER TABLE public.publicacoes_marcas 
ADD COLUMN IF NOT EXISTS stale_since TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN public.publicacoes_marcas.linking_method IS 'How the client was linked: manual, auto_process, auto_brand, fuzzy';
COMMENT ON COLUMN public.publicacoes_marcas.stale_since IS 'Timestamp when the publication was detected as stalled (no status change for 30+ days)';
