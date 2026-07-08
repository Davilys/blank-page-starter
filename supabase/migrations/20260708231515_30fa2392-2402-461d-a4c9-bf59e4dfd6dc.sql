CREATE OR REPLACE FUNCTION public.verify_contract_by_id(p_contract_id uuid)
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
  WHERE c.id = p_contract_id
    AND c.signature_status = 'signed'
    AND c.blockchain_hash IS NOT NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.verify_contract_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_contract_by_id(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_contract_by_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_contract_by_id(uuid) TO service_role;