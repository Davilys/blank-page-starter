-- PREVIEW-ONLY: external schedules/production routes removed.
-- Canonical WebMarcas remote migration replay
-- Generated from the 93 migrations captured read-only on 2026-09-21.
-- This file is for ephemeral PostgreSQL validation only. Never apply to production.

-- BEGIN MIGRATION 20260326202928 20260326202928_.sql sha256=e9fe29df3cefd98cafd5b468acafeba1b39d0bc52cb43e97a816cf9f8a5e63ea
CREATE POLICY "Admins can insert profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));;

-- END MIGRATION 20260326202928

-- BEGIN MIGRATION 20260327144218 20260327144218_.sql sha256=c0430209dc085441991e54530ea4461ed9ce07e9ddb325d6427f6fc1aab950e0
INSERT INTO public.user_roles (user_id, role) VALUES ('3936b155-c42d-4508-81df-76842b4896eb', 'admin') ON CONFLICT (user_id, role) DO NOTHING;;

-- END MIGRATION 20260327144218

-- BEGIN MIGRATION 20260331204303 20260331204303_.sql sha256=73b234fa9a197cdfb8fc5dbb888badea00c3ae4f77ca69169b0f46e7251bd7d6
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS suggested_classes jsonb DEFAULT NULL;;

-- END MIGRATION 20260331204303

-- BEGIN MIGRATION 20260403123021 20260403123021_.sql sha256=7ce46dd8a5594015a71fb53cdabc46d5645c4f97f2c67a875775c5cf290bfef9

-- Fix client_remarketing_queue: drop both old policies, recreate correctly
DROP POLICY IF EXISTS "Service can manage client remarketing queue" ON public.client_remarketing_queue;
DROP POLICY IF EXISTS "Admins can manage client remarketing queue" ON public.client_remarketing_queue;
CREATE POLICY "Admins can manage client remarketing queue"
  ON public.client_remarketing_queue FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix lead_remarketing_queue
DROP POLICY IF EXISTS "Service can manage remarketing queue" ON public.lead_remarketing_queue;
DROP POLICY IF EXISTS "Admins can manage remarketing queue" ON public.lead_remarketing_queue;
DROP POLICY IF EXISTS "Admins can manage lead remarketing queue" ON public.lead_remarketing_queue;
CREATE POLICY "Admins can manage lead remarketing queue"
  ON public.lead_remarketing_queue FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix upsell_engine_weights
DROP POLICY IF EXISTS "Service can manage engine weights" ON public.upsell_engine_weights;
DROP POLICY IF EXISTS "Admins can manage engine weights" ON public.upsell_engine_weights;
CREATE POLICY "Admins can manage engine weights"
  ON public.upsell_engine_weights FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
;

-- END MIGRATION 20260403123021

-- BEGIN MIGRATION 20260403123158 20260403123158_.sql sha256=1048afad85e61b84c9fcf1946b5542f3cb357e3d2be8c2296a97ddca7d35176b

-- ai_usage_logs
DROP POLICY IF EXISTS "Service can insert ai_usage_logs" ON public.ai_usage_logs;
CREATE POLICY "Authenticated can insert ai_usage_logs"
  ON public.ai_usage_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- inpi_knowledge_base
DROP POLICY IF EXISTS "Service role can insert inpi knowledge" ON public.inpi_knowledge_base;
CREATE POLICY "Admins can insert inpi knowledge"
  ON public.inpi_knowledge_base FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Service role can update inpi knowledge" ON public.inpi_knowledge_base;
CREATE POLICY "Admins can update inpi knowledge"
  ON public.inpi_knowledge_base FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- inpi_sync_logs
DROP POLICY IF EXISTS "Service role can manage sync logs" ON public.inpi_sync_logs;
CREATE POLICY "Admins can manage sync logs"
  ON public.inpi_sync_logs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- intelligence_process_history
DROP POLICY IF EXISTS "Service can insert intelligence history" ON public.intelligence_process_history;
CREATE POLICY "Admins can insert intelligence history"
  ON public.intelligence_process_history FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Service can update intelligence history" ON public.intelligence_process_history;
CREATE POLICY "Admins can update intelligence history"
  ON public.intelligence_process_history FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- notification_dispatch_logs
DROP POLICY IF EXISTS "Service can insert dispatch logs" ON public.notification_dispatch_logs;
CREATE POLICY "Admins can insert dispatch logs"
  ON public.notification_dispatch_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- promotion_expiration_logs
DROP POLICY IF EXISTS "Service can insert promotion logs" ON public.promotion_expiration_logs;
CREATE POLICY "Admins can insert promotion logs"
  ON public.promotion_expiration_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- upsell_monetization_logs
DROP POLICY IF EXISTS "Service can insert upsell logs" ON public.upsell_monetization_logs;
CREATE POLICY "Admins can insert upsell logs"
  ON public.upsell_monetization_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- marketing_attribution: keep for authenticated users (tracking)
DROP POLICY IF EXISTS "Public can insert marketing_attribution" ON public.marketing_attribution;
CREATE POLICY "Authenticated can insert marketing_attribution"
  ON public.marketing_attribution FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- viability_searches: remove duplicate public policy
DROP POLICY IF EXISTS "Anyone can insert viability search" ON public.viability_searches;
;

-- END MIGRATION 20260403123158

-- BEGIN MIGRATION 20260403123303 20260403123303_.sql sha256=bd5ff74e81d3de06f2d22c4203c4da9d1ac28aaa417047f459831dd6901dbf65

-- Remove old duplicate policies that survived the partial first migration
DROP POLICY IF EXISTS "Service role can insert inpi knowledge" ON public.inpi_knowledge_base;
DROP POLICY IF EXISTS "Service role can update inpi knowledge" ON public.inpi_knowledge_base;
DROP POLICY IF EXISTS "Service role can manage sync logs" ON public.inpi_sync_logs;
DROP POLICY IF EXISTS "Service can insert ai_usage_logs" ON public.ai_usage_logs;

-- Also drop the contracts public verify policy (it was created in first partial migration)
DROP POLICY IF EXISTS "Public can verify contracts by hash" ON public.contracts;
;

-- END MIGRATION 20260403123303

-- BEGIN MIGRATION 20260403123404 20260403123404_.sql sha256=3f14d8319cf0c839a9abaaa30c876b2405dc15ed7dae7ae84e4fe3c3cf20c3b5

-- Enable RLS on inpiknowledgebase (failed in partial first migration)
ALTER TABLE public.inpiknowledgebase ENABLE ROW LEVEL SECURITY;

-- Add policies for inpiknowledgebase
CREATE POLICY "Authenticated can read inpiknowledgebase"
  ON public.inpiknowledgebase FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage inpiknowledgebase"
  ON public.inpiknowledgebase FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix viability_searches: restrict to authenticated only (not anon)
DROP POLICY IF EXISTS "Anyone can insert viability searches" ON public.viability_searches;
CREATE POLICY "Authenticated can insert viability searches"
  ON public.viability_searches FOR INSERT
  TO authenticated
  WITH CHECK (true);
;

-- END MIGRATION 20260403123404

-- BEGIN MIGRATION 20260414182358 20260414182358_.sql sha256=69f9bba9572f48aacc70daac26b406d7ce732a5c89853905ccea876eda7e9e1f
ALTER TABLE public.admin_permissions ALTER COLUMN id SET DEFAULT gen_random_uuid();;

-- END MIGRATION 20260414182358

-- BEGIN MIGRATION 20260428051200 20260428051200_.sql sha256=bab2d128ed7d6822cd6831ffa27b515fdfc446229d0a0602c375032aa3572fb1
-- 1. Coluna plan_type
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS plan_type TEXT
  CHECK (plan_type IN ('essencial','premium','corporativo'));

-- 2. Backfill heurístico
UPDATE public.contracts
SET plan_type = CASE
  WHEN payment_method ILIKE '%avista%' OR payment_method ILIKE '%pix%' THEN 'essencial'
  WHEN contract_value IS NOT NULL AND contract_value BETWEEN 600 AND 800 THEN 'essencial'
  WHEN contract_value IS NOT NULL AND contract_value BETWEEN 350 AND 450 THEN 'premium'
  WHEN contract_value IS NOT NULL AND contract_value BETWEEN 1500 AND 1800 THEN 'corporativo'
  WHEN contract_value IS NOT NULL AND contract_value BETWEEN 1100 AND 1300 THEN 'essencial' -- cartão 6x ~1194
  ELSE NULL
END
WHERE plan_type IS NULL;

-- 3. Índice
CREATE INDEX IF NOT EXISTS idx_contracts_plan_type ON public.contracts(plan_type);
CREATE INDEX IF NOT EXISTS idx_contracts_user_plan ON public.contracts(user_id, plan_type);;

-- END MIGRATION 20260428051200

-- BEGIN MIGRATION 20260429150604 20260429150604_.sql sha256=8b3ae15cba943e7dd0889bc8b7c325ec9cf39f7dc63d95643156f7c203553868
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_document_type_check;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_document_type_check
  CHECK (document_type = ANY (ARRAY[
    'contract'::text,
    'signed_contract'::text,
    'contrato'::text,
    'anexo'::text,
    'outro'::text,
    'procuracao'::text,
    'invoice'::text,
    'receipt'::text,
    'identity'::text,
    'power_of_attorney'::text,
    'other'::text,
    'distrato'::text,
    'distrato_multa'::text,
    'distrato_sem_multa'::text
  ]));;

-- END MIGRATION 20260429150604

-- BEGIN MIGRATION 20260429150737 20260429150737_.sql sha256=3fc8112cf96511768353a25f75521a7fb42d38920f20780bf87d8c93c90cb156
WITH signed_contracts AS (
  SELECT c.id AS contract_id, c.user_id, c.process_id, c.document_type, c.subject
  FROM public.contracts c
  WHERE c.signature_status = 'signed'
),
missing AS (
  SELECT sc.*
  FROM signed_contracts sc
  LEFT JOIN public.documents d
    ON d.contract_id = sc.contract_id
   AND d.document_type IN ('contrato','distrato','distrato_multa','distrato_sem_multa','procuracao','contract')
  WHERE d.id IS NULL
),
latest_pdf AS (
  SELECT m.contract_id, m.user_id, m.process_id, m.document_type, m.subject,
         o.name AS storage_name,
         (o.metadata->>'size')::bigint AS storage_size
  FROM missing m
  JOIN LATERAL (
    SELECT name, metadata, created_at
    FROM storage.objects
    WHERE bucket_id = 'documents'
      AND name LIKE ('signed-contracts/' || m.contract_id || '/%')
    ORDER BY created_at DESC
    LIMIT 1
  ) o ON true
)
INSERT INTO public.documents (
  name, document_type, file_url, file_size, mime_type,
  user_id, process_id, contract_id, uploaded_by
)
SELECT
  COALESCE(lp.subject, 'Documento Assinado'),
  CASE
    WHEN lower(COALESCE(lp.document_type,'')) = 'contract' THEN 'contrato'
    WHEN lower(COALESCE(lp.document_type,'')) IN ('contrato','procuracao','distrato','distrato_multa','distrato_sem_multa')
      THEN lower(lp.document_type)
    ELSE 'contrato'
  END,
  'preview-disabled://documents/' || lp.storage_name,
  lp.storage_size,
  'application/pdf',
  lp.user_id,
  lp.process_id,
  lp.contract_id,
  'system-backfill'
FROM latest_pdf lp;;

-- END MIGRATION 20260429150737

-- BEGIN MIGRATION 20260429155549 20260429155549_.sql sha256=f6d7c9f1c43d781f609671d9db4995612690ddfbad1e9d623543d2a7a46b5d81
-- Backfill plan_type by template (most reliable)
UPDATE public.contracts SET plan_type = 'essencial'
WHERE plan_type IS NULL
  AND template_id IN (
    SELECT id FROM public.contract_templates
    WHERE LOWER(name) LIKE '%padrão%registro de marca%'
       OR LOWER(name) LIKE '%padrao%registro de marca%'
  );

UPDATE public.contracts SET plan_type = 'premium'
WHERE plan_type IS NULL
  AND template_id IN (
    SELECT id FROM public.contract_templates
    WHERE LOWER(name) LIKE '%premium%registro de marca%'
  );

UPDATE public.contracts SET plan_type = 'corporativo'
WHERE plan_type IS NULL
  AND template_id IN (
    SELECT id FROM public.contract_templates
    WHERE LOWER(name) LIKE '%corporativo%registro de marca%'
  );

-- Fallback by exact value for contracts without template_id
UPDATE public.contracts SET plan_type = 'essencial'
WHERE plan_type IS NULL AND template_id IS NULL AND contract_value IN (699, 698.97);

UPDATE public.contracts SET plan_type = 'premium'
WHERE plan_type IS NULL AND template_id IS NULL AND contract_value = 398;

UPDATE public.contracts SET plan_type = 'corporativo'
WHERE plan_type IS NULL AND template_id IS NULL AND contract_value = 1621;;

-- END MIGRATION 20260429155549

-- BEGIN MIGRATION 20260430195258 20260430195258_.sql sha256=ab441c8f2a23955fa27692f184a28dc119f915b1fa7dc092078b4f16afa5d781
ALTER TABLE public.award_entries
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'essencial'
  CHECK (plan IN ('essencial','premium','corporativo'));;

-- END MIGRATION 20260430195258

-- BEGIN MIGRATION 20260502182453 20260502182453_.sql sha256=12726d41a8f2918f79e83006b51d77062d798acf556588317f1b2d4aecdbe87e

-- Bucket privado para upload do dump Perfex (ZIP/SQL) + NDJSON gerados
INSERT INTO storage.buckets (id, name, public)
VALUES ('perfex-import', 'perfex-import', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Master can read perfex-import" ON storage.objects;
CREATE POLICY "Master can read perfex-import"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'perfex-import' AND EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'davillys@gmail.com'));

