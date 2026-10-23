 NOT NULL THEN
    UPDATE public.publicacao_cobranca_schedule
       SET status = 'pausado_resposta',
           client_responded_at = COALESCE(client_responded_at, now()),
           updated_at = now()
     WHERE client_id = NEW.user_id
       AND status = 'ativo';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_messages_pause_cobranca ON public.chat_messages;
CREATE TRIGGER chat_messages_pause_cobranca
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.pause_cobranca_on_client_message();
;

-- END MIGRATION 20260610164001

-- BEGIN MIGRATION 20260610165147 20260610165147_.sql sha256=34d19f14de3a568bd0207b58a92c2de18251478ff9899fe82d0604d119204dab

ALTER TABLE public.publicacoes_marcas
  ADD COLUMN IF NOT EXISTS cumprimento_status text;

ALTER TABLE public.publicacoes_marcas
  DROP CONSTRAINT IF EXISTS publicacoes_marcas_cumprimento_status_check;

ALTER TABLE public.publicacoes_marcas
  ADD CONSTRAINT publicacoes_marcas_cumprimento_status_check
  CHECK (cumprimento_status IS NULL OR cumprimento_status IN ('cumprido','contato_agendado','aguardando_pagamento'));

CREATE OR REPLACE FUNCTION public.sync_cumprimento_ok_from_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cumprimento_status = 'cumprido' THEN
    NEW.cumprimento_ok := true;
    IF NEW.cumprimento_at IS NULL THEN
      NEW.cumprimento_at := now();
    END IF;
  ELSIF NEW.cumprimento_status IS DISTINCT FROM 'cumprido' THEN
    -- Não força false aqui se já estava true por outro caminho? Sim, vamos sincronizar.
    IF NEW.cumprimento_status IS NULL THEN
      NEW.cumprimento_ok := false;
      NEW.cumprimento_at := NULL;
      NEW.cumprimento_by := NULL;
    ELSE
      -- contato_agendado / aguardando_pagamento => não some da lista
      NEW.cumprimento_ok := false;
      NEW.cumprimento_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_cumprimento_status ON public.publicacoes_marcas;
CREATE TRIGGER trg_sync_cumprimento_status
  BEFORE INSERT OR UPDATE OF cumprimento_status ON public.publicacoes_marcas
  FOR EACH ROW EXECUTE FUNCTION public.sync_cumprimento_ok_from_status();
;

-- END MIGRATION 20260610165147

-- BEGIN MIGRATION 20260610165636 20260610165636_.sql sha256=bfb218cd90a05dc5d1523e3d16e989689215d1031c16d2b8c0d676ec96f17714

ALTER TABLE public.publicacao_cobranca_schedule
  ADD COLUMN IF NOT EXISTS last_notif_bucket text,
  ADD COLUMN IF NOT EXISTS last_notif_at timestamptz;
;

-- END MIGRATION 20260610165636

-- BEGIN MIGRATION 20260610180331 20260610180331_.sql sha256=8cdf20b9342df3b353422f4eab5ccb94081d0495c33a7ffc4e351b751ea6885c
ALTER TABLE public.publicacoes_marcas
  DROP CONSTRAINT IF EXISTS publicacoes_marcas_cumprimento_status_check;
ALTER TABLE public.publicacoes_marcas
  ADD CONSTRAINT publicacoes_marcas_cumprimento_status_check
  CHECK (cumprimento_status IS NULL OR cumprimento_status IN ('cumprido','contato_agendado','aguardando_pagamento','desistiu'));;

-- END MIGRATION 20260610180331

-- BEGIN MIGRATION 20260612044949 20260612044949_.sql sha256=02a204bf05427399fb6ae0517e9fffdbc15b25e0d4d4bff18e8f2ea525aa0fcd

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
;

-- END MIGRATION 20260612044949

-- BEGIN MIGRATION 20260612045058 20260612045058_.sql sha256=191a800284df8fe299197f85c0c31a2d45d10187aa70209bce1e1e68bfa387a7

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
;

