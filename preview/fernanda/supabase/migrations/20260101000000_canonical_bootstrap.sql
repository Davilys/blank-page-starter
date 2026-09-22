-- PREVIEW-ONLY sanitized canonical bootstrap. Never merge/deploy to production.
-- Offline bootstrap from repository-local migrations before the first captured remote ledger version.
-- Ephemeral CI only. Never apply to production.

-- BEGIN LOCAL BOOTSTRAP 20260107210351_remix_migration_from_pg_dump.sql
CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- PostgreSQL database dump complete
--




COMMIT;
-- END LOCAL BOOTSTRAP 20260107210351_remix_migration_from_pg_dump.sql

-- BEGIN LOCAL BOOTSTRAP 20260108163107_e41b3b6d-2e54-4a13-8159-31e1e1b727b5.sql
-- =============================================
-- ÁREA DO CLIENTE WEBMARCAS - ESTRUTURA BASE
-- =============================================

-- 1. PERFIS DE CLIENTES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  cpf_cnpj TEXT,
  company_name TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  perfex_customer_id TEXT,
  asaas_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Service role can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (true);

-- 2. PROCESSOS DE MARCA
CREATE TABLE public.brand_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  business_area TEXT,
  ncl_classes INTEGER[],
  status TEXT DEFAULT 'em_andamento' CHECK (status IN (
    'em_andamento', 'publicado_rpi', 'em_exame', 'deferido', 'concedido', 'indeferido', 'arquivado'
  )),
  process_number TEXT,
  inpi_protocol TEXT,
  deposit_date DATE,
  grant_date DATE,
  expiry_date DATE,
  next_step TEXT,
  next_step_date DATE,
  notes TEXT,
  perfex_project_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.brand_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own processes" ON public.brand_processes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own processes" ON public.brand_processes
  FOR UPDATE USING (auth.uid() = user_id);

-- 3. TIMELINE DE EVENTOS DO PROCESSO
CREATE TABLE public.process_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID REFERENCES public.brand_processes(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'protocolo', 'publicacao_rpi', 'exigencia', 'prazo', 'deferimento', 
    'indeferimento', 'recurso', 'concessao', 'renovacao', 'outro'
  )),
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  rpi_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.process_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own process events" ON public.process_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.brand_processes bp 
      WHERE bp.id = process_id AND bp.user_id = auth.uid()
    )
  );

-- 4. DOCUMENTOS
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID REFERENCES public.brand_processes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document_type TEXT CHECK (document_type IN (
    'contrato', 'laudo', 'notificacao', 'certificado', 'rpi', 'comprovante', 'outro'
  )),
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by TEXT DEFAULT 'system',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents" ON public.documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can upload documents" ON public.documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. FATURAS (Sincronizado com Asaas)
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  process_id UUID REFERENCES public.brand_processes(id) ON DELETE SET NULL,
  asaas_invoice_id TEXT UNIQUE,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'received', 'overdue', 'refunded', 'canceled'
  )),
  due_date DATE NOT NULL,
  payment_date DATE,
  payment_method TEXT,
  invoice_url TEXT,
  boleto_code TEXT,
  pix_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoices" ON public.invoices
  FOR SELECT USING (auth.uid() = user_id);

-- 6. NOTIFICAÇÕES
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
  read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- 7. MENSAGENS DO CHATBOT
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" ON public.chat_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert messages" ON public.chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 8. CONTRATOS
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  process_id UUID REFERENCES public.brand_processes(id) ON DELETE SET NULL,
  contract_number TEXT,
  contract_type TEXT DEFAULT 'registro_marca',
  contract_html TEXT,
  signed_at TIMESTAMP WITH TIME ZONE,
  ip_address TEXT,
  user_agent TEXT,
  perfex_contract_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contracts" ON public.contracts
  FOR SELECT USING (auth.uid() = user_id);

-- 9. HISTÓRICO DE LOGIN
CREATE TABLE public.login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  login_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own login history" ON public.login_history
  FOR SELECT USING (auth.uid() = user_id);

-- TRIGGER para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_brand_processes_updated_at
  BEFORE UPDATE ON public.brand_processes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TRIGGER para criar perfil automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- END LOCAL BOOTSTRAP 20260108163107_e41b3b6d-2e54-4a13-8159-31e1e1b727b5.sql

-- BEGIN LOCAL BOOTSTRAP 20260108163300_185c6286-5ebf-4b3b-b47a-a0db19987d49.sql
-- Corrigir policy permissiva de INSERT
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.profiles;

-- Criar policy que permite inserção apenas para o próprio usuário ou via trigger
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
-- END LOCAL BOOTSTRAP 20260108163300_185c6286-5ebf-4b3b-b47a-a0db19987d49.sql

-- BEGIN LOCAL BOOTSTRAP 20260108163355_963b27e1-f454-4d93-9db8-1fe239aa7011.sql
-- Criar bucket para documentos
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);

-- Policies para o bucket de documentos
CREATE POLICY "Users can view own documents storage"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
-- END LOCAL BOOTSTRAP 20260108163355_963b27e1-f454-4d93-9db8-1fe239aa7011.sql

-- BEGIN LOCAL BOOTSTRAP 20260108165110_7b981538-09c8-4221-a9ee-a4c7b08e6e89.sql
-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));
-- END LOCAL BOOTSTRAP 20260108165110_7b981538-09c8-4221-a9ee-a4c7b08e6e89.sql

-- BEGIN LOCAL BOOTSTRAP 20260108180124_2b7d3d4d-976c-4a88-bef8-526520240da5.sql
-- Add RLS policies for admins to access all data

-- Profiles: Admin can view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Brand Processes: Admin can manage all processes
CREATE POLICY "Admins can view all processes"
ON public.brand_processes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert processes"
ON public.brand_processes
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all processes"
ON public.brand_processes
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete processes"
ON public.brand_processes
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Invoices: Admin can manage all invoices
CREATE POLICY "Admins can view all invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert invoices"
ON public.invoices
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all invoices"
ON public.invoices
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete invoices"
ON public.invoices
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Documents: Admin can manage all documents
CREATE POLICY "Admins can view all documents"
ON public.documents
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all documents"
ON public.documents
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete documents"
ON public.documents
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Notifications: Admin can manage all notifications
CREATE POLICY "Admins can view all notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Process Events: Admin can manage all process events
CREATE POLICY "Admins can view all process events"
ON public.process_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert process events"
ON public.process_events
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all process events"
ON public.process_events
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Contracts: Admin can manage all contracts
CREATE POLICY "Admins can view all contracts"
ON public.contracts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert contracts"
ON public.contracts
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Login History: Admin can view all login history
CREATE POLICY "Admins can view all login history"
ON public.login_history
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Chat Messages: Admin can view all chat messages
CREATE POLICY "Admins can view all chat messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
-- END LOCAL BOOTSTRAP 20260108180124_2b7d3d4d-976c-4a88-bef8-526520240da5.sql

-- BEGIN LOCAL BOOTSTRAP 20260108182810_28c951c2-00c3-4e48-a00c-b66fab4e9aac.sql
-- Create table for INPI administrative resources
CREATE TABLE public.inpi_resources (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('indeferimento', 'exigencia_merito', 'oposicao')),
    process_number TEXT,
    brand_name TEXT,
    ncl_class TEXT,
    holder TEXT,
    examiner_or_opponent TEXT,
    legal_basis TEXT,
    draft_content TEXT,
    final_content TEXT,
    adjustments_history JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'finalized')),
    original_pdf_path TEXT,
    final_pdf_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    approved_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.inpi_resources ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Only admins can access
CREATE POLICY "Admins can view all INPI resources"
ON public.inpi_resources
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert INPI resources"
ON public.inpi_resources
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update INPI resources"
ON public.inpi_resources
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete INPI resources"
ON public.inpi_resources
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_inpi_resources_updated_at
BEFORE UPDATE ON public.inpi_resources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- END LOCAL BOOTSTRAP 20260108182810_28c951c2-00c3-4e48-a00c-b66fab4e9aac.sql

-- BEGIN LOCAL BOOTSTRAP 20260108190430_1c5dcae6-89b1-4cf0-b89b-c1141f6dffe4.sql
-- Add pipeline_stage column to brand_processes to track Kanban stages
ALTER TABLE public.brand_processes 
ADD COLUMN IF NOT EXISTS pipeline_stage text DEFAULT 'protocolado';

-- Add priority and origin columns for client management
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS origin text DEFAULT 'site',
ADD COLUMN IF NOT EXISTS contract_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_contact timestamp with time zone;

-- Create client_notes table for internal notes
CREATE TABLE IF NOT EXISTS public.client_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    admin_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create client_activities table for tracking changes
CREATE TABLE IF NOT EXISTS public.client_activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    admin_id uuid,
    activity_type text NOT NULL,
    description text NOT NULL,
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now()
);

-- Create client_appointments table for scheduling
CREATE TABLE IF NOT EXISTS public.client_appointments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    admin_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    scheduled_at timestamp with time zone NOT NULL,
    completed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_appointments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_notes (admin only)
CREATE POLICY "Admins can view all client notes" ON public.client_notes
    FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert client notes" ON public.client_notes
    FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update client notes" ON public.client_notes
    FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete client notes" ON public.client_notes
    FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for client_activities (admin only)
CREATE POLICY "Admins can view all client activities" ON public.client_activities
    FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert client activities" ON public.client_activities
    FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for client_appointments (admin only)
CREATE POLICY "Admins can view all client appointments" ON public.client_appointments
    FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert client appointments" ON public.client_appointments
    FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update client appointments" ON public.client_appointments
    FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete client appointments" ON public.client_appointments
    FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Add policy for admins to update profiles
CREATE POLICY "Admins can update all profiles" ON public.profiles
    FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
-- END LOCAL BOOTSTRAP 20260108190430_1c5dcae6-89b1-4cf0-b89b-c1141f6dffe4.sql

-- BEGIN LOCAL BOOTSTRAP 20260108200522_e3dae0e8-f2a8-46b2-afe7-38b6bf0fc3f5.sql
-- Create table for RPI uploads
CREATE TABLE public.rpi_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  rpi_date DATE,
  rpi_number TEXT,
  total_processes_found INTEGER DEFAULT 0,
  total_clients_matched INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  summary TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id)
);

-- Create table for extracted RPI entries
CREATE TABLE public.rpi_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rpi_upload_id UUID NOT NULL REFERENCES public.rpi_uploads(id) ON DELETE CASCADE,
  process_number TEXT NOT NULL,
  brand_name TEXT,
  ncl_classes TEXT[],
  dispatch_type TEXT,
  dispatch_code TEXT,
  dispatch_text TEXT,
  publication_date DATE,
  holder_name TEXT,
  attorney_name TEXT,
  matched_client_id UUID,
  matched_process_id UUID,
  update_status TEXT DEFAULT 'pending',
  updated_at TIMESTAMP WITH TIME ZONE,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rpi_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpi_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rpi_uploads (admin only)
CREATE POLICY "Admins can view all RPI uploads"
  ON public.rpi_uploads FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert RPI uploads"
  ON public.rpi_uploads FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update RPI uploads"
  ON public.rpi_uploads FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete RPI uploads"
  ON public.rpi_uploads FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for rpi_entries (admin only)
CREATE POLICY "Admins can view all RPI entries"
  ON public.rpi_entries FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert RPI entries"
  ON public.rpi_entries FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update RPI entries"
  ON public.rpi_entries FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete RPI entries"
  ON public.rpi_entries FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_rpi_entries_process_number ON public.rpi_entries(process_number);
CREATE INDEX idx_rpi_entries_matched_client ON public.rpi_entries(matched_client_id);
CREATE INDEX idx_rpi_uploads_status ON public.rpi_uploads(status);
-- END LOCAL BOOTSTRAP 20260108200522_e3dae0e8-f2a8-46b2-afe7-38b6bf0fc3f5.sql

-- BEGIN LOCAL BOOTSTRAP 20260108204314_6b0559b0-d7a2-43c9-9a16-de763a95762d.sql
-- Políticas de storage para permitir admins fazerem upload de PDFs da RPI
CREATE POLICY "Admins can upload RPI PDFs"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = 'rpi'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can read RPI files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = 'rpi'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete RPI files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = 'rpi'
  AND public.has_role(auth.uid(), 'admin')
);
-- END LOCAL BOOTSTRAP 20260108204314_6b0559b0-d7a2-43c9-9a16-de763a95762d.sql

-- BEGIN LOCAL BOOTSTRAP 20260109170029_a3c368fd-c0ab-4e14-a69b-fb401d0e1adb.sql
-- Create leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company_name TEXT,
  cpf_cnpj TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  status TEXT NOT NULL DEFAULT 'novo',
  origin TEXT DEFAULT 'site',
  estimated_value NUMERIC(12,2),
  assigned_to UUID,
  notes TEXT,
  converted_at TIMESTAMPTZ,
  converted_to_client_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create contract_types table
CREATE TABLE public.contract_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default contract types
INSERT INTO public.contract_types (name, description) VALUES
  ('REGISTRO DE MARCA', 'Contrato para registro de marca no INPI'),
  ('DISTRATO SEM MULTA', 'Contrato de distrato sem aplicação de multa'),
  ('DISTRATO COM MULTA', 'Contrato de distrato com aplicação de multa'),
  ('RENOVAÇÃO', 'Contrato de renovação de marca');

-- Create contract_templates table
CREATE TABLE public.contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contract_type_id UUID REFERENCES public.contract_types(id),
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Expand contracts table with new columns
ALTER TABLE public.contracts 
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS contract_value NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS contract_type_id UUID REFERENCES public.contract_types(id),
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.contract_templates(id),
  ADD COLUMN IF NOT EXISTS signature_status TEXT DEFAULT 'not_signed',
  ADD COLUMN IF NOT EXISTS signature_ip TEXT,
  ADD COLUMN IF NOT EXISTS signature_user_agent TEXT,
  ADD COLUMN IF NOT EXISTS visible_to_client BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT;

-- Create contract_comments table
CREATE TABLE public.contract_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id UUID,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create contract_attachments table
CREATE TABLE public.contract_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create contract_tasks table
CREATE TABLE public.contract_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  assigned_to UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create contract_notes table
CREATE TABLE public.contract_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create contract_renewal_history table
CREATE TABLE public.contract_renewal_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  previous_end_date DATE,
  new_end_date DATE,
  previous_value NUMERIC(12,2),
  new_value NUMERIC(12,2),
  notes TEXT,
  renewed_by UUID,
  renewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create import_logs table
CREATE TABLE public.import_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_type TEXT NOT NULL,
  file_name TEXT,
  total_records INTEGER,
  imported_records INTEGER,
  failed_records INTEGER,
  errors JSONB,
  imported_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_renewal_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leads (admin only)
CREATE POLICY "Admins can manage leads" ON public.leads
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for contract_types (read all, write admin)
CREATE POLICY "Anyone can read contract types" ON public.contract_types
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage contract types" ON public.contract_types
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for contract_templates (admin only)
CREATE POLICY "Admins can manage contract templates" ON public.contract_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for contract_comments
CREATE POLICY "Users can view their contract comments" ON public.contract_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c 
      WHERE c.id = contract_id AND c.user_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage contract comments" ON public.contract_comments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for contract_attachments
CREATE POLICY "Users can view their contract attachments" ON public.contract_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c 
      WHERE c.id = contract_id AND c.user_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage contract attachments" ON public.contract_attachments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for contract_tasks (admin only)
CREATE POLICY "Admins can manage contract tasks" ON public.contract_tasks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for contract_notes (admin only)
CREATE POLICY "Admins can manage contract notes" ON public.contract_notes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for contract_renewal_history
CREATE POLICY "Users can view their renewal history" ON public.contract_renewal_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c 
      WHERE c.id = contract_id AND c.user_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage renewal history" ON public.contract_renewal_history
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for import_logs (admin only)
CREATE POLICY "Admins can manage import logs" ON public.import_logs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contract_templates_updated_at BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contract_notes_updated_at BEFORE UPDATE ON public.contract_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- END LOCAL BOOTSTRAP 20260109170029_a3c368fd-c0ab-4e14-a69b-fb401d0e1adb.sql

-- BEGIN LOCAL BOOTSTRAP 20260109193236_50f3fad3-f472-4d21-afbf-6f95242f85eb.sql
-- Create table for Perfex customers (external customers not yet in auth system)
CREATE TABLE public.perfex_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfex_id TEXT UNIQUE NOT NULL,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  company_name TEXT,
  cpf_cnpj TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  active BOOLEAN DEFAULT true,
  synced_profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add perfex_customer_id to contracts table for linking to external customers
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS perfex_customer_id UUID REFERENCES public.perfex_customers(id);

-- Enable RLS on perfex_customers
ALTER TABLE public.perfex_customers ENABLE ROW LEVEL SECURITY;

-- RLS policies for perfex_customers (admin only)
CREATE POLICY "Admins can manage perfex customers"
ON public.perfex_customers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_perfex_customers_perfex_id ON public.perfex_customers(perfex_id);
CREATE INDEX idx_perfex_customers_email ON public.perfex_customers(email);
CREATE INDEX idx_contracts_perfex_customer_id ON public.contracts(perfex_customer_id);

-- Trigger to update updated_at
CREATE TRIGGER update_perfex_customers_updated_at
BEFORE UPDATE ON public.perfex_customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- END LOCAL BOOTSTRAP 20260109193236_50f3fad3-f472-4d21-afbf-6f95242f85eb.sql

-- BEGIN LOCAL BOOTSTRAP 20260109201218_3cef7a2c-6e1e-4aab-adcf-f5d537db10d8.sql
-- First, create a contract type for "Registro de Marca" if it doesn't exist
INSERT INTO public.contract_types (id, name, description)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Registro de Marca',
  'Contrato para serviços de registro de marca junto ao INPI'
)
ON CONFLICT (id) DO NOTHING;

-- Insert the complete contract template with all 12 clauses
INSERT INTO public.contract_templates (
  name,
  content,
  contract_type_id,
  is_active,
  variables
) VALUES (
  'Contrato Padrão - Registro de Marca INPI',
  'CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS DE ASSESSORAMENTO PARA REGISTRO DE MARCA JUNTO AO INPI

Por este instrumento particular de prestação de serviços, que fazem, de um lado:

I) WEB MARCAS PATENTES EIRELI, com sede na cidade de SÃO PAULO, Estado de SP, na AVENIDA BRIGADEIRO LUIS ANTONIO, Nº: 2696, CEP: 01402-000, inscrita no CNPJ/MF sob o Nº: 39.528.012/0001-29, neste ato representada por seu titular, senhor Davilys Danques de Oliveira Cunha, brasileiro, casado, regularmente inscrito no RG sob o Nº 50.688.779-0 e CPF sob o Nº 393.239.118-79, a seguir denominada CONTRATADA.

II) {{razao_social_ou_nome}}, {{dados_cnpj}}com sede na {{endereco_completo}}, neste ato representada por {{nome_cliente}}, CPF sob o nº {{cpf}}, com endereço de e-mail para faturamento {{email}} e Tel: {{telefone}}, ("Contratante").

As partes celebram o presente Acordo de Tarifas, que se regerá pelas cláusulas e condições abaixo:

1. CLÁUSULA PRIMEIRA – DO OBJETO

1.1 A CONTRATADA prestará os serviços de preparo, protocolo e acompanhamento do pedido de registro da marca "{{marca}}" junto ao INPI até a conclusão do processo, no ramo de atividade: {{ramo_atividade}}.

2. CLÁUSULA SEGUNDA – DA RESPONSABILIDADE SOBRE OS SERVIÇOS CONTRATADOS

2.1 Executar os serviços com responsabilidade e qualidade;
2.2 Fornecer cópia digital dos atos praticados junto ao INPI;
2.3 Comunicar à CONTRATANTE eventuais impedimentos ou exigências;
2.4 Acompanhar semanalmente o processo no INPI e informar colidências, exigências ou publicações;
2.5 Garantir o investimento da CONTRATANTE com nova tentativa sem custos adicionais de honorários caso o registro seja negado.

3. CLÁUSULA TERCEIRA - DAS OBRIGAÇÕES GERAIS DA CONTRATADA

3.1 Enviar cópias digitais por e-mail e relatório anual do processo;
3.2 Executar os serviços conforme o contrato e a legislação;
3.3 Cumprir prazos e exigências do INPI;
3.4 Comunicar impedimentos imediatamente, a fim de cumprir as normas do INPI para garantir o registro.

4. CLÁUSULA QUARTA – DAS OBRIGAÇÕES GERAIS DA CONTRATANTE

4.1 A CONTRATANTE obriga-se a efetuar os pagamentos na forma, prazos e condições estabelecidas neste instrumento.
4.2 A CONTRATANTE compromete-se a fornecer à CONTRATADA todas as informações, documentos e materiais solicitados, de forma completa e dentro dos prazos estipulados.
4.3 A CONTRATANTE poderá solicitar ajustes ou correções nos serviços prestados somente quando houver divergência comprovada com o objeto deste contrato.
4.4 A CONTRATANTE reconhece que a CONTRATADA atua como assessoria técnica e jurídica especializada, sendo que a decisão final sobre a concessão do registro de marca cabe exclusivamente ao INPI.

5. CLÁUSULA QUINTA – DAS CONDIÇÕES DE PAGAMENTO

5.1 Os pagamentos à CONTRATADA serão efetuados conforme a opção escolhida:
{{forma_pagamento_detalhada}}
5.2 Taxas do INPI: As taxas federais obrigatórias (GRU) serão de responsabilidade exclusiva do CONTRATANTE, devendo ser recolhidas diretamente ao INPI.
5.3 O cadastro do CONTRATANTE junto ao INPI é realizado pela CONTRATADA previamente ao pagamento das taxas federais.
5.4 Em caso de parcelamento, o atraso de qualquer parcela implicará no vencimento antecipado de todas as demais, com acréscimo de multa e juros conforme cláusula sétima.

6. CLÁUSULA SEXTA – DO PRAZO DE VIGÊNCIA

6.1 O presente contrato terá vigência a partir da data de sua assinatura e perdurará até o final do decênio de registro de marca junto ao INPI, podendo ser renovado mediante termo aditivo.

7. CLÁUSULA SÉTIMA – DA INADIMPLÊNCIA

7.1 No caso de inadimplência, a CONTRATANTE estará sujeita a:
a) Multa de 10% (dez por cento) sobre o valor total devido;
b) Juros de mora de 1% (um por cento) ao mês;
c) Correção monetária pelo IGPM/FGV;
d) Suspensão imediata dos serviços até a regularização do débito;
e) Inscrição em cadastros de proteção ao crédito após 30 dias de inadimplência.

8. CLÁUSULA OITAVA – DA CONFIDENCIALIDADE

8.1 As partes se comprometem a manter em sigilo absoluto todas as informações confidenciais trocadas durante a execução do contrato, incluindo dados pessoais, comerciais e estratégicos.
8.2 Esta obrigação de confidencialidade permanecerá vigente por prazo indeterminado, mesmo após o término deste contrato.

9. CLÁUSULA NONA – DA RESCISÃO

9.1 Este contrato poderá ser rescindido por qualquer das partes mediante aviso prévio de 30 (trinta) dias, por escrito.
9.2 A CONTRATANTE somente poderá cancelar o contrato se não houver débitos pendentes com a CONTRATADA.
9.3 Em caso de rescisão antecipada por iniciativa da CONTRATANTE, não haverá devolução de valores já pagos referentes a serviços executados ou em andamento.

10. CLÁUSULA DÉCIMA – DAS CONDIÇÕES GERAIS

