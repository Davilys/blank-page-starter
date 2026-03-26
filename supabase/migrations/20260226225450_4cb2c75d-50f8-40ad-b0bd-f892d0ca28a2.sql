
-- Add ncl_class column to publicacoes_marcas for manual Nice class assignment
ALTER TABLE public.publicacoes_marcas ADD COLUMN IF NOT EXISTS ncl_class text;