-- END MIGRATION 20260612045058

-- BEGIN MIGRATION 20260620164157 20260620164157_.sql sha256=776009090deaa6ea1218d50f87a313d41a8200f2b7cee2565537e962854ac1e1

CREATE TABLE public.inpi_resource_evidences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES public.inpi_resources(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  page_number INTEGER,
  source_file_name TEXT,
  mime_type TEXT NOT NULL DEFAULT 'image/png',
  caption TEXT,
  ocr_text TEXT,
  placement TEXT NOT NULL DEFAULT 'annex' CHECK (placement IN ('inline','annex')),
  display_order INTEGER NOT NULL DEFAULT 0,
  included BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inpi_resource_evidences_resource ON public.inpi_resource_evidences(resource_id, display_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inpi_resource_evidences TO authenticated;
GRANT ALL ON public.inpi_resource_evidences TO service_role;

ALTER TABLE public.inpi_resource_evidences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all evidences"
  ON public.inpi_resource_evidences
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_inpi_resource_evidences_updated_at
  BEFORE UPDATE ON public.inpi_resource_evidences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Admins read evidence files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'inpi-resource-evidence' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins upload evidence files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'inpi-resource-evidence' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update evidence files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'inpi-resource-evidence' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete evidence files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'inpi-resource-evidence' AND public.has_role(auth.uid(), 'admin'));
;

-- END MIGRATION 20260620164157

-- BEGIN MIGRATION 20260620194714 20260620194714_.sql sha256=32fdae7bc53c7f15aa35795d9b6724ef413f8297a23170ec5880784cab714e51
ALTER TABLE public.inpi_resource_evidences
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'evidence';

ALTER TABLE public.inpi_resource_evidences
  DROP CONSTRAINT IF EXISTS inpi_resource_evidences_kind_check;

ALTER TABLE public.inpi_resource_evidences
  ADD CONSTRAINT inpi_resource_evidences_kind_check
  CHECK (kind IN ('brand_logo','inpi_consulta','evidence'));;

-- END MIGRATION 20260620194714

-- BEGIN MIGRATION 20260623143535 20260623143535_.sql sha256=f7a6e3113338152a0594bc966152f816a59d42dd1ba15d73b2c23d1fd8b024ad

-- 1) Consolida status "certificados" (plural) em "certificado"
UPDATE public.publicacoes_marcas
SET status = 'certificado', updated_at = now()
WHERE status = 'certificados';

-- 2) Recalcula prazo baseado no status para linhas com prazo padrão antigo (30 dias) ou sem prazo
-- Não toca em linhas com descricao_prazo específica (já editada manualmente)
WITH rules AS (
  SELECT * FROM (VALUES
    ('003',              60, 'Prazo para oposição'),
    ('oposicao',         60, 'Prazo para oposição'),
    ('exigencia_merito', 60, 'Cumprimento de exigência de mérito'),
    ('indeferimento',    60, 'Prazo para recurso (indeferimento)'),
    ('deferimento',      60, 'Pagamento de taxas (deferimento)'),
    ('renovacao',        60, 'Prazo para protocolar renovação')
  ) AS r(status, dias, descricao)
)
UPDATE public.publicacoes_marcas pm
SET 
  proximo_prazo_critico = (pm.data_publicacao_rpi + (r.dias || ' days')::interval)::date,
  descricao_prazo = r.descricao,
  updated_at = now()
FROM rules r
WHERE pm.status = r.status
  AND pm.data_publicacao_rpi IS NOT NULL
  AND (pm.descricao_prazo IS NULL OR pm.descricao_prazo = 'Prazo padrão - 30 dias');

-- 3) Certificado: prazo de renovação = 9 anos a partir da data do certificado ou da publicação
UPDATE public.publicacoes_marcas
SET 
  proximo_prazo_critico = (COALESCE(data_certificado, data_publicacao_rpi) + interval '9 years')::date,
  descricao_prazo = 'Renovação ordinária - 9 anos',
  updated_at = now()
