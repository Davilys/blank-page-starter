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
  ('whatsapp', '{"number": "", "enabled": true, "welcome_message": "Olá! Como posso ajudar?"}'),
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
