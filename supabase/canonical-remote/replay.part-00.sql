-- Canonical WebMarcas remote migration replay
-- Generated from the 93 migrations captured read-only on 2026-09-21.
-- This file is for ephemeral PostgreSQL validation only. Never apply to production.
\set ON_ERROR_STOP on

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
  'https://scpbqsvwojhbxihyqbdz.supabase.co/storage/v1/object/public/documents/' || lp.storage_name,
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

-- Schedule sync every 2 minutes
DO $mig$
DECLARE
  existing_jobid bigint;
BEGIN
  SELECT jobid INTO existing_jobid FROM cron.job WHERE jobname = 'cron-sync-all-emails';
  IF existing_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(existing_jobid);
  END IF;

  PERFORM cron.schedule(
    'cron-sync-all-emails',
    '*/2 * * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://scpbqsvwojhbxihyqbdz.supabase.co/functions/v1/cron-sync-all-emails',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcGJxc3Z3b2poYnhpaHlxYmR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjcyNTUsImV4cCI6MjA5MDA0MzI1NX0.FTZt4yiL6dVsYT9cQnqrABgS0sMXYl23wf4ZtzP-GAE'
      ),
      body := '{}'::jsonb
    );
    $cron$
  );
END$mig$;;

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

-- remove jobs com mesmo nome para idempotência
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('asaas-daily-sync-10h','cobranca-reentry-daily');

SELECT cron.schedule(
  'asaas-daily-sync-10h',
  '0 13 * * 1-5',
  $$
  SELECT net.http_post(
    url:='https://scpbqsvwojhbxihyqbdz.supabase.co/functions/v1/sync-asaas-invoices',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcGJxc3Z3b2poYnhpaHlxYmR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjcyNTUsImV4cCI6MjA5MDA0MzI1NX0.FTZt4yiL6dVsYT9cQnqrABgS0sMXYl23wf4ZtzP-GAE"}'::jsonb,
    body:='{}'::jsonb
  );
  SELECT net.http_post(
    url:='https://scpbqsvwojhbxihyqbdz.supabase.co/functions/v1/asaas-debtors-api?action=sync-overdue-30',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcGJxc3Z3b2poYnhpaHlxYmR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjcyNTUsImV4cCI6MjA5MDA0MzI1NX0.FTZt4yiL6dVsYT9cQnqrABgS0sMXYl23wf4ZtzP-GAE"}'::jsonb,
    body:='{"action":"sync-overdue-30"}'::jsonb
  );
  SELECT net.http_post(
    url:='https://scpbqsvwojhbxihyqbdz.supabase.co/functions/v1/asaas-debtors-api?action=sync-overdue',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcGJxc3Z3b2poYnhpaHlxYmR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjcyNTUsImV4cCI6MjA5MDA0MzI1NX0.FTZt4yiL6dVsYT9cQnqrABgS0sMXYl23wf4ZtzP-GAE"}'::jsonb,
    body:='{"action":"sync-overdue"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'cobranca-reentry-daily',
  '15 13 * * *',
  $$ SELECT public.recheck_cobranca_reentry(); $$
);;

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