WHERE status = 'certificado'
  AND COALESCE(data_certificado, data_publicacao_rpi) IS NOT NULL
  AND (descricao_prazo IS NULL OR descricao_prazo = 'Prazo padrão - 30 dias');
;

-- END MIGRATION 20260623143535

-- BEGIN MIGRATION 20260623155910 20260623155910_.sql sha256=b49b9b9cf21ccd74cab44d884e54f59a49e543483dd2e3ff5995d57bb50400ed
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_special_client boolean NOT NULL DEFAULT false;;

-- END MIGRATION 20260623155910

-- BEGIN MIGRATION 20260625152856 20260625152856_.sql sha256=6e8d90a480c201b7cfabaabada905b19f7def9ae4da2683cd61e76456b92dd37
ALTER TABLE public.publicacoes_marcas DROP CONSTRAINT IF EXISTS publicacoes_marcas_cumprimento_status_check;
ALTER TABLE public.publicacoes_marcas ADD CONSTRAINT publicacoes_marcas_cumprimento_status_check CHECK (cumprimento_status IS NULL OR cumprimento_status = ANY (ARRAY['cumprido'::text, 'contato_agendado'::text, 'aguardando_pagamento'::text, 'nao_respondeu'::text, 'desistiu'::text]));;

-- END MIGRATION 20260625152856

-- BEGIN MIGRATION 20260627030227 20260627030227_.sql sha256=89c81aeb5e4573c754f988aa702d394308cca9c99d7df1e2f1f63dd32f54cf76
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS manually_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manually_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS manually_paid_by uuid;;

-- END MIGRATION 20260627030227

-- BEGIN MIGRATION 20260629144353 20260629144353_.sql sha256=b53750f41e854347622754cb2be78c2ba7a3d0119595be67f59e5875336b6a84
ALTER TABLE public.publicacoes_marcas DROP CONSTRAINT IF EXISTS publicacoes_marcas_cumprimento_status_check;
ALTER TABLE public.publicacoes_marcas ADD CONSTRAINT publicacoes_marcas_cumprimento_status_check CHECK (cumprimento_status IS NULL OR cumprimento_status IN ('cumprido','contato_agendado','aguardando_pagamento','nao_respondeu','desistiu','assinou_distrato'));;

-- END MIGRATION 20260629144353

-- BEGIN MIGRATION 20260704224024 20260704224024_20260704224016_2b36de2d-be19-4bdc-b424-eb5b10840a99.sql sha256=556959efe4e38313e70b461e34fe1de2103869ea4ad3eb1b37d6f0994ec2f741
ALTER TABLE public.cobranca_historico ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'cobranca_vencida';
CREATE INDEX IF NOT EXISTS idx_cobranca_historico_tipo_invoice ON public.cobranca_historico(tipo, invoice_id, enviada_em DESC);;

-- END MIGRATION 20260704224024

