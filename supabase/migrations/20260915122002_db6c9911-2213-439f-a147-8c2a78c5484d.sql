CREATE OR REPLACE FUNCTION public.has_financial_permission(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
    AND (
      NOT EXISTS (SELECT 1 FROM public.admin_permissions WHERE user_id = _user_id)
      OR EXISTS (
        SELECT 1 FROM public.admin_permissions
        WHERE user_id = _user_id AND permission_key = 'financial' AND can_view = true
      )
    )
$$;

CREATE TABLE public.acordos_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_action_id uuid NOT NULL UNIQUE,
  invoice_original_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  asaas_payment_id_original text,
  user_id uuid,
  cliente_nome text,
  asaas_customer_id text,
  valor_original_centavos bigint NOT NULL,
  juros_percentual numeric(6,3) NOT NULL DEFAULT 10,
  juros_centavos bigint NOT NULL DEFAULT 0,
  total_centavos bigint NOT NULL,
  num_parcelas integer NOT NULL,
  primeira_parcela_data date NOT NULL,
  billing_type text NOT NULL DEFAULT 'BOLETO',
  status text NOT NULL DEFAULT 'processando',
  cancelamento_status text NOT NULL DEFAULT 'pendente',
  cancelamento_resposta jsonb,
  cancelamento_em timestamptz,
  compensacao_resultado jsonb,
  bloqueado_por_pendencia boolean NOT NULL DEFAULT false,
  enviado_em timestamptz,
  enviado_canais text[],
  auditoria jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX acordos_cliente_um_ativo_por_fatura
  ON public.acordos_cliente (invoice_original_id)
  WHERE invoice_original_id IS NOT NULL AND status IN ('processando','ativo');

CREATE INDEX acordos_cliente_user_idx ON public.acordos_cliente (user_id);

CREATE TABLE public.acordo_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acordo_id uuid NOT NULL REFERENCES public.acordos_cliente(id) ON DELETE CASCADE,
  numero_parcela integer NOT NULL,
  valor_centavos bigint NOT NULL,
  data_vencimento date NOT NULL,
  asaas_payment_id text,
  status text NOT NULL DEFAULT 'PENDING',
  invoice_url text,
  link_boleto text,
  compensacao_status text,
  compensacao_resposta jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (acordo_id, numero_parcela)
);

CREATE INDEX acordo_parcelas_asaas_idx ON public.acordo_parcelas (asaas_payment_id);

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS acordo_id uuid REFERENCES public.acordos_cliente(id) ON DELETE SET NULL;

GRANT SELECT ON public.acordos_cliente TO authenticated;
GRANT ALL ON public.acordos_cliente TO service_role;
GRANT SELECT ON public.acordo_parcelas TO authenticated;
GRANT ALL ON public.acordo_parcelas TO service_role;

ALTER TABLE public.acordos_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acordo_parcelas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financeiro pode ver acordos"
  ON public.acordos_cliente FOR SELECT TO authenticated
  USING (public.has_financial_permission(auth.uid()));

CREATE POLICY "Financeiro pode ver parcelas do acordo"
  ON public.acordo_parcelas FOR SELECT TO authenticated
  USING (public.has_financial_permission(auth.uid()));

CREATE TRIGGER update_acordos_cliente_updated_at
  BEFORE UPDATE ON public.acordos_cliente
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_acordo_parcelas_updated_at
  BEFORE UPDATE ON public.acordo_parcelas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();