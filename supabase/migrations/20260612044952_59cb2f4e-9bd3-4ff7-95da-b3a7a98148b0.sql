
-- 1) Colunas de responsável em cobrancas_vencidas
ALTER TABLE public.cobrancas_vencidas
  ADD COLUMN IF NOT EXISTS responsavel_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsavel_nome text,
  ADD COLUMN IF NOT EXISTS responsavel_atribuido_em timestamptz;

-- 2) Colunas de responsável em publicacoes_marcas
ALTER TABLE public.publicacoes_marcas
  ADD COLUMN IF NOT EXISTS responsavel_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsavel_nome text,
  ADD COLUMN IF NOT EXISTS responsavel_atribuido_em timestamptz;

-- 3) Tabela de histórico de responsabilidade
CREATE TABLE IF NOT EXISTS public.responsavel_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade text NOT NULL CHECK (entidade IN ('cobranca','publicacao','invoice')),
  entidade_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_nome text,
  acao text NOT NULL CHECK (acao IN ('cobrou','negociou','atribuiu','assumiu','removeu')),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.responsavel_historico TO authenticated;
GRANT ALL ON public.responsavel_historico TO service_role;

ALTER TABLE public.responsavel_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view responsavel historico" ON public.responsavel_historico;
CREATE POLICY "Admins can view responsavel historico"
ON public.responsavel_historico FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert responsavel historico" ON public.responsavel_historico;
CREATE POLICY "Admins can insert responsavel historico"
ON public.responsavel_historico FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_resp_hist_entidade ON public.responsavel_historico (entidade, entidade_id, created_at DESC);

-- 4) Habilitar realtime nas tabelas para receber updates do responsavel
ALTER TABLE public.cobrancas_vencidas REPLICA IDENTITY FULL;
ALTER TABLE public.publicacoes_marcas REPLICA IDENTITY FULL;