10.1 Fica pactuada entre as partes a prestação dos serviços de acompanhamento e vigilância do(s) processo(s) referentes à marca {{marca}}.
10.2 Durante a tramitação do processo junto ao INPI, poderão surgir situações que exijam a apresentação de documentos adicionais, os quais deverão ser providenciados pela CONTRATANTE em tempo hábil.
10.3 A CONTRATADA não se responsabiliza por decisões do INPI contrárias ao pedido de registro, desde que tenha cumprido integralmente suas obrigações contratuais.

11. CLÁUSULA DÉCIMA PRIMEIRA – DAS DISPOSIÇÕES FINAIS

11.1 Este contrato representa o acordo integral entre as partes, substituindo quaisquer negociações ou acordos anteriores, verbais ou escritos.
11.2 A tolerância de uma das partes quanto ao descumprimento de qualquer obrigação pela outra não implica novação ou renúncia de direitos.
11.3 Qualquer alteração deste contrato somente será válida se formalizada por escrito e assinada por ambas as partes.

12. CLÁUSULA DÉCIMA SEGUNDA – DO FORO

12.1 Para dirimir quaisquer dúvidas ou controvérsias oriundas do presente instrumento, as partes elegem o Foro da Comarca de São Paulo – SP, com renúncia expressa a qualquer outro, por mais privilegiado que seja.

Por estarem justas e contratadas, as partes assinam o presente instrumento em 02 (duas) vias de igual teor e forma, na presença das testemunhas abaixo.

São Paulo, {{data_extenso}}.

_______________________________
WEB MARCAS PATENTES EIRELI
CNPJ: 39.528.012/0001-29

_______________________________
{{nome_cliente}}
CPF: {{cpf}}',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  true,
  '["{{nome_cliente}}", "{{cpf}}", "{{email}}", "{{telefone}}", "{{marca}}", "{{ramo_atividade}}", "{{endereco_completo}}", "{{razao_social_ou_nome}}", "{{dados_cnpj}}", "{{forma_pagamento_detalhada}}", "{{data_extenso}}"]'::jsonb
);
-- END LOCAL BOOTSTRAP 20260109201218_3cef7a2c-6e1e-4aab-adcf-f5d537db10d8.sql

-- BEGIN LOCAL BOOTSTRAP 20260109202745_1147a13e-00b7-4ca7-a724-1b2dde9fc028.sql
-- Add blockchain signature fields to contracts table
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS blockchain_hash text,
ADD COLUMN IF NOT EXISTS blockchain_timestamp text,
ADD COLUMN IF NOT EXISTS blockchain_tx_id text,
ADD COLUMN IF NOT EXISTS blockchain_network text DEFAULT 'Bitcoin (OpenTimestamps)',
ADD COLUMN IF NOT EXISTS blockchain_proof text,
ADD COLUMN IF NOT EXISTS device_info jsonb DEFAULT '{}'::jsonb;

-- Add index for faster hash lookups (for verification)
CREATE INDEX IF NOT EXISTS idx_contracts_blockchain_hash ON public.contracts(blockchain_hash);

-- Add RLS policy for updating contracts with blockchain data (service role only via edge function)
CREATE POLICY "Service role can update contract signatures" 
ON public.contracts 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- Comment explaining the blockchain fields
COMMENT ON COLUMN public.contracts.blockchain_hash IS 'SHA-256 hash of the contract content';
COMMENT ON COLUMN public.contracts.blockchain_timestamp IS 'Timestamp when registered in blockchain';
COMMENT ON COLUMN public.contracts.blockchain_tx_id IS 'Transaction/attestation ID from OpenTimestamps';
COMMENT ON COLUMN public.contracts.blockchain_network IS 'Blockchain network used (default: Bitcoin via OpenTimestamps)';
COMMENT ON COLUMN public.contracts.blockchain_proof IS 'Base64 encoded cryptog
raphic proof from OpenTimestamps';
COMMENT ON COLUMN public.contracts.device_info IS 'JSON with device information (browser, OS, screen resolution, timezone)';
-- END LOCAL BOOTSTRAP 20260109202745_1147a13e-00b7-4ca7-a724-1b2dde9fc028.sql

-- BEGIN LOCAL BOOTSTRAP 20260109202808_bc25837d-9986-41cc-8869-016aa8281b1e.sql
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can update contract signatures" ON public.contracts;

-- Create a proper policy for users to update their own contracts (for signature)
CREATE POLICY "Users can update own contracts for signature" 
ON public.contracts 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create policy for admins to update any contract
CREATE POLICY "Admins can update all contracts" 
ON public.contracts 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- END LOCAL BOOTSTRAP 20260109202808_bc25837d-9986-41cc-8869-016aa8281b1e.sql

-- BEGIN LOCAL BOOTSTRAP 20260109205859_bc00df96-9b79-40dd-bfe8-5a691177bfc0.sql

-- Tabela para configurações de conta de email do admin
CREATE TABLE public.email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'smtp',
  email_address TEXT NOT NULL,
  display_name TEXT,
  smtp_host TEXT,
  smtp_port INTEGER DEFAULT 587,
  smtp_user TEXT,
  smtp_password TEXT,
  imap_host TEXT,
  imap_port INTEGER DEFAULT 993,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para templates de email automático
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  trigger_event TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para histórico de emails enviados
CREATE TABLE public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  cc_emails TEXT[],
  bcc_emails TEXT[],
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  html_body TEXT,
  status TEXT DEFAULT 'sent',
  trigger_type TEXT DEFAULT 'manual',
  related_lead_id UUID REFERENCES public.leads(id),
  template_id UUID REFERENCES public.email_templates(id),
  error_message TEXT,
  sent_by UUID,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para emails recebidos (cache local)
CREATE TABLE public.email_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  message_id TEXT UNIQUE,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_inbox ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_accounts
CREATE POLICY "Admins can manage email accounts"
ON public.email_accounts FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for email_templates
CREATE POLICY "Admins can manage email templates"
ON public.email_templates FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for email_logs
CREATE POLICY "Admins can manage email logs"
ON public.email_logs FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for email_inbox
CREATE POLICY "Admins can manage email inbox"
ON public.email_inbox FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_email_accounts_updated_at
BEFORE UPDATE ON public.email_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add columns to leads for email automation tracking
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS form_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_opt_out BOOLEAN DEFAULT false;

-- END LOCAL BOOTSTRAP 20260109205859_bc00df96-9b79-40dd-bfe8-5a691177bfc0.sql

-- BEGIN LOCAL BOOTSTRAP 20260109214018_ff47d900-f37b-4551-a9ee-262b6b23317c.sql
-- Allow public insert on leads table for form submissions (unauthenticated users)
CREATE POLICY "Anyone can create leads from form" 
ON public.leads 
FOR INSERT 
WITH CHECK (true);

-- Allow public update on leads for form_started_at (unauthenticated users)
CREATE POLICY "Anyone can update their own lead by email" 
ON public.leads 
FOR UPDATE 
USING (true)
WITH CHECK (true);
-- END LOCAL BOOTSTRAP 20260109214018_ff47d900-f37b-4551-a9ee-262b6b23317c.sql

-- BEGIN LOCAL BOOTSTRAP 20260109214048_c9324d1a-c0b2-46a2-9fdd-114122379f2b.sql
-- Drop the overly permissive update policy
DROP POLICY IF EXISTS "Anyone can update their own lead by email" ON public.leads;

-- Create a more restrictive policy that only allows updating form_started_at and last_reminder_sent_at
-- Note: The Edge Functions use service role key which bypasses RLS, so this mainly protects from client-side abuse
-- END LOCAL BOOTSTRAP 20260109214048_c9324d1a-c0b2-46a2-9fdd-114122379f2b.sql

-- BEGIN LOCAL BOOTSTRAP 20260109220420_c44f99dc-68da-475f-8827-6ec895302813.sql
-- Add storage policy for admins to upload client documents
CREATE POLICY "Admins can upload client documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' AND 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Add storage policy for admins to read client documents
CREATE POLICY "Admins can read client documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' AND 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Add storage policy for admins to delete client documents
CREATE POLICY "Admins can delete client documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' AND 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Add storage policy for users to read their own documents
CREATE POLICY "Users can read own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
-- END LOCAL BOOTSTRAP 20260109220420_c44f99dc-68da-475f-8827-6ec895302813.sql

-- BEGIN LOCAL BOOTSTRAP 20260109223517_1dc2503a-ce4b-4528-942f-942724582ad8.sql
-- Remover constraint antiga
ALTER TABLE documents 
DROP CONSTRAINT IF EXISTS documents_document_type_check;

-- Adicionar nova constraint com todos os tipos necessários
ALTER TABLE documents 
ADD CONSTRAINT documents_document_type_check 
CHECK (document_type = ANY (ARRAY[
  'contrato',
  'procuracao', 
  'certificado',
  'comprovante',
  'parecer',
  'rpi',
  'laudo',
  'notificacao',
  'anexo',
  'outro'
]::text[]));
-- END LOCAL BOOTSTRAP 20260109223517_1dc2503a-ce4b-4528-942f-942724582ad8.sql

-- BEGIN LOCAL BOOTSTRAP 20260109225939_558800a1-7ace-4f16-a808-8844668835a1.sql
-- Criar tabela de templates de notificação
CREATE TABLE public.notification_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  category TEXT NOT NULL DEFAULT 'geral',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Habilitar RLS
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para admins
CREATE POLICY "Admins can manage notification templates"
ON public.notification_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_notification_templates_updated_at
BEFORE UPDATE ON public.notification_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir templates padrão de Cobrança Extrajudicial
INSERT INTO public.notification_templates (name, title, message, type, category) VALUES
('Cobrança - Fatura Vencida', 'Fatura Vencida - Ação Necessária', 'Prezado(a) cliente, identificamos que sua fatura encontra-se vencida. Solicitamos a regularização do pagamento para evitar a suspensão dos serviços. Em caso de dúvidas, entre em contato conosco.', 'warning', 'cobranca'),
('Cobrança - Atraso de Pagamento', 'Aviso de Atraso - Segunda Notificação', 'Prezado(a) cliente, esta é nossa segunda notificação referente ao atraso no pagamento. Pedimos que regularize sua situação financeira o mais breve possível para evitar medidas adicionais.', 'warning', 'cobranca'),
('Cobrança - Protesto', 'Aviso de Protesto - Última Notificação', 'Prezado(a) cliente, informamos que devido ao não pagamento da fatura, seu título será encaminhado para protesto em cartório. Para evitar esta medida, efetue o pagamento imediatamente.', 'error', 'cobranca');

-- Inserir templates padrão de Exigências INPI
INSERT INTO public.notification_templates (name, title, message, type, category) VALUES
('INPI - Prazo 60 dias', 'Exigência INPI - Prazo de 60 dias', 'Prezado(a) cliente, informamos que foi publicada uma exigência do INPI referente ao seu processo de marca. Você tem 60 dias para cumprir a exigência. Nossa equipe já está trabalhando na resposta.', 'info', 'inpi'),
('INPI - Prazo 30 dias', 'Exigência INPI - Restam 30 dias', 'Prezado(a) cliente, lembramos que restam 30 dias para cumprimento da exigência do INPI referente ao seu processo de marca. Por favor, verifique se há pendências de sua parte.', 'warning', 'inpi'),
('INPI - Prazo 15 dias', 'Exigência INPI - Restam 15 dias (Urgente)', 'URGENTE: Prezado(a) cliente, restam apenas 15 dias para cumprimento da exigência do INPI. Caso haja alguma pendência de documentação, solicitamos envio imediato para evitar arquivamento.', 'warning', 'inpi'),
('INPI - Vencimento Hoje', 'Exigência INPI - Prazo Vence Hoje!', 'ATENÇÃO: O prazo para cumprimento da exigência do INPI vence HOJE. Se houver qualquer pendência de sua parte, entre em contato imediatamente. Após esta data, o processo poderá ser arquivado.', 'error', 'inpi');
-- END LOCAL BOOTSTRAP 20260109225939_558800a1-7ace-4f16-a808-8844668835a1.sql

-- BEGIN LOCAL BOOTSTRAP 20260109230837_8913bfe9-8500-4452-ae28-52282914c054.sql
-- Create whatsapp_config table for BotConversa integration
CREATE TABLE public.whatsapp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key TEXT NOT NULL,
  company_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

-- RLS policy for admins only
CREATE POLICY "Admins can manage whatsapp config"
ON public.whatsapp_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create notification_logs table for multi-channel tracking
CREATE TABLE public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'platform')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT,
  recipient TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- RLS policy for admins
CREATE POLICY "Admins can manage notification logs"
ON public.notification_logs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add channels column to notifications table
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS channels JSONB DEFAULT '{"platform": true}'::jsonb;

-- Trigger for updated_at on whatsapp_config
CREATE TRIGGER update_whatsapp_config_updated_at
BEFORE UPDATE ON public.whatsapp_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- END LOCAL BOOTSTRAP 20260109230837_8913bfe9-8500-4452-ae28-52282914c054.sql

-- BEGIN LOCAL BOOTSTRAP 20260109231657_46ed1c1c-987d-4256-b78d-7d25cb87c191.sql
-- Adicionar colunas específicas do Evolution API na tabela whatsapp_config
ALTER TABLE public.whatsapp_config
ADD COLUMN IF NOT EXISTS server_url TEXT,
ADD COLUMN IF NOT EXISTS instance_name TEXT DEFAULT 'webmarcas';
-- END LOCAL BOOTSTRAP 20260109231657_46ed1c1c-987d-4256-b78d-7d25cb87c191.sql

-- BEGIN LOCAL BOOTSTRAP 20260109233845_0ee06413-1fcd-48e6-8be7-af102f5c506a.sql
-- Adicionar colunas na tabela contracts para assinatura digital
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS signature_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS signature_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS client_signature_image TEXT,
ADD COLUMN IF NOT EXISTS contractor_signature_image TEXT,
ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'contract',
ADD COLUMN IF NOT EXISTS signatory_name TEXT,
ADD COLUMN IF NOT EXISTS signatory_cpf TEXT,
ADD COLUMN IF NOT EXISTS signatory_cnpj TEXT,
ADD COLUMN IF NOT EXISTS penalty_value NUMERIC;

-- Criar índice para busca rápida por token
CREATE INDEX IF NOT EXISTS idx_contracts_signature_token ON public.contracts(signature_token);

-- Criar tabela de auditoria de assinaturas
CREATE TABLE IF NOT EXISTS public.signature_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS na tabela de auditoria
ALTER TABLE public.signature_audit_log ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para signature_audit_log
CREATE POLICY "Admins can manage audit logs" ON public.signature_audit_log
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their contract audit logs" ON public.signature_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contracts c 
      WHERE c.id = signature_audit_log.contract_id 
      AND c.user_id = auth.uid()
    )
  );

-- Adicionar tipo PROCURACAO na tabela contract_types (se não existir)
INSERT INTO public.contract_types (name, description)
SELECT 'PROCURACAO', 'Procuração para representação junto ao INPI'
WHERE NOT EXISTS (SELECT 1 FROM public.contract_types WHERE name = 'PROCURACAO');

-- Adicionar tipos DISTRATO
INSERT INTO public.contract_types (name, description)
SELECT 'DISTRATO_COM_MULTA', 'Acordo de Distrato de Parceria com multa'
WHERE NOT EXISTS (SELECT 1 FROM public.contract_types WHERE name = 'DISTRATO_COM_MULTA');

INSERT INTO public.contract_types (name, description)
SELECT 'DISTRATO_SEM_MULTA', 'Acordo de Distrato de Parceria sem multa'
WHERE NOT EXISTS (SELECT 1 FROM public.contract_types WHERE name = 'DISTRATO_SEM_MULTA');

-- Política para permitir acesso público a contratos via token (para assinatura)
CREATE POLICY "Public can view contracts by valid token" ON public.contracts
  FOR SELECT USING (
    signature_token IS NOT NULL 
    AND (signature_expires_at IS NULL OR signature_expires_at > now())
  );

-- Política para permitir atualização pública de contratos via token (para assinatura)
CREATE POLICY "Public can sign contracts with valid token" ON public.contracts
  FOR UPDATE USING (
    signature_token IS NOT NULL 
    AND signature_status = 'not_signed'
    AND (signature_expires_at IS NULL OR signature_expires_at > now())
  );
-- END LOCAL BOOTSTRAP 20260109233845_0ee06413-1fcd-48e6-8be7-af102f5c506a.sql

-- BEGIN LOCAL BOOTSTRAP 20260109233911_0ad53a22-0c45-4440-ade0-0eafd98a843e.sql
-- Corrigir políticas RLS muito permissivas removendo as anteriores
DROP POLICY IF EXISTS "Public can view contracts by valid token" ON public.contracts;
DROP POLICY IF EXISTS "Public can sign contracts with valid token" ON public.contracts;

-- Nota: O acesso público via token será feito através de edge functions com service role
-- que validam o token e retornam apenas os dados necessários para assinatura
-- END LOCAL BOOTSTRAP 20260109233911_0ad53a22-0c45-4440-ade0-0eafd98a843e.sql

-- BEGIN LOCAL BOOTSTRAP 20260110034945_33c9fb37-8168-475b-9ffe-cb81b72612af.sql
-- Create system_settings table for general configurations
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage settings
CREATE POLICY "Admins can manage settings" ON public.system_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Insert default settings
INSERT INTO public.system_settings (key, value) VALUES
  ('company', '{"name": "WebMarcas", "phone": "", "email": "contato@webmarcas.net", "cnpj": "", "address": ""}'),
  ('whatsapp', '{"number": "", "enabled": false, "welcome_message": "Olá! Como posso ajudar?"}'),
  ('business_hours', '{"weekdays": "09:00-18:00", "saturday": "09:00-13:00", "sunday": "Fechado"}'),
  ('asaas', '{"environment": "sandbox", "enabled": false}'),
  ('perfex', '{"url": "", "enabled": false, "auto_sync": false}');
-- END LOCAL BOOTSTRAP 20260110034945_33c9fb37-8168-475b-9ffe-cb81b72612af.sql

-- BEGIN LOCAL BOOTSTRAP 20260110041318_40317b82-cfa4-4802-97f4-5f0ec316bb3a.sql
-- Add new configuration entries for expanded settings
INSERT INTO system_settings (key, value) VALUES
  ('api_keys', '{"system_key": null, "zapier_webhook": "", "n8n_webhook": "", "make_webhook": "", "openai_key": ""}'),
  ('webhooks', '[]'),
  ('appearance', '{"theme": "system", "primaryColor": "#0066CC", "customCss": ""}'),
  ('contracts', '{"linkValidityDays": 7, "requireSignature": true, "blockchainEnabled": true}'),
  ('processes', '{"stages": [{"id": "analise", "name": "Análise", "color": "#3B82F6"}, {"id": "enviado", "name": "Enviado INPI", "color": "#8B5CF6"}, {"id": "exigencia", "name": "Exigência", "color": "#F59E0B"}, {"id": "publicado", "name": "Publicado", "color": "#10B981"}, {"id": "registrado", "name": "Registrado", "color": "#06B6D4"}]}'),
  ('financial', '{"currency": "BRL", "inpiFee": 355, "dueDays": 7, "cashDiscount": 5, "maxInstallments": 12}'),
  ('backup', '{"lastExport": null, "autoBackup": false}')
ON CONFLICT (key) DO NOTHING;
-- END LOCAL BOOTSTRAP 20260110041318_40317b82-cfa4-4802-97f4-5f0ec316bb3a.sql

-- BEGIN LOCAL BOOTSTRAP 20260110231336_cd13414d-19c2-43f2-ae27-0f3b7d0157d8.sql
-- Tornar o bucket documents público
UPDATE storage.buckets SET public = true WHERE id = 'documents';

-- Política para leitura pública de todos os arquivos do bucket documents
CREATE POLICY "Acesso publico para leitura documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents');

-- Política para upload por usuários autenticados
CREATE POLICY "Usuarios autenticados podem fazer upload documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- Política para update por usuários autenticados
CREATE POLICY "Usuarios autenticados podem atualizar documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- Política para admins deletarem documentos
CREATE POLICY "Admins podem deletar documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' 
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
  )
);
-- END LOCAL BOOTSTRAP 20260110231336_cd13414d-19c2-43f2-ae27-0f3b7d0157d8.sql

-- BEGIN LOCAL BOOTSTRAP 20260111050338_cc3393ed-6415-4d5a-a950-e77f2e101727.sql
-- Add neighborhood column to profiles table for storing bairro
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS neighborhood TEXT;

-- Add ots_file_url column to contracts table for storing .ots proof file URL
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS ots_file_url TEXT;
-- END LOCAL BOOTSTRAP 20260111050338_cc3393ed-6415-4d5a-a950-e77f2e101727.sql

-- BEGIN LOCAL BOOTSTRAP 20260111055213_4aa0ac49-caa5-4dd3-8903-70357f279c0a.sql
-- 1. Remover política insegura de leads
DROP POLICY IF EXISTS "Anyone can create leads from form" ON leads;

-- 2. Nova política: INSERT público mas com campos obrigatórios e validação
CREATE POLICY "Public can create leads with required fields"
ON leads FOR INSERT
WITH CHECK (
  full_name IS NOT NULL AND 
  email IS NOT NULL AND 
  phone IS NOT NULL AND
  LENGTH(full_name) >= 2 AND
  LENGTH(email) >= 5
);

-- 3. Remover política pública de contract_types
DROP POLICY IF EXISTS "Anyone can read contract types" ON contract_types;

-- 4. Nova política: apenas usuários autenticados podem ler contract_types
CREATE POLICY "Authenticated users can read contract types"
ON contract_types FOR SELECT
TO authenticated
USING (true);

-- 5. Adicionar política DELETE para profiles - apenas admins
CREATE POLICY "Admins can delete profiles"
ON profiles FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 6. Criar função segura que usa auth.uid() internamente (evita privilege escalation)
CREATE OR REPLACE FUNCTION public.has_current_user_role(_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = _role
  )
$$;
-- END LOCAL BOOTSTRAP 20260111055213_4aa0ac49-caa5-4dd3-8903-70357f279c0a.sql

-- BEGIN LOCAL BOOTSTRAP 20260112002847_746cbfb5-9a28-49d2-a033-9e19ea2e415d.sql
-- Backfill: Mark all "registro_marca" contracts as signed if they have contract_html
-- These are contracts created via checkout where the customer accepted the terms
UPDATE public.contracts
SET 
  signature_status = 'signed',
  signed_at = COALESCE(signed_at, created_at)
WHERE contract_type = 'registro_marca'
  AND signature_status IN ('not_signed', 'pending')
  AND (contract_html IS NOT NULL OR subject IS NOT NULL);

-- Also update contracts that were created via checkout but don't have contract_html
-- These should still be marked as signed since the customer accepted terms
UPDATE public.contracts
SET 
  signature_status = 'signed',
  signed_at = COALESCE(signed_at, created_at)
WHERE contract_type = 'registro_marca'
  AND signature_status IN ('not_signed', 'pending')
  AND lead_id IS NOT NULL;
-- END LOCAL BOOTSTRAP 20260112002847_746cbfb5-9a28-49d2-a033-9e19ea2e415d.sql

-- BEGIN LOCAL BOOTSTRAP 20260112004258_a837db4f-e03a-4eb0-b3a6-3ddefe07bd44.sql
-- Phase 1: Add contract_id to documents table for proper synchronization
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_documents_contract_id ON public.documents(contract_id);

-- Comment for documentation
COMMENT ON COLUMN public.documents.contract_id IS 'Links document to its parent contract for synchronization between CRM and Client Area';
-- END LOCAL BOOTSTRAP 20260112004258_a837db4f-e03a-4eb0-b3a6-3ddefe07bd44.sql

-- BEGIN LOCAL BOOTSTRAP 20260112014307_c1649083-516c-4531-acf7-8c6651245f1a.sql
-- Add unique index on cpf_cnpj (only for non-null values)
-- This prevents duplicate clients with same CPF/CNPJ
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_cpf_cnpj_unique 
ON public.profiles (cpf_cnpj) 
WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj != '';

