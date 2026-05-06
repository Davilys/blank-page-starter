
ALTER TABLE public.cobrancas_vencidas ADD COLUMN IF NOT EXISTS bucket text NOT NULL DEFAULT 'd60';
CREATE INDEX IF NOT EXISTS idx_cobrancas_vencidas_bucket ON public.cobrancas_vencidas(bucket);

CREATE TABLE IF NOT EXISTS public.negociacoes_devedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nome text,
  cliente_cpf_cnpj text,
  asaas_customer_id text,
  tipo text NOT NULL CHECK (tipo IN ('negociar','cobrar')),
  valor_original_total numeric NOT NULL DEFAULT 0,
  valor_acrescimo numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  parcelas_originais_ids text[] DEFAULT '{}',
  motivo_cobranca text,
  observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.parcelas_devedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negociacao_id uuid NOT NULL REFERENCES public.negociacoes_devedor(id) ON DELETE CASCADE,
  numero_parcela int NOT NULL,
  asaas_payment_id text,
  valor numeric NOT NULL,
  data_vencimento date NOT NULL,
  status text,
  link_boleto text,
  invoice_url text,
  motivo_cobranca text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.negociacoes_devedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcelas_devedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage negociacoes_devedor" ON public.negociacoes_devedor
  FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins manage parcelas_devedor" ON public.parcelas_devedor
  FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS idx_parcelas_devedor_neg ON public.parcelas_devedor(negociacao_id);
