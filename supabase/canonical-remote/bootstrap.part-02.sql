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
  'https://www.gov.br/inpi/pt-br/servicos/marcas/taxas',
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
  'https://www.gov.br/inpi/pt-br/servicos/marcas/prazos-e-procedimentos',
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
  'https://www.gov.br/inpi/pt-br/servicos/marcas/despachos',
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
  'https://www.gov.br/inpi/pt-br/servicos/marcas/manual-de-marcas',
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
  ('email_provider', '{"enabled": true, "provider": "resend", "api_key": "", "from_email": "noreply@webmarcas.net", "from_name": "WebMarcas"}')
ON CONFLICT DO NOTHING;

-- END LOCAL BOOTSTRAP 20260218221052_4d0256c1-92bc-49cc-8810-0636efe58854.sql

-- BEGIN LOCAL BOOTSTRAP 20260218221827_94292e2f-f12b-4937-b621-aa4da7bc9d35.sql

-- Garante que a coluna unique constraint existe para key em system_settings (para ON CONFLICT funcionar)
-- Upsert configs padrão para integrações novas
INSERT INTO public.system_settings (key, value) VALUES
  ('email_provider', '{"enabled": true, "provider": "resend", "api_key": "", "from_email": "noreply@webmarcas.net", "from_name": "WebMarcas"}'::jsonb),
  ('openai_config', '{"enabled": true, "api_key": ""}'::jsonb),
  ('inpi_sync', '{"enabled": true, "sync_interval_hours": 24, "last_sync_at": null}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- END LOCAL BOOTSTRAP 20260218221827_94292e2f-f12b-4937-b621-aa4da7bc9d35.sql

-- BEGIN LOCAL BOOTSTRAP 20260218224357_684c3bbc-9af3-48be-b19c-435aca19afb9.sql

-- Garantir que notification_dispatch_logs existe com estrutura completa
CREATE TABLE IF NOT EXIS
