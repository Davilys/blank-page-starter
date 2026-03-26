
-- Tabela principal: publicacoes_marcas (isolada, sem alterar nada existente)
CREATE TABLE public.publicacoes_marcas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid REFERENCES public.brand_processes(id) ON DELETE CASCADE NOT NULL,
  client_id uuid NOT NULL,
  admin_id uuid,
  status text NOT NULL DEFAULT 'depositada',
  tipo_publicacao text DEFAULT 'publicacao_rpi',
  data_deposito date,
  data_publicacao_rpi date,
  prazo_oposicao date,
  data_decisao date,
  data_certificado date,
  data_renovacao date,
  proximo_prazo_critico date,
  descricao_prazo text,
  oposicao_protocolada boolean DEFAULT false,
  oposicao_data date,
  comentarios_internos text,
  documento_rpi_url text,
  rpi_number text,
  rpi_link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(process_id)
);

-- Tabela de logs de auditoria
CREATE TABLE public.publicacao_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publicacao_id uuid REFERENCES public.publicacoes_marcas(id) ON DELETE CASCADE NOT NULL,
  admin_id uuid,
  admin_email text,
  campo_alterado text NOT NULL,
  valor_anterior text,
  valor_novo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.publicacoes_marcas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publicacao_logs ENABLE ROW LEVEL SECURITY;

-- Politicas RLS: somente admins
CREATE POLICY "Admins can manage publicacoes"
  ON public.publicacoes_marcas FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage publicacao logs"
  ON public.publicacao_logs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger para updated_at automático
CREATE TRIGGER update_publicacoes_marcas_updated_at
  BEFORE UPDATE ON public.publicacoes_marcas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indices para performance
CREATE INDEX idx_publicacoes_marcas_client_id ON public.publicacoes_marcas(client_id);
CREATE INDEX idx_publicacoes_marcas_status ON public.publicacoes_marcas(status);
CREATE INDEX idx_publicacoes_marcas_proximo_prazo ON public.publicacoes_marcas(proximo_prazo_critico);
CREATE INDEX idx_publicacao_logs_publicacao_id ON public.publicacao_logs(publicacao_id);