-- Create a function to merge duplicate clients (for future use if needed)
CREATE OR REPLACE FUNCTION public.merge_duplicate_clients(keep_id uuid, merge_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Move all brand_processes to the kept client
  UPDATE public.brand_processes 
  SET user_id = keep_id 
  WHERE user_id = merge_id;
  
  -- Move all contracts to the kept client
  UPDATE public.contracts 
  SET user_id = keep_id 
  WHERE user_id = merge_id;
  
  -- Move all invoices to the kept client
  UPDATE public.invoices 
  SET user_id = keep_id 
  WHERE user_id = merge_id;
  
  -- Move all documents to the kept client
  UPDATE public.documents 
  SET user_id = keep_id 
  WHERE user_id = merge_id;
  
  -- Move all notifications to the kept client
  UPDATE public.notifications 
  SET user_id = keep_id 
  WHERE user_id = merge_id;
  
  -- Move all chat messages to the kept client
  UPDATE public.chat_messages 
  SET user_id = keep_id 
  WHERE user_id = merge_id;
  
  -- Move client activities
  UPDATE public.client_activities 
  SET user_id = keep_id 
  WHERE user_id = merge_id;
  
  -- Move client notes
  UPDATE public.client_notes 
  SET user_id = keep_id 
  WHERE user_id = merge_id;
  
  -- Move client appointments
  UPDATE public.client_appointments 
  SET user_id = keep_id 
  WHERE user_id = merge_id;
  
  -- Delete the merged profile (cascade will handle user_roles if FK exists)
  DELETE FROM public.profiles WHERE id = merge_id;
END;
$$;

COMMENT ON FUNCTION public.merge_duplicate_clients IS 'Merges all data from merge_id client into keep_id client and deletes the duplicate';
-- END LOCAL BOOTSTRAP 20260112014307_c1649083-516c-4531-acf7-8c6651245f1a.sql

-- BEGIN LOCAL BOOTSTRAP 20260112020233_e7a1b493-6619-4d10-ba03-a1763d5e1a92.sql
-- Drop the incorrect foreign key constraint
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

-- Create trigger to auto-create admin role when user is created via create-admin-user function
-- For now, just insert the admin role directly bypassing the FK check by first checking auth.users
-- We need to use a workaround: insert using service role which can access auth.users

-- Create a function to safely add admin role
CREATE OR REPLACE FUNCTION public.add_admin_role(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert admin role (FK constraint was removed so this should work)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;
-- END LOCAL BOOTSTRAP 20260112020233_e7a1b493-6619-4d10-ba03-a1763d5e1a92.sql

-- BEGIN LOCAL BOOTSTRAP 20260112021521_8b0843fc-f5f7-4e7d-a0a6-1eb84b013fe1.sql
-- 1. Add DELETE policy for contracts table (admins only)
CREATE POLICY "Admins can delete contracts"
ON public.contracts
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Drop the existing foreign key constraint
ALTER TABLE public.contracts
DROP CONSTRAINT IF EXISTS contracts_lead_id_fkey;

-- 3. Re-add the foreign key with ON DELETE SET NULL
ALTER TABLE public.contracts
ADD CONSTRAINT contracts_lead_id_fkey
FOREIGN KEY (lead_id) REFERENCES public.leads(id)
ON DELETE SET NULL;
-- END LOCAL BOOTSTRAP 20260112021521_8b0843fc-f5f7-4e7d-a0a6-1eb84b013fe1.sql

-- BEGIN LOCAL BOOTSTRAP 20260112024012_985fdbd6-3a89-4654-b083-f4c05c995ad4.sql
-- Create admin_permissions table for granular CRM access control
CREATE TABLE public.admin_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  permission_key TEXT NOT NULL,
  can_view BOOLEAN DEFAULT true,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, permission_key)
);

-- Enable RLS
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view permissions
CREATE POLICY "Admins can view permissions" ON public.admin_permissions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Policy: Only admins can insert permissions
CREATE POLICY "Admins can insert permissions" ON public.admin_permissions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy: Only admins can update permissions
CREATE POLICY "Admins can update permissions" ON public.admin_permissions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Policy: Only admins can delete permissions
CREATE POLICY "Admins can delete permissions" ON public.admin_permissions
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_admin_permissions_updated_at
  BEFORE UPDATE ON public.admin_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- END LOCAL BOOTSTRAP 20260112024012_985fdbd6-3a89-4654-b083-f4c05c995ad4.sql

-- BEGIN LOCAL BOOTSTRAP 20260112145138_d30dab54-641e-4109-888a-caf6fffe0da1.sql
-- Insert default email templates if they don't exist

-- 1. Email de Boas-Vindas (form_started)
INSERT INTO public.email_templates (name, subject, body, trigger_event, is_active)
SELECT 
  'Boas-Vindas',
  'Bem-vindo à WebMarcas, {{nome}}! 🎉',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1a365d 0%, #2d5a87 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #2d5a87; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Bem-vindo à WebMarcas!</h1>
    </div>
    <div class="content">
      <p>Olá <strong>{{nome}}</strong>,</p>
      <p>Ficamos muito felizes em receber seu interesse em proteger sua marca!</p>
      <p>Recebemos suas informações e nossa equipe já está analisando seu caso. Em breve entraremos em contato para dar continuidade ao processo de registro da sua marca.</p>
      <h3>Próximos Passos:</h3>
      <ul>
        <li>Análise de viabilidade da sua marca</li>
        <li>Preparação da documentação necessária</li>
        <li>Acompanhamento do processo junto ao INPI</li>
      </ul>
      <p>Caso tenha alguma dúvida, não hesite em nos contatar!</p>
      <p>Atenciosamente,<br><strong>Equipe WebMarcas</strong></p>
    </div>
    <div class="footer">
      <p>WebMarcas - Especialistas em Registro de Marcas</p>
      <p>Este é um e-mail automático, por favor não responda.</p>
    </div>
  </div>
</body>
</html>',
  'form_started',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE trigger_event = 'form_started'
);

-- 2. Email de Follow-up 24h (form_abandoned)
INSERT INTO public.email_templates (name, subject, body, trigger_event, is_active)
SELECT 
  'Follow-up 24h',
  '{{nome}}, sua marca ainda está disponível! ⏰',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #d97706; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .highlight { background: #fef3c7; padding: 15px; border-radius: 5px; border-left: 4px solid #d97706; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏰ Não deixe para depois!</h1>
    </div>
    <div class="content">
      <p>Olá <strong>{{nome}}</strong>,</p>
      <p>Notamos que você iniciou o processo de registro da sua marca, mas ainda não concluiu o cadastro.</p>
      <div class="highlight">
        <strong>⚠️ Importante:</strong> Enquanto sua marca não está registrada, outra pessoa pode registrá-la antes de você!
      </div>
      <p>O processo é simples e rápido. Leva apenas alguns minutos para proteger o que é seu.</p>
      <p style="text-align: center;">
        <a href="{{link_area_cliente}}" class="button">Continuar Cadastro</a>
      </p>
      <p>Se precisar de ajuda ou tiver alguma dúvida, nossa equipe está à disposição!</p>
      <p>Atenciosamente,<br><strong>Equipe WebMarcas</strong></p>
    </div>
    <div class="footer">
      <p>WebMarcas - Especialistas em Registro de Marcas</p>
      <p>Este é um e-mail automático, por favor não responda.</p>
    </div>
  </div>
</body>
</html>',
  'form_abandoned',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE trigger_event = 'form_abandoned'
);

-- 3. Confirmação de Contrato (contract_signed)
INSERT INTO public.email_templates (name, subject, body, trigger_event, is_active)
SELECT 
  'Confirmação de Contrato',
  'Contrato Assinado com Sucesso - {{marca}} ✅',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #059669; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .info-box { background: #d1fae5; padding: 15px; border-radius: 5px; border-left: 4px solid #059669; margin: 20px 0; }
    .hash { font-family: monospace; background: #e5e7eb; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 12px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Contrato Assinado!</h1>
    </div>
    <div class="content">
      <p>Olá <strong>{{nome}}</strong>,</p>
      <p>Confirmamos que seu contrato para registro da marca <strong>{{marca}}</strong> foi assinado com sucesso!</p>
      <div class="info-box">
        <strong>📋 Detalhes do Contrato:</strong>
        <ul>
          <li><strong>Marca:</strong> {{marca}}</li>
          <li><strong>Data de Assinatura:</strong> {{data_assinatura}}</li>
          <li><strong>Número do Processo:</strong> {{numero_processo}}</li>
        </ul>
      </div>
      <p><strong>🔐 Validade Jurídica:</strong></p>
      <p>Seu contrato possui validade jurídica garantida por certificação blockchain:</p>
      <div class="hash">{{hash_contrato}}</div>
      <p style="text-align: center; margin-top: 30px;">
        <a href="{{link_area_cliente}}" class="button">Acessar Área do Cliente</a>
      </p>
      <p>Você pode acompanhar todo o andamento do seu processo através da Área do Cliente.</p>
      <p>Atenciosamente,<br><strong>Equipe WebMarcas</strong></p>
    </div>
    <div class="footer">
      <p>WebMarcas - Especialistas em Registro de Marcas</p>
      <p>Este é um e-mail automático, por favor não responda.</p>
    </div>
  </div>
</body>
</html>',
  'contract_signed',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE trigger_event = 'contract_signed'
);

-- 4. Credenciais de Acesso (user_created) - if not exists
INSERT INTO public.email_templates (name, subject, body, trigger_event, is_active)
SELECT 
  'Credenciais de Acesso',
  'Seu acesso à Área do Cliente - WebMarcas 🔑',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #7c3aed; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .credentials { background: #ede9fe; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .credentials p { margin: 5px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔑 Suas Credenciais de Acesso</h1>
    </div>
    <div class="content">
      <p>Olá <strong>{{nome}}</strong>,</p>
      <p>Sua conta na Área do Cliente WebMarcas foi criada com sucesso!</p>
      <div class="credentials">
        <p><strong>📧 E-mail:</strong> {{email}}</p>
        <p><strong>🔐 Senha:</strong> {{senha}}</p>
      </div>
      <p>⚠️ <strong>Importante:</strong> Recomendamos que você altere sua senha no primeiro acesso.</p>
      <p style="text-align: center;">
        <a href="{{login_url}}" class="button">Acessar Área do Cliente</a>
      </p>
      <p>Na Área do Cliente você pode:</p>
      <ul>
        <li>Acompanhar o andamento do seu processo</li>
        <li>Visualizar documentos e contratos</li>
        <li>Acessar faturas e comprovantes</li>
        <li>Falar diretamente com nossa equipe</li>
      </ul>
      <p>Atenciosamente,<br><strong>Equipe WebMarcas</strong></p>
    </div>
    <div class="footer">
      <p>WebMarcas - Especialistas em Registro de Marcas</p>
      <p>Este é um e-mail automático, por favor não responda.</p>
    </div>
  </div>
</body>
</html>',
  'user_created',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE trigger_event = 'user_created'
);

-- 5. Confirmação de Pagamento (payment_received) - if not exists
INSERT INTO public.email_templates (name, subject, body, trigger_event, is_active)
SELECT 
  'Confirmação de Pagamento',
  'Pagamento Confirmado - WebMarcas 💳',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #0284c7; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .success-box { background: #d1fae5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💳 Pagamento Confirmado!</h1>
    </div>
    <div class="content">
      <p>Olá <strong>{{nome}}</strong>,</p>
      <div class="success-box">
        <h2 style="color: #059669; margin: 0;">✅ Pagamento Recebido</h2>
        <p style="margin: 10px 0 0 0;">Seu pagamento foi processado com sucesso!</p>
      </div>
      <p>Obrigado por confiar na WebMarcas para proteger sua marca. Seu pagamento foi confirmado e nosso time já está trabalhando no seu processo.</p>
      <p style="text-align: center;">
        <a href="{{link_area_cliente}}" class="button">Ver Comprovante</a>
      </p>
      <p>Se tiver alguma dúvida sobre o pagamento ou seu processo, entre em contato conosco.</p>
      <p>Atenciosamente,<br><strong>Equipe WebMarcas</strong></p>
    </div>
    <div class="footer">
      <p>WebMarcas - Especialistas em Registro de Marcas</p>
      <p>Este é um e-mail automático, por favor não responda.</p>
    </div>
  </div>
</body>
</html>',
  'payment_received',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE trigger_event = 'payment_received'
);
-- END LOCAL BOOTSTRAP 20260112145138_d30dab54-641e-4109-888a-caf6fffe0da1.sql

-- BEGIN LOCAL BOOTSTRAP 20260113123453_d261eaf9-cc54-4a9b-85a2-f1b65219839c.sql
-- Criar tabela para armazenar consultas de viabilidade
CREATE TABLE public.viability_searches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_name TEXT NOT NULL,
  business_area TEXT NOT NULL,
  result_level TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  ip_hash TEXT
);

-- Habilitar RLS
ALTER TABLE public.viability_searches ENABLE ROW LEVEL SECURITY;

-- Permitir inserção por qualquer um (consulta pública)
CREATE POLICY "Anyone can insert viability search" 
  ON public.viability_searches FOR INSERT 
  WITH CHECK (true);

-- Permitir leitura pública das últimas consultas (últimas 24h)
CREATE POLICY "Anyone can read recent searches" 
  ON public.viability_searches FOR SELECT 
  USING (created_at > now() - interval '24 hours');

-- Habilitar realtime para atualizações em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.viability_searches;
-- END LOCAL BOOTSTRAP 20260113123453_d261eaf9-cc54-4a9b-85a2-f1b65219839c.sql

-- BEGIN LOCAL BOOTSTRAP 20260113202213_fdaf46a0-93c7-4822-8788-0ae7347c94fe.sql
-- Add tag column to rpi_entries table for tracking status
ALTER TABLE public.rpi_entries ADD COLUMN IF NOT EXISTS tag TEXT DEFAULT 'pending';

-- Add index for faster filtering by tag
CREATE INDEX IF NOT EXISTS idx_rpi_entries_tag ON public.rpi_entries(tag);
-- END LOCAL BOOTSTRAP 20260113202213_fdaf46a0-93c7-4822-8788-0ae7347c94fe.sql

-- BEGIN LOCAL BOOTSTRAP 20260120160041_566c8283-08b4-4de5-9387-e347d8570de5.sql
-- Remove Perfex CRM integration from database

-- Drop the perfex_customers table
DROP TABLE IF EXISTS public.perfex_customers CASCADE;

-- Remove perfex column from contracts table (foreign key already dropped by CASCADE)
ALTER TABLE public.contracts DROP COLUMN IF EXISTS perfex_contract_id;
ALTER TABLE public.contracts DROP COLUMN IF EXISTS perfex_customer_id;

-- Remove perfex_customer_id from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS perfex_customer_id;

-- Delete perfex settings from system_settings
DELETE FROM public.system_settings WHERE key = 'perfex';
-- END LOCAL BOOTSTRAP 20260120160041_566c8283-08b4-4de5-9387-e347d8570de5.sql

-- BEGIN LOCAL BOOTSTRAP 20260120164741_e33179bf-1cb4-4a6b-83d7-172a527d6f07.sql
-- =====================================================
-- SECURITY HARDENING: RLS Policies Improvements (Fixed)
-- =====================================================

-- =====================================================
-- PROFILES: Block anonymous access, allow only authenticated users
-- =====================================================
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view own profile" ON profiles;

CREATE POLICY "Authenticated users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- CONTRACTS: Only owner or admin access
-- =====================================================
DROP POLICY IF EXISTS "Users can view own contracts" ON contracts;
DROP POLICY IF EXISTS "Users can insert own contracts" ON contracts;
DROP POLICY IF EXISTS "Users can update own contracts" ON contracts;
DROP POLICY IF EXISTS "Admins can delete contracts" ON contracts;

CREATE POLICY "Users can view own contracts"
ON contracts FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own contracts"
ON contracts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own contracts"
ON contracts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete contracts"
ON contracts FOR DELETE
TO authenticated
USING (has_role(auth.
uid(), 'admin'::app_role));

-- =====================================================
-- INVOICES: Only owner or admin access
-- =====================================================
DROP POLICY IF EXISTS "Users can view own invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can insert invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can update invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can delete invoices" ON invoices;

CREATE POLICY "Users can view own invoices"
ON invoices FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert invoices"
ON invoices FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update invoices"
ON invoices FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete invoices"
ON invoices FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- LEADS: Only admins can access (keep public insert for forms)
-- =====================================================
DROP POLICY IF EXISTS "Admins can view all leads" ON leads;
DROP POLICY IF EXISTS "Admins can insert leads" ON leads;
DROP POLICY IF EXISTS "Admins can update leads" ON leads;
DROP POLICY IF EXISTS "Admins can delete leads" ON leads;
DROP POLICY IF EXISTS "Public can create leads with valid data" ON leads;

CREATE POLICY "Admins can view all leads"
ON leads FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert leads"
ON leads FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can create leads with valid data"
ON leads FOR INSERT
TO anon
WITH CHECK (
  full_name IS NOT NULL AND 
  char_length(full_name) >= 2 AND 
  char_length(full_name) <= 100
);

CREATE POLICY "Admins can update leads"
ON leads FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete leads"
ON leads FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- EMAIL_ACCOUNTS: Only admins can access
-- =====================================================
DROP POLICY IF EXISTS "Admins can view email_accounts" ON email_accounts;
DROP POLICY IF EXISTS "Admins can insert email_accounts" ON email_accounts;
DROP POLICY IF EXISTS "Admins can update email_accounts" ON email_accounts;
DROP POLICY IF EXISTS "Admins can delete email_accounts" ON email_accounts;

CREATE POLICY "Admins can view email_accounts"
ON email_accounts FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert email_accounts"
ON email_accounts FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update email_accounts"
ON email_accounts FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete email_accounts"
ON email_accounts FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- EMAIL_INBOX: Only admins can access
-- =====================================================
DROP POLICY IF EXISTS "Admins can view email_inbox" ON email_inbox;
DROP POLICY IF EXISTS "Admins can insert email_inbox" ON email_inbox;
DROP POLICY IF EXISTS "Admins can update email_inbox" ON email_inbox;
DROP POLICY IF EXISTS "Admins can delete email_inbox" ON email_inbox;

CREATE POLICY "Admins can view email_inbox"
ON email_inbox FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert email_inbox"
ON email_inbox FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update email_inbox"
ON email_inbox FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete email_inbox"
ON email_inbox FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- WHATSAPP_CONFIG: Only admins can access
-- =====================================================
DROP POLICY IF EXISTS "Admins can view whatsapp_config" ON whatsapp_config;
DROP POLICY IF EXISTS "Admins can insert whatsapp_config" ON whatsapp_config;
DROP POLICY IF EXISTS "Admins can update whatsapp_config" ON whatsapp_config;
DROP POLICY IF EXISTS "Admins can delete whatsapp_config" ON whatsapp_config;

CREATE POLICY "Admins can view whatsapp_config"
ON whatsapp_config FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert whatsapp_config"
ON whatsapp_config FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update whatsapp_config"
ON whatsapp_config FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete whatsapp_config"
ON whatsapp_config FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- CHAT_MESSAGES: User isolation with admin access
-- =====================================================
DROP POLICY IF EXISTS "Users can view own chat messages or admin can view all" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Admins can manage chat messages" ON chat_messages;

CREATE POLICY "Users can view own chat messages or admin can view all"
ON chat_messages FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own chat messages"
ON chat_messages FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- LOGIN_HISTORY: User isolation with admin access
-- =====================================================
DROP POLICY IF EXISTS "Users can view own login history or admin can view all" ON login_history;
DROP POLICY IF EXISTS "System can insert login history" ON login_history;

CREATE POLICY "Users can view own login history or admin can view all"
ON login_history FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert login history"
ON login_history FOR INSERT
TO authenticated
WITH CHECK (true);

-- =====================================================
-- SIGNATURE_AUDIT_LOG: Contract owner or admin access
-- =====================================================
DROP POLICY IF EXISTS "Admins and contract owners can view signature audit log" ON signature_audit_log;
DROP POLICY IF EXISTS "System can insert signature audit log" ON signature_audit_log;

CREATE POLICY "Admins and contract owners can view signature audit log"
ON signature_audit_log FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  EXISTS (
    SELECT 1 FROM contracts 
    WHERE contracts.id = signature_audit_log.contract_id 
    AND contracts.user_id = auth.uid()
  )
);

CREATE POLICY "System can insert signature audit log"
ON signature_audit_log FOR INSERT
TO authenticated
WITH CHECK (true);

-- =====================================================
-- VIABILITY_SEARCHES: Restrict reads to authenticated users
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view recent viability searches" ON viability_searches;
DROP POLICY IF EXISTS "Anyone can insert viability searches" ON viability_searches;

CREATE POLICY "Authenticated users can view recent viability searches"
ON viability_searches FOR SELECT
TO authenticated
USING (created_at > now() - interval '24 hours');

CREATE POLICY "Anyone can insert viability searches"
ON viability_searches FOR INSERT
TO anon, authenticated
WITH CHECK (true);
-- END LOCAL BOOTSTRAP 20260120164741_e33179bf-1cb4-4a6b-83d7-172a527d6f07.sql

-- BEGIN LOCAL BOOTSTRAP 20260120165747_31a6df3c-b7e8-4923-8d92-a846b10e1897.sql
-- Remove public read policy from documents bucket
DROP POLICY IF EXISTS "Acesso publico para leitura documents" ON storage.objects;
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view documents" ON storage.objects;

-- Create secure policy: only authenticated users (owners or admins) can read
CREATE POLICY "Authenticated users can read own documents" ON storage.objects
FOR SELECT USING (
  bucket_id = 'documents' AND (
    auth.uid() IS NOT NULL AND (
      (auth.uid())::text = (storage.foldername(name))[1] OR
      public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  )
);

-- Restrict viability_searches to authenticated users only
DROP POLICY IF EXISTS "Anyone can read recent searches" ON public.viability_searches;

CREATE POLICY "Authenticated can read recent searches" ON public.viability_searches
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  created_at > now() - interval '24 hours'
);
-- END LOCAL BOOTSTRAP 20260120165747_31a6df3c-b7e8-4923-8d92-a846b10e1897.sql

-- BEGIN LOCAL BOOTSTRAP 20260124190457_fd14e623-dad0-4960-abc9-a1a388f36312.sql
-- Add payment_method column to contracts table for post-signature payment processing
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT NULL;

-- Add comment explaining the column purpose
COMMENT ON COLUMN public.contracts.payment_method IS 'Payment method selected: avista, cartao6x, boleto3x';
-- END LOCAL BOOTSTRAP 20260124190457_fd14e623-dad0-4960-abc9-a1a388f36312.sql

-- BEGIN LOCAL BOOTSTRAP 20260124191120_7c9b4142-7650-4f98-9f81-461d3094b5bc.sql
-- Add asaas_customer_id column to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

-- Drop existing document_type check constraint if exists
ALTER TABLE public.documents 
DROP CONSTRAINT IF EXISTS documents_document_type_check;

-- Add updated check constraint that includes all existing types plus 'contract' and 'signed_contract'
ALTER TABLE public.documents 
ADD CONSTRAINT documents_document_type_check 
CHECK (document_type IN ('contract', 'signed_contract', 'contrato', 'anexo', 'outro', 'procuracao', 'invoice', 'receipt', 'identity', 'power_of_attorney', 'other'));
-- END LOCAL BOOTSTRAP 20260124191120_7c9b4142-7650-4f98-9f81-461d3094b5bc.sql

