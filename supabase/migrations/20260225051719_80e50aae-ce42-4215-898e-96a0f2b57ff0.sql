
-- RLS para clientes verem seus proprios registros de publicacao
CREATE POLICY "Clients can view own publicacoes"
  ON public.publicacoes_marcas FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

-- Ativar realtime na tabela publicacoes_marcas
ALTER PUBLICATION supabase_realtime ADD TABLE public.publicacoes_marcas;
