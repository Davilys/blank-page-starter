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
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();