-- BEGIN LOCAL BOOTSTRAP 20260124191134_dcffeb37-ba07-4ba3-8db7-7d3cd400a17f.sql
-- Add contract_id column to invoices table for linking payments to contracts
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.contracts(id);

-- Add pix_qr_code column for storing the base64 QR code image
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS pix_qr_code TEXT;

-- Add pix_payload column for storing the copy-paste code
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS pix_payload TEXT;

-- Add payment_link column for storing the invoice URL
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS payment_link TEXT;
-- END LOCAL BOOTSTRAP 20260124191134_dcffeb37-ba07-4ba3-8db7-7d3cd400a17f.sql

-- BEGIN LOCAL BOOTSTRAP 20260128200226_bf63e611-d7a8-4f70-8e38-bdde2be20841.sql
-- Add separate cpf and cnpj columns to profiles table
-- This allows storing CPF (personal) and CNPJ (company) separately

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cpf text,
ADD COLUMN IF NOT EXISTS cnpj text;

-- Migrate existing data from cpf_cnpj to the appropriate new column
-- If length is 11 digits (CPF), put in cpf column
-- If length is 14 digits (CNPJ), put in cnpj column
UPDATE public.profiles 
SET cpf = cpf_cnpj 
WHERE cpf_cnpj IS NOT NULL 
AND LENGTH(REGEXP_REPLACE(cpf_cnpj, '\D', '', 'g')) = 11;

UPDATE public.profiles 
SET cnpj = cpf_cnpj 
WHERE cpf_cnpj IS NOT NULL 
AND LENGTH(REGEXP_REPLACE(cpf_cnpj, '\D', '', 'g')) = 14;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.cpf IS 'CPF do representante legal (pessoa física)';
COMMENT ON COLUMN public.profiles.cnpj IS 'CNPJ da empresa (pessoa jurídica)';
-- END LOCAL BOOTSTRAP 20260128200226_bf63e611-d7a8-4f70-8e38-bdde2be20841.sql

-- BEGIN LOCAL BOOTSTRAP 20260130164948_e4df4340-55d9-4c86-abaa-61426051c794.sql
-- Add client_funnel_type column to profiles table
-- Default 'juridico' to preserve all existing clients in the legal funnel
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS client_funnel_type text DEFAULT 'juridico';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.client_funnel_type IS 'Type of funnel: comercial (sales) or juridico (legal/INPI processes)';
-- END LOCAL BOOTSTRAP 20260130164948_e4df4340-55d9-4c86-abaa-61426051c794.sql

-- BEGIN LOCAL BOOTSTRAP 20260130172102_cdbb39fa-b2f6-48d7-99f8-32d19c4e8ff8.sql
-- Add custom_due_date column to contracts table for admin-specified payment dates
-- This column stores the custom due date for PIX/Boleto payments when admin selects a specific date
-- If null, the system uses the default automatic date calculation

ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS custom_due_date DATE NULL;

COMMENT ON COLUMN public.contracts.custom_due_date IS 'Admin-specified custom due date for PIX/Boleto payments. If null, uses automatic date calculation.';
-- END LOCAL BOOTSTRAP 20260130172102_cdbb39fa-b2f6-48d7-99f8-32d19c4e8ff8.sql

-- BEGIN LOCAL BOOTSTRAP 20260206191420_3d2092d2-a4b3-4e3b-921b-fd2ba190dff1.sql
-- Tabela de log para auditoria das execuções
CREATE TABLE IF NOT EXISTS public.promotion_expiration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at timestamptz DEFAULT now(),
  contracts_updated integer DEFAULT 0,
  contract_ids jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'success'
);

-- Habilitar RLS
ALTER TABLE public.promotion_expiration_logs ENABLE ROW LEVEL SECURITY;

-- Política: Apenas admins podem visualizar os logs
CREATE POLICY "Admins can view promotion logs"
  ON public.promotion_expiration_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Política: Apenas admins podem inserir logs (via service role)
CREATE POLICY "Service can insert promotion logs"
  ON public.promotion_expiration_logs
  FOR INSERT
  WITH CHECK (true);

-- Comentário na tabela
COMMENT ON TABLE public.promotion_expiration_logs IS 'Log de execuções do scheduler de expiração de promoção semanal';
-- END LOCAL BOOTSTRAP 20260206191420_3d2092d2-a4b3-4e3b-921b-fd2ba190dff1.sql

-- BEGIN LOCAL BOOTSTRAP 20260209181211_50ed20a6-93be-4303-a4a1-d3fc38001458.sql

UPDATE contracts c
SET contract_type_id = t.contract_type_id
FROM contract_templates t
WHERE c.template_id = t.id
AND c.contract_type_id IS NULL
AND t.contract_type_id IS NOT NULL;

-- END LOCAL BOOTSTRAP 20260209181211_50ed20a6-93be-4303-a4a1-d3fc38001458.sql

-- BEGIN LOCAL BOOTSTRAP 20260209182424_1056a888-0596-4841-bb5a-69e7014f612c.sql
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS protocol text;
-- END LOCAL BOOTSTRAP 20260209182424_1056a888-0596-4841-bb5a-69e7014f612c.sql

-- BEGIN LOCAL BOOTSTRAP 20260211231325_a49643a2-fb0e-441c-8c76-71cd18730ac9.sql

-- Add created_by and assigned_to columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assigned_to uuid;

-- Add a system setting for admin client visibility restriction
-- We'll use admin_permissions with a special key 'clients_own_only'
-- No schema change needed - we reuse admin_permissions table

-- END LOCAL BOOTSTRAP 20260211231325_a49643a2-fb0e-441c-8c76-71cd18730ac9.sql

-- BEGIN LOCAL BOOTSTRAP 20260211233736_9347a8e9-f489-4608-ad86-f0c123d262ba.sql

-- Conversations table
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group', 'ai_support')),
  title TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ DEFAULT now(),
  last_message_preview TEXT
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Conversation participants
CREATE TABLE public.conversation_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  is_typing BOOLEAN DEFAULT false,
  is_online BOOLEAN DEFAULT false,
  UNIQUE(conversation_id, user_id)
);

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Messages
CREATE TABLE public.conversation_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id),
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'image', 'audio', 'video', 'system', 'call_started', 'call_ended', 'meeting_scheduled')),
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  file_mime_type TEXT,
  reply_to_id UUID REFERENCES public.conversation_messages(id),
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

-- Meetings
CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id),
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  meeting_type TEXT NOT NULL DEFAULT 'video' CHECK (meeting_type IN ('video', 'audio', 'screen_share')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Meeting participants
CREATE TABLE public.meeting_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined', 'joined')),
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  UNIQUE(meeting_id, user_id)
);

ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;

-- WebRTC signaling
CREATE TABLE public.call_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  caller_id UUID NOT NULL REFERENCES auth.users(id),
  receiver_id UUID REFERENCES auth.users(id),
  signal_type TEXT NOT NULL CHECK (signal_type IN ('offer', 'answer', 'ice_candidate', 'call_start', 'call_end', 'call_reject', 'screen_share_start', 'screen_share_stop')),
  signal_data JSONB,
  call_type TEXT DEFAULT 'video' CHECK (call_type IN ('video', 'audio')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed BOOLEAN DEFAULT false
);

ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "Users can view conversations they participate in" ON public.conversations
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = id AND user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Authenticated users can create conversations" ON public.conversations
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Participants can update conversations" ON public.conversations
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = id AND user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- RLS for conversation_participants
CREATE POLICY "Users can view participants of their conversations" ON public.conversation_participants
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = conversation_participants.conversation_id AND cp.user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Authenticated users can insert participants" ON public.conversation_participants
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own participant record" ON public.conversation_participants
FOR UPDATE USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete participants" ON public.conversation_participants
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS for messages
CREATE POLICY "Users can view messages in their conversations" ON public.conversation_messages
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = conversation_messages.conversation_id AND user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Participants can send messages" ON public.conversation_messages
FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = conversation_messages.conversation_id AND user_id = auth.uid())
);

