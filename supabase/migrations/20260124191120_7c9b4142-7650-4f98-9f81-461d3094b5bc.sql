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