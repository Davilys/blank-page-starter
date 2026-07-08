CREATE OR REPLACE FUNCTION public.verify_contract_by_hash(p_hash text)
RETURNS TABLE (
  contract_number text,
  blockchain_hash text,
  blockchain_tx_id text,
  blockchain_network text,
  blockchain_timestamp text,
  signed_at timestamptz,
  subject text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.contract_number,
    c.blockchain_hash,
    c.blockchain_tx_id,
    c.blockchain_network,
    c.blockchain_timestamp,
    c.signed_at,
    c.subject
  FROM public.contracts c
  WHERE c.signature_status = 'signed'
    AND c.blockchain_hash IS NOT NULL
    AND lower(trim(c.blockchain_hash)) = lower(trim(p_hash))
    AND lower(trim(p_hash)) ~ '^[a-f0-9]{64}$'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.verify_contract_by_hash(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_contract_by_hash(text) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_contract_by_hash(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_contract_by_hash(text) TO service_role;