CREATE POLICY "Users can update own messages" ON public.conversation_messages
FOR UPDATE USING (sender_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete messages" ON public.conversation_messages
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS for meetings
CREATE POLICY "Users can view meetings they participate in" ON public.meetings
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.meeting_participants WHERE meeting_id = id AND user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Authenticated users can create meetings" ON public.meetings
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Creators can update meetings" ON public.meetings
FOR UPDATE USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete meetings" ON public.meetings
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS for meeting_participants
CREATE POLICY "Users can view meeting participants" ON public.meeting_participants
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.meeting_participants mp WHERE mp.meeting_id = meeting_participants.meeting_id AND mp.user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Authenticated users can insert meeting participants" ON public.meeting_participants
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own meeting participation" ON public.meeting_participants
FOR UPDATE USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete meeting participants" ON public.meeting_participants
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS for call_signals
CREATE POLICY "Users can view their call signals" ON public.call_signals
FOR SELECT USING (caller_id = auth.uid() OR receiver_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can create signals" ON public.call_signals
FOR INSERT WITH CHECK (caller_id = auth.uid());

CREATE POLICY "Users can update their signals" ON public.call_signals
FOR UPDATE USING (caller_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can delete their signals" ON public.call_signals
FOR DELETE USING (caller_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for messaging
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;

-- Indexes for performance
CREATE INDEX idx_conv_messages_conversation ON public.conversation_messages(conversation_id, created_at DESC);
CREATE INDEX idx_conv_participants_user ON public.conversation_participants(user_id);
CREATE INDEX idx_conv_participants_conv ON public.conversation_participants(conversation_id);
CREATE INDEX idx_call_signals_conv ON public.call_signals(conversation_id, created_at DESC);
CREATE INDEX idx_call_signals_receiver ON public.call_signals(receiver_id, processed);
CREATE INDEX idx_meetings_scheduled ON public.meetings(scheduled_at);
CREATE INDEX idx_conversations_last_msg ON public.conversations(last_message_at DESC);

-- END LOCAL BOOTSTRAP 20260211233736_9347a8e9-f489-4608-ad86-f0c123d262ba.sql

-- BEGIN LOCAL BOOTSTRAP 20260212024021_37e3445d-383c-4f9d-b0d9-3553d8158b7b.sql

-- Fix BROKEN conversations RLS policies
-- The bug: conversation_participants.conversation_id = conversation_participants.id (wrong!)
-- Should be: conversation_participants.conversation_id = conversations.id

DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;
DROP POLICY IF EXISTS "Participants can update conversations" ON public.conversations;

CREATE POLICY "Users can view conversations they participate in"
ON public.conversations
FOR SELECT
USING (
  (EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_participants.conversation_id = conversations.id
      AND conversation_participants.user_id = auth.uid()
  )) OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Participants can update conversations"
ON public.conversations
FOR UPDATE
USING (
  (EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_participants.conversation_id = conversations.id
      AND conversation_participants.user_id = auth.uid()
  )) OR has_role(auth.uid(), 'admin'::app_role)
);

-- Also add DELETE policy for admins
CREATE POLICY "Admins can delete conversations"
ON public.conversations
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for conversations table
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- END LOCAL BOOTSTRAP 20260212024021_37e3445d-383c-4f9d-b0d9-3553d8158b7b.sql

-- BEGIN LOCAL BOOTSTRAP 20260212030004_46f01426-ff53-4d85-a15c-25c7d1729e5d.sql

-- Add call_signals to realtime (conversation_messages already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'call_signals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;
  END IF;
END $$;

-- END LOCAL BOOTSTRAP 20260212030004_46f01426-ff53-4d85-a15c-25c7d1729e5d.sql

-- BEGIN LOCAL BOOTSTRAP 20260212030435_71ce8226-bbb4-4b93-bb0f-ffb3abcd1fcf.sql

-- Create security definer function to check participation without triggering RLS
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = _conversation_id
      AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_meeting_participant(_meeting_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.meeting_participants
    WHERE meeting_id = _meeting_id
      AND user_id = _user_id
  )
$$;

-- Fix conversation_participants SELECT policy (infinite recursion)
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
CREATE POLICY "Users can view participants of their conversations"
ON public.conversation_participants FOR SELECT
USING (
  public.is_conversation_participant(conversation_id, auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix conversations SELECT policy
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;
CREATE POLICY "Users can view conversations they participate in"
ON public.conversations FOR SELECT
USING (
  public.is_conversation_participant(id, auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix conversations UPDATE policy
DROP POLICY IF EXISTS "Participants can update conversations" ON public.conversations;
CREATE POLICY "Participants can update conversations"
ON public.conversations FOR UPDATE
USING (
  public.is_conversation_participant(id, auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix conversation_messages SELECT policy
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.conversation_messages;
CREATE POLICY "Users can view messages in their conversations"
ON public.conversation_messages FOR SELECT
USING (
  public.is_conversation_participant(conversation_id, auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix conversation_messages INSERT policy
DROP POLICY IF EXISTS "Participants can send messages" ON public.conversation_messages;
CREATE POLICY "Participants can send messages"
ON public.conversation_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND public.is_conversation_participant(conversation_id, auth.uid())
);

-- Fix meeting_participants SELECT policy
DROP POLICY IF EXISTS "Users can view meeting participants" ON public.meeting_participants;
CREATE POLICY "Users can view meeting participants"
ON public.meeting_participants FOR SELECT
USING (
  public.is_meeting_participant(meeting_id, auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- END LOCAL BOOTSTRAP 20260212030435_71ce8226-bbb4-4b93-bb0f-ffb3abcd1fcf.sql

-- BEGIN LOCAL BOOTSTRAP 20260216190914_bc170747-e7c7-4ff5-aada-fe16dcbe32e6.sql

-- Table for award entries (registro de marca, publicação, cobrança)
CREATE TABLE public.award_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('registro_marca', 'publicacao', 'cobranca')),
  client_name TEXT NOT NULL,
  brand_name TEXT,
  responsible_user_id UUID NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  observations TEXT,
  
  -- Registro de Marca fields
  brand_quantity INTEGER DEFAULT 1,
  payment_type TEXT CHECK (payment_type IN ('avista', 'parcelado', 'promocao')),
  
  -- Publicação fields
  publication_type TEXT,
  pub_quantity INTEGER DEFAULT 1,
  
  -- Cobrança fields
  installments_paid INTEGER,
  total_resolved_value NUMERIC,
  
  payment_date DATE,
  payment_form TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.award_entries ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage award entries"
ON public.award_entries
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Regular users can view their own entries
CREATE POLICY "Users can view own award entries"
ON public.award_entries
FOR SELECT
USING (responsible_user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_award_entries_updated_at
BEFORE UPDATE ON public.award_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add permission key for the new tab
INSERT INTO public.admin_permissions (user_id, permission_key, can_view, can_edit, can_delete)
SELECT ur.user_id, 'awards', true, true, true
FROM public.user_roles ur
WHERE ur.role = 'admin'
ON CONFLICT DO NOTHING;

-- END LOCAL BOOTSTRAP 20260216190914_bc170747-e7c7-4ff5-aada-fe16dcbe32e6.sql

-- BEGIN LOCAL BOOTSTRAP 20260218020031_a0533d8a-468b-4ede-b1e6-7f9a2f85e152.sql

-- Tabela de base de conhecimento automática do INPI
CREATE TABLE IF NOT EXISTS public.inpi_knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL, -- 'taxas', 'prazos', 'despachos', 'resolucoes', 'circulares', 'manual', 'jurisprudencia', 'noticias'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_url TEXT,
  source_date DATE,
  valid_until DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER DEFAULT 5, -- 1 = crítico, 10 = baixo
  tags TEXT[] DEFAULT '{}',
  raw_html TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de log de sincronizações com INPI
CREATE TABLE IF NOT EXISTS public.inpi_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled' | 'manual'
  status TEXT NOT NULL DEFAULT 'running', -- 'running' | 'success' | 'partial' | 'failed'
  categories_synced TEXT[] DEFAULT '{}',
  items_created INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  details JSONB DEFAULT '{}',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_inpi_knowledge_category ON public.inpi_knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_inpi_knowledge_active ON public.inpi_knowledge_base(is_active);
CREATE INDEX IF NOT EXISTS idx_inpi_knowledge_priority ON public.inpi_knowledge_base(priority);
CREATE INDEX IF NOT EXISTS idx_inpi_sync_logs_started ON public.inpi_sync_logs(started_at DESC);

-- RLS
ALTER TABLE public.inpi_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inpi_sync_logs ENABLE ROW LEVEL SECURITY;

-- Políticas: admins gerenciam, edge functions inserem via service role
CREATE POLICY "Admins can manage inpi knowledge base"
  ON public.inpi_knowledge_base
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone authenticated can read inpi knowledge base"
  ON public.inpi_knowledge_base
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

CREATE POLICY "Service role can insert inpi knowledge"
  ON public.inpi_knowledge_base
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update inpi knowledge"
  ON public.inpi_knowledge_base
  FOR UPDATE
  USING (true);

CREATE POLICY "Admins can view sync logs"
  ON public.inpi_sync_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage sync logs"
  ON public.inpi_sync_logs
  FOR ALL
  WITH CHECK (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_inpi_knowledge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_inpi_knowledge_base_updated_at
  BEFORE UPDATE ON public.inpi_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION public.update_inpi_knowledge_updated_at();

-- Seed inicial com dados sempre atuais de 2026 (informações fixas que vêm do site INPI)
INSERT INTO public.inpi_knowledge_base (category, title, content, source_url, source_date, priority, tags) VALUES
(
  'taxas',
  'Tabela de Taxas INPI 2025-2026 (Resolução INPI/PR nº 262/2024)',
  'TAXAS OFICIAIS INPI VIGENTES 2025-2026 (Resolução INPI/PR nº 262/2024):

  PEDIDO DE REGISTRO DE MARCA:
  - Pessoa Natural / Micro / MEI: R$ 142,00 por classe (com redução 60%)
  - Pessoa Jurídica Normal: R$ 355,00 por classe
  - Entidade sem fins lucrativos / EPP: R$ 213,00 por classe

  RECURSO ADMINISTRATIVO (Art. 212 LPI):
  - Interposição de recurso: R$ 475,00

  CONCESSÃO DE REGISTRO:
  - Pessoa Natural / Micro / MEI: R$ 298,00 (com redução 60%)
  - Pessoa Jurídica Normal: R$ 745,00

  PRORROGAÇÃO DE REGISTRO:
  - Pessoa Natural / Micro / MEI: R$ 449,00 (com redução 60%)
  - Pessoa Jurídica Normal: R$ 1.122,00

  OPOSIÇÃO:
  - Interposição de oposição: R$ 475,00

  LICENÇA / CESSÃO:
  - Anotação de licença ou cessão: R$ 142,00
  
  OBSERVAÇÃO: As reduções de 60% são aplicadas automaticamente para pessoas físicas, MEI, microempresas e EPPs. Para aplicar a redução, o requerente deve declarar seu enquadramento no formulário de pedido.',
  'preview-disabled://inpi/taxas',
  '2025-01-01',
  1,
  ARRAY['taxas', 'valores', '2025', '2026', 'resolucao']
),
(
  'prazos',
  'Prazos Legais e Processuais INPI 2026',
  'PRAZOS PROCESSUAIS VIGENTES NO INPI (Lei 9.279/96 + Manual de Marcas):

  EXAME DE MÉRITO:
  - Prazo médio para exame: 18 a 36 meses (depende da classe e volume)
  - Classes mais rápidas: serviços (26-30 meses)
  - Classes mais lentas: produtos (30-40 meses)

  RECURSO ADMINISTRATIVO (Art. 212 LPI):
  - Prazo para interpor recurso: 60 dias corridos após publicação na RPI
  - Contagem: inicia no dia seguinte à publicação
  - Sem prorrogação; prazo peremptório
  - Após recurso: 5 dias para intimação dos interessados apresentarem contrarrazões (60 dias)

  OPOSIÇÃO (Art. 158 LPI):
  - Prazo para oposição: 60 dias corridos após publicação do pedido deferido/indeferido para manifestação
  - Manifestação à oposição: 60 dias após intimação

  EXIGÊNCIA (Art. 157 LPI):
  - Prazo para atender exigência: 60 dias (pode ser prorrogado por igual período mediante petição)
  - Não atendimento: arquivamento do pedido

  NULIDADE ADMINISTRATIVA (Art. 168 LPI):
  - Pode ser requerida pelo INPI a qualquer tempo ou por interessado em até 180 dias da concessão

  EXTINÇÃO DO REGISTRO (Art. 142 LPI):
  - Registro vigente por 10 anos, renovável por períodos iguais e sucessivos
  - Prazo para solicitar prorrogação: até 6 meses antes do vencimento
  - Prorrogação em até 6 meses após vencimento (com adicional de 20% na taxa)',
  'preview-disabled://inpi/prazos',
  '2025-01-01',
  1,
  ARRAY['prazos', 'recurso', 'oposição', 'exigencia', 'procedimentos']
),
(
  'despachos',
  'Tabela de Códigos de Despacho INPI mais comuns 2026',
  'PRINCIPAIS CÓDIGOS DE DESPACHO INPI (Revista da Propriedade Industrial - RPI):

  DESPACHOS FAVORÁVEIS:
  - IPPM7.1 / DEXP1.1: Depósito efetuado
  - IPPM17.1: Deferido (aprovado para registro)
  - IPPM18.1: Registro concedido
  - IPPM19.1: Prazo para pagamento da taxa de concessão
  - IPPM20.1: Prorrogação concedida

  DESPACHOS DE EXIGÊNCIA:
  - IPPM6.1: Exigência formal (documentação incompleta)
  - IPPM6.2: Exigência de mérito (questão técnica sobre a marca)
  - Prazo resposta: 60 dias corridos

  DESPACHOS DE INDEFERIMENTO:
  - IPPM8.1: Indeferimento – Marca não registrável (Art. 124 LPI)
  - IPPM8.2: Indeferimento – Marca de alto renome / famosa
  - IPPM8.3: Indeferimento – Colidência com marca registrada anterior
  - IPPM9.1: Arquivamento por não atendimento de exigência
  - IPPM10.1: Extinção do registro por caducidade
  
  DESPACHOS DE RECURSO / OPOSIÇÃO:
  - IPPM22.1: Recurso interposto
  - IPPM22.2: Recurso provido (favorável ao recorrente)
  - IPPM22.3: Recurso não provido (mantém indeferimento)
  - IPPM23.1: Oposição apresentada
  - IPPM24.1: Manifestação à oposição

  OUTROS:
  - IPPM25.1: Cessão anotada
  - IPPM26.1: Licença anotada
  - IPPM27.1: Cancelamento a pedido do titular',
  'preview-disabled://inpi/despachos',
  '2025-01-01',
  2,
  ARRAY['despachos', 'codigos', 'rpi', 'status']
),
(
  'manual',
  'Manual de Marcas INPI - Critérios de Distintividade 2024',
  'CRITÉRIOS DO MANUAL DE MARCAS DO INPI (versão vigente 2024):

  DISTINTIVIDADE (Art. 122 LPI):
  A marca deve ser capaz de distinguir produtos/serviços de um estabelecimento dos de outro.
  
  GRAUS DE DISTINTIVIDADE (do mais ao menos proteção):
  1. Marcas de fantasia (máxima proteção) - Ex.: KODAK, XEROX
  2. Marcas arbitrárias - palavras existentes sem relação com o produto - Ex.: MAÇÃ para computadores
  3. Marcas sugestivas - sugerem qualidades sem descrever - Ex.: SORRISO para pasta dental
  4. Marcas descritivas (baixa proteção, normalmente indeferidas)
  5. Marcas genéricas (sem proteção alguma)

  IMPEDIMENTOS ABSOLUTOS (Art. 124 LPI) - Marcas NÃO registráveis:
  - Brasão, armas, medalha oficial
  - Sinal de uso comum (genérico, necessário, vulgar)
  - Forma necessária, comum ou funcional do produto
  - Sinal contrário à moral e bons costumes
  - Denominação ou sigla de entidade pública
  - Reprodução de sinal de uso comum
  - Indicação geográfica
  - Termo técnico ou científico
  - Cor pura e simples (sem forma especial)
  - Letra ou número isolado (sem combinação ou forma especial)

  IMPEDIMENTOS RELATIVOS (Art. 125 LPI) - Colidência:
  - Marca idêntica ou semelhante à anteriormente registrada para produto/serviço idêntico, semelhante ou afim
  - Critério de colidência: combinação de semelhança gráfica, fonética e ideológica
  - ANUALIDADE DA CLASSE: proteção se aplica à classe registrada

  COEXISTÊNCIA:
  - Possível quando marcas são distintas o suficiente E mercados são diferentes (sem risco de confusão/associação)
  - Casos especiais: acordos de coexistência entre titulares',
  'preview-disabled://inpi/manual',
  '2024-01-01',
  1,
  ARRAY['manual', 'distintividade', 'impedimentos', 'criterios', 'colidencia']
);

-- END LOCAL BOOTSTRAP 20260218020031_a0533d8a-468b-4ede-b1e6-7f9a2f85e152.sql

-- BEGIN LOCAL BOOTSTRAP 20260218221052_4d0256c1-92bc-49cc-8810-0636efe58854.sql

-- ============================================================
-- Notification Dispatch Logs table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notification_dispatch_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  channel text NOT NULL,
  recipient_phone text,
  recipient_email text,
  recipient_user_id uuid,
  status text NOT NULL DEFAULT 'pending',
  payload jsonb,
  response_body text,
  error_message text,
  attempts integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_dispatch_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage dispatch logs"
  ON public.notification_dispatch_logs
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert dispatch logs"
  ON public.notification_dispatch_logs
  FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- Insert default system_settings for BotConversa and SMS
-- only if they don't already exist
-- ============================================================
INSERT INTO public.system_settings (key, value)
VALUES
  ('sms_provider', '{"enabled": false, "provider": "zenvia", "api_key": "", "sender_name": "WebMarcas", "test_phone": ""}'),
  ('botconversa', '{"enabled": false, "webhook_url": "", "auth_token": "", "test_phone": ""}'),
  ('email_provider', '{"enabled": false, "provider": "disabled-preview", "api_key": "", "from_email": "noreply@webmarcas.net", "from_name": "WebMarcas"}')
ON CONFLICT DO NOTHING;

-- END LOCAL BOOTSTRAP 20260218221052_4d0256c1-92bc-49cc-8810-0636efe58854.sql

-- BEGIN LOCAL BOOTSTRAP 20260218221827_94292e2f-f12b-4937-b621-aa4da7bc9d35.sql

-- Garante que a coluna unique constraint existe para key em system_settings (para ON CONFLICT funcionar)
-- Upsert configs padrão para integrações novas
INSERT INTO public.system_settings (key, value) VALUES
  ('email_provider', '{"enabled": false, "provider": "disabled-preview", "api_key": "", "from_email": "noreply@webmarcas.net", "from_name": "WebMarcas"}'::jsonb),
  ('openai_config', '{"enabled": false, "api_key": ""}'::jsonb),
  ('inpi_sync', '{"enabled": false, "sync_interval_hours": 24, "last_sync_at": null}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- END LOCAL BOOTSTRAP 20260218221827_94292e2f-f12b-4937-b621-aa4da7bc9d35.sql

-- BEGIN LOCAL BOOTSTRAP 20260218224357_684c3bbc-9af3-48be-b19c-435aca19afb9.sql

-- Garantir que notification_dispatch_logs existe com estrutura completa
CREATE TABLE IF NOT EXIS
TS public.notification_dispatch_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  channel text NOT NULL,
  recipient_phone text,
  recipient_email text,
  recipient_user_id uuid,
  status text NOT NULL DEFAULT 'failed',
  payload jsonb,
  response_body text,
  error_message text,
  attempts integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.notification_dispatch_logs ENABLE ROW LEVEL SECURITY;

-- Políticas
DROP POLICY IF EXISTS "Admins can view dispatch logs" ON public.notification_dispatch_logs;
CREATE POLICY "Admins can view dispatch logs"
  ON public.notification_dispatch_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service can insert dispatch logs" ON public.notification_dispatch_logs;
CREATE POLICY "Service can insert dispatch logs"
  ON public.notification_dispatch_logs FOR INSERT
  WITH CHECK (true);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_event ON public.notification_dispatch_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_channel ON public.notification_dispatch_logs(channel);
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_status ON public.notification_dispatch_logs(status);
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_created ON public.notification_dispatch_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_user ON public.notification_dispatch_logs(recipient_user_id);

-- Garantir que notifications tem coluna link (para CRM)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read boolean DEFAULT false;

-- END LOCAL BOOTSTRAP 20260218224357_684c3bbc-9af3-48be-b19c-435aca19afb9.sql

-- BEGIN LOCAL BOOTSTRAP 20260219204133_08e265e5-b042-40df-b831-180d4c01bc08.sql
-- Adicionar coluna created_by na tabela contracts
-- Registra qual admin criou o contrato para atribuição automática de responsável
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Índice para performance nas queries de atribuição
CREATE INDEX IF NOT EXISTS idx_contracts_created_by ON public.contracts(created_by);

-- END LOCAL BOOTSTRAP 20260219204133_08e265e5-b042-40df-b831-180d4c01bc08.sql

-- BEGIN LOCAL BOOTSTRAP 20260220010001_af1b7bf3-c8c5-4a10-a48c-134f80266676.sql
-- Cria uma função SECURITY DEFINER para verificar se o perfil acessado é o consultor atribuído ao usuário atual
-- Isso evita recursão infinita na RLS ao consultar a própria tabela profiles
CREATE OR REPLACE FUNCTION public.is_assigned_admin_of_current_user(_admin_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND (
        (assigned_to = _admin_id AND assigned_to IS NOT NULL)
        OR
        (created_by = _admin_id AND created_by IS NOT NULL)
      )
  )
$$;

-- Adiciona política que permite ao cliente visualizar o perfil do admin atribuído a ele
CREATE POLICY "Clients can view their assigned admin profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.is_assigned_admin_of_current_user(id)
);
-- END LOCAL BOOTSTRAP 20260220010001_af1b7bf3-c8c5-4a10-a48c-134f80266676.sql

-- BEGIN LOCAL BOOTSTRAP 20260221013919_432f053f-3688-41fe-896e-f88aba34e952.sql
ALTER TABLE public.email_accounts ADD COLUMN assigned_to uuid;
-- END LOCAL BOOTSTRAP 20260221013919_432f053f-3688-41fe-896e-f88aba34e952.sql

-- BEGIN LOCAL BOOTSTRAP 20260221024011_20f11925-28f1-49a4-b56a-18618c752396.sql

INSERT INTO public.email_templates (name, subject, body, trigger_event, is_active)
VALUES (
  'Link de Assinatura',
  '[WebMarcas] {{documento_tipo}} pendente de assinatura - {{marca}}',
  '<div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #1a1a2e; margin: 0;">WebMarcas</h2>
    <p style="color: #666; font-size: 14px;">Registro e Proteção de Marcas</p>
  </div>
  
  <p style="font-size: 16px; color: #333;">Olá <strong>{{nome}}</strong>,</p>
  
  <p style="font-size: 15px; color: #333; line-height: 1.6;">
    Você possui um documento pendente de assinatura eletrônica:
  </p>
  
  <div style="background: #f8f9fa; border-left: 4px solid #4f46e5; padding: 15px 20px; margin: 20px 0; border-radius: 4px;">
    <p style="margin: 0; font-size: 15px;">📄 <strong>{{documento_tipo}}</strong>: {{marca}}</p>
  </div>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="{{link_assinatura}}" style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
      ✍️ Assinar Documento
    </a>
  </div>
  
  <p style="font-size: 14px; color: #e74c3c; text-align: center;">
    ⚠️ Este link expira em <strong>{{data_expiracao}}</strong>.
  </p>
  
  <p style="font-size: 14px; color: #555; line-height: 1.6;">
    A assinatura eletrônica tem validade jurídica conforme Lei 14.063/2020 e será registrada em blockchain para garantir autenticidade.
  </p>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  
  <p style="font-size: 13px; color: #888; text-align: center;">
    Dúvidas? Entre em contato:<br/>
    📞 (11) 4200-1656 | 📧 contato@webmarcas.com.br<br/>
    🌐 <a href="preview-disabled://webmarcas" style="color: #4f46e5;">www.webmarcas.net</a>
  </p>
</div>',
  'signature_request',
  true
);

-- END LOCAL BOOTSTRAP 20260221024011_20f11925-28f1-49a4-b56a-18618c752396.sql

-- BEGIN LOCAL BOOTSTRAP 20260221031908_544fb4a0-1c62-4ad7-a260-41f48c2d63ad.sql

CREATE TABLE public.channel_notification_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage channel notification templates"
ON public.channel_notification_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_channel_notification_templates_updated_at
BEFORE UPDATE ON public.channel_notification_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- END LOCAL BOOTSTRAP 20260221031908_544fb4a0-1c62-4ad7-a260-41f48c2d63ad.sql

-- BEGIN LOCAL BOOTSTRAP 20260222052635_ac5ec245-9caa-48a0-87a3-8e65fe33328d.sql
-- Add folder column to email_inbox to distinguish inbox vs sent emails synced from IMAP
ALTER TABLE public.email_inbox ADD COLUMN IF NOT EXISTS folder text NOT NULL DEFAULT 'inbox';

-- Add index for faster filtering by folder
CREATE INDEX IF NOT EXISTS idx_email_inbox_folder ON public.email_inbox (folder);

-- Add To header field support for sent emails
ALTER TABLE public.email_inbox ADD COLUMN IF NOT EXISTS to_name text;
-- END LOCAL BOOTSTRAP 20260222052635_ac5ec245-9caa-48a0-87a3-8e65fe33328d.sql

-- BEGIN LOCAL BOOTSTRAP 20260222222431_64797194-6b32-4aac-927f-8db5c8d030d5.sql

-- Table: AI Providers
CREATE TABLE public.ai_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('openai', 'gemini', 'deepseek', 'lovable')),
  api_key TEXT,
  model TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_fallback BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ai_providers"
  ON public.ai_providers FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_ai_providers_updated_at
  BEFORE UPDATE ON public.ai_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Table: AI Usage Logs
CREATE TABLE public.ai_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  module TEXT NOT NULL,
  task_type TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  response_time_ms INTEGER,
  tokens_used INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ai_usage_logs"
  ON public.ai_usage_logs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert ai_usage_logs"
  ON public.ai_usage_logs FOR INSERT
  WITH CHECK (true);

-- Seed default Lovable AI provider (always available, no key needed)
INSERT INTO public.ai_providers (name, provider_type, api_key, model, is_active, is_fallback)
VALUES ('Lovable AI', 'lovable', NULL, 'google/gemini-3-flash-preview', true, false);

-- END LOCAL BOOTSTRAP 20260222222431_64797194-6b32-4aac-927f-8db5c8d030d5.sql

-- BEGIN LOCAL BOOTSTRAP 20260222233916_68e8607e-5beb-40f6-9393-3b11728a2a6b.sql

-- =====================================================
-- MOTOR PREDITIVO - FASE 1 (100% ADITIVO)
-- Nenhuma tabela existente é alterada
-- =====================================================

-- 1. Tabela analítica de histórico de processos
CREATE TABLE public.intelligence_process_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id UUID REFERENCES public.brand_processes(id) ON DELETE CASCADE,
  classe TEXT,
  tipo_marca TEXT DEFAULT 'nominativa',
  teve_oposicao BOOLEAN DEFAULT false,
  teve_exigencia BOOLEAN DEFAULT false,
  teve_recurso BOOLEAN DEFAULT false,
  resultado_final TEXT, -- deferido, indeferido, arquivado
  tempo_total_dias INTEGER,
  ano_finalizacao INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(process_id)
);

-- RLS: apenas admins
ALTER TABLE public.intelligence_process_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage intelligence history"
  ON public.intelligence_process_history
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert intelligence history"
  ON public.intelligence_process_history
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can update intelligence history"
  ON public.intelligence_process_history
  FOR UPDATE
  USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_intelligence_history_updated_at
  BEFORE UPDATE ON public.intelligence_process_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Função para calcular score preditivo
CREATE OR REPLACE FUNCTION public.calculate_predictive_score(p_classe TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  taxa_deferimento NUMERIC := 0;
  taxa_recurso NUMERIC := 0;
  impacto_oposicao NUMERIC := 0;
  impacto_exigencia NUMERIC := 0;
  fator_tempo NUMERIC := 0;
  score NUMERIC := 0;
  total_julgados INTEGER := 0;
  total_deferidos INTEGER := 0;
  total_com_recurso INTEGER := 0;
  recursos_deferidos INTEGER := 0;
  total_com_oposicao INTEGER := 0;
  deferidos_com_oposicao INTEGER := 0;
  total_com_exigencia INTEGER := 0;
  deferidos_com_exigencia INTEGER := 0;
  tempo_medio NUMERIC := 0;
  tempo_ref NUMERIC := 365; -- referência: 1 ano
BEGIN
  -- Taxa de deferimento por classe
  SELECT 
    COUNT(*) FILTER (WHERE resultado_final IN ('deferido', 'indeferido', 'arquivado')),
    COUNT(*) FILTER (WHERE resultado_final = 'deferido')
  INTO total_julgados, total_deferidos
  FROM intelligence_process_history
  WHERE (p_classe IS NULL OR classe = p_classe);

  IF total_julgados > 0 THEN
    taxa_deferimento := (total_deferidos::NUMERIC / total_julgados) * 100;
  END IF;

  -- Taxa de sucesso em recurso
  SELECT
    COUNT(*) FILTER (WHERE teve_recurso = true),
    COUNT(*) FILTER (WHERE teve_recurso = true AND resultado_final = 'deferido')
  INTO total_com_recurso, recursos_deferidos
  FROM intelligence_process_history
  WHERE (p_classe IS NULL OR classe = p_classe);

  IF total_com_recurso > 0 THEN
    taxa_recurso := (recursos_deferidos::NUMERIC / total_com_recurso) * 100;
  END IF;

  -- Impacto da oposição
  SELECT
    COUNT(*) FILTER (WHERE teve_oposicao = true),
    COUNT(*) FILTER (WHERE teve_oposicao = true AND resultado_final = 'deferido')
  INTO total_com_oposicao, deferidos_com_oposicao
  FROM intelligence_process_history
  WHERE (p_classe IS NULL OR classe = p_classe);

  IF total_com_oposicao > 0 THEN
    impacto_oposicao := (deferidos_com_oposicao::NUMERIC / total_com_oposicao) * 100;
  END IF;

  -- Impacto da exigência
  SELECT
    COUNT(*) FILTER (WHERE teve_exigencia = true),
    COUNT(*) FILTER (WHERE teve_exigencia = true AND resultado_final = 'deferido')
  INTO total_com_exigencia, deferidos_com_exigencia
  FROM intelligence_process_history
  WHERE (p_classe IS NULL OR classe = p_classe);

  IF total_com_exigencia > 0 THEN
    impacto_exigencia := (deferidos_com_exigencia::NUMERIC / total_com_exigencia) * 100;
  END IF;

  -- Fator tempo (quanto mais rápido, melhor)
  SELECT COALESCE(AVG(tempo_total_dias), 0)
  INTO tempo_medio
  FROM intelligence_process_history
  WHERE (p_classe IS NULL OR classe = p_classe)
    AND tempo_total_dias IS NOT NULL AND tempo_total_dias > 0;

  IF tempo_medio > 0 THEN
    fator_tempo := GREATEST(0, LEAST(100, (1 - (tempo_medio / (tempo_ref * 3))) * 100));
  ELSE
    fator_tempo := 50; -- neutro se sem dados
  END IF;

  -- Score composto
  score := (taxa_deferimento * 0.4) + (taxa_recurso * 0.2) + (impacto_oposicao * 0.2) + (impacto_exigencia * 0.1) + (fator_tempo * 0.1);
  score := GREATEST(0, LEAST(100, score));

  result := json_build_object(
    'score', ROUND(score, 1),
    'classificacao', CASE
      WHEN score >= 80 THEN 'Alta previsibilidade'
      WHEN score >= 60 THEN 'Estável'
      WHEN score >= 40 THEN 'Risco moderado'
      ELSE 'Alto risco'
    END,
    'taxa_deferimento', ROUND(taxa_deferimento, 1),
    'taxa_recurso', ROUND(taxa_recurso, 1),
    'impacto_oposicao', ROUND(impacto_oposicao, 1),
    'impacto_exigencia', ROUND(impacto_exigencia, 1),
    'fator_tempo', ROUND(fator_tempo, 1),
    'tempo_medio_dias', ROUND(tempo_medio),
    'total_julgados', total_julgados,
    'total_deferidos', total_deferidos,
    'total_com_recurso', total_com_recurso,
    'total_com_oposicao', total_com_oposicao,
    'total_com_exigencia', total_com_exigencia
  );

  RETURN result;
END;
$$;

-- 3. Função para obter métricas por classe (ranking)
CREATE OR REPLACE FUNCTION public.get_class_ranking()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_data ORDER BY score DESC)
  INTO result
  FROM (
    SELECT 
      classe,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE resultado_final = 'deferido') as deferidos,
      COUNT(*) FILTER (WHERE resultado_final = 'indeferido') as indeferidos,
      COUNT(*) FILTER (WHERE resultado_final = 'arquivado') as arquivados,
      ROUND(AVG(tempo_total_dias) FILTER (WHERE tempo_total_dias > 0)) as tempo_medio,
      CASE 
        WHEN COUNT(*) FILTER (WHERE resultado_final IN ('deferido','indeferido','arquivado')) > 0 
        THEN ROUND((COUNT(*) FILTER (WHERE resultado_final = 'deferido')::NUMERIC / 
              COUNT(*) FILTER (WHERE resultado_final IN ('deferido','indeferido','arquivado'))) * 100, 1)
        ELSE 0
      END as score
    FROM intelligence_process_history
    WHERE classe IS NOT NULL
    GROUP BY classe
    HAVING COUNT(*) >= 1
  ) row_data;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- 4. Função para evolução anual
CREATE OR REPLACE FUNCTION public.get_annual_evolution()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_data ORDER BY ano)
  INTO result
  FROM (
    SELECT 
      ano_finalizacao as ano,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE resultado_final = 'deferido') as deferidos,
      CASE 
        WHEN COUNT(*) > 0 
        THEN ROUND((COUNT(*) FILTER (WHERE resultado_final = 'deferido')::NUMERIC / COUNT(*)) * 100, 1)
        ELSE 0
      END as taxa_sucesso,
      ROUND(AVG(tempo_total_dias) FILTER (WHERE tempo_total_dias > 0)) as tempo_medio
    FROM intelligence_process_history
    WHERE ano_finalizacao IS NOT NULL
    GROUP BY ano_finalizacao
  ) row_data;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- 5. Função para sincronizar dados existentes na tabela analítica
CREATE OR REPLACE FUNCTION public.sync_intelligence_history()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  synced INTEGER := 0;
  proc RECORD;
  has_opposition BOOLEAN;
  has_exigency BOOLEAN;
  has_appeal BOOLEAN;
  final_result TEXT;
  total_days INTEGER;
  finish_year INTEGER;
  classe_val TEXT;
BEGIN
  FOR proc IN 
    SELECT bp.id, bp.ncl_classes, bp.business_area, bp.status, bp.pipeline_stage,
           bp.deposit_date, bp.created_at, bp.grant_date
    FROM brand_processes bp
  LOOP
    -- Determinar resultado final baseado no status/pipeline
    final_result := NULL;
    IF proc.status = 'registrada' OR proc.pipeline_stage = 'deferido' OR proc.pipeline_stage = 'registrada' THEN
      final_result := 'deferido';
    ELSIF proc.status = 'indeferido' OR proc.pipeline_stage = 'indeferido' THEN
      final_result := 'indeferido';
    ELSIF proc.status = 'arquivado' OR proc.pipeline_stage = 'arquivado' THEN
      final_result := 'arquivado';
    END IF;

    -- Verificar oposições, exigências e recursos via inpi_resources
    SELECT 
      EXISTS(SELECT 1 FROM inpi_resources WHERE process_number IN (
        SELECT process_number FROM brand_processes WHERE id = proc.id
      ) AND resource_type = 'oposicao'),
      EXISTS(SELECT 1 FROM inpi_resources WHERE process_number IN (
        SELECT process_number FROM brand_processes WHERE id = proc.id
      ) AND resource_type LIKE '%exigencia%'),
      EXISTS(SELECT 1 FROM inpi_resources WHERE process_number IN (
        SELECT process_number FROM brand_processes WHERE id = proc.id
      ) AND resource_type = 'recurso')
    INTO has_opposition, has_exigency, has_appeal;

    -- Classe NCL (primeira da lista)
    classe_val := NULL;
    IF proc.ncl_classes IS NOT NULL AND array_length(proc.ncl_classes, 1) > 0 THEN
      classe_val := 'NCL ' || proc.ncl_classes[1]::TEXT;
    ELSIF proc.business_area IS NOT NULL THEN
      classe_val := proc.business_area;
    END IF;

    -- Tempo total
    total_days := NULL;
    IF proc.grant_date IS NOT NULL AND proc.deposit_date IS NOT NULL THEN
      total_days := (proc.grant_date - proc.deposit_date);
    ELSIF proc.grant_date IS NOT NULL AND proc.created_at IS NOT NULL THEN
      total_days := EXTRACT(DAY FROM (proc.grant_date::timestamp - proc.created_at::timestamp))::INTEGER;
    ELSIF final_result IS NOT NULL AND proc.created_at IS NOT NULL THEN
      total_days := EXTRACT(DAY FROM (now() - proc.created_at))::INTEGER;
    END IF;

    -- Ano de finalização
    finish_year := NULL;
    IF proc.grant_date IS NOT NULL THEN
      finish_year := EXTRACT(YEAR FROM proc.grant_date);
    ELSIF final_result IS NOT NULL THEN
      finish_year := EXTRACT(YEAR FROM now());
    END IF;

    -- Upsert
    INSERT INTO intelligence_process_history (
      process_id, classe, tipo_marca,
      teve_oposicao, teve_exigencia, teve_recurso,
      resultado_final, tempo_total_dias, ano_finalizacao
    ) VALUES (
      proc.id, classe_val, 'nominativa',
      has_opposition, has_exigency, has_appeal,
      final_result, total_days, finish_year
    )
    ON CONFLICT (process_id) DO UPDATE SET
      classe = EXCLUDED.classe,
      teve_oposicao = EXCLUDED.teve_oposicao,
      teve_exigencia = EXCLUDED.teve_exigencia,
      teve_recurso = EXCLUDED.teve_recurso,
      resultado_final = EXCLUDED.resultado_final,
      tempo_total_dias = EXCLUDED.tempo_total_dias,
      ano_finalizacao = EXCLUDED.ano_finalizacao,
      updated_at = now();

    synced := synced + 1;
  END LOOP;

  RETURN json_build_object('synced', synced);
END;
$$;

-- END LOCAL BOOTSTRAP 20260222233916_68e8607e-5beb-40f6-9393-3b11728a2a6b.sql

-- BEGIN LOCAL BOOTSTRAP 20260223015015_08f7b437-5e21-44bb-946a-174313503ea1.sql

-- =========================================
-- Motor de Monetização Híbrido - Tabelas Auxiliares
-- NÃO altera nenhuma tabela existente
-- =========================================

-- 1) Tabela de logs de upsell (registra aceite/recusa)
CREATE TABLE public.upsell_monetization_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  classe_principal TEXT,
  segmento TEXT,
  score_comercial NUMERIC DEFAULT 0,
  upsell_sugerido TEXT NOT NULL,
  upsell_tipo TEXT DEFAULT 'classe_complementar',
  aceitou BOOLEAN DEFAULT NULL,
  justificativa TEXT,
  confidence_index NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.upsell_monetization_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage upsell logs"
  ON public.upsell_monetization_logs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert upsell logs"
  ON public.upsell_monetization_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view own upsell logs"
  ON public.upsell_monetization_logs FOR SELECT
  USING (auth.uid() = user_id);

-- 2) Tabela de pesos do motor (aprendizado)
CREATE TABLE public.upsell_engine_weights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dimension TEXT NOT NULL,
  dimension_value TEXT NOT NULL,
  peso NUMERIC NOT NULL DEFAULT 50,
  taxa_aceite NUMERIC DEFAULT 0,
  total_sugestoes INTEGER DEFAULT 0,
  total_aceites INTEGER DEFAULT 0,
  confidence_index NUMERIC DEFAULT 0,
  is_premium BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(dimension, dimension_value)
);

ALTER TABLE public.upsell_engine_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage engine weights"
  ON public.upsell_engine_weights FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage engine weights"
  ON public.upsell_engine_weights FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3) Tabela de configuração do motor
CREATE TABLE public.upsell_engine_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  engine_enabled BOOLEAN DEFAULT true,
  mode TEXT DEFAULT 'fixed',
  global_confidence NUMERIC DEFAULT 0,
  last_recalculation TIMESTAMP WITH TIME ZONE,
  last_optimization TIMESTAMP WITH TIME ZONE,
  stats JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.upsell_engine_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage engine config"
  ON public.upsell_engine_config FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default config
INSERT INTO public.upsell_engine_config (engine_enabled, mode, global_confidence)
VALUES (true, 'fixed', 0);

-- 4) Função de recalcular pesos
CREATE OR REPLACE FUNCTION public.recalculate_upsell_weights()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
  rec RECORD;
  total_logs INTEGER;
  global_conf NUMERIC;
  updated_count INTEGER := 0;
BEGIN
  -- Recalcular por classe
  FOR rec IN
    SELECT classe_principal as dim_val, 
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE aceitou = true) as aceitos
    FROM upsell_monetization_logs
    WHERE classe_principal IS NOT NULL AND aceitou IS NOT NULL
    GROUP BY classe_principal
  LOOP
    INSERT INTO upsell_engine_weights (dimension, dimension_value, peso, taxa_aceite, total_sugestoes, total_aceites, confidence_index, is_premium)
    VALUES (
      'classe', rec.dim_val,
      CASE WHEN rec.total >= 5 THEN (rec.aceitos::NUMERIC / rec.total) * 100 ELSE 50 END,
      CASE WHEN rec.total > 0 THEN (rec.aceitos::NUMERIC / rec.total) * 100 ELSE 0 END,
      rec.total, rec.aceitos,
      LEAST(100, rec.total * 5),
      (rec.aceitos::NUMERIC / GREATEST(rec.total, 1)) * 100 > 60
    )
    ON CONFLICT (dimension, dimension_value) DO UPDATE SET
      peso = CASE WHEN rec.total >= 5 THEN (rec.aceitos::NUMERIC / rec.total) * 100 ELSE 50 END,
      taxa_aceite = CASE WHEN rec.total > 0 THEN (rec.aceitos::NUMERIC / rec.total) * 100 ELSE 0 END,
      total_sugestoes = rec.total,
      total_aceites = rec.aceitos,
      confidence_index = LEAST(100, rec.total * 5),
      is_premium = (rec.aceitos::NUMERIC / GREATEST(rec.total, 1)) * 100 > 60,
      updated_at = now();
    updated_count := updated_count + 1;
  END LOOP;

  -- Recalcular por segmento
  FOR rec IN
    SELECT segmento as dim_val,
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE aceitou = true) as aceitos
    FROM upsell_monetization_logs
    WHERE segmento IS NOT NULL AND aceitou IS NOT NULL
    GROUP BY segmento
  LOOP
    INSERT INTO upsell_engine_weights (dimension, dimension_value, peso, taxa_aceite, total_sugestoes, total_aceites, confidence_index, is_premium)
    VALUES (
      'segmento', rec.dim_val,
      CASE WHEN rec.total >= 5 THEN (rec.aceitos::NUMERIC / rec.total) * 100 ELSE 50 END,
      CASE WHEN rec.total > 0 THEN (rec.aceitos::NUMERIC / rec.total) * 100 ELSE 0 END,
      rec.total, rec.aceitos,
      LEAST(100, rec.total * 5),
      (rec.aceitos::NUMERIC / GREATEST(rec.total, 1)) * 100 > 60
    )
    ON CONFLICT (dimension, dimension_value) DO UPDATE SET
      peso = CASE WHEN rec.total >= 5 THEN (rec.aceitos::NUMERIC / rec.total) * 100 ELSE 50 END,
      taxa_aceite = CASE WHEN rec.total > 0 THEN (rec.aceitos::NUMERIC / rec.total) * 100 ELSE 0 END,
      total_sugestoes = rec.total,
      total_aceites = rec.aceitos,
      confidence_index = LEAST(100, rec.total * 5),
      is_premium = (rec.aceitos::NUMERIC / GREATEST(rec.total, 1)) * 100 > 60,
      updated_at = now();
    updated_count := updated_count + 1;
  END LOOP;

  -- Calcular confiança global
  SELECT COUNT(*) INTO total_logs FROM upsell_monetization_logs WHERE aceitou IS NOT NULL;
  global_conf := LEAST(100, COALESCE(total_logs, 0) * 2);

  -- Determinar modo
  UPDATE upsell_engine_config SET
    global_confidence = global_conf,
    mode = CASE
      WHEN global_conf < 40 THEN 'fixed'
      WHEN global_conf < 70 THEN 'hybrid'
      ELSE 'intelligent'
    END,
    last_recalculation = now(),
    stats = json_build_object(
      'total_logs', total_logs,
      'weights_updated', updated_count,
      'recalculated_at', now()
    )::jsonb,
    updated_at = now();

  result := json_build_object(
    'success', true,
    'weights_updated', updated_count,
    'total_logs', total_logs,
    'global_confidence', global_conf,
    'mode', CASE
      WHEN global_conf < 40 THEN 'fixed'
      WHEN global_conf < 70 THEN 'hybrid'
      ELSE 'intelligent'
    END
  );

  RETURN result;
END;
$$;

-- END LOCAL BOOTSTRAP 20260223015015_08f7b437-5e21-44bb-946a-174313503ea1.sql

-- BEGIN LOCAL BOOTSTRAP 20260224040154_560a8578-c393-419b-bbf3-0c650aa7ccf1.sql
-- Allow anonymous users to verify contracts by blockchain hash (public verification page)
CREATE POLICY "Public can verify contracts by hash"
  ON public.contracts
  FOR SELECT
  TO anon
  USING (blockchain_hash IS NOT NULL);

-- Allow anonymous users to read documents linked to verified contracts
CREATE POLICY "Public can read documents for verified contracts"
  ON public.documents
  FOR SELECT
  TO anon
  USING (
    contract_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.contracts c 
      WHERE c.id = documents.contract_id 
      AND c.blockchain_hash IS NOT NULL
    )
  );
-- END LOCAL BOOTSTRAP 20260224040154_560a8578-c393-419b-bbf3-0c650aa7ccf1.sql

-- BEGIN LOCAL BOOTSTRAP 20260225035917_ae374caf-1fd6-4175-9839-48f3b8362253.sql
ALTER TABLE rpi_entries
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS linked_at timestamptz;
-- END LOCAL BOOTSTRAP 20260225035917_ae374caf-1fd6-4175-9839-48f3b8362253.sql

-- BEGIN LOCAL BOOTSTRAP 20260225044652_df6dbede-3828-4793-8769-8dfe23e60769.sql

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

-- END LOCAL BOOTSTRAP 20260225044652_df6dbede-3828-4793-8769-8dfe23e60769.sql

-- BEGIN LOCAL BOOTSTRAP 20260225051719_80e50aae-ce42-4215-898e-96a0f2b57ff0.sql

-- RLS para clientes verem seus proprios registros de publicacao
CREATE POLICY "Clients can view own publicacoes"
  ON public.publicacoes_marcas FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

-- Ativar realtime na tabela publicacoes_marcas
ALTER PUBLICATION supabase_realtime ADD TABLE public.publicacoes_marcas;

-- END LOCAL BOOTSTRAP 20260225051719_80e50aae-ce42-4215-898e-96a0f2b57ff0.sql

-- BEGIN LOCAL BOOTSTRAP 20260225054629_17e63308-b235-45ca-be2e-5a7934e6003f.sql

-- 1. Tornar process_id e client_id nullable
ALTER TABLE publicacoes_marcas ALTER COLUMN process_id DROP NOT NULL;
ALTER TABLE publicacoes_marcas ALTER COLUMN client_id DROP NOT NULL;

-- 2. Adicionar colunas de rastreamento RPI
ALTER TABLE publicacoes_marcas ADD COLUMN IF NOT EXISTS rpi_entry_id uuid UNIQUE;
ALTER TABLE publicacoes_marcas ADD COLUMN IF NOT EXISTS brand_name_rpi text;
ALTER TABLE publicacoes_marcas ADD COLUMN IF NOT EXISTS process_number_rpi text;

-- END LOCAL BOOTSTRAP 20260225054629_17e63308-b235-45ca-be2e-5a7934e6003f.sql

-- BEGIN LOCAL BOOTSTRAP 20260225065013_45f6d078-c4e9-44ae-86eb-16f492070a56.sql

-- Add last_notification_sent_at to publicacoes_marcas for notification dedup
ALTER TABLE public.publicacoes_marcas 
ADD COLUMN IF NOT EXISTS last_notification_sent_at timestamp with time zone DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN public.publicacoes_marcas.last_notification_sent_at IS 'Timestamp of last automated notification sent for this publication, used for dedup';

-- END LOCAL BOOTSTRAP 20260225065013_45f6d078-c4e9-44ae-86eb-16f492070a56.sql

-- BEGIN LOCAL BOOTSTRAP 20260225133413_e4370ea1-47fd-4d37-b490-e606bb55b8d0.sql

-- Add Google Meet columns to client_appointments
ALTER TABLE public.client_appointments ADD COLUMN IF NOT EXISTS google_meet_link TEXT;
ALTER TABLE public.client_appointments ADD COLUMN IF NOT EXISTS google_event_id TEXT;

-- Add Google Meet columns to meetings
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS google_meet_link TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS google_event_id TEXT;

-- END LOCAL BOOTSTRAP 20260225133413_e4370ea1-47fd-4d37-b490-e606bb55b8d0.sql

-- BEGIN LOCAL BOOTSTRAP 20260226031038_e794a6c2-f44a-4c44-9100-83ad0fc8d77f.sql

-- 1. Novas colunas na tabela leads (aditivo)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_temperature text DEFAULT 'frio',
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz,
  ADD COLUMN IF NOT EXISTS remarketing_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- 2. Tabela lead_activities
CREATE TABLE IF NOT EXISTS public.lead_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  admin_id uuid,
  activity_type text NOT NULL,
  content text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lead_activities"
  ON public.lead_activities FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. Tabela lead_remarketing_campaigns
CREATE TABLE IF NOT EXISTS public.lead_remarketing_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'personalizado',
  subject text,
  body text,
  target_status text[] DEFAULT '{}',
  target_origin text[] DEFAULT '{}',
  scheduled_at timestamptz,
  sent_at timestamptz,
  total_sent integer DEFAULT 0,
  total_opened integer DEFAULT 0,
  created_by uuid,
  status text NOT NULL DEFAULT 'rascunho',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_remarketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lead_remarketing_campaigns"
  ON public.lead_remarketing_campaigns FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- END LOCAL BOOTSTRAP 20260226031038_e794a6c2-f44a-4c44-9100-83ad0fc8d77f.sql

-- BEGIN LOCAL BOOTSTRAP 20260226055141_e5895465-3777-4432-8e5d-446a779f0f1d.sql

-- Tabela de fila de remarketing
CREATE TABLE public.lead_remarketing_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NULL,
  lead_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'pending',
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  subject text NULL,
  body text NULL
);