DROP POLICY IF EXISTS "Master can upload perfex-import" ON storage.objects;
CREATE POLICY "Master can upload perfex-import"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'perfex-import' AND EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'davillys@gmail.com'));

DROP POLICY IF EXISTS "Master can update perfex-import" ON storage.objects;
CREATE POLICY "Master can update perfex-import"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'perfex-import' AND EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'davillys@gmail.com'));

DROP POLICY IF EXISTS "Master can delete perfex-import" ON storage.objects;
CREATE POLICY "Master can delete perfex-import"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'perfex-import' AND EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'davillys@gmail.com'));

-- Garantir RPC auxiliar (idempotente)
CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(lookup_email text)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM auth.users WHERE email = lower(trim(lookup_email)) LIMIT 1;
$$;
;

-- END MIGRATION 20260502182453

-- BEGIN MIGRATION 20260503201743 20260503201743_.sql sha256=3d1920e3df36a798b9e2f3a0226fc0caad6544c614f4afe541a26a1ce004bbd3
-- Enable extensions for cron sync
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Track last synced UID per (account, folder) for incremental IMAP sync
CREATE TABLE IF NOT EXISTS public.email_sync_state (
  account_id uuid NOT NULL,
  folder text NOT NULL,
  last_uid bigint NOT NULL DEFAULT 0,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, folder)
);

ALTER TABLE public.email_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage email_sync_state" ON public.email_sync_state;
CREATE POLICY "Admins manage email_sync_state"
ON public.email_sync_state FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Realtime: enable changes streaming on email_inbox.
ALTER TABLE public.email_inbox REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'email_inbox'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.email_inbox';
  END IF;
END$$;

-- PREVIEW-SANITIZED: cron-sync-all-emails not scheduled; no outbound route.

-- END MIGRATION 20260503201743

-- BEGIN MIGRATION 20260504234900 20260504234900_.sql sha256=60c6df29e944824659f8ec6372959af4483451e032eba511e7caf15d5ccd5559
DROP POLICY IF EXISTS "Admins full access documents bucket" ON storage.objects;

CREATE POLICY "Admins full access documents bucket"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);;

-- END MIGRATION 20260504234900

-- BEGIN MIGRATION 20260505172037 20260505172037_.sql sha256=28ae11bbec51d55df115f88af741d2f8604f78c9298be8b2cda098059f4e3595

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
;

-- END MIGRATION 20260505172037

-- BEGIN MIGRATION 20260505211447 20260505211447_.sql sha256=0e4f0d1c14cf63d0f1cf2440155e6d0eea6a638bbc0f7c80493df5898e71dd78
INSERT INTO public.email_accounts (user_id, provider, email_address, display_name, is_default)
SELECT 'e42ee787-e405-4be4-8f86-f1b4596243fb'::uuid, 'smtp', 'noreply@webmarcas.net', 'WebMarcas (Notificações)', false
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_accounts WHERE email_address = 'noreply@webmarcas.net'
);;

-- END MIGRATION 20260505211447

-- BEGIN MIGRATION 20260505224835 20260505224835_.sql sha256=077a8379a0cd1353d3ec7055711cb9d224cf60bbb36ec3aed78ce8594d73fff1

CREATE TABLE IF NOT EXISTS public.email_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'onboarding',
  trigger_event text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  trigger_count integer NOT NULL DEFAULT 0,
  success_rate integer NOT NULL DEFAULT 0,
  last_triggered_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_automations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage email automations" ON public.email_automations;
CREATE POLICY "Admins manage email automations"
ON public.email_automations
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS email_automations_updated_at ON public.email_automations;
CREATE TRIGGER email_automations_updated_at
BEFORE UPDATE ON public.email_automations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.email_automations (name, description, category, trigger_event, steps, is_active, trigger_count, success_rate)
SELECT 'Cobrança Automática', 'Lembrete de cobrança para faturas próximas do vencimento', 'financeiro', 'invoice_due_soon',
  '[{"type":"trigger","label":"Fatura Vencendo (3 dias)","detail":"invoice_due_soon"},{"type":"action","label":"Email: Lembrete de Pagamento","detail":"Cobrança Amigável"}]'::jsonb,
  false, 89, 71
WHERE NOT EXISTS (SELECT 1 FROM public.email_automations);
;

-- END MIGRATION 20260505224835

-- BEGIN MIGRATION 20260505225451 20260505225451_.sql sha256=7914a02477a75d9c153a17948b1d089fc309976ee6d8c710aa693b7b862b21fe

INSERT INTO public.email_automations (name, description, category, trigger_event, steps, is_active, trigger_count, success_rate)
VALUES
('Onboarding Automático',
 'Sequência completa de boas-vindas após assinatura de contrato',
 'onboarding', 'contract_signed',
 '[
   {"type":"action","action":"send_email","label":"Email: Boas-vindas","detail":"Template: Bem-vindo à WebMarcas"},
   {"type":"delay","action":"wait","label":"Aguardar 2 dias","detail":"2 dias"},
   {"type":"action","action":"send_email","label":"Email: Tutorial Portal","detail":"Template: Como acompanhar"}
 ]'::jsonb,
 true, 48, 94),
('Recuperação de Leads',
 'Reengajar leads que não converteram após 24h do formulário',
 'leads', 'form_abandoned',
 '[
   {"type":"condition","action":"check_condition","label":"SE: email_opt_out = false","detail":"Verificar consentimento LGPD"},
   {"type":"action","action":"send_email","label":"Email: Follow-up Personalizado","detail":"Template: Seguimento Lead"}
 ]'::jsonb,
 true, 124, 38),
('Alerta Exigência INPI',
 'Notificar cliente automaticamente quando INPI publica exigência',
 'juridico', 'inpi_status_change',
 '[
   {"type":"condition","action":"check_condition","label":"SE: Status = Exigência","detail":"Verificar tipo publicação RPI"},
   {"type":"action","action":"send_email","label":"Email: Exigência de Mérito","detail":"Template: Processual"},
   {"type":"action","action":"notify_admin","label":"Notificar Admin","detail":"Push + Email interno"}
 ]'::jsonb,
 true, 31, 97);
;

-- END MIGRATION 20260505225451

-- BEGIN MIGRATION 20260506124736 20260506124736_.sql sha256=09456a31d9dadee9e17b7eee9a8aa8493183cae2473aa2a42d0ece27f2819d47

CREATE OR REPLACE FUNCTION public.only_digits(s text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(COALESCE(s,''), '[^0-9]', '', 'g')
$$;

CREATE OR REPLACE FUNCTION public.resolve_contract_user_id(
  _signatory_name text,
  _signatory_cpf text,
  _signatory_cnpj text
) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cpf text := only_digits(_signatory_cpf);
  v_cnpj text := only_digits(_signatory_cnpj);
  v_id uuid;
  v_count int;
BEGIN
  -- 1) CPF
  IF length(v_cpf) = 11 THEN
    SELECT COUNT(*) INTO v_count FROM profiles
      WHERE only_digits(cpf) = v_cpf OR only_digits(cpf_cnpj) = v_cpf;
    IF v_count = 1 THEN
      SELECT id INTO v_id FROM profiles
        WHERE only_digits(cpf) = v_cpf OR only_digits(cpf_cnpj) = v_cpf
        LIMIT 1;
      RETURN v_id;
    END IF;
  END IF;

  -- 2) CNPJ
  IF length(v_cnpj) = 14 THEN
    SELECT COUNT(*) INTO v_count FROM profiles
      WHERE only_digits(cnpj) = v_cnpj OR only_digits(cpf_cnpj) = v_cnpj;
    IF v_count = 1 THEN
      SELECT id INTO v_id FROM profiles
        WHERE only_digits(cnpj) = v_cnpj OR only_digits(cpf_cnpj) = v_cnpj
        LIMIT 1;
      RETURN v_id;
    END IF;
  END IF;

  -- 3) Nome (case-insensitive, único)
  IF _signatory_name IS NOT NULL AND length(trim(_signatory_name)) >= 3 THEN
    SELECT COUNT(*) INTO v_count FROM profiles
      WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(_signatory_name));
    IF v_count = 1 THEN
      SELECT id INTO v_id FROM profiles
        WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(_signatory_name))
        LIMIT 1;
      RETURN v_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

UPDATE contracts c
SET user_id = public.resolve_contract_user_id(c.signatory_name, c.signatory_cpf, c.signatory_cnpj)
WHERE c.user_id IS NULL
  AND public.resolve_contract_user_id(c.signatory_name, c.signatory_cpf, c.signatory_cnpj) IS NOT NULL;

CREATE OR REPLACE FUNCTION public.contracts_auto_link_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := public.resolve_contract_user_id(NEW.signatory_name, NEW.signatory_cpf, NEW.signatory_cnpj);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contracts_auto_link_user ON public.contracts;
CREATE TRIGGER trg_contracts_auto_link_user
  BEFORE INSERT OR UPDATE OF signatory_name, signatory_cpf, signatory_cnpj, user_id
  ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.contracts_auto_link_user();
;

-- END MIGRATION 20260506124736

-- BEGIN MIGRATION 20260506155300 20260506155300_.sql sha256=24ce81990ad358eeb3cc48e0e695e256f64a51be6feb91cf598f7abbaefc20df

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
;

-- END MIGRATION 20260506155300

-- BEGIN MIGRATION 20260506162850 20260506162850_.sql sha256=f6d739cd5e00d4773aefe89473ca3f5ef9a66e897d182241bcebaa0b676df71d
-- 1) Marca como 'renegociada' tudo que já foi para renegociacoes (5x) ou negociacoes_devedor tipo 'negociar'
UPDATE public.cobrancas_vencidas cv
SET status = 'renegociada', updated_at = now()
WHERE cv.status = 'pendente_renegociacao'
  AND cv.asaas_payment_id IN (
    SELECT unnest(parcelas_originais_ids) FROM public.renegociacoes
    UNION
    SELECT unnest(parcelas_originais_ids) FROM public.negociacoes_devedor WHERE tipo = 'negociar'
  );

-- 2) Marca como 'cobrada' tudo que entrou em cobrança única
UPDATE public.cobrancas_vencidas cv
SET status = 'cobrada', updated_at = now()
WHERE cv.status = 'pendente_renegociacao'
  AND cv.asaas_payment_id IN (
    SELECT unnest(parcelas_originais_ids) FROM public.negociacoes_devedor WHERE tipo = 'cobrar'
  );;

-- END MIGRATION 20260506162850

-- BEGIN MIGRATION 20260507032051 20260507032051_.sql sha256=5f684877c524234946f24e2847769a5d138cb443e992f4f5dfefe3dbc7d6d50f

-- Fix mojibake in email_inbox: bytes are UTF-8 but were decoded as Latin-1.
-- Re-encode by writing the text bytes as Latin-1 and reading them as UTF-8.
DO $$
DECLARE
  r record;
  fixed_text text;
  fixed_html text;
  fixed_subj text;
  fixed_snippet text;
BEGIN
  FOR r IN SELECT id, body_text, body_html, subject, snippet
           FROM email_inbox
           WHERE body_text ~ '[ÃÂ][\u0080-\u00BF]'
              OR body_html ~ '[ÃÂ][\u0080-\u00BF]'
              OR subject  ~ '[ÃÂ][\u0080-\u00BF]'
              OR snippet  ~ '[ÃÂ][\u0080-\u00BF]'
  LOOP
    BEGIN
      fixed_text := CASE WHEN r.body_text IS NOT NULL
        THEN convert_from(convert_to(r.body_text, 'LATIN1'), 'UTF8') ELSE NULL END;
    EXCEPTION WHEN others THEN fixed_text := r.body_text; END;
    BEGIN
      fixed_html := CASE WHEN r.body_html IS NOT NULL
        THEN convert_from(convert_to(r.body_html, 'LATIN1'), 'UTF8') ELSE NULL END;
    EXCEPTION WHEN others THEN fixed_html := r.body_html; END;
    BEGIN
      fixed_subj := CASE WHEN r.subject IS NOT NULL
        THEN convert_from(convert_to(r.subject, 'LATIN1'), 'UTF8') ELSE NULL END;
    EXCEPTION WHEN others THEN fixed_subj := r.subject; END;
    BEGIN
      fixed_snippet := CASE WHEN r.snippet IS NOT NULL
        THEN convert_from(convert_to(r.snippet, 'LATIN1'), 'UTF8') ELSE NULL END;
    EXCEPTION WHEN others THEN fixed_snippet := r.snippet; END;

    UPDATE email_inbox
       SET body_text = fixed_text,
           body_html = fixed_html,
           subject   = fixed_subj,
           snippet   = fixed_snippet
     WHERE id = r.id;
  END LOOP;
END $$;
;

-- END MIGRATION 20260507032051

-- BEGIN MIGRATION 20260507113533 20260507113533_.sql sha256=3e432ade482ec761202e0db10acaafad6541d8cf30c73db93949c95c1897a433
CREATE TABLE IF NOT EXISTS public.cobranca_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id UUID,
  cliente_nome TEXT,
  cliente_email TEXT,
  cliente_phone TEXT,
  enviada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  canais TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'enviada',
  proxima_acao_em TIMESTAMPTZ,
  message_whatsapp TEXT,
  message_email_html TEXT,
  message_email_subject TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cobranca_historico_invoice ON public.cobranca_historico(invoice_id);
CREATE INDEX IF NOT EXISTS idx_cobranca_historico_status ON public.cobranca_historico(status);
CREATE INDEX IF NOT EXISTS idx_cobranca_historico_enviada_em ON public.cobranca_historico(enviada_em DESC);

