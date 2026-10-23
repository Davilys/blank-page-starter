NPI (três modalidades): base persistente, versionamento e log de IA.
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