-- RLS
ALTER TABLE public.lead_remarketing_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage remarketing queue"
ON public.lead_remarketing_queue
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage remarketing queue"
ON public.lead_remarketing_queue
FOR ALL
USING (true)
WITH CHECK (true);

-- Index para o cron processor
CREATE INDEX idx_remarketing_queue_pending ON public.lead_remarketing_queue (status, scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_remarketing_queue_campaign ON public.lead_remarketing_queue (campaign_id);

-- Também garantir que a tabela lead_remarketing_campaigns existe com os campos necessários
-- Adicionar coluna channels e total_queued se não existirem
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lead_remarketing_campaigns' AND column_name = 'channels') THEN
    ALTER TABLE public.lead_remarketing_campaigns ADD COLUMN channels text[] DEFAULT '{email}'::text[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lead_remarketing_campaigns' AND column_name = 'total_queued') THEN
    ALTER TABLE public.lead_remarketing_campaigns ADD COLUMN total_queued integer DEFAULT 0;
  END IF;
END $$;

-- END LOCAL BOOTSTRAP 20260226055141_e5895465-3777-4432-8e5d-446a779f0f1d.sql

-- BEGIN LOCAL BOOTSTRAP 20260226173108_bd71eb7b-e0ad-4909-8fc2-7e22485180c6.sql

-- Tabela de campanhas de remarketing para clientes
CREATE TABLE public.client_remarketing_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'custom',
  subject text,
  body text,
  target_status text[] DEFAULT '{}',
  channels text[] DEFAULT '{email}',
  status text NOT NULL DEFAULT 'rascunho',
  total_sent integer DEFAULT 0,
  total_opened integer DEFAULT 0,
  total_queued integer DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_at timestamp with time zone,
  scheduled_at timestamp with time zone
);

ALTER TABLE public.client_remarketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage client remarketing campaigns"
  ON public.client_remarketing_campaigns FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Tabela de fila de remarketing para clientes
CREATE TABLE public.client_remarketing_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid REFERENCES public.client_remarketing_campaigns(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'pending',
  scheduled_for timestamp with time zone NOT NULL DEFAULT now(),
  sent_at timestamp with time zone,
  error_message text,
  subject text,
  body text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.client_remarketing_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage client remarketing queue"
  ON public.client_remarketing_queue FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage client remarketing queue"
  ON public.client_remarketing_queue FOR ALL
  USING (true)
  WITH CHECK (true);

-- END LOCAL BOOTSTRAP 20260226173108_bd71eb7b-e0ad-4909-8fc2-7e22485180c6.sql

-- BEGIN LOCAL BOOTSTRAP 20260226191713_a8c537dd-ee4d-4b76-83bb-a5f926c485a0.sql
-- Add FK from lead_remarketing_queue.lead_id to leads.id
ALTER TABLE public.lead_remarketing_queue
  ADD CONSTRAINT lead_remarketing_queue_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

-- Add FK from client_remarketing_queue.client_id to profiles.id
ALTER TABLE public.client_remarketing_queue
  ADD CONSTRAINT client_remarketing_queue_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
-- END LOCAL BOOTSTRAP 20260226191713_a8c537dd-ee4d-4b76-83bb-a5f926c485a0.sql

-- BEGIN LOCAL BOOTSTRAP 20260226225450_4cb2c75d-50f8-40ad-b0bd-f892d0ca28a2.sql

-- Add ncl_class column to publicacoes_marcas for manual Nice class assignment
ALTER TABLE public.publicacoes_marcas ADD COLUMN IF NOT EXISTS ncl_class text;

-- END LOCAL BOOTSTRAP 20260226225450_4cb2c75d-50f8-40ad-b0bd-f892d0ca28a2.sql

-- BEGIN LOCAL BOOTSTRAP 20260226233127_4e0bb0b3-a551-4a9e-9452-76657fec13af.sql

-- Add linking_method column to track how publications were linked to clients
ALTER TABLE public.publicacoes_marcas 
ADD COLUMN IF NOT EXISTS linking_method TEXT DEFAULT 'manual';

-- Add stale_since column to detect stalled processes
ALTER TABLE public.publicacoes_marcas 
ADD COLUMN IF NOT EXISTS stale_since TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN public.publicacoes_marcas.linking_method IS 'How the client was linked: manual, auto_process, auto_brand, fuzzy';
COMMENT ON COLUMN public.publicacoes_marcas.stale_since IS 'Timestamp when the publication was detected as stalled (no status change for 30+ days)';

-- END LOCAL BOOTSTRAP 20260226233127_4e0bb0b3-a551-4a9e-9452-76657fec13af.sql

-- BEGIN LOCAL BOOTSTRAP 20260227004850_43adc06d-8cde-48e1-8fe5-2905359cf00c.sql
ALTER TABLE public.inpi_resources DROP CONSTRAINT inpi_resources_resource_type_check;

ALTER TABLE public.inpi_resources ADD CONSTRAINT inpi_resources_resource_type_check CHECK (resource_type = ANY (ARRAY['indeferimento'::text, 'exigencia_merito'::text, 'oposicao'::text, 'notificacao_extrajudicial'::text]));
-- END LOCAL BOOTSTRAP 20260227004850_43adc06d-8cde-48e1-8fe5-2905359cf00c.sql

-- BEGIN LOCAL BOOTSTRAP 20260228063347_ee8356ea-655b-4fcf-8245-b66f37cd9002.sql

-- Permitir que usuarios autenticados leiam system_settings
CREATE POLICY "Authenticated users can read system settings"
ON public.system_settings
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Inserir configuracao padrao do kanban do cliente
INSERT INTO public.system_settings (key, value)
VALUES ('client_kanban_stages', '{"stages":[{"id":"em_andamento","name":"Em Andamento","color":"#3B82F6"},{"id":"publicado_rpi","name":"Publicado RPI","color":"#8B5CF6"},{"id":"em_exame","name":"Em Exame","color":"#F59E0B"},{"id":"deferido","name":"Deferido","color":"#10B981"},{"id":"concedido","name":"Concedido","color":"#22C55E"},{"id":"indeferido","name":"Indeferido","color":"#EF4444"},{"id":"arquivado","name":"Arquivado","color":"#6B7280"}]}')
ON CONFLICT (key) DO NOTHING;

-- END LOCAL BOOTSTRAP 20260228063347_ee8356ea-655b-4fcf-8245-b66f37cd9002.sql

-- BEGIN LOCAL BOOTSTRAP 20260302212508_7e03e17f-4dbe-43a0-a59c-07726f14ab67.sql
-- Migrate existing publicacoes_marcas status values to match juridico kanban stages
UPDATE public.publicacoes_marcas SET status = '003' WHERE status = 'depositada';
UPDATE public.publicacoes_marcas SET status = 'publicada' WHERE status = 'publicada';
UPDATE public.publicacoes_marcas SET status = 'oposicao' WHERE status = 'oposicao';
UPDATE public.publicacoes_marcas SET status = 'exigencia_merito' WHERE status = 'publicada';
UPDATE public.publicacoes_marcas SET status = 'deferimento' WHERE status = 'deferida';
UPDATE public.publicacoes_marcas SET status = 'certificado' WHERE status = 'certificada';
UPDATE public.publicacoes_marcas SET status = 'indeferimento' WHERE status = 'indeferida';
UPDATE public.publicacoes_marcas SET status = 'arquivado' WHERE status = 'arquivada';
UPDATE public.publicacoes_marcas SET status = 'renovacao' WHERE status = 'renovacao_pendente';

-- END LOCAL BOOTSTRAP 20260302212508_7e03e17f-4dbe-43a0-a59c-07726f14ab67.sql

-- BEGIN LOCAL BOOTSTRAP 20260303035939_8b6e10dd-0fc1-4fb3-87a1-7669ed5a4be6.sql
CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(lookup_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE email = lower(trim(lookup_email)) LIMIT 1;
$$;
-- END LOCAL BOOTSTRAP 20260303035939_8b6e10dd-0fc1-4fb3-87a1-7669ed5a4be6.sql

-- BEGIN LOCAL BOOTSTRAP 20260303195133_6c63f14e-3cca-4c1d-af3e-76cd23d5c46f.sql
UPDATE public.profiles SET assigned_to = '1ca389a4-bb64-4ff5-97ab-0a214ccab4b8' WHERE assigned_to = '8b5a4fc0-1fc4-402d-8ee9-c7cae2c0e39a';
-- END LOCAL BOOTSTRAP 20260303195133_6c63f14e-3cca-4c1d-af3e-76cd23d5c46f.sql

-- BEGIN LOCAL BOOTSTRAP 20260305022724_fe59c7b5-3e81-4fb0-9712-d9fdeb7dd068.sql

-- Marketing Intelligence tables

CREATE TABLE public.marketing_config (
  id uuid PRIMARY KEY DEFAULT gen
_random_uuid(),
  meta_pixel_id text,
  meta_business_id text,
  is_connected boolean NOT NULL DEFAULT false,
  last_sync timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage marketing_config"
  ON public.marketing_config FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_campaign_id text,
  campaign_name text NOT NULL,
  adset_name text,
  ad_name text,
  status text DEFAULT 'active',
  spend numeric DEFAULT 0,
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  leads_count integer DEFAULT 0,
  cpl numeric DEFAULT 0,
  revenue numeric DEFAULT 0,
  roi numeric DEFAULT 0,
  synced_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage marketing_campaigns"
  ON public.marketing_campaigns FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.marketing_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  fbclid text,
  meta_campaign_id text,
  meta_adset_id text,
  meta_ad_id text,
  revenue numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_attribution ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage marketing_attribution"
  ON public.marketing_attribution FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can insert marketing_attribution"
  ON public.marketing_attribution FOR INSERT
  WITH CHECK (true);

-- END LOCAL BOOTSTRAP 20260305022724_fe59c7b5-3e81-4fb0-9712-d9fdeb7dd068.sql

-- BEGIN LOCAL BOOTSTRAP 20260305023930_36dc7ec3-f406-42f5-8c26-54c80b46745d.sql

-- Marketing Data Warehouse: Ads table (ad-level data from Meta/Google)
CREATE TABLE public.marketing_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'meta',
  meta_ad_id TEXT,
  meta_adset_id TEXT,
  ad_name TEXT,
  adset_name TEXT,
  status TEXT DEFAULT 'active',
  spend NUMERIC DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  leads_count INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  cpc NUMERIC DEFAULT 0,
  cpm NUMERIC DEFAULT 0,
  cpl NUMERIC DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(meta_ad_id)
);

-- Marketing Data Warehouse: Daily performance snapshots
CREATE TABLE public.marketing_ad_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  ad_id UUID REFERENCES public.marketing_ads(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'meta',
  date DATE NOT NULL,
  spend NUMERIC DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  leads_count INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  cpc NUMERIC DEFAULT 0,
  cpm NUMERIC DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ad_id, date)
);

-- Marketing Data Warehouse: Conversions tracking
CREATE TABLE public.marketing_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID,
  client_id UUID,
  contract_id UUID,
  invoice_id UUID,
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  ad_id UUID REFERENCES public.marketing_ads(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  event_value NUMERIC DEFAULT 0,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  fbclid TEXT,
  gclid TEXT,
  attribution_model TEXT DEFAULT 'last_click',
  platform TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Marketing Budget Alerts
CREATE TABLE public.marketing_budget_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  threshold_value NUMERIC NOT NULL,
  current_value NUMERIC DEFAULT 0,
  is_triggered BOOLEAN DEFAULT false,
  triggered_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add new columns to marketing_campaigns for enhanced tracking
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'meta';
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS ctr NUMERIC DEFAULT 0;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS cpc NUMERIC DEFAULT 0;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS cpm NUMERIC DEFAULT 0;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS conversions INTEGER DEFAULT 0;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS daily_budget NUMERIC DEFAULT 0;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS monthly_budget_limit NUMERIC DEFAULT 0;

-- Add new columns to marketing_attribution for enhanced tracking
ALTER TABLE public.marketing_attribution ADD COLUMN IF NOT EXISTS gclid TEXT;
ALTER TABLE public.marketing_attribution ADD COLUMN IF NOT EXISTS landing_page TEXT;
ALTER TABLE public.marketing_attribution ADD COLUMN IF NOT EXISTS referrer TEXT;
ALTER TABLE public.marketing_attribution ADD COLUMN IF NOT EXISTS attribution_model TEXT DEFAULT 'last_click';
ALTER TABLE public.marketing_attribution ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;
ALTER TABLE public.marketing_attribution ADD COLUMN IF NOT EXISTS contract_id UUID;
ALTER TABLE public.marketing_attribution ADD COLUMN IF NOT EXISTS invoice_id UUID;

-- Add Google Ads config to marketing_config
ALTER TABLE public.marketing_config ADD COLUMN IF NOT EXISTS google_ads_customer_id TEXT;
ALTER TABLE public.marketing_config ADD COLUMN IF NOT EXISTS google_ads_connected BOOLEAN DEFAULT false;
ALTER TABLE public.marketing_config ADD COLUMN IF NOT EXISTS sync_interval_minutes INTEGER DEFAULT 60;
ALTER TABLE public.marketing_config ADD COLUMN IF NOT EXISTS budget_alert_enabled BOOLEAN DEFAULT true;

-- RLS for new tables
ALTER TABLE public.marketing_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_ad_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_budget_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage marketing_ads" ON public.marketing_ads FOR ALL TO authenticated USING (public.has_current_user_role('admin'::app_role));
CREATE POLICY "Admins can manage marketing_ad_performance" ON public.marketing_ad_performance FOR ALL TO authenticated USING (public.has_current_user_role('admin'::app_role));
CREATE POLICY "Admins can manage marketing_conversions" ON public.marketing_conversions FOR ALL TO authenticated USING (public.has_current_user_role('admin'::app_role));
CREATE POLICY "Admins can manage marketing_budget_alerts" ON public.marketing_budget_alerts FOR ALL TO authenticated USING (public.has_current_user_role('admin'::app_role));

-- END LOCAL BOOTSTRAP 20260305023930_36dc7ec3-f406-42f5-8c26-54c80b46745d.sql

-- BEGIN LOCAL BOOTSTRAP 20260305024418_98904e05-4f8f-439d-b52f-3a6058face52.sql

-- AI Generated Ads storage
CREATE TABLE public.marketing_generated_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name TEXT,
  platform TEXT NOT NULL DEFAULT 'meta',
  target_audience TEXT,
  objective TEXT,
  headline TEXT NOT NULL,
  primary_text TEXT NOT NULL,
  description TEXT,
  call_to_action TEXT,
  generated_by TEXT DEFAULT 'lovable_ai',
  status TEXT DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- A/B Test tracking
CREATE TABLE public.marketing_ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name TEXT NOT NULL,
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'running',
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  winner_variant TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- A/B Test variants
CREATE TABLE public.marketing_ab_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID REFERENCES public.marketing_ab_tests(id) ON DELETE CASCADE NOT NULL,
  variant_name TEXT NOT NULL,
  headline TEXT,
  primary_text TEXT,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  leads INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  spend NUMERIC DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  cpl NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI Audience suggestions
CREATE TABLE public.marketing_audience_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_type TEXT NOT NULL DEFAULT 'interest',
  name TEXT NOT NULL,
  description TEXT,
  estimated_reach TEXT,
  confidence_score NUMERIC DEFAULT 0,
  source TEXT DEFAULT 'ai_analysis',
  is_applied BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.marketing_generated_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_ab_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_audience_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage marketing_generated_ads" ON public.marketing_generated_ads FOR ALL TO authenticated USING (public.has_current_user_role('admin'::app_role));
CREATE POLICY "Admins manage marketing_ab_tests" ON public.marketing_ab_tests FOR ALL TO authenticated USING (public.has_current_user_role('admin'::app_role));
CREATE POLICY "Admins manage marketing_ab_variants" ON public.marketing_ab_variants FOR ALL TO authenticated USING (public.has_current_user_role('admin'::app_role));
CREATE POLICY "Admins manage marketing_audience_suggestions" ON public.marketing_audience_suggestions FOR ALL TO authenticated USING (public.has_current_user_role('admin'::app_role));

-- END LOCAL BOOTSTRAP 20260305024418_98904e05-4f8f-439d-b52f-3a6058face52.sql

-- BEGIN LOCAL BOOTSTRAP 20260305030244_92f0b990-d8ca-4a86-9e9f-1ba5d47bed9f.sql

-- Trigger 1: Auto-populate marketing_conversions when a lead is created
CREATE OR REPLACE FUNCTION public.on_lead_created_marketing_conversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO marketing_conversions (lead_id, event_name, platform, utm_source, utm_medium, utm_campaign, created_at)
  VALUES (NEW.id, 'LeadCreated', 'website', NULL, NULL, NULL, NOW());
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lead_created_marketing_conversion
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.on_lead_created_marketing_conversion();

-- Trigger 2: Auto-populate marketing_conversions when a contract is signed
CREATE OR REPLACE FUNCTION public.on_contract_signed_marketing_conversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.signature_status = 'signed' AND (OLD.signature_status IS NULL OR OLD.signature_status != 'signed') THEN
    INSERT INTO marketing_conversions (contract_id, client_id, event_name, event_value, platform, created_at)
    VALUES (NEW.id, NEW.user_id, 'ContractSigned', NEW.contract_value, 'website', NOW());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contract_signed_marketing_conversion
AFTER UPDATE OF signature_status ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.on_contract_signed_marketing_conversion();

-- Trigger 3: Auto-populate marketing_conversions when an invoice is paid
CREATE OR REPLACE FUNCTION public.on_invoice_paid_marketing_conversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    INSERT INTO marketing_conversions (invoice_id, client_id, event_name, event_value, platform, created_at)
    VALUES (NEW.id, NEW.user_id, 'PaymentCompleted', NEW.amount, 'website', NOW());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invoice_paid_marketing_conversion
AFTER UPDATE OF status ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.on_invoice_paid_marketing_conversion();

-- END LOCAL BOOTSTRAP 20260305030244_92f0b990-d8ca-4a86-9e9f-1ba5d47bed9f.sql

-- BEGIN LOCAL BOOTSTRAP 20260305192612_9f0d0e72-544e-4948-a08f-f296d86236ef.sql
ALTER TABLE public.brand_processes DROP CONSTRAINT IF EXISTS brand_processes_status_check;

ALTER TABLE public.brand_processes ADD CONSTRAINT brand_processes_status_check CHECK (status IN (
  'em_andamento',
  '003',
  'oposicao',
  'exigencia_merito',
  'deferido',
  'deferimento',
  'indeferido',
  'indeferimento',
  'certificado',
  'renovacao',
  'arquivado',
  'publicado_rpi',
  'em_exame',
  'concedido'
));
-- END LOCAL BOOTSTRAP 20260305192612_9f0d0e72-544e-4948-a08f-f296d86236ef.sql

-- BEGIN LOCAL BOOTSTRAP 20260306045045_f42dea1b-e0ab-4c63-abbe-da822c8828b9.sql

INSERT INTO public.contract_templates (name, content, is_active, variables)
VALUES 
(
  'Contrato Premium - Registro de Marca INPI',
  'CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS DE ASSESSORAMENTO PREMIUM PARA REGISTRO DE MARCA JUNTO AO INPI

Por este instrumento particular de prestação de serviços, que fazem, de um lado:

I) WebMarcas Intelligence PI, com sede na cidade de SÃO PAULO, Estado de SP, na AVENIDA BRIGADEIRO LUIS ANTONIO, Nº: 2696, CEP: 01402-000, inscrita no CNPJ/MF sob o Nº: 39.528.012/0001-29, neste ato representada por seu titular, senhor Davilys Danques de Oliveira Cunha, brasileiro, casado, regularmente inscrito no RG sob o Nº 50.688.779-0 e CPF sob o Nº 393.239.118-79, a seguir denominada CONTRATADA.

II) {{razao_social_ou_nome}}, {{dados_cnpj}}com sede na {{endereco_completo}}, neste ato representada por {{nome_cliente}}, CPF sob o nº {{cpf}}, com endereço de e-mail para faturamento {{email}} e Tel: {{telefone}}, ("Contratante").

As partes celebram o presente Acordo de Tarifas, que se regerá pelas cláusulas e condições abaixo:

1. CLÁUSULA PRIMEIRA – DO OBJETO

1.1 A CONTRATADA prestará os serviços de preparo, protocolo e acompanhamento do pedido de registro da marca "{{marca}}" junto ao INPI até a conclusão do processo, incluindo o cumprimento de todas as exigências, oposições e recursos necessários, no ramo de atividade: {{ramo_atividade}}.

2. CLÁUSULA SEGUNDA – DA RESPONSABILIDADE SOBRE OS SERVIÇOS CONTRATADOS

2.1 Executar os serviços com responsabilidade e qualidade;
2.2 Fornecer cópia digital dos atos praticados junto ao INPI;
2.3 Comunicar à CONTRATANTE eventuais impedimentos ou exigências;
2.4 Acompanhar semanalmente o processo no INPI e informar colidências, exigências ou publicações;
2.5 Garantir o investimento da CONTRATANTE com nova tentativa sem custos adicionais de honorários caso o registro seja negado.

3. CLÁUSULA TERCEIRA - DAS OBRIGAÇÕES GERAIS DA CONTRATADA

3.1 Enviar cópias digitais por e-mail e relatório anual do processo;
3.2 Executar os serviços conforme o contrato e a legislação;
3.3 Cumprir prazos e exigências do INPI;
3.4 Comunicar impedimentos imediatamente, a fim de cumprir as normas do INPI para garantir o registro.

4. CLÁUSULA QUARTA – DAS OBRIGAÇÕES GERAIS DA CONTRATANTE

4.1 A CONTRATANTE obriga-se a efetuar os pagamentos na forma, prazos e condições estabelecidas neste instrumento.
4.2 A CONTRATANTE compromete-se a fornecer à CONTRATADA todas as informações, documentos e materiais solicitados, de forma completa e dentro dos prazos estipulados.
4.3 A CONTRATANTE poderá solicitar ajustes ou correções nos serviços prestados somente quando houver divergência comprovada com o objeto deste contrato.
4.4 A CONTRATANTE reconhece que a CONTRATADA atua como assessoria técnica e jurídica especializada, sendo que a decisão final sobre a concessão do registro de marca cabe exclusivamente ao INPI.

5. CLÁUSULA QUINTA – DAS CONDIÇÕES DE PAGAMENTO

5.1 Os pagamentos à CONTRATADA serão efetuados mediante assinatura mensal recorrente no valor de R$ 398,00 (trezentos e noventa e oito reais), cobrada automaticamente via cartão de crédito, com vigência a partir da data de assinatura deste contrato.
5.2 Taxas do INPI e anuidade: As taxas federais obrigatórias (GRU) serão de responsabilidade exclusiva do CONTRATANTE, devendo ser recolhidas diretamente ao INPI e a taxa de anuidade valor de R$398,00 a ser paga sempre do 05/12 de cada ano. Após essas etapas, o requerente receberá o certificado de registro válido por 10 anos, com direito à renovação.
5.3 O cadastro do CONTRATANTE junto ao INPI é realizado pela CONTRATADA previamente ao pagamento das taxas federais.
5.4 O atraso no pagamento da mensalidade implicará em acréscimo de multa e juros conforme cláusula sétima.

6. CLÁUSULA SEXTA – DO PRAZO DE VIGÊNCIA

6.1 O presente contrato terá vigência a partir da data de sua assinatura e perdurará até o final do decênio de registro de marca junto ao INPI, podendo ser renovado mediante termo aditivo.

7. CLÁUSULA SÉTIMA – DA INADIMPLÊNCIA

7.1 No caso de inadimplência, a CONTRATANTE estará sujeita a:
a) Multa de 10% (dez por cento) sobre o valor total devido;
b) Juros de mora de 1% (um por cento) ao mês;
c) Correção monetária pelo IGPM/FGV;
d) Suspensão imediata dos serviços até a regularização do débito;
e) Inscrição em cadastros de proteção ao crédito após 30 dias de inadimplência.