ALTER TABLE public.cobranca_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cobranca_historico"
  ON public.cobranca_historico
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_cobranca_historico_updated_at
  BEFORE UPDATE ON public.cobranca_historico
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: when invoice is paid, mark related cobrancas as confirmada_paga
CREATE OR REPLACE FUNCTION public.mark_cobranca_paid_on_invoice_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('paid','confirmed','received','RECEIVED','CONFIRMED')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('paid','confirmed','received','RECEIVED','CONFIRMED')) THEN
    UPDATE public.cobranca_historico
    SET status = 'confirmada_paga', updated_at = now()
    WHERE invoice_id = NEW.id
      AND status <> 'confirmada_paga';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_cobranca_paid ON public.invoices;
CREATE TRIGGER trg_mark_cobranca_paid
  AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_cobranca_paid_on_invoice_paid();

-- Function to mark cobrancas as reentrada_fila after 7 days without payment
CREATE OR REPLACE FUNCTION public.recheck_cobranca_reentry()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER := 0;
BEGIN
  UPDATE public.cobranca_historico
  SET status = 'reentrada_fila', updated_at = now()
  WHERE status = 'enviada'
    AND proxima_acao_em IS NOT NULL
    AND proxima_acao_em < now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;;

-- END MIGRATION 20260507113533

-- BEGIN MIGRATION 20260507113910 20260507113910_.sql sha256=a701f6773c6faad55edb588c1f72a1906427d1b8cb4f50eb137f5483cecacdef
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- PREVIEW-SANITIZED: Asaas/email cron jobs not scheduled; no outbound route.

-- END MIGRATION 20260507113910

-- BEGIN MIGRATION 20260507154227 20260507154227_.sql sha256=2f78c0e1e0172380f8343d3af9bb94a8ee47a044d92ca64b7f18d6cf10ff9b99

