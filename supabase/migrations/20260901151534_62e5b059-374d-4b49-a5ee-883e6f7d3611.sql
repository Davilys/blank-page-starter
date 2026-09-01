-- 1) Marcação de origem CRM
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS originado_pelo_crm boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS negociacao_id uuid,
  ADD COLUMN IF NOT EXISTS renegociacao_id uuid,
  ADD COLUMN IF NOT EXISTS cobranca_origem_id text,
  ADD COLUMN IF NOT EXISTS crm_action_id uuid;

ALTER TABLE public.cobrancas_vencidas
  ADD COLUMN IF NOT EXISTS originado_pelo_crm boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS negociacao_id uuid,
  ADD COLUMN IF NOT EXISTS renegociacao_id uuid,
  ADD COLUMN IF NOT EXISTS cobranca_origem_id text,
  ADD COLUMN IF NOT EXISTS crm_action_id uuid,
  ADD COLUMN IF NOT EXISTS tratada_em timestamptz,
  ADD COLUMN IF NOT EXISTS tratada_por uuid;

ALTER TABLE public.parcelas_devedor
  ADD COLUMN IF NOT EXISTS originado_pelo_crm boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS crm_action_id uuid;

ALTER TABLE public.parcelas_renegociadas
  ADD COLUMN IF NOT EXISTS originado_pelo_crm boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS crm_action_id uuid;

-- 2) Idempotência por identificador do Asaas
CREATE UNIQUE INDEX IF NOT EXISTS invoices_asaas_invoice_id_uidx
  ON public.invoices (asaas_invoice_id) WHERE asaas_invoice_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cobrancas_vencidas_asaas_payment_id_uidx
  ON public.cobrancas_vencidas (asaas_payment_id) WHERE asaas_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoices_origem_crm_idx ON public.invoices (originado_pelo_crm);
CREATE INDEX IF NOT EXISTS cobrancas_vencidas_origem_crm_idx ON public.cobrancas_vencidas (originado_pelo_crm);

-- 3) Histórico permanente de tratamentos
CREATE TABLE IF NOT EXISTS public.cobranca_tratamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_action_id uuid NOT NULL,
  tipo_acao text NOT NULL,
  motivo text NOT NULL,
  cliente_nome text,
  cliente_cpf_cnpj text,
  cliente_user_id uuid,
  asaas_customer_id text,
  cobranca_original_id uuid,
  invoice_original_id uuid,
  asaas_payment_id_original text,
  valor_original numeric,
  vencimento_original date,
  negociacao_id uuid,
  renegociacao_id uuid,
  nova_cobranca_asaas_id text,
  novo_boleto_url text,
  novo_vencimento date,
  novo_valor numeric,
  cancelamento_status text NOT NULL DEFAULT 'pendente',
  cancelamento_resposta jsonb,
  cancelamento_em timestamptz,
  status_negociacao text NOT NULL DEFAULT 'ativa',
  responsavel_id uuid,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cobranca_tratamentos_evento_uidx
  ON public.cobranca_tratamentos (asaas_payment_id_original, crm_action_id)
  WHERE asaas_payment_id_original IS NOT NULL;
CREATE INDEX IF NOT EXISTS cobranca_tratamentos_pay_idx ON public.cobranca_tratamentos (asaas_payment_id_original);
CREATE INDEX IF NOT EXISTS cobranca_tratamentos_neg_idx ON public.cobranca_tratamentos (negociacao_id);
CREATE INDEX IF NOT EXISTS cobranca_tratamentos_novo_idx ON public.cobranca_tratamentos (nova_cobranca_asaas_id);

GRANT SELECT, INSERT, UPDATE ON public.cobranca_tratamentos TO authenticated;
GRANT ALL ON public.cobranca_tratamentos TO service_role;

ALTER TABLE public.cobranca_tratamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver tratamentos" ON public.cobranca_tratamentos
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins podem registrar tratamentos" ON public.cobranca_tratamentos
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins podem atualizar tratamentos" ON public.cobranca_tratamentos
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_cobranca_tratamentos_updated_at
  BEFORE UPDATE ON public.cobranca_tratamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Backfill: parcelas já criadas pelo CRM
UPDATE public.invoices i
SET originado_pelo_crm = true,
    negociacao_id = pd.negociacao_id
FROM public.parcelas_devedor pd
WHERE pd.asaas_payment_id IS NOT NULL
  AND i.asaas_invoice_id = pd.asaas_payment_id
  AND i.originado_pelo_crm = false;

UPDATE public.invoices i
SET originado_pelo_crm = true,
    renegociacao_id = pr.renegociacao_id
FROM public.parcelas_renegociadas pr
WHERE pr.asaas_payment_id IS NOT NULL
  AND i.asaas_invoice_id = pr.asaas_payment_id
  AND i.originado_pelo_crm = false;

UPDATE public.cobrancas_vencidas cv
SET originado_pelo_crm = true,
    negociacao_id = pd.negociacao_id,
    tratada_em = COALESCE(cv.tratada_em, now())
FROM public.parcelas_devedor pd
WHERE pd.asaas_payment_id IS NOT NULL
  AND cv.asaas_payment_id = pd.asaas_payment_id
  AND cv.originado_pelo_crm = false;

UPDATE public.cobrancas_vencidas cv
SET originado_pelo_crm = true,
    renegociacao_id = pr.renegociacao_id,
    tratada_em = COALESCE(cv.tratada_em, now())
FROM public.parcelas_renegociadas pr
WHERE pr.asaas_payment_id IS NOT NULL
  AND cv.asaas_payment_id = pr.asaas_payment_id
  AND cv.originado_pelo_crm = false;

-- 5) Backfill: tratamentos retroativos a partir das negociações existentes
INSERT INTO public.cobranca_tratamentos (
  crm_action_id, tipo_acao, motivo, cliente_nome, cliente_cpf_cnpj, asaas_customer_id,
  asaas_payment_id_original, negociacao_id, cancelamento_status, status_negociacao,
  responsavel_id, observacao, created_at
)
SELECT n.id,
       CASE WHEN n.tipo = 'negociar' THEN 'negociacao' ELSE 'cobranca' END,
       CASE WHEN n.tipo = 'negociar' THEN 'NEGOCIAÇÃO REALIZADA' ELSE 'COBRANÇA REALIZADA' END,
       n.cliente_nome, n.cliente_cpf_cnpj, n.asaas_customer_id,
       orig.pid, n.id, 'nao_verificado', 'ativa', n.created_by,
       'Registro retroativo gerado na migração', n.created_at
FROM public.negociacoes_devedor n
CROSS JOIN LATERAL unnest(COALESCE(n.parcelas_originais_ids, ARRAY[]::text[])) AS orig(pid)
ON CONFLICT DO NOTHING;

INSERT INTO public.cobranca_tratamentos (
  crm_action_id, tipo_acao, motivo, cliente_nome, cliente_cpf_cnpj, asaas_customer_id,
  asaas_payment_id_original, renegociacao_id, cancelamento_status, status_negociacao,
  responsavel_id, observacao, created_at
)
SELECT r.id, 'renegociacao', 'ACORDO REALIZADO',
       r.cliente_nome, r.cliente_cpf_cnpj, r.asaas_customer_id,
       orig.pid, r.id, 'nao_verificado', 'ativa', r.created_by,
       'Registro retroativo gerado na migração', r.created_at
FROM public.renegociacoes r
CROSS JOIN LATERAL unnest(COALESCE(r.parcelas_originais_ids, ARRAY[]::text[])) AS orig(pid)
ON CONFLICT DO NOTHING;