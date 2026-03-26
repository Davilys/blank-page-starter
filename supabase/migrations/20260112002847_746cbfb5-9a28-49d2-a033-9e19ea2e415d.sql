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