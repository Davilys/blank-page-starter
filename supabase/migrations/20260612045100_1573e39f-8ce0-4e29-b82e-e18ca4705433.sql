
ALTER TABLE public.cobrancas_vencidas
  DROP COLUMN IF EXISTS responsavel_user_id,
  DROP COLUMN IF EXISTS responsavel_nome,
  DROP COLUMN IF EXISTS responsavel_atribuido_em;

ALTER TABLE public.publicacoes_marcas
  DROP COLUMN IF EXISTS responsavel_user_id,
  DROP COLUMN IF EXISTS responsavel_nome,
  DROP COLUMN IF EXISTS responsavel_atribuido_em;

-- Permitir 'devedor' no histórico (cliente devedor agregado por asaas_customer_id)
ALTER TABLE public.responsavel_historico DROP CONSTRAINT IF EXISTS responsavel_historico_entidade_check;
ALTER TABLE public.responsavel_historico
  ADD CONSTRAINT responsavel_historico_entidade_check
  CHECK (entidade IN ('invoice','devedor','publicacao'));

CREATE TABLE IF NOT EXISTS public.responsavel_atribuicao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade text NOT NULL CHECK (entidade IN ('invoice','devedor','publicacao')),
  entidade_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_nome text,
  atribuido_em timestamptz NOT NULL DEFAULT now(),
  atribuido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entidade, entidade_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.responsavel_atribuicao TO authenticated;
GRANT ALL ON public.responsavel_atribuicao TO service_role;

ALTER TABLE public.responsavel_atribuicao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage responsavel" ON public.responsavel_atribuicao;
CREATE POLICY "Admins manage responsavel"
ON public.responsavel_atribuicao FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_resp_atrib_lookup ON public.responsavel_atribuicao(entidade, entidade_id);

ALTER TABLE public.responsavel_atribuicao REPLICA IDENTITY FULL;

DROP TRIGGER IF EXISTS trg_responsavel_atribuicao_updated ON public.responsavel_atribuicao;
CREATE TRIGGER trg_responsavel_atribuicao_updated
BEFORE UPDATE ON public.responsavel_atribuicao
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
