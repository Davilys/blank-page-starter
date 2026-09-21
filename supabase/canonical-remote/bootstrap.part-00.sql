-- Offline bootstrap from repository-local migrations before the first captured remote ledger version.
-- Ephemeral CI only. Never apply to production.
\set ON_ERROR_STOP on

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
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
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