8. CLÁUSULA OITAVA – DA CONFIDENCIALIDADE

8.1 As partes se comprometem a manter em sigilo absoluto todas as informações confidenciais trocadas durante a execução do contrato, incluindo dados pessoais, comerciais e estratégicos.
8.2 Esta obrigação de confidencialidade permanecerá vigente por prazo indeterminado, mesmo após o término deste contrato.

9. CLÁUSULA NONA – DA RESCISÃO

9.1 Este contrato poderá ser rescindido por qualquer das partes mediante aviso prévio de 30 (trinta) dias, por escrito.
9.2 A CONTRATANTE somente poderá cancelar o contrato se não houver débitos pendentes com a CONTRATADA.
9.3 Em caso de rescisão antecipada por iniciativa da CONTRATANTE, não haverá devolução de valores já pagos referentes a serviços executados ou em andamento.

10. CLÁUSULA DÉCIMA – DAS CONDIÇÕES GERAIS

10.1 Fica pactuada entre as partes a prestação dos serviços de acompanhamento e vigilância do(s) processo(s) referentes à marca {{marca}}.
10.2 Durante a tramitação do processo junto ao INPI, poderão surgir situações que exijam a apresentação de documentos adicionais, os quais deverão ser providenciados pela CONTRATANTE em tempo hábil.
10.3 A CONTRATADA se compromete a cumprir todas as exigências, oposições e recursos necessários sem custo adicional de honorários, estando estes já contemplados na mensalidade do Plano Premium. O recolhimento das taxas federais (GRU) será de responsabilidade da CONTRATANTE e deverá ser realizado conforme a liberação dos respectivos despachos publicados na Revista da Propriedade Industrial (RPI).

11. CLÁUSULA DÉCIMA PRIMEIRA – DAS DISPOSIÇÕES FINAIS

11.1 Este contrato representa o acordo integral entre as partes, substituindo quaisquer negociações ou acordos anteriores, verbais ou escritos.
11.2 A tolerância de uma das partes quanto ao descumprimento de qualquer obrigação pela outra não implica novação ou renúncia de direitos.
11.3 Qualquer alteração deste contrato somente será válida se formalizada por escrito e assinada por ambas as partes.

12. CLÁUSULA DÉCIMA SEGUNDA – DO FORO

12.1 Para dirimir quaisquer dúvidas ou controvérsias oriundas do presente instrumento, as partes elegem o Foro da Comarca de São Paulo – SP, com renúncia expressa a qualquer outro, por mais privilegiado que seja.

Por estarem justas e contratadas, as partes assinam o presente instrumento em 02 (duas) vias de igual teor e forma, na presença das testemunhas abaixo.

São Paulo, {{data_extenso}}.

CONTRATADA:
WebMarcas Intelligence PI
CNPJ: 39.528.012/0001-29

CONTRATANTE:
{{nome_cliente}}
CPF/CNPJ: {{cpf_cnpj}}',
  true,
  '["nome_cliente","cpf","cpf_cnpj","email","telefone","razao_social_ou_nome","dados_cnpj","endereco_completo","marca","ramo_atividade","data_extenso","forma_pagamento_detalhada"]'::jsonb
),
(
  'Contrato Corporativo - Registro de Marca INPI',
  'CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS CORPORATIVO PARA REGISTRO DE MARCA JUNTO AO INPI

Por este instrumento particular de prestação de serviços, que fazem, de um lado:

I) WebMarcas Intelligence PI, com sede na cidade de SÃO PAULO, Estado de SP, na AVENIDA BRIGADEIRO LUIS ANTONIO, Nº: 2696, CEP: 01402-000, inscrita no CNPJ/MF sob o Nº: 39.528.012/0001-29, neste ato representada por seu titular, senhor Davilys Danques de Oliveira Cunha, brasileiro, casado, regularmente inscrito no RG sob o Nº 50.688.779-0 e CPF sob o Nº 393.239.118-79, a seguir denominada CONTRATADA.

II) {{razao_social_ou_nome}}, {{dados_cnpj}}com sede na {{endereco_completo}}, neste ato representada por {{nome_cliente}}, CPF sob o nº {{cpf}}, com endereço de e-mail para faturamento {{email}} e Tel: {{telefone}}, ("Contratante").

As partes celebram o presente Acordo de Tarifas, que se regerá pelas cláusulas e condições abaixo:

1. CLÁUSULA PRIMEIRA – DO OBJETO

1.1 A CONTRATADA prestará os serviços de preparo, protocolo e acompanhamento de registros de marcas ilimitados junto ao INPI até a conclusão dos processos, incluindo o cumprimento de todas as exigências, oposições e recursos necessários, no ramo de atividade: {{ramo_atividade}}.

2. CLÁUSULA SEGUNDA – DA RESPONSABILIDADE SOBRE OS SERVIÇOS CONTRATADOS

2.1 Executar os serviços com responsabilidade e qualidade;
2.2 Fornecer cópia digital dos atos praticados junto ao INPI;
2.3 Comunicar à CONTRATANTE eventuais impedimentos ou exigências;
2.4 Acompanhar semanalmente o processo no INPI e informar colidências, exigências ou publicações;
2.5 Garantir o investimento da CONTRATANTE com nova tentativa sem custos adicionais de honorários caso o registro seja negado.

3. CLÁUSULA TERCEIRA - DAS OBRIGAÇÕES GERAIS DA CONTRATADA

3.1 Enviar cópias digitais por e-mail e relatório anual do processo;
3.2 Executar os serviços conforme o contrato e a legislação;
3.3 Cumprir prazos e exigências do INPI;
3.4 Comunicar impedimentos imediatamente, a fim de cumprir as normas do INPI para garantir o registro.

4. CLÁUSULA QUARTA – DAS OBRIGAÇÕES GERAIS DA CONTRATANTE

4.1 A CONTRATANTE obriga-se a efetuar os pagamentos na forma, prazos e condições estabelecidas neste instrumento.
4.2 A CONTRATANTE compromete-se a fornecer à CONTRATADA todas as informações, documentos e materiais solicitados, de forma completa e dentro dos prazos estipulados.
4.3 A CONTRATANTE poderá solicitar ajustes ou correções nos serviços prestados somente quando houver divergência comprovada com o objeto deste contrato.
4.4 A CONTRATANTE reconhece que a CONTRATADA atua como assessoria técnica e jurídica especializada, sendo que a decisão final sobre a concessão do registro de marca cabe exclusivamente ao INPI.

5. CLÁUSULA QUINTA – DAS CONDIÇÕES DE PAGAMENTO

5.1 Os pagamentos à CONTRATADA serão efetuados mediante assinatura mensal recorrente no valor de R$ 1.194,00 (mil cento e noventa e quatro reais), cobrada automaticamente via cartão de crédito, com vigência a partir da data de assinatura deste contrato.
5.2 Taxas do INPI e anuidade: As taxas federais obrigatórias (GRU) serão de responsabilidade exclusiva do CONTRATANTE, devendo ser recolhidas diretamente ao INPI e a taxa de anuidade valor de R$1.194,00 a ser paga sempre do 05/12 de cada ano. Após essas etapas, o requerente receberá o certificado de registro válido por 10 anos, com direito à renovação.
5.3 O cadastro do CONTRATANTE junto ao INPI é realizado pela CONTRATADA previamente ao pagamento das taxas federais.
5.4 O atraso no pagamento da mensalidade implicará em acréscimo de multa e juros conforme cláusula sétima.

6. CLÁUSULA SEXTA – DO PRAZO DE VIGÊNCIA

6.1 O presente contrato terá vigência a partir da data de sua assinatura e perdurará até o final do decênio de registro de marca junto ao INPI, podendo ser renovado mediante termo aditivo.

7. CLÁUSULA SÉTIMA – DA INADIMPLÊNCIA

7.1 No caso de inadimplência, a CONTRATANTE estará sujeita a:
a) Multa de 10% (dez por cento) sobre o valor total devido;
b) Juros de mora de 1% (um por cento) ao mês;
c) Correção monetária pelo IGPM/FGV;
d) Suspensão imediata dos serviços até a regularização do débito;
e) Inscrição em cadastros de proteção ao crédito após 30 dias de inadimplência.

8. CLÁUSULA OITAVA – DA CONFIDENCIALIDADE

8.1 As partes se comprometem a manter em sigilo absoluto todas as informações confidenciais trocadas durante a execução do contrato, incluindo dados pessoais, comerciais e estratégicos.
8.2 Esta obrigação de confidencialidade permanecerá vigente por prazo indeterminado, mesmo após o término deste contrato.

9. CLÁUSULA NONA – DA RESCISÃO

9.1 Este contrato poderá ser rescindido por qualquer das partes mediante aviso prévio de 30 (trinta) dias, por escrito.
9.2 A CONTRATANTE somente poderá cancelar o contrato se não houver débitos pendentes com a CONTRATADA.
9.3 Em caso de rescisão antecipada por iniciativa da CONTRATANTE, não haverá devolução de valores já pagos referentes a serviços executados ou em andamento.

10. CLÁUSULA DÉCIMA – DAS CONDIÇÕES GERAIS

10.1 Fica pactuada entre as partes a prestação dos serviços de acompanhamento e vigilância do(s) processo(s) referentes à marca {{marca}}.
10.2 Durante a tramitação do processo junto ao INPI, poderão surgir situações que exijam a apresentação de documentos adicionais, os quais deverão ser providenciados pela CONTRATANTE em tempo hábil.
10.3 A CONTRATADA se compromete a cumprir todas as exigências, oposições e recursos necessários sem custo adicional de honorários, estando estes já contemplados na mensalidade do Plano Corporativo. O recolhimento das taxas federais (GRU) será de responsabilidade da CONTRATANTE e deverá ser realizado conforme a liberação dos respectivos despachos publicados na Revista da Propriedade Industrial (RPI).
10.4 O Plano Corporativo contempla registros de marcas ilimitados, vinculados exclusivamente ao CPF ou CNPJ do CONTRATANTE que realizou a contratação. Todas as marcas registradas sob este plano deverão ser tituladas no mesmo CPF ou CNPJ cadastrado. Caso o CONTRATANTE deseje registrar marcas em outro CPF ou CNPJ, deverá contratar um novo plano específico para tal finalidade.

11. CLÁUSULA DÉCIMA PRIMEIRA – DAS DISPOSIÇÕES FINAIS

11.1 Este contrato representa o acordo integral entre as partes, substituindo quaisquer negociações ou acordos anteriores, verbais ou escritos.
11.2 A tolerância de uma das partes quanto ao descumprimento de qualquer obrigação pela outra não implica novação ou renúncia de direitos.
11.3 Qualquer alteração deste contrato somente será válida se formalizada por escrito e assinada por ambas as partes.

12. CLÁUSULA DÉCIMA SEGUNDA – DO FORO

12.1 Para dirimir quaisquer dúvidas ou controvérsias oriundas do presente instrumento, as partes elegem o Foro da Comarca de São Paulo – SP, com renúncia expressa a qualquer outro, por mais privilegiado que seja.

Por estarem justas e contratadas, as partes assinam o presente instrumento em 02 (duas) vias de igual teor e forma, na presença das testemunhas abaixo.

São Paulo, {{data_extenso}}.

CONTRATADA:
WebMarcas Intelligence PI
CNPJ: 39.528.012/0001-29