-- BEGIN MIGRATION 20260708231419 20260708231419_20260708231415_1cb324ba-9081-4a6d-927d-fc7091b5a50e.sql sha256=6a8395394732a3ab08ffc2d39c734d1f765b25f71bc4d9a6b48b75d2b563e20f
CREATE OR REPLACE FUNCTION public.verify_contract_by_hash(p_hash text)
RETURNS TABLE (
  contract_number text,
  blockchain_hash text,
  blockchain_tx_id text,
  blockchain_network text,
  blockchain_timestamp text,
  signed_at timestamptz,
  subject text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.contract_number,
    c.blockchain_hash,
    c.blockchain_tx_id,
    c.blockchain_network,
    c.blockchain_timestamp,
    c.signed_at,
    c.subject
  FROM public.contracts c
  WHERE c.signature_status = 'signed'
    AND c.blockchain_hash IS NOT NULL
    AND lower(trim(c.blockchain_hash)) = lower(trim(p_hash))
    AND lower(trim(p_hash)) ~ '^[a-f0-9]{64}$'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.verify_contract_by_hash(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_contract_by_hash(text) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_contract_by_hash(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_contract_by_hash(text) TO service_role;;

-- END MIGRATION 20260708231419

-- BEGIN MIGRATION 20260708231520 20260708231520_20260708231515_30fa2392-2402-461d-a4c9-bf59e4dfd6dc.sql sha256=fa2dfcbbe0aa3cf76aa13c9f0d14f366a6acd18e260aee586207677f877c14d9
CREATE OR REPLACE FUNCTION public.verify_contract_by_id(p_contract_id uuid)
RETURNS TABLE (
  contract_number text,
  blockchain_hash text,
  blockchain_tx_id text,
  blockchain_network text,
  blockchain_timestamp text,
  signed_at timestamptz,
  subject text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.contract_number,
    c.blockchain_hash,
    c.blockchain_tx_id,
    c.blockchain_network,
    c.blockchain_timestamp,
    c.signed_at,
    c.subject
  FROM public.contracts c
  WHERE c.id = p_contract_id
    AND c.signature_status = 'signed'
    AND c.blockchain_hash IS NOT NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.verify_contract_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_contract_by_id(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_contract_by_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_contract_by_id(uuid) TO service_role;;

-- END MIGRATION 20260708231520

-- BEGIN MIGRATION 20260715141754 20260715141754_20260715141751_1598f497-bd5b-4980-968d-67a0ebad7c87.sql sha256=5ff2c06a6e1c6d3110b4495582524e47b0bd4b2d3e31f31d9df6cbd4f39edc1e
ALTER TABLE public.inpi_resource_evidences ADD COLUMN IF NOT EXISTS party TEXT NOT NULL DEFAULT 'cliente' CHECK (party IN ('cliente','concorrente'));
CREATE INDEX IF NOT EXISTS idx_inpi_resource_evidences_party ON public.inpi_resource_evidences(resource_id, party, display_order);;

-- END MIGRATION 20260715141754

-- BEGIN MIGRATION 20260719031738 20260719031738_20260719031735_ea27b733-1a2a-4fae-832c-07ba8fea6028.sql sha256=4a5f3d415b457c2f6e41ff7526129eaa1dab7eda13b57776ec07fe1950b20dbf
UPDATE public.inpi_resource_evidences
SET placement = 'inline', updated_at = now()
WHERE included = true AND placement <> 'inline';;

-- END MIGRATION 20260719031738

-- BEGIN MIGRATION 20260830172626 20260830172626_d7dd31ae-6d78-4a70-97db-89c5f50f6391.sql sha256=dadd3ea87d99e8859543350a6efaa7b8e8351420edb7c787db62743c58ef0fdb
ALTER TABLE public.cobranca_historico
  ADD COLUMN IF NOT EXISTS situacao TEXT NOT NULL DEFAULT 'aguardando',
  ADD COLUMN IF NOT EXISTS pago_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pago_manual BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pago_obs TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS negativado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS negativado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS negativado_total NUMERIC;

UPDATE public.cobranca_historico
SET situacao = 'recebida', pago_em = COALESCE(pago_em, updated_at)
WHERE status = 'confirmada_paga' AND situacao <> 'recebida';;

-- END MIGRATION 20260830172626

-- BEGIN MIGRATION 20260901151534 20260901151534_62e5b059-374d-4b49-a5ee-883e6f7d3611.sql sha256=d1101f472d4d41e6753ab8d3d9525fe4dec0afd664bd830de8505d3d9fb6fc8b
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
ON CONFLICT DO NOTHING;;

-- END MIGRATION 20260901151534

-- BEGIN MIGRATION 20260901151702 20260901151702_79a1fee0-9f66-43f2-b9c2-05b40e3267f4.sql sha256=fd11cf218635dbc7771588faed00cea1e7e494d9e7b6bf84fe3c114d760fa2e1
DROP INDEX IF EXISTS public.cobranca_tratamentos_evento_uidx;
CREATE UNIQUE INDEX cobranca_tratamentos_evento_uidx
  ON public.cobranca_tratamentos (asaas_payment_id_original, crm_action_id);;

-- END MIGRATION 20260901151702

-- BEGIN MIGRATION 20260901152820 20260901152820_2fe5f286-55fc-437c-b29a-b55ba3038134.sql sha256=141aed2b26075ccdfa27cf74650720c72a33d145d0aad5e72671ae93913735c6
ALTER TABLE public.cobranca_tratamentos
  ADD COLUMN IF NOT EXISTS novos_boletos_asaas_ids text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS cobranca_tratamentos_novos_ids_idx
  ON public.cobranca_tratamentos USING gin (novos_boletos_asaas_ids);

-- Segurança: configurações sensíveis só para admins
DROP POLICY IF EXISTS "Authenticated users can read system settings" ON public.system_settings;

CREATE POLICY "Authenticated users can read non-sensitive settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR key NOT IN (
    'api_keys','email_provider','sms_provider','openai_config','deepseek_config',
    'botconversa','asaas','inpi','inpi_sync','webhooks','whatsapp','backup','ai_active_provider'
  )
);;

-- END MIGRATION 20260901152820

-- BEGIN MIGRATION 20260901154034 20260901154034_201a6b1e-5f8d-4ea5-ac04-165419f43465.sql sha256=9d93fcdd245803b3f45522b1ffa3020959a1b460780e265048a3599bc3e389a1
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS provider_message_id text;

CREATE INDEX IF NOT EXISTS email_logs_client_sent_idx
  ON public.email_logs (client_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS email_logs_to_email_idx
  ON public.email_logs (lower(to_email));

-- Backfill seguro: só vincula quando existe EXATAMENTE um cliente com aquele e-mail.
WITH unicos AS (
  SELECT lower(trim(p.email)) AS email, (array_agg(p.id))[1] AS client_id
  FROM public.profiles p
  WHERE p.email IS NOT NULL AND trim(p.email) <> ''
  GROUP BY lower(trim(p.email))
  HAVING count(*) = 1
)
UPDATE public.email_logs l
SET client_id = u.client_id
FROM unicos u
WHERE l.client_id IS NULL
  AND lower(trim(l.to_email)) = u.email;;

-- END MIGRATION 20260901154034

-- BEGIN MIGRATION 20260907204142 20260907204142_e9401029-234f-4dae-8659-2e3cbdb2bac1.sql sha256=46ddc953243abd23ffd44966332bfa04c59cf765c4e3a7fec6bc86dd56feb4a8
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS additional_phones text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS additional_emails text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS trade_name text,
  ADD COLUMN IF NOT EXISTS registration_status text,
  ADD COLUMN IF NOT EXISTS cnae text,
  ADD COLUMN IF NOT EXISTS opening_date date,
  ADD COLUMN IF NOT EXISTS share_capital numeric;;

-- END MIGRATION 20260907204142

-- BEGIN MIGRATION 20260907210404 20260907210404_ac7fedc0-2714-496f-8fab-6bf4015d5a87.sql sha256=aac53597bdd79612f1f05388dd9ac62793427a2fa6a5a068980875e18424a123
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date date;

COMMENT ON COLUMN public.profiles.birth_date IS 'Data de nascimento usada, mediante ação do administrador, na consulta cadastral oficial de CPF.';;

-- END MIGRATION 20260907210404

-- BEGIN MIGRATION 20260915122002 20260915122002_db6c9911-2213-439f-a147-8c2a78c5484d.sql sha256=ba01ac535ad0b7e853ebe41bf1add94b6b640a63d80e12c07ffc85d89cc60a5f
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
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();;

-- END MIGRATION 20260915122002

-- BEGIN MIGRATION 20260915124416 20260915124416_f498d174-f1af-4f36-8df5-74f9b4e1b00a.sql sha256=118be9892b3ce4b9ef795b31829607304df6eaf7f2a65dee58238779562567b0
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_por uuid,
  ADD COLUMN IF NOT EXISTS cancelamento_motivo text;;

-- END MIGRATION 20260915124416

-- BEGIN MIGRATION 20260915130030 20260915130030_aa905b96-bc81-4103-8843-40d3983e696a.sql sha256=a887190e13530de4920ca1da034556ba7ebe56a5a6c4fa7fe4ff30c5faf32eb1

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'ativa',
  ADD COLUMN IF NOT EXISTS removida_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_sincronizacao_asaas timestamptz,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'interna',
  ADD COLUMN IF NOT EXISTS asaas_status_raw text;

CREATE INDEX IF NOT EXISTS invoices_user_sync_idx ON public.invoices (user_id, sync_status);

CREATE TABLE IF NOT EXISTS public.asaas_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  executed_by uuid,
  sync_run_id uuid NOT NULL,
  customer_ids text[] NOT NULL DEFAULT '{}',
  ambiguous_customer_ids text[] NOT NULL DEFAULT '{}',
  total_encontradas integer NOT NULL DEFAULT 0,
  total_criadas integer NOT NULL DEFAULT 0,
  total_atualizadas integer NOT NULL DEFAULT 0,
  total_removidas integer NOT NULL DEFAULT 0,
  totais_antes jsonb,
  totais_depois jsonb,
  sucesso boolean NOT NULL DEFAULT false,
  incompleta boolean NOT NULL DEFAULT false,
  erro text,
  duracao_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.asaas_sync_logs TO authenticated;
GRANT ALL ON public.asaas_sync_logs TO service_role;

ALTER TABLE public.asaas_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view asaas sync logs"
ON public.asaas_sync_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS asaas_sync_logs_client_idx ON public.asaas_sync_logs (client_id, created_at DESC);
;

-- END MIGRATION 20260915130030

-- BEGIN MIGRATION 20260915134402 20260915134402_82c46536-46b9-4240-872d-27d0153b98c3.sql sha256=edb47cb1b27b2a0626e0fe413e5fea3861386460dd8540d6d32ddb9c966edeb4
-- 1) Tabela de execução da sincronização geral
CREATE TABLE IF NOT EXISTS public.asaas_full_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  executed_by uuid,
  cursor_offset integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'em_andamento',
  etapa text,
  total_clientes_asaas integer,
  clientes_processados integer NOT NULL DEFAULT 0,
  clientes_criados integer NOT NULL DEFAULT 0,
  clientes_vinculados integer NOT NULL DEFAULT 0,
  cobrancas_encontradas integer NOT NULL DEFAULT 0,
  criadas integer NOT NULL DEFAULT 0,
  atualizadas integer NOT NULL DEFAULT 0,
  removidas integer NOT NULL DEFAULT 0,
  ambiguidades jsonb NOT NULL DEFAULT '[]'::jsonb,
  ultimo_bloco_aplicado integer NOT NULL DEFAULT -1,
  erro text,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

GRANT SELECT ON public.asaas_full_sync_runs TO authenticated;
GRANT ALL ON public.asaas_full_sync_runs TO service_role;

ALTER TABLE public.asaas_full_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins podem ver execucoes de sincronizacao" ON public.asaas_full_sync_runs;
CREATE POLICY "Admins podem ver execucoes de sincronizacao"
  ON public.asaas_full_sync_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_asaas_full_sync_runs_updated_at ON public.asaas_full_sync_runs;
CREATE TRIGGER update_asaas_full_sync_runs_updated_at
  BEFORE UPDATE ON public.asaas_full_sync_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX IF NOT EXISTS asaas_full_sync_runs_unico_em_andamento
  ON public.asaas_full_sync_runs ((status)) WHERE status = 'em_andamento';

-- 2) Regras únicas de classificação/ordenação
CREATE OR REPLACE FUNCTION public.classificar_cobranca(p_status text, p_due_date date, p_sync_status text)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN COALESCE(lower(btrim(p_sync_status)), 'ativa') <> 'ativa' THEN 'inativo'
    WHEN lower(COALESCE(p_status, '')) IN ('received','confirmed','received_in_cash','dunning_received','paid') THEN 'pago'
    WHEN lower(COALESCE(p_status, '')) IN ('canceled','cancelled','deleted','removida_asaas','refunded','refund_requested','refund_in_progress','chargeback','chargeback_requested','chargeback_dispute','awaiting_chargeback_reversal') THEN 'inativo'
    WHEN lower(COALESCE(p_status, '')) IN ('overdue','dunning_requested') THEN 'vencido'
    WHEN p_due_date IS NOT NULL AND p_due_date < CURRENT_DATE THEN 'vencido'
    ELSE 'a_vencer'
  END;
$$;

CREATE OR REPLACE FUNCTION public.nome_ordenavel(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(btrim(translate(COALESCE(p, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')));
$$;

-- 3) Lista paginada do Financeiro
CREATE OR REPLACE FUNCTION public.admin_invoices_list(
  p_search text DEFAULT NULL,
  p_status text DEFAULT 'all',
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_owner uuid DEFAULT NULL,
  p_sort text DEFAULT 'cliente',
  p_dir text DEFAULT 'asc',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, description text, amount numeric, due_date date, status text,
  classificacao text, payment_date date, user_id uuid, invoice_url text, pix_code text,
  payment_method text, created_at timestamptz, sync_status text, origem text,
  asaas_invoice_id text, cliente_nome text, cliente_email text, total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dir text := CASE WHEN lower(COALESCE(p_dir, 'asc')) = 'desc' THEN 'DESC' ELSE 'ASC' END;
  v_order text;
  v_sql text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;

  v_order := CASE lower(COALESCE(p_sort, 'cliente'))
    WHEN 'descricao'  THEN format('public.nome_ordenavel(f.description) %s, f.due_date ASC', v_dir)
    WHEN 'valor'      THEN format('f.amount %s, f.nome_ord ASC', v_dir)
    WHEN 'metodo'     THEN format('lower(COALESCE(f.payment_method, %L)) %s, f.nome_ord ASC', '', v_dir)
    WHEN 'vencimento' THEN format('f.due_date %s NULLS LAST, f.nome_ord ASC', v_dir)
    WHEN 'status'     THEN format('f.classificacao %s, f.due_date ASC', v_dir)
    ELSE format('f.nome_ord %s, f.ordem_status ASC, f.due_date ASC', v_dir)
  END;

  v_sql := format($q$
    WITH base AS (
      SELECT i.id, i.description, i.amount, i.due_date, i.status, i.payment_date, i.user_id,
             i.invoice_url, i.pix_code, i.payment_method, i.created_at, i.sync_status, i.origem,
             i.asaas_invoice_id,
             p.full_name AS cliente_nome, p.email AS cliente_email,
             public.classificar_cobranca(i.status, i.due_date, i.sync_status) AS classificacao,
             public.nome_ordenavel(COALESCE(p.full_name, p.email, 'zzzz')) AS nome_ord,
             CASE public.classificar_cobranca(i.status, i.due_date, i.sync_status)
               WHEN 'vencido' THEN 0 WHEN 'a_vencer' THEN 1 WHEN 'pago' THEN 2 ELSE 3 END AS ordem_status
      FROM public.invoices i
      LEFT JOIN public.profiles p ON p.id = i.user_id
      WHERE ($1 IS NULL OR p.assigned_to = $1 OR p.created_by = $1)
        AND ($2 IS NULL OR COALESCE(i.created_at::date, i.due_date) >= $2)
        AND ($3 IS NULL OR COALESCE(i.created_at::date, i.due_date) <= $3)
        AND (
          $4 IS NULL OR $4 = '' OR
          public.nome_ordenavel(p.full_name) LIKE '%%' || public.nome_ordenavel($4) || '%%' OR
          lower(COALESCE(p.email, '')) LIKE '%%' || lower($4) || '%%' OR
          public.nome_ordenavel(i.description) LIKE '%%' || public.nome_ordenavel($4) || '%%' OR
          lower(COALESCE(i.asaas_invoice_id, '')) LIKE '%%' || lower($4) || '%%' OR
          (
            regexp_replace($4, '[^0-9]', '', 'g') <> '' AND
            regexp_replace(COALESCE(p.cpf_cnpj, ''), '[^0-9]', '', 'g') LIKE '%%' || regexp_replace($4, '[^0-9]', '', 'g') || '%%'
          )
        )
    ), f AS (
      SELECT * FROM base WHERE $5 = 'all' OR classificacao = $5
    )
    SELECT f.id, f.description, f.amount, f.due_date, f.status, f.classificacao, f.payment_date, f.user_id,
           f.invoice_url, f.pix_code, f.payment_method, f.created_at, f.sync_status, f.origem,
           f.asaas_invoice_id, f.cliente_nome, f.cliente_email, count(*) OVER() AS total_count
    FROM f
    ORDER BY %s
    LIMIT $6 OFFSET $7
  $q$, v_order);

  RETURN QUERY EXECUTE v_sql
    USING p_owner, p_from, p_to, p_search, COALESCE(p_status, 'all'),
          GREATEST(COALESCE(p_limit, 50), 1), GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

-- 4) Totais completos dos cartões
CREATE OR REPLACE FUNCTION public.admin_invoices_totals(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_owner uuid DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v json;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;

  WITH base AS (
    SELECT i.amount,
           public.classificar_cobranca(i.status, i.due_date, i.sync_status) AS c
    FROM public.invoices i
    LEFT JOIN public.profiles p ON p.id = i.user_id
    WHERE (p_owner IS NULL OR p.assigned_to = p_owner OR p.created_by = p_owner)
      AND (p_from IS NULL OR COALESCE(i.created_at::date, i.due_date) >= p_from)
      AND (p_to IS NULL OR COALESCE(i.created_at::date, i.due_date) <= p_to)
  )
  SELECT json_build_object(
    'pago', COALESCE(SUM(amount) FILTER (WHERE c = 'pago'), 0),
    'count_pago', COUNT(*) FILTER (WHERE c = 'pago'),
    'a_vencer', COALESCE(SUM(amount) FILTER (WHERE c = 'a_vencer'), 0),
    'count_a_vencer', COUNT(*) FILTER (WHERE c = 'a_vencer'),
    'vencido', COALESCE(SUM(amount) FILTER (WHERE c = 'vencido'), 0),
    'count_vencido', COUNT(*) FILTER (WHERE c = 'vencido'),
    'inativo', COALESCE(SUM(amount) FILTER (WHERE c = 'inativo'), 0),
    'count_inativo', COUNT(*) FILTER (WHERE c = 'inativo'),
    'total', COALESCE(SUM(amount) FILTER (WHERE c <> 'inativo'), 0),
    'count_total', COUNT(*) FILTER (WHERE c <> 'inativo')
  ) INTO v FROM base;

  RETURN v;
END;
$$;

-- 5) Índices de desempenho
CREATE INDEX IF NOT EXISTS idx_invoices_asaas_invoice_id ON public.invoices (asaas_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices (user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_sync_status ON public.invoices (sync_status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices (due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices (created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_asaas_customer_id ON public.profiles (asaas_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_cpf_cnpj_digits ON public.profiles ((regexp_replace(COALESCE(cpf_cnpj, ''), '[^0-9]', '', 'g')));
CREATE INDEX IF NOT EXISTS idx_profiles_nome_ordenavel ON public.profiles (public.nome_ordenavel(full_name));;

-- END MIGRATION 20260915134402

-- BEGIN MIGRATION 20260915134433 20260915134433_52975fa3-90d3-4ecc-a1a6-d43a67b0e14e.sql sha256=01192c79d0badc0a1410adc0a9cec1b34de071fe6def57ae2ac8bf3a83348289
CREATE OR REPLACE FUNCTION public.nome_ordenavel(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT lower(btrim(translate(COALESCE(p, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')));
$$;

REVOKE ALL ON FUNCTION public.admin_invoices_list(text, text, date, date, uuid, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_in
