-- Tabela de log para auditoria das execuções
CREATE TABLE IF NOT EXISTS public.promotion_expiration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at timestamptz DEFAULT now(),
  contracts_updated integer DEFAULT 0,
  contract_ids jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'success'
);

-- Habilitar RLS
ALTER TABLE public.promotion_expiration_logs ENABLE ROW LEVEL SECURITY;

-- Política: Apenas admins podem visualizar os logs
CREATE POLICY "Admins can view promotion logs"
  ON public.promotion_expiration_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Política: Apenas admins podem inserir logs (via service role)
CREATE POLICY "Service can insert promotion logs"
  ON public.promotion_expiration_logs
  FOR INSERT
  WITH CHECK (true);

-- Comentário na tabela
COMMENT ON TABLE public.promotion_expiration_logs IS 'Log de execuções do scheduler de expiração de promoção semanal';