CONTRATANTE:
{{nome_cliente}}
CPF/CNPJ: {{cpf_cnpj}}',
  true,
  '["nome_cliente","cpf","cpf_cnpj","email","telefone","razao_social_ou_nome","dados_cnpj","endereco_completo","marca","ramo_atividade","data_extenso","forma_pagamento_detalhada"]'::jsonb
);

-- END LOCAL BOOTSTRAP 20260306045045_f42dea1b-e0ab-4c63-abbe-da822c8828b9.sql

-- BEGIN LOCAL BOOTSTRAP 20260309185813_6ebb1b23-8a0e-4553-9f35-b40e8f9433b4.sql

ALTER TABLE public.brand_processes DROP CONSTRAINT IF EXISTS brand_processes_status_check;
ALTER TABLE public.brand_processes ADD CONSTRAINT brand_processes_status_check CHECK (pipeline_stage IS NULL OR pipeline_stage IN ('protocolado', '003', 'oposicao', 'exigencia_merito', 'exigencia_de_mrito', 'indeferimento', 'notificacao', 'deferimento', 'certificados', 'certificado', 'renovacao', 'distrato', 'assinou_contrato', 'pagamento_ok', 'pagou_taxa', 'taxa_inpi_paga', 'em_andamento', 'depositada', 'arquivado'));

-- END LOCAL BOOTSTRAP 20260309185813_6ebb1b23-8a0e-4553-9f35-b40e8f9433b4.sql

-- BEGIN LOCAL BOOTSTRAP 20260309193920_c5c50d91-7114-4a24-b041-e65d21d68125.sql
UPDATE system_settings 
SET value = jsonb_set(
  value,
  '{stages}',
  (
    SELECT jsonb_agg(
      CASE 
        WHEN elem->>'id' = 'exigencia_de_mrito' 
        THEN jsonb_set(elem, '{id}', '"exigencia_merito"')
        ELSE elem
      END
    )
    FROM jsonb_array_elements(value->'stages') elem
  )
)
WHERE key = 'admin_kanban_juridico_stages';
-- END LOCAL BOOTSTRAP 20260309193920_c5c50d91-7114-4a24-b041-e65d21d68125.sql

-- BEGIN LOCAL BOOTSTRAP 20260310192311_f5697147-6a6b-459e-9930-accc5c349771.sql
DELETE FROM publicacoes_marcas pm1
WHERE pm1.process_id IS NULL 
  AND pm1.client_id IS NULL
  AND pm1.process_number_rpi IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM publicacoes_marcas pm2
    WHERE pm2.process_number_rpi = pm1.process_number_rpi
      AND pm2.id != pm1.id
      AND pm2.process_id IS NOT NULL
  );
-- END LOCAL BOOTSTRAP 20260310192311_f5697147-6a6b-459e-9930-accc5c349771.sql

-- BEGIN LOCAL BOOTSTRAP 20260310194347_94868519-5719-468b-b58f-f8a06b3c2e29.sql
-- Remove orphan publicações (no client linked) — these should never exist in the Kanban
DELETE FROM publicacoes_marcas WHERE client_id IS NULL;
-- END LOCAL BOOTSTRAP 20260310194347_94868519-5719-468b-b58f-f8a06b3c2e29.sql

-- BEGIN LOCAL BOOTSTRAP 20260311194250_e543bce7-fc97-484a-911d-07fc9ca31539.sql
ALTER TABLE public.inpi_resources DROP CONSTRAINT IF EXISTS inpi_resources_resource_type_check;

ALTER TABLE public.inpi_resources
ADD CONSTRAINT inpi_resources_resource_type_check
CHECK (
  resource_type = ANY (
    ARRAY[
      'indeferimento'::text,
      'exigencia_merito'::text,
      'oposicao'::text,
      'notificacao_extrajudicial'::text,
      'troca_procurador'::text,
      'nomeacao_procurador'::text
    ]
  )
);
-- END LOCAL BOOTSTRAP 20260311194250_e543bce7-fc97-484a-911d-07fc9ca31539.sql

-- BEGIN LOCAL BOOTSTRAP 20260313011616_f0fa0998-a9a8-4878-825d-6f3bb6b219d0.sql

-- Step 4 fixed: For orphan cards, only enrich brand_name/ncl_class without setting process_id to avoid unique constraint
UPDATE publicacoes_marcas pm
SET brand_name_rpi = COALESCE(NULLIF(pm.brand_name_rpi, ''), bp.brand_name),
    ncl_class = COALESCE(pm.ncl_class, array_to_string(bp.ncl_classes, ', '))
FROM brand_processes bp
WHERE pm.process_id IS NULL
  AND pm.process_number_rpi IS NOT NULL
  AND pm.process_number_rpi != ''
  AND (pm.brand_name_rpi IS NULL OR pm.brand_name_rpi = '' OR pm.ncl_class IS NULL)
  AND REGEXP_REPLACE(bp.process_number, '[^0-9]', '', 'g') = REGEXP_REPLACE(pm.process_number_rpi, '[^0-9]', '', 'g')
  AND REGEXP_REPLACE(bp.process_number, '[^0-9]', '', 'g') != '';

-- END LOCAL BOOTSTRAP 20260313011616_f0fa0998-a9a8-4878-825d-6f3bb6b219d0.sql

-- BEGIN LOCAL BOOTSTRAP 20260313225732_c482271d-653d-48fd-8d4e-1ef9a0d113c7.sql

-- Add new columns to email_inbox for full content support
ALTER TABLE email_inbox ADD COLUMN IF NOT EXISTS imap_uid integer;
ALTER TABLE email_inbox ADD COLUMN IF NOT EXISTS snippet text;
ALTER TABLE email_inbox ADD COLUMN IF NOT EXISTS has_attachments boolean DEFAULT false;
ALTER TABLE email_inbox ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;
ALTER TABLE email_inbox ADD COLUMN IF NOT EXISTS body_fetched_at timestamptz;

-- Performance index
CREATE INDEX IF NOT EXISTS idx_email_inbox_account_folder_received ON email_inbox(account_id, folder, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_inbox_needs_hydration ON email_inbox(body_fetched_at) WHERE body_fetched_at IS NULL;

-- Storage bucket for email attachments (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('email-attachments', 'email-attachments', false) ON CONFLICT DO NOTHING;

-- RLS policies for email-attachments bucket
CREATE POLICY "Authenticated users can upload email attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'email-attachments');
CREATE POLICY "Authenticated users can read email attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'email-attachments');

-- END LOCAL BOOTSTRAP 20260313225732_c482271d-653d-48fd-8d4e-1ef9a0d113c7.sql

-- BEGIN LOCAL BOOTSTRAP 20260321213216_395c85e5-fa67-407a-af7f-f6ccb7b8e104.sql
UPDATE contract_templates 
SET content = E'Pelo presente instrumento particular de distrato, de um lado:\n\nI) WebMarcas Intelligence PI, pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o Nº: 39.528.012/0001-29, com sede na cidade de SÃO PAULO, Estado de SP, na Av. Brigadeiro Luís Antônio, 2696 - andar 2, sala 202 - Jardim Paulista, CEP: 01402-000, doravante denominada CONTRATADA;\n\nE, de outro lado:\n\nII) {{nome_empresa}}, com sede na {{endereco_empresa}}, na cidade de {{cidade}}, estado de {{estado}}, CEP {{cep}}, inscrita no CNPJ sob nº {{cnpj}}, neste ato representada por {{nome_representante}}, CPF sob o nº {{cpf_representante}}, com endereço de e-mail para faturamento {{email}} e Tel: {{telefone}}, doravante denominada CONTRATANTE.\n\nAs partes acima qualificadas, em comum e recíproco acordo, resolvem, por este instrumento e na melhor forma de direito, DISTRATAR o Contrato de Prestação de Serviços celebrado para preparo de depósito de registro de marca junto ao INSTITUTO NACIONAL DA PROPRIEDADE INDUSTRIAL, referente à marca {{marca}}, bem como o acompanhamento e supervisão do processo até sua fase processual seguinte, doravante denominado \"Contrato Original\", mediante as cláusulas e condições seguintes:\n\nCLÁUSULA PRIMEIRA – DO OBJETO DO DISTRATO E CONDIÇÕES DE RESCISÃO\n\n1.1. O presente instrumento tem como objeto o distrato do Contrato Original, celebrado entre as partes, que tinha como fundamento a prestação de serviços de preparo e depósito de registro de marca junto ao INSTITUTO NACIONAL DA PROPRIEDADE INDUSTRIAL, referente à marca {{marca}}, bem como o acompanhamento e supervisão do processo até sua fase processual seguinte.\n\n1.2. As partes, de forma livre e espontânea, e no pleno exercício de suas faculdades, declaram dissolver, a partir da data de assinatura deste distrato, todos os direitos e obrigações decorrentes do Contrato Original. Fica expressamente acordado que, em virtude do cancelamento, haverá um ônus financeiro correspondente ao valor de {{numero_parcelas}} parcela(s) de R$ {{valor_multa}}. A falta de pagamento deste ônus implicará na cobrança do valor total do serviço contratado, sujeito a protesto e demais medidas legais cabíveis.\n\n1.3. As partes declaram que, com a assinatura do presente distrato, o Contrato Original é considerado integralmente cumprido e extinto, ressalvadas as obrigações financeiras expressamente previstas neste instrumento, não havendo quaisquer outras pendências recíprocas, sejam elas financeiras, contratuais, ou de qualquer outra ordem, exceto as aqui estabelecidas.\n\n1.4. Este Distrato passa a vigorar entre as partes a partir da data de sua assinatura, independentemente do estágio de desenvolvimento financeiro ou jurídico das partes.\n\nCLÁUSULA SEGUNDA – DA QUITAÇÃO PLENA, IRREVOGÁVEL E IRRETRATÁVEL\n\n2.1. A CONTRATANTE, por este ato, concede à CONTRATADA, e esta à CONTRATANTE, a mais ampla, geral, rasa, plena, irrevogável e irretratável quitação de todas e quaisquer obrigações, direitos, deveres, créditos, débitos, responsabilidades, indenizações, multas, penalidades, perdas e danos, de qualquer natureza, presentes ou futuras, decorrentes ou relacionadas ao Contrato Original, para nada mais reclamar, a qualquer título e a qualquer tempo, judicial ou extrajudicialmente, ressalvadas as obrigações financeiras expressamente estabelecidas na Cláusula Primeira deste distrato.\n\n2.2. O presente distrato é celebrado em caráter irretratável e irrevogável, obrigando as partes por si, seus herdeiros e sucessores, a qualquer tempo e grau de desenvolvimento financeiro ou jurídico, não sendo admitida qualquer alegação de vício de consentimento, erro, dolo, coação, simulação ou fraude, para fins de sua anulação ou revisão.\n\nCLÁUSULA TERCEIRA – DA VEDAÇÃO A RECLAMAÇÕES E MEDIDAS ADVERSAS\n\n3.1. A CONTRATANTE, ao assinar o presente instrumento, reconhece e concorda expressamente que, em virtude da quitação plena, irrevogável e irretratável concedida na Cláusula Segunda, NÃO PODERÁ propor, iniciar, dar continuidade ou participar de qualquer tipo de reclamação, ação judicial, procedimento administrativo, queixa, denúncia, ou qualquer outra medida, de qualquer natureza, que vise a discutir, questionar, ou imputar responsabilidade à CONTRATADA, seus sócios, administradores, empregados, prepostos ou representantes, por fatos, atos ou omissões ocorridos durante a vigência ou em decorrência do Contrato Original, ressalvadas as obrigações financeiras expressamente estabelecidas na Cláusula Primeira deste distrato.\n\n3.2. A CONTRATANTE se compromete a abster-se de qualquer conduta que possa, direta ou indiretamente, causar prejuízo à imagem, reputação, bom nome, ou quaisquer outros direitos da CONTRATADA, de seus sócios, administradores, empregados, prepostos ou representantes, sob pena de responder por perdas e danos, sem prejuízo das demais medidas legais cabíveis.\n\nCLÁUSULA QUARTA – DA CONFIDENCIALIDADE\n\n4.1. As partes comprometem-se a manter sigilo e confidencialidade sobre todas as informações e termos do presente distrato, bem como sobre quaisquer informações comerciais, técnicas ou estratégicas da outra parte, que tenham tido acesso em razão do Contrato Original e deste distrato, sob pena de responderem por perdas e danos.\n\nCLÁUSULA QUINTA – DA INDEPENDÊNCIA DAS CLÁUSULAS\n\n5.1. Caso qualquer disposição deste distrato seja considerada inválida, ilegal ou inexequível em qualquer jurisdição, tal invalidade, ilegalidade ou inexequibilidade não afetará a validade, legalidade ou exequibilidade das demais disposições deste distrato, nem a validade, legalidade ou exequibilidade de tal disposição em qualquer outra jurisdição.\n\nCLÁUSULA SEXTA – DA LEGISLAÇÃO APLICÁVEL E ELEIÇÃO DE FORO\n\n6.1. O presente distrato será regido e interpretado de acordo com as leis da República Federativa do Brasil.\n\n6.2. Fica eleito o Foro da Comarca de São Paulo, Estado de São Paulo, para dirimir quaisquer dúvidas ou litígios oriundos do presente distrato, com expressa renúncia a qualquer outro, por mais privilegiado que seja.\n\nPor estarem justas e contratadas, as partes assinam o presente de igual teor e forma, de forma digital válida juridicamente.\n\nSão Paulo, {{data_distrato}}.\n\n{contract_signature}',
    variables = '["{{nome_empresa}}", "{{endereco_empresa}}", "{{cidade}}", "{{estado}}", "{{cep}}", "{{cnpj}}", "{{nome_representante}}", "{{cpf_representante}}", "{{email}}", "{{telefone}}", "{{marca}}", "{{numero_parcelas}}", "{{valor_multa}}", "{{data_distrato}}"]'::jsonb,
    updated_at = now()
WHERE name = 'Distrato com Multa - Padrão';

UPDATE contract_templates 
SET content = E'Pelo presente instrumento particular de distrato, de um lado:\n\nI) WebMarcas Intelligence PI, pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o Nº: 39.528.012/0001-29, com sede na cidade de SÃO PAULO, Estado de SP, na Av. Brigadeiro Luís Antônio, 2696 - andar 2, sala 202 - Jardim Paulista, CEP: 01402-000, doravante denominada CONTRATADA;\n\nE, de outro lado:\n\nII) {{nome_empresa}}, com sede na {{endereco_empresa}}, na cidade de {{cidade}}, estado de {{estado}}, CEP {{cep}}, inscrita no CNPJ sob nº {{cnpj}}, neste ato representada por {{nome_representante}}, CPF sob o nº {{cpf_representante}}, com endereço de e-mail para faturamento {{email}} e Tel: {{telefone}}, doravante denominada CONTRATANTE.\n\nAs partes acima qualificadas, em comum e recíproco acordo, resolvem, por este instrumento e na melhor forma de direito, DISTRATAR o Contrato de Prestação de Serviços celebrado para preparo de depósito de registro de marca junto ao INSTITUTO NACIONAL DA PROPRIEDADE INDUSTRIAL, referente à marca {{marca}}, bem como o acompanhamento e supervisão do processo até sua fase processual seguinte, doravante denominado \"Contrato Original\", mediante as cláusulas e condições seguintes:\n\nCLÁUSULA PRIMEIRA – DO OBJETO DO DISTRATO\n\n1.1. O presente instrumento tem como objeto o distrato do Contrato Original, celebrado entre as partes, que tinha como fundamento a prestação de serviços de preparo e depósito de registro de marca junto ao INSTITUTO NACIONAL DA PROPRIEDADE INDUSTRIAL, referente à marca {{marca}}, bem como o acompanhamento e supervisão do processo até sua fase processual seguinte.\n\n1.2. As partes, de forma livre e espontânea, e no pleno exercício de suas faculdades, declaram dissolver, a partir da data de assinatura deste distrato, todos os direitos e obrigações decorrentes do Contrato Original, de modo que não subsistam quaisquer resquícios de ônus financeiro, obrigacional, ou de qualquer outra natureza, relativos ao referido contrato.\n\nCLÁUSULA SEGUNDA – DA QUITAÇÃO PLENA, IRREVOGÁVEL E IRRETRATÁVEL\n\n2.1. A CONTRATANTE, por este ato, concede à CONTRATADA, e esta à CONTRATANTE, a mais ampla, geral, rasa, plena, irrevogável e irretratável quitação de todas e quaisquer obrigações, direitos, deveres, créditos, débitos, responsabilidades, indenizações, multas, penalidades, perdas e danos, de qualquer natureza, presentes ou futuras, decorrentes ou relacionadas ao Contrato Original, para nada mais reclamar, a qualquer título e a qualquer tempo, judicial ou extrajudicialmente.\n\n2.2. As partes declaram, expressamente, que, com a assinatura do presente distrato, o Contrato Original é considerado integralmente cumprido e extinto, não havendo quaisquer pendências recíprocas, sejam elas financeiras, contratuais, ou de qualquer outra ordem.\n\n2.3. O presente distrato é celebrado em caráter irretratável e irrevogável, obrigando as partes por si, seus herdeiros e sucessores, a qualquer tempo e grau de desenvolvimento financeiro ou jurídico, não sendo admitida qualquer alegação de vício de consentimento, erro, dolo, coação, simulação ou fraude, para fins de sua anulação ou revisão.\n\nCLÁUSULA TERCEIRA – DA VEDAÇÃO A RECLAMAÇÕES E MEDIDAS ADVERSAS\n\n3.1. A CONTRATANTE, ao assinar o presente instrumento, reconhece e concorda expressamente que, em virtude da quitação plena, irrevogável e irretratável concedida na Cláusula Segunda, NÃO PODERÁ propor, iniciar, dar continuidade ou participar de qualquer tipo de reclamação, ação judicial, procedimento administrativo, queixa, denúncia, ou qualquer outra medida, de qualquer natureza, que vise a discutir, questionar, ou imputar responsabilidade à CONTRATADA, seus sócios, administradores, empregados, prepostos ou representantes, por fatos, atos ou omissões ocorridos durante a vigência ou em decorrência do Contrato Original.\n\n3.2. A CONTRATANTE se compromete a abster-se de qualquer conduta que possa, direta ou indiretamente, causar prejuízo à imagem, reputação, bom nome, ou quaisquer outros direitos da CONTRATADA, de seus sócios, administradores, empregados, prepostos ou representantes, sob pena de responder por perdas e dan
os, sem prejuízo das demais medidas legais cabíveis.\n\nCLÁUSULA QUARTA – DA CONFIDENCIALIDADE\n\n4.1. As partes comprometem-se a manter sigilo e confidencialidade sobre todas as informações e termos do presente distrato, bem como sobre quaisquer informações comerciais, técnicas ou estratégicas da outra parte, que tenham tido acesso em razão do Contrato Original e deste distrato, sob pena de responderem por perdas e danos.\n\nCLÁUSULA QUINTA – DA INDEPENDÊNCIA DAS CLÁUSULAS\n\n5.1. Caso qualquer disposição deste distrato seja considerada inválida, ilegal ou inexequível em qualquer jurisdição, tal invalidade, ilegalidade ou inexequibilidade não afetará a validade, legalidade ou exequibilidade das demais disposições deste distrato, nem a validade, legalidade ou exequibilidade de tal disposição em qualquer outra jurisdição.\n\nCLÁUSULA SEXTA – DA LEGISLAÇÃO APLICÁVEL E ELEIÇÃO DE FORO\n\n6.1. O presente distrato será regido e interpretado de acordo com as leis da República Federativa do Brasil.\n\n6.2. Fica eleito o Foro da Comarca de São Paulo, Estado de São Paulo, para dirimir quaisquer dúvidas ou litígios oriundos do presente distrato, com expressa renúncia a qualquer outro, por mais privilegiado que seja.\n\nPor estarem justas e contratadas, as partes assinam o presente de igual teor e forma, de forma digital válida juridicamente.\n\nSão Paulo, {{data_distrato}}.\n\n{contract_signature}',
    variables = '["{{nome_empresa}}", "{{endereco_empresa}}", "{{cidade}}", "{{estado}}", "{{cep}}", "{{cnpj}}", "{{nome_representante}}", "{{cpf_representante}}", "{{email}}", "{{telefone}}", "{{marca}}", "{{data_distrato}}"]'::jsonb,
    updated_at = now()
WHERE name = 'Distrato sem Multa - Padrão';
-- END LOCAL BOOTSTRAP 20260321213216_395c85e5-fa67-407a-af7f-f6ccb7b8e104.sql

-- BEGIN LOCAL BOOTSTRAP 20260324173434_4d20bcc3-efe3-4315-b6a7-9ca48723d7a7.sql
ALTER TABLE public.inpi_resources DROP CONSTRAINT IF EXISTS inpi_resources_resource_type_check;

ALTER TABLE public.inpi_resources
ADD CONSTRAINT inpi_resources_resource_type_check
CHECK (
  resource_type = ANY (
    ARRAY[
      'indeferimento'::text,
      'exigencia_merito'::text,
      'oposicao'::text,
      'notificacao_extrajudicial'::text,
      'resposta_notificacao_extrajudicial'::text,
      'troca_procurador'::text,
      'nomeacao_procurador'::text
    ]
  )
);
-- END LOCAL BOOTSTRAP 20260324173434_4d20bcc3-efe3-4315-b6a7-9ca48723d7a7.sql

-- BEGIN LOCAL BOOTSTRAP 20260326020025_2ed111c5-2cba-4113-af59-a6275bc2aace.sql
ALTER TABLE public.brand_processes DROP CONSTRAINT brand_processes_status_check;

ALTER TABLE public.brand_processes ADD CONSTRAINT brand_processes_status_check CHECK (
  pipeline_stage IS NULL OR pipeline_stage = ANY (ARRAY[
    'protocolado', '003', 'oposicao', 'exigencia_merito', 'exigencia_de_mrito',
    'indeferimento', 'notificacao', 'deferimento', 'certificados', 'certificado',
    'renovacao', 'distrato', 'assinou_contrato', 'pagamento_ok', 'pagou_taxa',
    'taxa_inpi_paga', 'em_andamento', 'depositada', 'arquivado',
    'publicado_rpi', 'em_exame', 'deferido', 'concedido', 'registrada'
  ])
);
-- END LOCAL BOOTSTRAP 20260326020025_2ed111c5-2cba-4113-af59-a6275bc2aace.sql

-- BEGIN LOCAL BOOTSTRAP 20260326020558_4ec1aaf9-2e29-41c3-8930-b0d05d63ca05.sql
ALTER TABLE public.brand_processes DROP CONSTRAINT brand_processes_status_check;

ALTER TABLE public.brand_processes ADD CONSTRAINT brand_processes_status_check CHECK (
  pipeline_stage IS NULL OR pipeline_stage = ANY (ARRAY[
    'protocolado', '003', 'oposicao', 'exigencia_merito', 'exigencia_de_mrito',
    'indeferimento', 'indeferido', 'notificacao', 'deferimento', 'deferido',
    'certificados', 'certificado', 'renovacao', 'distrato', 'assinou_contrato',
    'pagamento_ok', 'pagou_taxa', 'taxa_inpi_paga', 'em_andamento', 'depositada',
    'arquivado', 'arquivados', 'publicado_rpi', 'em_exame', 'concedido', 'registrada'
  ])
);
-- END LOCAL BOOTSTRAP 20260326020558_4ec1aaf9-2e29-41c3-8930-b0d05d63ca05.sql

-- Catalog-verified legacy relation absent from the local pre-ledger dump.
CREATE TABLE public.inpiknowledgebase (
 id uuid PRIMARY KEY, category varchar NOT NULL, title text NOT NULL, content text NOT NULL,
 source_url text, source_date date, valid_until date, is_active boolean DEFAULT true,
 priority integer DEFAULT 1, tags text[] DEFAULT '{}'::text[], raw_html text,
 created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