-- Trigger: ao definir/alterar contracts.user_id, propaga para documents e invoices vinculados ao contrato
CREATE OR REPLACE FUNCTION public.propagate_contract_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    UPDATE public.documents SET user_id = NEW.user_id
      WHERE contract_id = NEW.id AND (user_id IS DISTINCT FROM NEW.user_id);
    UPDATE public.invoices SET user_id = NEW.user_id
      WHERE contract_id = NEW.id AND (user_id IS DISTINCT FROM NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_contract_user_id ON public.contracts;
CREATE TRIGGER trg_propagate_contract_user_id
  AFTER UPDATE OF user_id ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.propagate_contract_user_id();

-- Backfill: corrige documentos/faturas que já estão com contract_id mas sem user_id
UPDATE public.documents d
SET user_id = c.user_id
FROM public.contracts c
WHERE d.contract_id = c.id
  AND c.user_id IS NOT NULL
  AND (d.user_id IS NULL OR d.user_id IS DISTINCT FROM c.user_id);

UPDATE public.invoices i
SET user_id = c.user_id
FROM public.contracts c
WHERE i.contract_id = c.id
  AND c.user_id IS NOT NULL
  AND (i.user_id IS NULL OR i.user_id IS DISTINCT FROM c.user_id);
;

-- END MIGRATION 20260507154227

-- BEGIN MIGRATION 20260513142936 20260513142936_.sql sha256=aa4e86364d88e73cb233d4bb56def945179493a5990099b73fe07623f8d7f300
ALTER TABLE public.brand_processes DROP CONSTRAINT IF EXISTS brand_processes_status_check;
ALTER TABLE public.brand_processes ADD CONSTRAINT brand_processes_pipeline_stage_format_check CHECK (pipeline_stage IS NULL OR pipeline_stage ~ '^[a-z0-9_]+$');;

-- END MIGRATION 20260513142936

-- BEGIN MIGRATION 20260513160028 20260513160028_.sql sha256=11e16da9485fccd2a619a3e0bd99e223778d94bb8ffa116c256ed2f09636df55

WITH ranked AS (
  SELECT id, rpi_number,
    ROW_NUMBER() OVER (
      PARTITION BY rpi_number
      ORDER BY (CASE WHEN status = 'completed' THEN 0 ELSE 1 END), created_at DESC
    ) AS rn
  FROM public.rpi_uploads
  WHERE rpi_number IS NOT NULL
),
dups AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM public.rpi_entries WHERE rpi_upload_id IN (SELECT id FROM dups);

WITH ranked AS (
  SELECT id, rpi_number,
    ROW_NUMBER() OVER (
      PARTITION BY rpi_number
      ORDER BY (CASE WHEN status = 'completed' THEN 0 ELSE 1 END), created_at DESC
    ) AS rn
  FROM public.rpi_uploads
  WHERE rpi_number IS NOT NULL
)
DELETE FROM public.rpi_uploads WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
;

-- END MIGRATION 20260513160028

-- BEGIN MIGRATION 20260513210305 20260513210305_.sql sha256=f86d281414dffecdefdfe3ba9ee7f2bf9df503489d65b72e5df879340b176735
CREATE POLICY "Public can read active contract templates"
ON public.contract_templates
FOR SELECT
TO anon, authenticated
USING (is_active = true);;

-- END MIGRATION 20260513210305

-- BEGIN MIGRATION 20260516163730 20260516163730_.sql sha256=875087b42b39fdbedef24d13f0bd80ad93091e40bee501eda6456a4ac3e1346f
ALTER TABLE public.email_inbox ADD COLUMN IF NOT EXISTS is_alias BOOLEAN DEFAULT false;
ALTER TABLE public.email_sync_state
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS consecutive_errors INTEGER DEFAULT 0;;

-- END MIGRATION 20260516163730

-- BEGIN MIGRATION 20260516182503 20260516182503_.sql sha256=c6521beb7b83ffb4ab7be34c65a9b0d3cb6b158240f68b1b8981b2c9d915effe
-- Remove emails corrompidos (cabeçalhos DKIM/MIME interpretados como assunto)
-- e reseta o watermark IMAP das pastas afetadas para reimportar corretamente.

WITH corrupted AS (
  SELECT DISTINCT account_id, folder, MIN(imap_uid) AS min_uid
  FROM public.email_inbox
  WHERE subject ~* '^(date:|mime-version|subject:|to:|cc:|from:|message-id:|references:|reply-to:|content-type:|b=|bh=|h=)'
  GROUP BY account_id, folder
)
UPDATE public.email_sync_state s
SET last_uid = GREATEST(0, COALESCE(c.min_uid, 1) - 1),
    last_error = NULL,
    consecutive_errors = 0
FROM corrupted c
WHERE s.account_id = c.account_id AND s.folder = c.folder;

DELETE FROM public.email_inbox
WHERE subject ~* '^(date:|mime-version|subject:|to:|cc:|from:|message-id:|references:|reply-to:|content-type:|b=|bh=|h=)';;

-- END MIGRATION 20260516182503

-- BEGIN MIGRATION 20260522141221 20260522141221_.sql sha256=deb9ffe4042eecef010218739c3ccaadb14ad2474d9186c7a1c97e9930779a2b
DELETE FROM public.admin_permissions WHERE user_id = '14aef7b6-4455-49ab-9264-6e7015dab05d';
DELETE FROM public.user_roles WHERE user_id = '14aef7b6-4455-49ab-9264-6e7015dab05d';
DELETE FROM public.profiles WHERE id = '14aef7b6-4455-49ab-9264-6e7015dab05d';
DELETE FROM auth.users WHERE id = '14aef7b6-4455-49ab-9264-6e7015dab05d';;

-- END MIGRATION 20260522141221

-- BEGIN MIGRATION 20260530163359 20260530163359_.sql sha256=450989f6f1f8f7e67db8751946f53b6c8252bb6f5f611f63d1e389d417387382
UPDATE public.system_settings
SET value = jsonb_set(
  jsonb_set(
    value::jsonb,
    '{publicacao,milestone_enabled}',
    'false'::jsonb,
    true
  ),
  '{cobranca,milestone_enabled}',
  'false'::jsonb,
  true
)
WHERE key = 'award_config'
  AND (
    NOT (value::jsonb -> 'publicacao' ? 'milestone_enabled')
    OR NOT (value::jsonb -> 'cobranca' ? 'milestone_enabled')
  );;

-- END MIGRATION 20260530163359

-- BEGIN MIGRATION 20260610162901 20260610162901_.sql sha256=d1165cfb50dafafb6bc2d3c25c50c94223620638351eccb4fffa0cb48a55f770
ALTER TABLE public.publicacoes_marcas
  ADD COLUMN IF NOT EXISTS cumprimento_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cumprimento_at timestamptz,
  ADD COLUMN IF NOT EXISTS cumprimento_by uuid;

CREATE INDEX IF NOT EXISTS idx_publicacoes_marcas_prazo
  ON public.publicacoes_marcas (cumprimento_ok, proximo_prazo_critico);;

-- END MIGRATION 20260610162901

-- BEGIN MIGRATION 20260610164001 20260610164001_.sql sha256=da5cababbc4eae601d4054619a2ba6571cb3d6e0b16320aaf5ec064d399e8b54

CREATE TABLE IF NOT EXISTS public.publicacao_cobranca_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publicacao_id uuid NOT NULL UNIQUE REFERENCES public.publicacoes_marcas(id) ON DELETE CASCADE,
  client_id uuid,
  data_inicio date NOT NULL DEFAULT (now()::date),
  notif_1_at timestamptz,
  notif_2_at timestamptz,
  notif_3_at timestamptz,
  notif_1_channel text,
  notif_2_channel text,
  notif_3_channel text,
  status text NOT NULL DEFAULT 'ativo',
  client_responded_at timestamptz,
  responsavel_admin_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.publicacao_cobranca_schedule TO authenticated;
GRANT ALL ON public.publicacao_cobranca_schedule TO service_role;

ALTER TABLE public.publicacao_cobranca_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cobranca schedule"
  ON public.publicacao_cobranca_schedule
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients read own schedule"
  ON public.publicacao_cobranca_schedule
  FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_pcs_status_data ON public.publicacao_cobranca_schedule (status, data_inicio);
CREATE INDEX IF NOT EXISTS idx_pcs_client ON public.publicacao_cobranca_schedule (client_id);

CREATE TRIGGER update_pcs_updated_at
  BEFORE UPDATE ON public.publicacao_cobranca_schedule
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: pause schedule when client sends a chat message
CREATE OR REPLACE FUNCTION public.pause_cobranca_on_client_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS
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
GRANT EXECUTE ON FUNCTION public.admin_invoices_list(text, text, date, date, uuid, text, text, integer, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_invoices_totals(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_invoices_totals(date, date, uuid) TO authenticated, service_role;;

-- END MIGRATION 20260915134433

-- BEGIN MIGRATION 20260915134613 20260915134613_ceb0e543-d647-496a-88e5-e4b0986d2a68.sql sha256=e0309a62cc5619a9299d9c511e448302c30d4b813663199044041ff1306f68c1
CREATE OR REPLACE FUNCTION public.profiles_by_doc_digits(p_doc text)
RETURNS TABLE(id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id FROM public.profiles p
  WHERE regexp_replace(COALESCE(p.cpf_cnpj, ''), '[^0-9]', '', 'g') = regexp_replace(COALESCE(p_doc, ''), '[^0-9]', '', 'g')
    AND regexp_replace(COALESCE(p_doc, ''), '[^0-9]', '', 'g') <> ''
  LIMIT 5;
$$;

REVOKE ALL ON FUNCTION public.profiles_by_doc_digits(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profiles_by_doc_digits(text) TO service_role;;

-- END MIGRATION 20260915134613

-- BEGIN MIGRATION 20260915142432 20260915142432_03f5f337-9a71-4dc3-a223-2a9e0f401fc3.sql sha256=291d8d35f0424ec58eeebb63e91e73409a31761cba0e703899879ff1187b4225
CREATE OR REPLACE FUNCTION public.classificar_situacao_cobranca(
  p_status text,
  p_due_date date,
  p_sync_status text
) RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(lower(trim(p_sync_status)), 'ativa') <> 'ativa' THEN NULL
    WHEN lower(trim(COALESCE(p_status, ''))) IN (
      'canceled','cancelled','deleted','removida_asaas','refunded','refund_requested',
      'refund_in_progress','chargeback','chargeback_requested','chargeback_dispute',
      'awaiting_chargeback_reversal'
    ) THEN NULL
    WHEN lower(trim(COALESCE(p_status, ''))) = 'confirmed' THEN 'confirmadas'
    WHEN lower(trim(COALESCE(p_status, ''))) IN (
      'received','received_in_cash','dunning_received','paid'
    ) THEN 'recebidas'
    WHEN lower(trim(COALESCE(p_status, ''))) IN ('overdue','dunning_requested')
      OR (p_due_date IS NOT NULL AND p_due_date < CURRENT_DATE) THEN 'vencidas'
    ELSE 'aguardando'
  END
$$;

REVOKE ALL ON FUNCTION public.classificar_situacao_cobranca(text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classificar_situacao_cobranca(text, date, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_billing_situation(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_owner uuid DEFAULT NULL,
  p_account text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_client uuid DEFAULT NULL,
  p_origin text DEFAULT NULL,
  p_due_from date DEFAULT NULL,
  p_due_to date DEFAULT NULL,
  p_payment_from date DEFAULT NULL,
  p_payment_to date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;

  WITH filtered AS (
    SELECT
      i.id,
      i.user_id,
      i.amount,
      i.payment_method,
      i.due_date,
      i.payment_date,
      public.classificar_situacao_cobranca(i.status, i.due_date, i.sync_status) AS situacao,
      CASE
        WHEN public.classificar_situacao_cobranca(i.status, i.due_date, i.sync_status) IN ('recebidas','confirmadas')
          THEN COALESCE(i.payment_date, i.due_date, i.created_at::date)
        ELSE COALESCE(i.due_date, i.created_at::date)
      END AS reference_date
    FROM public.invoices i
    LEFT JOIN public.profiles p ON p.id = i.user_id
    WHERE (p_owner IS NULL OR p.assigned_to = p_owner OR p.created_by = p_owner)
      AND (p_account IS NULL OR p_account = '' OR i.asaas_customer_id = p_account)
      AND (p_payment_method IS NULL OR p_payment_method = '' OR lower(COALESCE(i.payment_method, '')) = lower(p_payment_method))
      AND (p_client IS NULL OR i.user_id = p_client)
      AND (p_origin IS NULL OR p_origin = '' OR lower(COALESCE(i.origem, 'interna')) = lower(p_origin))
      AND (p_due_from IS NULL OR i.due_date >= p_due_from)
      AND (p_due_to IS NULL OR i.due_date <= p_due_to)
      AND (p_payment_from IS NULL OR i.payment_date >= p_payment_from)
      AND (p_payment_to IS NULL OR i.payment_date <= p_payment_to)
  ), valid AS (
    SELECT * FROM filtered
    WHERE situacao IS NOT NULL
      AND (p_from IS NULL OR reference_date >= p_from)
      AND (p_to IS NULL OR reference_date <= p_to)
  ), categories(situacao) AS (
    VALUES ('recebidas'::text), ('confirmadas'), ('aguardando'), ('vencidas')
  ), category_totals AS (
    SELECT
      c.situacao,
      COALESCE(sum(v.amount), 0)::numeric AS gross_amount,
      count(DISTINCT v.user_id)::bigint AS clients_count,
      count(v.id)::bigint AS invoices_count
    FROM categories c
    LEFT JOIN valid v ON v.situacao = c.situacao
    GROUP BY c.situacao
  ), composition AS (
    SELECT situacao,
      jsonb_agg(jsonb_build_object(
        'key', subdivision,
        'label', subdivision_label,
        'amount', amount,
        'count', invoice_count
      ) ORDER BY subdivision_order) AS items
    FROM (
      SELECT situacao,
        CASE
          WHEN situacao IN ('recebidas','confirmadas') THEN COALESCE(NULLIF(lower(payment_method), ''), 'nao_informado')
          WHEN situacao = 'aguardando' THEN CASE
            WHEN due_date = CURRENT_DATE THEN 'vence_hoje'
            WHEN due_date <= CURRENT_DATE + 7 THEN 'proximos_7_dias'
            ELSE 'mais_de_7_dias' END
          ELSE CASE
            WHEN CURRENT_DATE - due_date <= 30 THEN 'ate_30_dias'
            WHEN CURRENT_DATE - due_date <= 60 THEN '31_a_60_dias'
            WHEN CURRENT_DATE - due_date <= 90 THEN '61_a_90_dias'
            ELSE 'mais_de_90_dias' END
        END AS subdivision,
        CASE
          WHEN situacao IN ('recebidas','confirmadas') THEN CASE COALESCE(NULLIF(lower(payment_method), ''), 'nao_informado')
            WHEN 'pix' THEN 'Pix' WHEN 'boleto' THEN 'Boleto' WHEN 'credit_card' THEN 'Cartão'
            WHEN 'cartao' THEN 'Cartão' ELSE 'Não informado' END
          WHEN situacao = 'aguardando' THEN CASE
            WHEN due_date = CURRENT_DATE THEN 'Vence hoje'
            WHEN due_date <= CURRENT_DATE + 7 THEN 'Próximos 7 dias'
            ELSE 'Após 7 dias' END
          ELSE CASE
            WHEN CURRENT_DATE - due_date <= 30 THEN 'Até 30 dias'
            WHEN CURRENT_DATE - due_date <= 60 THEN '31 a 60 dias'
            WHEN CURRENT_DATE - due_date <= 90 THEN '61 a 90 dias'
            ELSE 'Mais de 90 dias' END
        END AS subdivision_label,
        CASE
          WHEN situacao IN ('recebidas','confirmadas') THEN CASE COALESCE(NULLIF(lower(payment_method), ''), 'nao_informado')
            WHEN 'pix' THEN 1 WHEN 'boleto' THEN 2 WHEN 'credit_card' THEN 3 WHEN 'cartao' THEN 3 ELSE 4 END
          WHEN situacao = 'aguardando' THEN CASE WHEN due_date = CURRENT_DATE THEN 1 WHEN due_date <= CURRENT_DATE + 7 THEN 2 ELSE 3 END
          ELSE CASE WHEN CURRENT_DATE - due_date <= 30 THEN 1 WHEN CURRENT_DATE - due_date <= 60 THEN 2 WHEN CURRENT_DATE - due_date <= 90 THEN 3 ELSE 4 END
        END AS subdivision_order,
        sum(amount)::numeric AS amount,
        count(*)::bigint AS invoice_count
      FROM valid
      GROUP BY situacao, subdivision, subdivision_label, subdivision_order
    ) grouped
    GROUP BY situacao
  ), series AS (
    SELECT reference_date AS day,
      sum(amount) FILTER (WHERE situacao = 'recebidas')::numeric AS recebidas,
      sum(amount) FILTER (WHERE situacao = 'confirmadas')::numeric AS confirmadas,
      sum(amount) FILTER (WHERE situacao = 'aguardando')::numeric AS aguardando,
      sum(amount) FILTER (WHERE situacao = 'vencidas')::numeric AS vencidas
    FROM valid
    GROUP BY reference_date
    ORDER BY reference_date
  )
  SELECT jsonb_build_object(
    'total', COALESCE((SELECT sum(gross_amount) FROM category_totals), 0),
    'net_available', false,
    'categories', (SELECT jsonb_object_agg(
      ct.situacao,
      jsonb_build_object(
        'gross_amount', ct.gross_amount,
        'net_amount', NULL,
        'clients_count', ct.clients_count,
        'invoices_count', ct.invoices_count,
        'composition', COALESCE(cp.items, '[]'::jsonb)
      )
    ) FROM category_totals ct LEFT JOIN composition cp USING (situacao)),
    'series', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'date', day,
      'recebidas', COALESCE(recebidas, 0),
      'confirmadas', COALESCE(confirmadas, 0),
      'aguardando', COALESCE(aguardando, 0),
      'vencidas', COALESCE(vencidas, 0)
    ) ORDER BY day) FROM series), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_billing_situation(date, date, uuid, text, text, uuid, text, date, date, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_billing_situation(date, date, uuid, text, text, uuid, text, date, date, date, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_invoices_list_filtered(
  p_search text DEFAULT NULL,
  p_situation text DEFAULT 'all',
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_owner uuid DEFAULT NULL,
  p_sort text DEFAULT 'cliente',
  p_dir text DEFAULT 'asc',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_account text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_client uuid DEFAULT NULL,
  p_origin text DEFAULT NULL,
  p_due_from date DEFAULT NULL,
  p_due_to date DEFAULT NULL,
  p_payment_from date DEFAULT NULL,
  p_payment_to date DEFAULT NULL
) RETURNS TABLE(
  id uuid, description text, amount numeric, due_date date, status text,
  classificacao text, payment_date date, user_id uuid, invoice_url text,
  pix_code text, payment_method text, created_at timestamptz, sync_status text,
  origem text, asaas_invoice_id text, cliente_nome text, cliente_email text,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dir text := CASE WHEN lower(COALESCE(p_dir, 'asc')) = 'desc' THEN 'DESC' ELSE 'ASC' END;
  v_order text;
  v_sql text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;

  v_order := CASE lower(COALESCE(p_sort, 'cliente'))
    WHEN 'descricao' THEN format('public.nome_ordenavel(f.description) %s, f.due_date ASC', v_dir)
    WHEN 'valor' THEN format('f.amount %s, f.nome_ord ASC', v_dir)
    WHEN 'metodo' THEN format('lower(COALESCE(f.payment_method, %L)) %s, f.nome_ord ASC', '', v_dir)
    WHEN 'vencimento' THEN format('f.due_date %s NULLS LAST, f.nome_ord ASC', v_dir)
    WHEN 'status' THEN format('f.classificacao %s, f.due_date ASC', v_dir)
    ELSE format('f.nome_ord %s, f.ordem_status ASC, f.due_date ASC', v_dir)
  END;

  v_sql := format($q$
    WITH base AS (
      SELECT i.id, i.description, i.amount, i.due_date, i.status, i.payment_date, i.user_id,
        i.invoice_url, i.pix_code, i.payment_method, i.created_at, i.sync_status, i.origem,
        i.asaas_invoice_id, p.full_name AS cliente_nome, p.email AS cliente_email,
        public.classificar_situacao_cobranca(i.status, i.due_date, i.sync_status) AS classificacao,
        public.nome_ordenavel(COALESCE(p.full_name, p.email, 'zzzz')) AS nome_ord,
        CASE public.classificar_situacao_cobranca(i.status, i.due_date, i.sync_status)
          WHEN 'vencidas' THEN 0 WHEN 'aguardando' THEN 1 WHEN 'confirmadas' THEN 2
          WHEN 'recebidas' THEN 3 ELSE 4 END AS ordem_status,
        CASE
          WHEN public.classificar_situacao_cobranca(i.status, i.due_date, i.sync_status) IN ('recebidas','confirmadas')
            THEN COALESCE(i.payment_date, i.due_date, i.created_at::date)
          ELSE COALESCE(i.due_date, i.created_at::date)
        END AS reference_date
      FROM public.invoices i
      LEFT JOIN public.profiles p ON p.id = i.user_id
      WHERE ($1 IS NULL OR p.assigned_to = $1 OR p.created_by = $1)
        AND ($2 IS NULL OR $2 = '' OR i.asaas_customer_id = $2)
        AND ($3 IS NULL OR $3 = '' OR lower(COALESCE(i.payment_method, '')) = lower($3))
        AND ($4 IS NULL OR i.user_id = $4)
        AND ($5 IS NULL OR $5 = '' OR lower(COALESCE(i.origem, 'interna')) = lower($5))
        AND ($6 IS NULL OR i.due_date >= $6) AND ($7 IS NULL OR i.due_date <= $7)
        AND ($8 IS NULL OR i.payment_date >= $8) AND ($9 IS NULL OR i.payment_date <= $9)
        AND ($10 IS NULL OR $10 = '' OR
          public.nome_ordenavel(p.full_name) LIKE '%%' || public.nome_ordenavel($10) || '%%' OR
          lower(COALESCE(p.email, '')) LIKE '%%' || lower($10) || '%%' OR
          public.nome_ordenavel(i.description) LIKE '%%' || public.nome_ordenavel($10) || '%%' OR
          lower(COALESCE(i.asaas_invoice_id, '')) LIKE '%%' || lower($10) || '%%' OR
          (regexp_replace($10, '[^0-9]', '', 'g') <> '' AND regexp_replace(COALESCE(p.cpf_cnpj, ''), '[^0-9]', '', 'g') LIKE '%%' || regexp_replace($10, '[^0-9]', '', 'g') || '%%'))
    ), f AS (
      SELECT * FROM base
      WHERE classificacao IS NOT NULL
        AND ($11 = 'all' OR classificacao = $11)
        AND ($12 IS NULL OR reference_date >= $12)
        AND ($13 IS NULL OR reference_date <= $13)
    )
    SELECT f.id, f.description, f.amount, f.due_date, f.status, f.classificacao,
      f.payment_date, f.user_id, f.invoice_url, f.pix_code, f.payment_method,
      f.created_at, f.sync_status, f.origem, f.asaas_invoice_id,
      f.cliente_nome, f.cliente_email, count(*) OVER() AS total_count
    FROM f ORDER BY %s LIMIT $14 OFFSET $15
  $q$, v_order);

  RETURN QUERY EXECUTE v_sql USING
    p_owner, p_account, p_payment_method, p_client, p_origin,
    p_due_from, p_due_to, p_payment_from, p_payment_to, p_search,
    COALESCE(p_situation, 'all'), p_from, p_to,
    GREATEST(COALESCE(p_limit, 50), 1), GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_invoices_list_filtered(text, text, date, date, uuid, text, text, integer, integer, text, text, uuid, text, date, date, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_invoices_list_filtered(text, text, date, date, uuid, text, text, integer, integer, text, text, uuid, text, date, date, date, date) TO authenticated, service_role;;

-- END MIGRATION 20260915142432

-- BEGIN MIGRATION 20260915142750 20260915142750_82b21db0-a4f4-4ebe-9610-1a330181753d.sql sha256=fdfb271e19a33ef8402c57d6c9d882c30446079d8ebca3c67217dab66b8e1fac
REVOKE ALL ON FUNCTION public.classificar_situacao_cobranca(text, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.classificar_situacao_cobranca(text, date, text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_billing_situation(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_owner uuid DEFAULT NULL,
  p_account text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_client uuid DEFAULT NULL,
  p_origin text DEFAULT NULL,
  p_due_from date DEFAULT NULL,
  p_due_to date DEFAULT NULL,
  p_payment_from date DEFAULT NULL,
  p_payment_to date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  WITH filtered AS (
    SELECT i.id, i.user_id, i.amount, i.payment_method, i.due_date, i.payment_date,
      public.classificar_situacao_cobranca(i.status, i.due_date, i.sync_status) AS situacao,
      CASE WHEN public.classificar_situacao_cobranca(i.status, i.due_date, i.sync_status) IN ('recebidas','confirmadas')
        THEN COALESCE(i.payment_date, i.due_date, i.created_at::date) ELSE COALESCE(i.due_date, i.created_at::date) END AS reference_date
    FROM public.invoices i LEFT JOIN public.profiles p ON p.id = i.user_id
    WHERE (p_owner IS NULL OR p.assigned_to = p_owner OR p.created_by = p_owner)
      AND (p_account IS NULL OR p_account = '' OR i.asaas_customer_id = p_account)
      AND (p_payment_method IS NULL OR p_payment_method = '' OR lower(COALESCE(i.payment_method, '')) = lower(p_payment_method))
      AND (p_client IS NULL OR i.user_id = p_client)
      AND (p_origin IS NULL OR p_origin = '' OR lower(COALESCE(i.origem, 'interna')) = lower(p_origin))
      AND (p_due_from IS NULL OR i.due_date >= p_due_from) AND (p_due_to IS NULL OR i.due_date <= p_due_to)
      AND (p_payment_from IS NULL OR i.payment_date >= p_payment_from) AND (p_payment_to IS NULL OR i.payment_date <= p_payment_to)
  ), valid AS (
    SELECT * FROM filtered WHERE situacao IS NOT NULL AND (p_from IS NULL OR reference_date >= p_from) AND (p_to IS NULL OR reference_date <= p_to)
  ), categories(situacao) AS (VALUES ('recebidas'::text), ('confirmadas'), ('aguardando'), ('vencidas')),
  category_totals AS (
    SELECT c.situacao, COALESCE(sum(v.amount), 0)::numeric gross_amount, count(DISTINCT v.user_id)::bigint clients_count, count(v.id)::bigint invoices_count
    FROM categories c LEFT JOIN valid v ON v.situacao = c.situacao GROUP BY c.situacao
  ), composition AS (
    SELECT situacao, jsonb_agg(jsonb_build_object('key', subdivision, 'label', subdivision_label, 'amount', amount, 'count', invoice_count) ORDER BY subdivision_order) items
    FROM (
      SELECT situacao,
        CASE WHEN situacao IN ('recebidas','confirmadas') THEN COALESCE(NULLIF(lower(payment_method), ''), 'nao_informado')
          WHEN situacao = 'aguardando' THEN CASE WHEN due_date = CURRENT_DATE THEN 'vence_hoje' WHEN due_date <= CURRENT_DATE + 7 THEN 'proximos_7_dias' ELSE 'mais_de_7_dias' END
          ELSE CASE WHEN CURRENT_DATE - due_date <= 30 THEN 'ate_30_dias' WHEN CURRENT_DATE - due_date <= 60 THEN '31_a_60_dias' WHEN CURRENT_DATE - due_date <= 90 THEN '61_a_90_dias' ELSE 'mais_de_90_dias' END END subdivision,
        CASE WHEN situacao IN ('recebidas','confirmadas') THEN CASE COALESCE(NULLIF(lower(payment_method), ''), 'nao_informado') WHEN 'pix' THEN 'Pix' WHEN 'boleto' THEN 'Boleto' WHEN 'credit_card' THEN 'Cartão' WHEN 'cartao' THEN 'Cartão' ELSE 'Não informado' END
          WHEN situacao = 'aguardando' THEN CASE WHEN due_date = CURRENT_DATE THEN 'Vence hoje' WHEN due_date <= CURRENT_DATE + 7 THEN 'Próximos 7 dias' ELSE 'Após 7 dias' END
          ELSE CASE WHEN CURRENT_DATE - due_date <= 30 THEN 'Até 30 dias' WHEN CURRENT_DATE - due_date <= 60 THEN '31 a 60 dias' WHEN CURRENT_DATE - due_date <= 90 THEN '61 a 90 dias' ELSE 'Mais de 90 dias' END END subdivision_label,
        CASE WHEN situacao IN ('recebidas','confirmadas') THEN CASE COALESCE(NULLIF(lower(payment_method), ''), 'nao_informado') WHEN 'pix' THEN 1 WHEN 'boleto' THEN 2 WHEN 'credit_card' THEN 3 WHEN 'cartao' THEN 3 ELSE 4 END
          WHEN situacao = 'aguardando' THEN CASE WHEN due_date = CURRENT_DATE THEN 1 WHEN due_date <= CURRENT_DATE + 7 THEN 2 ELSE 3 END
          ELSE CASE WHEN CURRENT_DATE - due_date <= 30 THEN 1 WHEN CURRENT_DATE - due_date <= 60 THEN 2 WHEN CURRENT_DATE - due_date <= 90 THEN 3 ELSE 4 END END subdivision_order,
        sum(amount)::numeric amount, count(*)::bigint invoice_count FROM valid GROUP BY situacao, subdivision, subdivision_label, subdivision_order
    ) grouped GROUP BY situacao
  ), series AS (
    SELECT reference_date AS series_date, sum(amount) FILTER (WHERE situacao='recebidas')::numeric recebidas,
      sum(amount) FILTER (WHERE situacao='confirmadas')::numeric confirmadas, sum(amount) FILTER (WHERE situacao='aguardando')::numeric aguardando,
      sum(amount) FILTER (WHERE situacao='vencidas')::numeric vencidas FROM valid GROUP BY reference_date ORDER BY reference_date
  )
  SELECT jsonb_build_object('total', COALESCE((SELECT sum(gross_amount) FROM category_totals),0), 'net_available',false,
    'categories',(SELECT jsonb_object_agg(ct.situacao,jsonb_build_object('gross_amount',ct.gross_amount,'net_amount',NULL,'clients_count',ct.clients_count,'invoices_count',ct.invoices_count,'composition',COALESCE(cp.items,'[]'::jsonb))) FROM category_totals ct LEFT JOIN composition cp USING(situacao)),
    'series',COALESCE((SELECT jsonb_agg(jsonb_build_object('date',series_date,'recebidas',COALESCE(recebidas,0),'confirmadas',COALESCE(confirmadas,0),'aguardando',COALESCE(aguardando,0),'vencidas',COALESCE(vencidas,0)) ORDER BY series_date) FROM series),'[]'::jsonb)) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_billing_situation(date, date, uuid, text, text, uuid, text, date, date, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_billing_situation(date, date, uuid, text, text, uuid, text, date, date, date, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_invoices_list_filtered(
  p_search text DEFAULT NULL, p_situation text DEFAULT 'all', p_from date DEFAULT NULL, p_to date DEFAULT NULL,
  p_owner uuid DEFAULT NULL, p_sort text DEFAULT 'cliente', p_dir text DEFAULT 'asc', p_limit integer DEFAULT 50, p_offset integer DEFAULT 0,
  p_account text DEFAULT NULL, p_payment_method text DEFAULT NULL, p_client uuid DEFAULT NULL, p_origin text DEFAULT NULL,
  p_due_from date DEFAULT NULL, p_due_to date DEFAULT NULL, p_payment_from date DEFAULT NULL, p_payment_to date DEFAULT NULL
) RETURNS TABLE(id uuid, description text, amount numeric, due_date date, status text, classificacao text, payment_date date, user_id uuid, invoice_url text, pix_code text, payment_method text, created_at timestamptz, sync_status text, origem text, asaas_invoice_id text, cliente_nome text, cliente_email text, total_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_dir text:=CASE WHEN lower(COALESCE(p_dir,'asc'))='desc' THEN 'DESC' ELSE 'ASC' END; v_order text; v_sql text;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
 v_order:=CASE lower(COALESCE(p_sort,'cliente')) WHEN 'descricao' THEN format('public.nome_ordenavel(f.description) %s, f.due_date ASC',v_dir) WHEN 'valor' THEN format('f.amount %s, f.nome_ord ASC',v_dir) WHEN 'metodo' THEN format('lower(COALESCE(f.payment_method,%L)) %s, f.nome_ord ASC','',v_dir) WHEN 'vencimento' THEN format('f.due_date %s NULLS LAST, f.nome_ord ASC',v_dir) WHEN 'status' THEN format('f.classificacao %s, f.due_date ASC',v_dir) ELSE format('f.nome_ord %s, f.ordem_status ASC, f.due_date ASC',v_dir) END;
 v_sql:=format($q$ WITH base AS (
  SELECT i.id,i.description,i.amount,i.due_date,i.status,i.payment_date,i.user_id,i.invoice_url,i.pix_code,i.payment_method,i.created_at,i.sync_status,i.origem,i.asaas_invoice_id,p.full_name cliente_nome,p.email cliente_email,
   public.classificar_situacao_cobranca(i.status,i.due_date,i.sync_status) classificacao,public.nome_ordenavel(COALESCE(p.full_name,p.email,'zzzz')) nome_ord,
   CASE public.classificar_situacao_cobranca(i.status,i.due_date,i.sync_status) WHEN 'vencidas' THEN 0 WHEN 'aguardando' THEN 1 WHEN 'confirmadas' THEN 2 WHEN 'recebidas' THEN 3 ELSE 4 END ordem_status,
   CASE WHEN public.classificar_situacao_cobranca(i.status,i.due_date,i.sync_status) IN ('recebidas','confirmadas') THEN COALESCE(i.payment_date,i.due_date,i.created_at::date) ELSE COALESCE(i.due_date,i.created_at::date) END reference_date
  FROM public.invoices i LEFT JOIN public.profiles p ON p.id=i.user_id WHERE ($1 IS NULL OR p.assigned_to=$1 OR p.created_by=$1) AND ($2 IS NULL OR $2='' OR i.asaas_customer_id=$2) AND ($3 IS NULL OR $3='' OR lower(COALESCE(i.payment_method,''))=lower($3)) AND ($4 IS NULL OR i.user_id=$4) AND ($5 IS NULL OR $5='' OR lower(COALESCE(i.origem,'interna'))=lower($5)) AND ($6 IS NULL OR i.due_date >= $6) AND ($7 IS NULL OR i.due_date <= $7) AND ($8 IS NULL OR i.payment_date >= $8) AND ($9 IS NULL OR i.payment_date <= $9) AND ($10 IS NULL OR $10='' OR public.nome_ordenavel(p.full_name) LIKE '%%'||public.nome_ordenavel($10)||'%%' OR lower(COALESCE(p.email,'')) LIKE '%%'||lower($10)||'%%' OR public.nome_ordenavel(i.description) LIKE '%%'||public.nome_ordenavel($10)||'%%' OR lower(COALESCE(i.asaas_invoice_id,'')) LIKE '%%'||lower($10)||'%%' OR (regexp_replace($10,'[^0-9]','','g')<>'' AND regexp_replace(COALESCE(p.cpf_cnpj,''),'[^0-9]','','g') LIKE '%%'||regexp_replace($10,'[^0-9]','','g')||'%%'))
 ), f AS (SELECT * FROM base WHERE classificacao IS NOT NULL AND ($11='all' OR classificacao=$11) AND ($12 IS NULL OR reference_date >= $12) AND ($13 IS NULL OR reference_date <= $13))
 SELECT f.id,f.description,f.amount,f.due_date,f.status,f.classificacao,f.payment_date,f.user_id,f.invoice_url,f.pix_code,f.payment_method,f.created_at,f.sync_status,f.origem,f.asaas_invoice_id,f.cliente_nome,f.cliente_email,count(*) OVER() total_count FROM f ORDER BY %s LIMIT $14 OFFSET $15 $q$,v_order);
 RETURN QUERY EXECUTE v_sql USING p_owner,p_account,p_payment_method,p_client,p_origin,p_due_from,p_due_to,p_payment_from,p_payment_to,p_search,COALESCE(p_situation,'all'),p_from,p_to,GREATEST(COALESCE(p_limit,50),1),GREATEST(COALESCE(p_offset,0),0);
END; $$;
REVOKE ALL ON FUNCTION public.admin_invoices_list_filtered(text, text, date, date, uuid, text, text, integer, integer, text, text, uuid, text, date, date, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_invoices_list_filtered(text, text, date, date, uuid, text, text, integer, integer, text, text, uuid, text, date, date, date, date) TO authenticated, service_role;;

-- END MIGRATION 20260915142750

-- BEGIN MIGRATION 20260915142924 20260915142924_ee663141-d5ae-449a-84c8-ef97a3b764f6.sql sha256=5abf7393ae3a7fc3280ec48a82a6c7949ed65edab6c81e8316e991bf83dbaf5e
CREATE OR REPLACE FUNCTION public.admin_invoices_list_filtered(
  p_search text DEFAULT NULL, p_situation text DEFAULT 'all', p_from date DEFAULT NULL, p_to date DEFAULT NULL,
  p_owner uuid DEFAULT NULL, p_sort text DEFAULT 'cliente', p_dir text DEFAULT 'asc', p_limit integer DEFAULT 50, p_offset integer DEFAULT 0,
  p_account text DEFAULT NULL, p_payment_method text DEFAULT NULL, p_client uuid DEFAULT NULL, p_origin text DEFAULT NULL,
  p_due_from date DEFAULT NULL, p_due_to date DEFAULT NULL, p_payment_from date DEFAULT NULL, p_payment_to date DEFAULT NULL
) RETURNS TABLE(id uuid, description text, amount numeric, due_date date, status text, classificacao text, payment_date date, user_id uuid, invoice_url text, pix_code text, payment_method text, created_at timestamptz, sync_status text, origem text, asaas_invoice_id text, cliente_nome text, cliente_email text, total_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_dir text:=CASE WHEN lower(COALESCE(p_dir,'asc'))='desc' THEN 'DESC' ELSE 'ASC' END; v_order text; v_sql text;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
 v_order:=CASE lower(COALESCE(p_sort,'cliente')) WHEN 'descricao' THEN format('public.nome_ordenavel(f.description) %s, f.due_date ASC',v_dir) WHEN 'valor' THEN format('f.amount %s, f.nome_ord ASC',v_dir) WHEN 'metodo' THEN format('lower(COALESCE(f.payment_method,%L)) %s, f.nome_ord ASC','',v_dir) WHEN 'vencimento' THEN format('f.due_date %s NULLS LAST, f.nome_ord ASC',v_dir) WHEN 'status' THEN format('f.classificacao %s, f.due_date ASC',v_dir) ELSE format('f.nome_ord %s, f.ordem_status ASC, f.due_date ASC',v_dir) END;
 v_sql:=format($q$ WITH base AS (
  SELECT i.id,i.description,i.amount,i.due_date,i.status,i.payment_date,i.user_id,i.invoice_url,i.pix_code,i.payment_method,i.created_at,i.sync_status,i.origem,i.asaas_invoice_id,p.full_name cliente_nome,p.email cliente_email,
   COALESCE(public.classificar_situacao_cobranca(i.status,i.due_date,i.sync_status),'inativas') classificacao,public.nome_ordenavel(COALESCE(p.full_name,p.email,'zzzz')) nome_ord,
   CASE COALESCE(public.classificar_situacao_cobranca(i.status,i.due_date,i.sync_status),'inativas') WHEN 'vencidas' THEN 0 WHEN 'aguardando' THEN 1 WHEN 'confirmadas' THEN 2 WHEN 'recebidas' THEN 3 ELSE 4 END ordem_status,
   CASE WHEN public.classificar_situacao_cobranca(i.status,i.due_date,i.sync_status) IN ('recebidas','confirmadas') THEN COALESCE(i.payment_date,i.due_date,i.created_at::date) ELSE COALESCE(i.due_date,i.created_at::date) END reference_date
  FROM public.invoices i LEFT JOIN public.profiles p ON p.id=i.user_id WHERE ($1 IS NULL OR p.assigned_to=$1 OR p.created_by=$1) AND ($2 IS NULL OR $2='' OR i.asaas_customer_id=$2) AND ($3 IS NULL OR $3='' OR lower(COALESCE(i.payment_method,''))=lower($3)) AND ($4 IS NULL OR i.user_id=$4) AND ($5 IS NULL OR $5='' OR lower(COALESCE(i.origem,'interna'))=lower($5)) AND ($6 IS NULL OR i.due_date >= $6) AND ($7 IS NULL OR i.due_date <= $7) AND ($8 IS NULL OR i.payment_date >= $8) AND ($9 IS NULL OR i.payment_date <= $9) AND ($10 IS NULL OR $10='' OR public.nome_ordenavel(p.full_name) LIKE '%%'||public.nome_ordenavel($10)||'%%' OR lower(COALESCE(p.email,'')) LIKE '%%'||lower($10)||'%%' OR public.nome_ordenavel(i.description) LIKE '%%'||public.nome_ordenavel($10)||'%%' OR lower(COALESCE(i.asaas_invoice_id,'')) LIKE '%%'||lower($10)||'%%' OR (regexp_replace($10,'[^0-9]','','g')<>'' AND regexp_replace(COALESCE(p.cpf_cnpj,''),'[^0-9]','','g') LIKE '%%'||regexp_replace($10,'[^0-9]','','g')||'%%'))
 ), f AS (SELECT * FROM base WHERE ($11='all' OR classificacao=$11) AND ($12 IS NULL OR reference_date >= $12) AND ($13 IS NULL OR reference_date <= $13))
 SELECT f.id,f.description,f.amount,f.due_date,f.status,f.classificacao,f.payment_date,f.user_id,f.invoice_url,f.pix_code,f.payment_method,f.created_at,f.sync_status,f.origem,f.asaas_invoice_id,f.cliente_nome,f.cliente_email,count(*) OVER() total_count FROM f ORDER BY %s LIMIT $14 OFFSET $15 $q$,v_order);
 RETURN QUERY EXECUTE v_sql USING p_owner,p_account,p_payment_method,p_client,p_origin,p_due_from,p_due_to,p_payment_from,p_payment_to,p_search,COALESCE(p_situation,'all'),p_from,p_to,GREATEST(COALESCE(p_limit,50),1),GREATEST(COALESCE(p_offset,0),0);
END; $$;
REVOKE ALL ON FUNCTION public.admin_invoices_list_filtered(text, text, date, date, uuid, text, text, integer, integer, text, text, uuid, text, date, date, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_invoices_list_filtered(text, text, date, date, uuid, text, text, integer, integer, text, text, uuid, text, date, date, date, date) TO authenticated, service_role;;

-- END MIGRATION 20260915142924

-- BEGIN MIGRATION 20260915143004 20260915143004_05af9c55-8f43-4c84-b58a-8ab2a966e870.sql sha256=70e643d9d4cbc7d7e8ff04208bd4d1a2538ba670d6d182a24fe92d79cee48c82
CREATE OR REPLACE FUNCTION public.admin_asaas_accounts(p_owner uuid DEFAULT NULL)
RETURNS TABLE(asaas_customer_id text, cliente_nome text, cobrancas bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;

  RETURN QUERY
  SELECT i.asaas_customer_id,
         COALESCE(max(p.full_name), max(p.email), i.asaas_customer_id) AS cliente_nome,
         count(*)::bigint AS cobrancas
  FROM public.invoices i
  LEFT JOIN public.profiles p ON p.id = i.user_id
  WHERE i.asaas_customer_id IS NOT NULL
    AND trim(i.asaas_customer_id) <> ''
    AND (p_owner IS NULL OR p.assigned_to = p_owner OR p.created_by = p_owner)
  GROUP BY i.asaas_customer_id
  ORDER BY public.nome_ordenavel(COALESCE(max(p.full_name), max(p.email), i.asaas_customer_id));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_asaas_accounts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_asaas_accounts(uuid) TO authenticated, service_role;;

-- END MIGRATION 20260915143004

-- BEGIN MIGRATION 20260915165901 20260915165901_60e3c560-dc0b-4496-9d36-4014420e9eba.sql sha256=359836cdbc4835b48a9960ea47780e0327a2e616a32a1305eea52731cd344884

-- rpi_uploads: prévia, progresso e estatísticas
ALTER TABLE public.rpi_uploads
  ADD COLUMN IF NOT EXISTS is_preview boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parse_progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS parse_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_file_url text,
  ADD COLUMN IF NOT EXISTS total_mentions integer;

-- rpi_entries: auditoria de ocorrências e dados estruturais
ALTER TABLE public.rpi_entries
  ADD COLUMN IF NOT EXISTS occurrences_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS occurrences jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS relation_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS relation_primary text,
  ADD COLUMN IF NOT EXISTS relation_confidence numeric,
  ADD COLUMN IF NOT EXISTS is_destituicao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_nomeacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_substituicao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS procurador_anterior text,
  ADD COLUMN IF NOT EXISTS procurador_novo text,
  ADD COLUMN IF NOT EXISTS needs_human_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS deposit_date date,
  ADD COLUMN IF NOT EXISTS concession_date date,
  ADD COLUMN IF NOT EXISTS validity_date date,
  ADD COLUMN IF NOT EXISTS natureza text,
  ADD COLUMN IF NOT EXISTS apresentacao text,
  ADD COLUMN IF NOT EXISTS situacao_atual text,
  ADD COLUMN IF NOT EXISTS apostila text,
  ADD COLUMN IF NOT EXISTS titulares jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS requerentes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS procuradores jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dispatches jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS protocols jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ncl_specifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS vienna_classes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS field_sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS match_candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS process_block_hash text,
  ADD COLUMN IF NOT EXISTS source_file_ref text,
  ADD COLUMN IF NOT EXISTS enrichment_status text NOT NULL DEFAULT 'pendente';

CREATE UNIQUE INDEX IF NOT EXISTS rpi_entries_upload_process_uidx
  ON public.rpi_entries (rpi_upload_id, process_number);

CREATE INDEX IF NOT EXISTS rpi_entries_relation_primary_idx ON public.rpi_entries (relation_primary);
CREATE INDEX IF NOT EXISTS rpi_entries_enrichment_status_idx ON public.rpi_entries (enrichment_status);

-- Fila de complementação individual
CREATE TABLE IF NOT EXISTS public.rpi_enrichment_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rpi_entry_id uuid NOT NULL REFERENCES public.rpi_entries(id) ON DELETE CASCADE,
  process_number text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rpi_enrichment_queue_entry_uidx ON public.rpi_enrichment_queue (rpi_entry_id);
CREATE INDEX IF NOT EXISTS rpi_enrichment_queue_status_idx ON public.rpi_enrichment_queue (status, next_attempt_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rpi_enrichment_queue TO authenticated;
GRANT ALL ON public.rpi_enrichment_queue TO service_role;

ALTER TABLE public.rpi_enrichment_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam fila de enriquecimento"
  ON public.rpi_enrichment_queue FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_rpi_enrichment_queue_updated_at
  BEFORE UPDATE ON public.rpi_enrichment_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
;

-- END MIGRATION 20260915165901

-- BEGIN MIGRATION 20260915180443 20260915180443_b4804e55-9a05-412d-aa86-4ba732827979.sql sha256=90b3e4adfe74be05739c4e57d146ef7fdc133c25172eccb2bda3e2c7b26f6214
CREATE TABLE public.rpi_process_lookups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_number text NOT NULL UNIQUE,
  brand_name text,
  holder text,
  ncl_class text,
  current_status text,
  presentation text,
  nature text,
  class_status text,
  specification text,
  legal_representative text,
  priority_date text,
  filing_date text,
  grant_date text,
  expiry_date text,
  source_url text,
  source text,
  detail_status text,
  lookup_status text NOT NULL DEFAULT 'pending',
  queried_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rpi_process_lookups TO authenticated;
GRANT ALL ON public.rpi_process_lookups TO service_role;

ALTER TABLE public.rpi_process_lookups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view process lookups"
ON public.rpi_process_lookups FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_rpi_process_lookups_updated_at
BEFORE UPDATE ON public.rpi_process_lookups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.rpi_enrichment_field_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rpi_entry_id uuid NOT NULL REFERENCES public.rpi_entries(id) ON DELETE CASCADE,
  process_number text NOT NULL,
  field_name text NOT NULL,
  previous_value text,
  new_value text,
  applied_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rpi_enrichment_field_log_entry ON public.rpi_enrichment_field_log(rpi_entry_id);

GRANT SELECT ON public.rpi_enrichment_field_log TO authenticated;
GRANT ALL ON public.rpi_enrichment_field_log TO service_role;

ALTER TABLE public.rpi_enrichment_field_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view enrichment field log"
ON public.rpi_enrichment_field_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));;

-- END MIGRATION 20260915180443

-- BEGIN MIGRATION 20260915182529 20260915182529_31996f9f-f841-455d-b5d3-dea94a59092a.sql sha256=0daae8c524d54285cbd94f7f688303bf6f8d74a610a5124624ab271621cfe66d
ALTER TABLE public.rpi_entries ADD COLUMN IF NOT EXISTS auto_linked_at timestamptz;
ALTER TABLE public.rpi_entries ADD COLUMN IF NOT EXISTS auto_link_source text;
CREATE INDEX IF NOT EXISTS idx_brand_processes_process_number ON public.brand_processes (process_number);
CREATE INDEX IF NOT EXISTS idx_brand_processes_user_process ON public.brand_processes (user_id, process_number);;

-- END MIGRATION 20260915182529

-- BEGIN MIGRATION 20260915184437 20260915184437_521b02ee-9144-4966-aa12-5d2336c2215e.sql sha256=495b55ec139eefd868664892d688104e84b97a66aedff174b1b33937aca604da
-- Additive columns for message parsing/reprocessing
ALTER TABLE public.email_inbox
  ADD COLUMN IF NOT EXISTS raw_source text,
  ADD COLUMN IF NOT EXISTS thread_id text,
  ADD COLUMN IF NOT EXISTS in_reply_to text,
  ADD COLUMN IF NOT EXISTS references_ids text,
  ADD COLUMN IF NOT EXISTS parse_status text NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS parse_error text,
  ADD COLUMN IF NOT EXISTS parser_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reprocessed_at timestamptz,
  ADD COLUMN IF NOT EXISTS original_backup jsonb;

CREATE INDEX IF NOT EXISTS idx_email_inbox_thread ON public.email_inbox(account_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_email_inbox_account_folder_date ON public.email_inbox(account_id, folder, received_at DESC);

-- Sync state hardening
ALTER TABLE public.email_sync_state
  ADD COLUMN IF NOT EXISTS uidvalidity bigint,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz;

-- Per-account auto reply toggle (default true preserves current behaviour)
ALTER TABLE public.email_accounts
  ADD COLUMN IF NOT EXISTS auto_reply_enabled boolean NOT NULL DEFAULT true;

-- Sync run history
CREATE TABLE IF NOT EXISTS public.email_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  result text NOT NULL DEFAULT 'running',
  trigger_source text NOT NULL DEFAULT 'cron',
  new_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  folders jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  error_summary text,
  recommended_action text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_sync_runs TO authenticated;
GRANT ALL ON public.email_sync_runs TO service_role;
ALTER TABLE public.email_sync_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins view email sync runs" ON public.email_sync_runs;
CREATE POLICY "Admins view email sync runs" ON public.email_sync_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_email_sync_runs_account ON public.email_sync_runs(account_id, started_at DESC);

-- Failed-message reprocess queue
CREATE TABLE IF NOT EXISTS public.email_reprocess_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  folder text NOT NULL,
  imap_uid bigint NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, folder, imap_uid)
);
GRANT SELECT ON public.email_reprocess_queue TO authenticated;
GRANT ALL ON public.email_reprocess_queue TO service_role;
ALTER TABLE public.email_reprocess_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins view email reprocess queue" ON public.email_reprocess_queue;
CREATE POLICY "Admins view email reprocess queue" ON public.email_reprocess_queue
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_email_reprocess_pending ON public.email_reprocess_queue(status, next_attempt_at);;

-- END MIGRATION 20260915184437

-- BEGIN MIGRATION 20260915190034 20260915190034_70997172-94e7-404f-9361-c84ec2786f94.sql sha256=748e209192498ff5b6e24976f847f435d59d96eb966b73acc0330d96a099d954
CREATE TABLE public.email_repair_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.email_accounts(id) ON DELETE SET NULL,
  mode text NOT NULL DEFAULT 'preview',
  status text NOT NULL DEFAULT 'running',
  limit_count integer NOT NULL DEFAULT 30,
  examined integer NOT NULL DEFAULT 0,
  repaired integer NOT NULL DEFAULT 0,
  unchanged integer NOT NULL DEFAULT 0,
  not_found integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  processed integer NOT NULL DEFAULT 0,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  started_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.email_repair_runs TO authenticated;
GRANT ALL ON public.email_repair_runs TO service_role;

ALTER TABLE public.email_repair_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email repair runs"
ON public.email_repair_runs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX email_repair_runs_single_running
ON public.email_repair_runs ((status)) WHERE status = 'running';

CREATE TRIGGER update_email_repair_runs_updated_at
BEFORE UPDATE ON public.email_repair_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();;

-- END MIGRATION 20260915190034

-- BEGIN MIGRATION 20260915193314 20260915193314_5c825490-c6dd-4d48-b716-2e08f197227d.sql sha256=2a5df14105951bd87e669909e0c91f1904806ad76641614189aad10fab53f825
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_document_type_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_document_type_check CHECK (document_type = ANY (ARRAY['contract','signed_contract','contrato','anexo','outro','procuracao','invoice','receipt','identity','power_of_attorney','other','distrato','distrato_multa','distrato_sem_multa','taxa','busca_inpi','certificado','rpi','parecer','comprovante']));;

-- END MIGRATION 20260915193314

-- BEGIN MIGRATION 20260915224230 20260915224230_e142082a-1d92-425c-9375-096ab8816b85.sql sha256=bb52dc423fcbdcc19e8aef7cdd887493025c2ccc61e07dcbbe3267280aacf3c7
-- FASE 1 — Recursos INPI (três modalidades): base persistente, versionamento e log de IA.
-- Migração ADITIVA: nenhuma tabela existente é alterada ou removida.

CREATE TABLE IF NOT EXISTS public.inpi_resource_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('indeferimento','exigencia_merito','oposicao')),
  agent_id text NOT NULL,
  agent_name text NOT NULL,
  status text NOT NULL DEFAULT 'documentos',
  is_homologation boolean NOT NULL DEFAULT false,
  client_id uuid,
  resource_id uuid REFERENCES public.inpi_resources(id) ON DELETE SET NULL,
  process_number text,
  brand_name text,
  current_draft_version integer NOT NULL DEFAULT 0,
  current_orientation_version integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inpi_resource_cases TO authenticated;
GRANT ALL ON public.inpi_resource_cases TO service_role;
ALTER TABLE public.inpi_resource_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage inpi resource cases" ON public.inpi_resource_cases
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.inpi_case_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.inpi_resource_cases(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('documento_inpi','provas_cliente','procuracao','guia_taxa','comprovante_pagamento','pedido_anterioridades','complementares')),
  file_name text NOT NULL,
  mime_type text,
  declared_mime_type text,
  byte_size bigint,
  storage_path text NOT NULL,
  sha256 text,
  page_count integer,
  sheet_names text[],
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  replaced_by uuid REFERENCES public.inpi_case_documents(id) ON DELETE SET NULL,
  receipt_status text NOT NULL DEFAULT 'recebido',
  extraction_status text NOT NULL DEFAULT 'pendente',
  extraction_notes text,
  extracted_text text,
  review_status text NOT NULL DEFAULT 'nao_conferido',
  display_order integer NOT NULL DEFAULT 0,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inpi_case_documents_case ON public.inpi_case_documents(case_id, category);
CREATE INDEX IF NOT EXISTS idx_inpi_case_documents_hash ON public.inpi_case_documents(case_id, sha256);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inpi_case_documents TO authenticated;
GRANT ALL ON public.inpi_case_documents TO service_role;
ALTER TABLE public.inpi_case_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage inpi case documents" ON public.inpi_case_documents
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.inpi_case_orientations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.inpi_resource_cases(id) ON DELETE CASCADE,
  version integer NOT NULL,
  sections jsonb NOT NULL DEFAULT '{}'::jsonb,
  editable_text text,
  human_edited boolean NOT NULL DEFAULT false,
  documents_fingerprint text,
  is_stale boolean NOT NULL DEFAULT false,
  confirmed_at timestamptz,
  confirmed_by uuid,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inpi_case_orientations TO authenticated;
GRANT ALL ON public.inpi_case_orientations TO service_role;
ALTER TABLE public.inpi_case_orientations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage inpi case orientations" ON public.inpi_case_orientations
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.inpi_draft_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.inpi_resource_cases(id) ON DELETE CASCADE,
  version integer NOT NULL,
  content text NOT NULL,
  content_hash text NOT NULL,
  documents_fingerprint text,
  orientation_version integer,
  model text,
  prompt_version text,
  internal_report text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inpi_draft_versions TO authenticated;
GRANT ALL ON public.inpi_draft_versions TO service_role;
ALTER TABLE public.inpi_draft_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage inpi draft versions" ON public.inpi_draft_versions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.inpi_case_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.inpi_resource_cases(id) ON DELETE CASCADE,
  draft_version_id uuid NOT NULL REFERENCES public.inpi_draft_versions(id) ON DELETE CASCADE,
  approval_kind text NOT NULL CHECK (approval_kind IN ('texto_interno','conferencia_protocolo')),
  content_hash text NOT NULL,
  documents_hash text,
  orientation_hash text,
  approved_by uuid NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  invalidated_at timestamptz,
  invalidation_reason text,
  notes text
);
CREATE INDEX IF NOT EXISTS idx_inpi_case_approvals_case ON public.inpi_case_approvals(case_id, approved_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.inpi_case_approvals TO authenticated;
GRANT ALL ON public.inpi_case_approvals TO service_role;
ALTER TABLE public.inpi_case_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage inpi case approvals" ON public.inpi_case_approvals
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.inpi_ai_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid,
  resource_type text NOT NULL,
  operation text NOT NULL,
  model text NOT NULL,
  dedicated_model boolean NOT NULL DEFAULT false,
  reasoning_effort text,
  prompt_version text,
  duration_ms integer,
  status text NOT NULL,
  http_status integer,
  error_kind text,
  input_tokens integer,
  output_tokens integer,
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inpi_ai_call_logs_created ON public.inpi_ai_call_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inpi_ai_call_logs_correlation ON public.inpi_ai_call_logs(correlation_id);
GRANT SELECT ON public.inpi_ai_call_logs TO authenticated;
GRANT ALL ON public.inpi_ai_call_logs TO service_role;
ALTER TABLE public.inpi_ai_call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read inpi ai call logs" ON public.inpi_ai_call_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_inpi_resource_cases_updated BEFORE UPDATE ON public.inpi_resource_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_inpi_case_documents_updated BEFORE UPDATE ON public.inpi_case_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_inpi_case_orientations_updated BEFORE UPDATE ON public.inpi_case_orientations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();;

-- END MIGRATION 20260915224230

-- BEGIN MIGRATION 20260915224428 20260915224428_1db9fbe7-6acb-445f-a47e-5cf12d75720b.sql sha256=64742d454784e87ec4db5370049a507aaf76c5a9efd47c508e488a6d9d81138f
-- Acesso privado ao bucket de documentos dos casos de Recursos INPI (somente administradores).
CREATE POLICY "Admins read inpi recursos docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'inpi-recursos-docs' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins upload inpi recursos docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'inpi-recursos-docs' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins update inpi recursos docs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'inpi-recursos-docs' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'inpi-recursos-docs' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins delete inpi recursos docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'inpi-recursos-docs' AND public.has_role(auth.uid(),'admin'));;

-- END MIGRATION 20260915224428

-- BEGIN MIGRATION 20260915233424 20260915233424_d7bf7f67-8b59-42f5-88fc-2301977e47cc.sql sha256=89b603249a8033ed508497c1c0061ca3350cc594a4385ca9a2ff0dc14b7cc848
ALTER TABLE public.inpi_case_documents
  ADD COLUMN IF NOT EXISTS conversion_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS conversion_notes text,
  ADD COLUMN IF NOT EXISTS converted_page_count integer,
  ADD COLUMN IF NOT EXISTS interpreted_pages integer,
  ADD COLUMN IF NOT EXISTS unreadable_pages integer,
  ADD COLUMN IF NOT EXISTS processing_confirmed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.inpi_export_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.inpi_resource_cases(id) ON DELETE CASCADE,
  resource_id uuid,
  draft_version_id uuid REFERENCES public.inpi_draft_versions(id) ON DELETE SET NULL,
  approval_id uuid REFERENCES public.inpi_case_approvals(id) ON DELETE SET NULL,
  content_hash text,
  documents_hash text,
  is_complete boolean NOT NULL DEFAULT false,
  is_draft_stamped boolean NOT NULL DEFAULT true,
  total_annexes integer NOT NULL DEFAULT 0,
  total_pages integer,
  manifest jsonb NOT NULL DEFAULT '[]'::jsonb,
  failed_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  file_name text,
  generated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inpi_export_packages TO authenticated;
GRANT ALL ON public.inpi_export_packages TO service_role;

ALTER TABLE public.inpi_export_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage inpi export packages"
ON public.inpi_export_packages FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_inpi_export_packages_updated_at
BEFORE UPDATE ON public.inpi_export_packages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_inpi_export_packages_case ON public.inpi_export_packages(case_id);;

-- END MIGRATION 20260915233424

-- BEGIN MIGRATION 20260915235150 20260915235150_e837c536-253e-410e-b387-f103f3666f54.sql sha256=1806831d50bc0f81e5cda937ff8b8f367b510cd2ff3f202a8b39e9b59092f370
ALTER TABLE public.inpi_case_documents
  ADD COLUMN IF NOT EXISTS vision_read_pages integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vision_model text,
  ADD COLUMN IF NOT EXISTS vision_notes text,
  ADD COLUMN IF NOT EXISTS vision_read_at timestamptz;

CREATE TABLE IF NOT EXISTS public.inpi_draft_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.inpi_resource_cases(id) ON DELETE CASCADE,
  resource_id uuid,
  content_hash text NOT NULL,
  documents_hash text,
  model text,
  prompt_version text,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  has_blocking boolean NOT NULL DEFAULT false,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inpi_draft_reviews TO authenticated;
GRANT ALL ON public.inpi_draft_reviews TO service_role;

ALTER TABLE public.inpi_draft_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage inpi draft reviews"
ON public.inpi_draft_reviews FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_inpi_draft_reviews_case ON public.inpi_draft_reviews(case_id, created_at DESC);

CREATE TRIGGER update_inpi_draft_reviews_updated_at
BEFORE UPDATE ON public.inpi_draft_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();;

-- END MIGRATION 20260915235150

-- BEGIN MIGRATION 20260916000016 20260916000016_84306b80-064c-415e-957e-39158f4466b1.sql sha256=1b45e633886ac279a15d7d951f79546cf502c283eed199ecba30323b175109de
-- Aprovação válida única por versão exata (texto + anexos + orientação)
CREATE UNIQUE INDEX IF NOT EXISTS inpi_case_approvals_unique_active
  ON public.inpi_case_approvals (case_id, approval_kind, content_hash, coalesce(documents_hash,''), coalesce(orientation_hash,''))
  WHERE invalidated_at IS NULL;

-- Revisão jurídica única por versão de texto + anexos
CREATE UNIQUE INDEX IF NOT EXISTS inpi_draft_reviews_unique_version
  ON public.inpi_draft_reviews (case_id, content_hash, coalesce(documents_hash,''));

-- Pacote de exportação único por versão
CREATE UNIQUE INDEX IF NOT EXISTS inpi_export_packages_unique_version
  ON public.inpi_export_packages (case_id, content_hash, coalesce(documents_hash,''));;

-- END MIGRATION 20260916000016

-- BEGIN MIGRATION 20260916003141 20260916003141_45f2ec99-983e-4826-b4d9-3de0b7c423be.sql sha256=c7c9a72d8cb986d32a448955150848878a387e3a9302e95493337fd752bd520c
CREATE OR REPLACE FUNCTION public.is_master_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid() AND u.email = 'davillys@gmail.com'
  )
$$;

DROP POLICY IF EXISTS "Master can upload perfex-import" ON storage.objects;
DROP POLICY IF EXISTS "Master can read perfex-import" ON storage.objects;
DROP POLICY IF EXISTS "Master can update perfex-import" ON storage.objects;
DROP POLICY IF EXISTS "Master can delete perfex-import" ON storage.objects;

CREATE POLICY "Master can upload perfex-import" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'perfex-import' AND public.is_master_user());

CREATE POLICY "Master can read perfex-import" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'perfex-import' AND public.is_master_user());

CREATE POLICY "Master can update perfex-import" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'perfex-import' AND public.is_master_user())
  WITH CHECK (bucket_id = 'perfex-import' AND public.is_master_user());

CREATE POLICY "Master can delete perfex-import" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'perfex-import' AND public.is_master_user());;

-- END MIGRATION 20260916003141

-- BEGIN MIGRATION 20260916003204 20260916003204_1c523fec-074f-4601-b272-d1a2c9654cc6.sql sha256=d62352ff1c15a17359380aa2d05552d7f8570e260c017bcb6799a7bc4bb774a3
REVOKE EXECUTE ON FUNCTION public.is_master_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_master_user() TO authenticated, service_role;;

-- END MIGRATION 20260916003204

-- BEGIN MIGRATION 20260916023714 20260916023714_873caa6d-9413-4dd0-8092-0b7703d36ffc.sql sha256=36a4e064f6d77e1e8266903b13486cd95fc92a38d9c519f06514649098bcf7d6
CREATE TABLE public.inpi_generation_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES public.inpi_resource_cases(id) ON DELETE CASCADE,
  owner_id UUID,
  resource_type TEXT NOT NULL,
  agent_name TEXT,
  agent_strategy TEXT,
  user_orientation TEXT,
  stage TEXT NOT NULL DEFAULT 'preparar',
  status TEXT NOT NULL DEFAULT 'processing',
  attempt INTEGER NOT NULL DEFAULT 0,
  extracted_data JSONB,
  pass1_content TEXT,
  result_content TEXT,
  error_message TEXT,
  error_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.inpi_generation_jobs TO authenticated;
GRANT ALL ON public.inpi_generation_jobs TO service_role;

ALTER TABLE public.inpi_generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam jobs de geracao INPI"
ON public.inpi_generation_jobs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX inpi_generation_jobs_active_case
ON public.inpi_generation_jobs (case_id)
WHERE status = 'processing';

CREATE INDEX inpi_generation_jobs_case_created
ON public.inpi_generation_jobs (case_id, created_at DESC);

CREATE TRIGGER update_inpi_generation_jobs_updated_at
BEFORE UPDATE ON public.inpi_generation_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();;

-- END MIGRATION 20260916023714

-- BEGIN MIGRATION 20260916032949 20260916032949_7b74f120-0619-4a04-b63b-a79ccb2aef3b.sql sha256=13d5ce574704e2ba90fe32feeffc075721bc27b75249b41488cdef508e64d5a6
BEGIN;
LOCK TABLE public.inpi_case_documents IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.inpi_case_documents ADD COLUMN doc_number integer;
WITH numbered AS (
  SELECT id, row_number() OVER (
    PARTITION BY case_id ORDER BY display_order, created_at, id
  )::integer AS n FROM public.inpi_case_documents
)
UPDATE public.inpi_case_documents d SET doc_number = numbered.n
FROM numbered WHERE numbered.id = d.id;
ALTER TABLE public.inpi_case_documents ALTER COLUMN doc_number SET NOT NULL;
ALTER TABLE public.inpi_case_documents ADD CONSTRAINT inpi_document_number_positive CHECK (doc_number > 0);
CREATE UNIQUE INDEX inpi_document_number_unique ON public.inpi_case_documents(case_id, doc_number);
ALTER TABLE public.inpi_resource_cases ADD COLUMN next_document_number integer NOT NULL DEFAULT 1;
UPDATE public.inpi_resource_cases c SET next_document_number = x.n + 1
FROM (SELECT case_id, max(doc_number) n FROM public.inpi_case_documents GROUP BY case_id) x
WHERE x.case_id = c.id;

CREATE FUNCTION public.assign_inpi_document_number() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.doc_number IS DISTINCT FROM OLD.doc_number OR NEW.case_id IS DISTINCT FROM OLD.case_id THEN
      RAISE EXCEPTION 'Document identity cannot be reassigned';
    END IF;
    RETURN NEW;
  END IF;
  UPDATE public.inpi_resource_cases
    SET next_document_number = next_document_number + 1
    WHERE id = NEW.case_id
    RETURNING next_document_number - 1 INTO NEW.doc_number;
  IF NEW.doc_number IS NULL THEN RAISE EXCEPTION 'Case unavailable'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER assign_inpi_document_number BEFORE INSERT OR UPDATE ON public.inpi_case_documents
FOR EACH ROW EXECUTE FUNCTION public.assign_inpi_document_number();
COMMIT;;

-- END MIGRATION 20260916032949

-- BEGIN MIGRATION 20260916033043 20260916033043_bee76c8f-552d-45fa-ae03-9bf04eb998e7.sql sha256=abf93b597601d3a63802b5c2b385853d98b19ea012464fe7f99046fe334edd08
ALTER TABLE public.inpi_case_documents ALTER COLUMN doc_number SET DEFAULT 0;;

-- END MIGRATION 20260916033043

-- BEGIN MIGRATION 20260916042801 20260916042801_5af0266b-b3e1-4969-ae98-e6e995ab427f.sql sha256=402b24eeecd4d3f390fcb9a5433752086ca209ba1e39bddc68da89883ba0ecd6
ALTER TABLE public.inpi_generation_jobs
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS run_token uuid,
  ADD COLUMN IF NOT EXISTS prepared_files jsonb;

UPDATE public.inpi_generation_jobs
SET status = 'error',
    error_code = 'interrompido',
    error_message = 'A geração foi interrompida antes de terminar. Nenhum documento ou orientação foi perdido — use "Tentar de novo" para retomar da etapa que parou.',
    run_token = NULL,
    updated_at = now()
WHERE id IN ('2621ccf6-65c9-4d8b-8dc3-46f160ed96f6', '75309d5f-55dc-4130-bfca-7f22c1c8fcf0')
  AND status = 'processing';;

-- END MIGRATION 20260916042801

-- BEGIN MIGRATION 20260916143415 20260916143415_1a1f3f49-7092-4700-8ade-a10f4591415a.sql sha256=f3b9eb4ebb584ca66829574b87d54818ca812ee90a48fb1b15cfe906b3e634e9
CREATE OR REPLACE FUNCTION public.has_inpi_resources_access(_user_id uuid, _need_edit boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND (
      public.has_role(_user_id, 'admin')
      OR EXISTS (
        SELECT 1 FROM public.admin_permissions ap
        WHERE ap.user_id = _user_id
          AND ap.permission_key = 'inpi_resources'
          AND ap.can_view
          AND (NOT _need_edit OR ap.can_edit)
      )
    )
$$;

GRANT EXECUTE ON FUNCTION public.has_inpi_resources_access(uuid, boolean) TO authenticated, service_role;

-- Tabelas com acesso total (leitura + escrita) para quem pode editar,
-- leitura para quem só pode visualizar.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'inpi_resource_cases','inpi_case_documents','inpi_case_orientations',
    'inpi_draft_versions','inpi_draft_reviews','inpi_case_approvals',
    'inpi_export_packages','inpi_generation_jobs','inpi_resource_evidences'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Acesso liberado a Recursos INPI - leitura', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Acesso liberado a Recursos INPI - escrita', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Acesso liberado a Recursos INPI - alteracao', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Acesso liberado a Recursos INPI - exclusao', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_inpi_resources_access(auth.uid(), false))', 'Acesso liberado a Recursos INPI - leitura', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_inpi_resources_access(auth.uid(), true))', 'Acesso liberado a Recursos INPI - escrita', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.has_inpi_resources_access(auth.uid(), true)) WITH CHECK (public.has_inpi_resources_access(auth.uid(), true))', 'Acesso liberado a Recursos INPI - alteracao', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_inpi_resources_access(auth.uid(), true))', 'Acesso liberado a Recursos INPI - exclusao', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Acesso liberado a Recursos INPI - leitura" ON public.inpi_ai_call_logs;
CREATE POLICY "Acesso liberado a Recursos INPI - leitura" ON public.inpi_ai_call_logs
  FOR SELECT TO authenticated USING (public.has_inpi_resources_access(auth.uid(), false));

-- Arquivos anexados aos casos (bucket privado)
DROP POLICY IF EXISTS "Recursos INPI - ler documentos do caso" ON storage.objects;
DROP POLICY IF EXISTS "Recursos INPI - enviar documentos do caso" ON storage.objects;
DROP POLICY IF EXISTS "Recursos INPI - atualizar documentos do caso" ON storage.objects;
DROP POLICY IF EXISTS "Recursos INPI - remover documentos do caso" ON storage.objects;
CREATE POLICY "Recursos INPI - ler documentos do caso" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'inpi-recursos-docs' AND public.has_inpi_resources_access(auth.uid(), false));
CREATE POLICY "Recursos INPI - enviar documentos do caso" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'inpi-recursos-docs' AND public.has_inpi_resources_access(auth.uid(), true));
CREATE POLICY "Recursos INPI - atualizar documentos do caso" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'inpi-recursos-docs' AND public.has_inpi_resources_access(auth.uid(), true));
CREATE POLICY "Recursos INPI - remover documentos do caso" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'inpi-recursos-docs' AND public.has_inpi_resources_access(auth.uid(), true));;

-- END MIGRATION 20260916143415

-- BEGIN MIGRATION 20260916143543 20260916143543_4cf9a6ec-788c-4e7d-8f2f-690a39d1cfa0.sql sha256=e5472beebd19d131986972574977c492f416dc31f317d3d002d3498a98d4fa4e
DROP POLICY IF EXISTS "Acesso liberado a Recursos INPI - leitura" ON public.inpi_resources;
DROP POLICY IF EXISTS "Acesso liberado a Recursos INPI - escrita" ON public.inpi_resources;
DROP POLICY IF EXISTS "Acesso liberado a Recursos INPI - alteracao" ON public.inpi_resources;
DROP POLICY IF EXISTS "Acesso liberado a Recursos INPI - exclusao" ON public.inpi_resources;

CREATE POLICY "Acesso liberado a Recursos INPI - leitura" ON public.inpi_resources
  FOR SELECT TO authenticated USING (public.has_inpi_resources_access(auth.uid(), false));
CREATE POLICY "Acesso liberado a Recursos INPI - escrita" ON public.inpi_resources
  FOR INSERT TO authenticated WITH CHECK (public.has_inpi_resources_access(auth.uid(), true));
CREATE POLICY "Acesso liberado a Recursos INPI - alteracao" ON public.inpi_resources
  FOR UPDATE TO authenticated USING (public.has_inpi_resources_access(auth.uid(), true))
  WITH CHECK (public.has_inpi_resources_access(auth.uid(), true));
CREATE POLICY "Acesso liberado a Recursos INPI - exclusao" ON public.inpi_resources
  FOR DELETE TO authenticated USING (public.has_inpi_resources_access(auth.uid(), true));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inpi_resources TO authenticated;
GRANT ALL ON public.inpi_resources TO service_role;;

-- END MIGRATION 20260916143543

-- BEGIN MIGRATION 20260916151905 20260916151905_b468db92-a137-43cc-aa11-26425ada152f.sql sha256=bb155e2c6bcdeb363c0a9216992f66aa1eb5cd5e76458e81fe0a77811a6151ec
CREATE POLICY "Users can view their own permissions"
ON public.admin_permissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());;

-- END MIGRATION 20260916151905

-- BEGIN MIGRATION 20260918034312 20260918034312_a2b189dc-76de-4c4f-81a8-6bb74c93003b.sql sha256=5493d031364e48247d67cb2b4e7015aa5d2075cdbab7258241414394c1bd0c8f
ALTER TABLE public.responsavel_atribuicao DROP CONSTRAINT IF EXISTS responsavel_atribuicao_entidade_check;
ALTER TABLE public.responsavel_atribuicao ADD CONSTRAINT responsavel_atribuicao_entidade_check CHECK (entidade = ANY (ARRAY['invoice'::text, 'devedor'::text, 'publicacao'::text, 'cliente'::text]));
ALTER TABLE public.responsavel_historico DROP CONSTRAINT IF EXISTS responsavel_historico_entidade_check;
ALTER TABLE public.responsavel_historico ADD CONSTRAINT responsavel_historico_entidade_check CHECK (entidade = ANY (ARRAY['invoice'::text, 'devedor'::text, 'publicacao'::text, 'cliente'::text]));;

-- END MIGRATION 20260918034312

-- BEGIN MIGRATION 20260918192840 20260918192840_4f87daf7-a247-4563-bfd6-7f14719f1408.sql sha256=e27ee179665710cc8cb0dd5fa7915566a4bd2d5165f228e43cdf251c6fa6bfef
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check CHECK (status = ANY (ARRAY[
  'pending','paid','confirmed','received','received_in_cash','overdue','refunded','canceled','cancelled','deleted',
  'awaiting_risk_analysis','approved_by_risk_analysis','reproved_by_risk_analysis','authorized',
  'refund_requested','refund_in_progress','chargeback_requested','chargeback_dispute','awaiting_chargeback_reversal',
  'dunning_requested','dunning_received','awaiting_cash_payment','payment_deleted','removida_asaas','partially_refunded'
]));;

-- END MIGRATION 20260918192840

-- BEGIN MIGRATION 20260919223758 20260919223758_b532222e-2319-49cc-8e8a-2a033b0f633d.sql sha256=399a35102e110e044eda917cfd03b568d919921e816686056e6d2e68a0cd254d
CREATE TABLE public.lembrete_fila (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid,
  asaas_payment_id text,
  tipo text NOT NULL DEFAULT 'd0',
  cliente_nome text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pendente',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  batch_id uuid,
  interval_minutes integer NOT NULL DEFAULT 5,
  created_by uuid,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lembrete_fila_status_check CHECK (status IN ('pendente','processando','enviado','pulado','falha','cancelado')),
  CONSTRAINT lembrete_fila_tipo_check CHECK (tipo IN ('d0','d3'))
);

GRANT SELECT, INSERT, UPDATE ON public.lembrete_fila TO authenticated;
GRANT ALL ON public.lembrete_fila TO service_role;

ALTER TABLE public.lembrete_fila ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam fila de lembretes"
ON public.lembrete_fila FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX lembrete_fila_pendentes_idx ON public.lembrete_fila (status, scheduled_at);
CREATE UNIQUE INDEX lembrete_fila_invoice_pendente_idx ON public.lembrete_fila (invoice_id) WHERE status IN ('pendente','processando') AND invoice_id IS NOT NULL;
CREATE UNIQUE INDEX lembrete_fila_asaas_pendente_idx ON public.lembrete_fila (asaas_payment_id) WHERE status IN ('pendente','processando') AND invoice_id IS NULL AND asaas_payment_id IS NOT NULL;

CREATE TRIGGER lembrete_fila_updated_at
BEFORE UPDATE ON public.lembrete_fila
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();;

-- END MIGRATION 20260919223758
