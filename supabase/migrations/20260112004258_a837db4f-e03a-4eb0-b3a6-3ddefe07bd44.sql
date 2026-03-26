-- Phase 1: Add contract_id to documents table for proper synchronization
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_documents_contract_id ON public.documents(contract_id);

-- Comment for documentation
COMMENT ON COLUMN public.documents.contract_id IS 'Links document to its parent contract for synchronization between CRM and Client Area';