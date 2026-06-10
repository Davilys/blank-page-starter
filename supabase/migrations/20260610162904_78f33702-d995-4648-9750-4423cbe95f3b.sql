ALTER TABLE public.publicacoes_marcas
  ADD COLUMN IF NOT EXISTS cumprimento_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cumprimento_at timestamptz,
  ADD COLUMN IF NOT EXISTS cumprimento_by uuid;

CREATE INDEX IF NOT EXISTS idx_publicacoes_marcas_prazo
  ON public.publicacoes_marcas (cumprimento_ok, proximo_prazo_critico);