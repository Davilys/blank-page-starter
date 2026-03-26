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