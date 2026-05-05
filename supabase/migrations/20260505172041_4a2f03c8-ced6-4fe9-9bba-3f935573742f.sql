
CREATE TABLE public.cobrancas_vencidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asaas_payment_id TEXT NOT NULL UNIQUE,
  asaas_customer_id TEXT,
  cliente_nome TEXT,
  cliente_cpf_cnpj TEXT,
  cliente_email TEXT,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  data_vencimento DATE,
  dias_atraso INTEGER,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente_renegociacao',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cobrancas_vencidas_cpf ON public.cobrancas_vencidas(cliente_cpf_cnpj);
CREATE INDEX idx_cobrancas_vencidas_status ON public.cobrancas_vencidas(status);

CREATE TABLE public.renegociacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nome TEXT,
  cliente_cpf_cnpj TEXT,
  asaas_customer_id TEXT,
  valor_original_total NUMERIC(12,2) NOT NULL,
  valor_acrescimo NUMERIC(12,2) NOT NULL,
  valor_renegociado NUMERIC(12,2) NOT NULL,
  parcelas_originais_ids TEXT[] NOT NULL DEFAULT '{}',
  motivo_cobranca TEXT NOT NULL,
  observacao TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_renegociacoes_cpf ON public.renegociacoes(cliente_cpf_cnpj);

CREATE TABLE public.parcelas_renegociadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  renegociacao_id UUID NOT NULL REFERENCES public.renegociacoes(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL,
  asaas_payment_id TEXT,
  valor NUMERIC(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  link_boleto TEXT,
  invoice_url TEXT,
  motivo_cobranca TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_parcelas_renegociacao ON public.parcelas_renegociadas(renegociacao_id);

ALTER TABLE public.cobrancas_vencidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renegociacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcelas_renegociadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cobrancas_vencidas" ON public.cobrancas_vencidas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage renegociacoes" ON public.renegociacoes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage parcelas_renegociadas" ON public.parcelas_renegociadas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_cobrancas_vencidas_updated_at
  BEFORE UPDATE ON public.cobrancas_vencidas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_parcelas_renegociadas_updated_at
  BEFORE UPDATE ON public.parcelas_renegociadas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
