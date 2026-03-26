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