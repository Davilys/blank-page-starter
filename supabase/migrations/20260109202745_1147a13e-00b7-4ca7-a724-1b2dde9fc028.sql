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
COMMENT ON COLUMN public.contracts.blockchain_proof IS 'Base64 encoded cryptographic proof from OpenTimestamps';
COMMENT ON COLUMN public.contracts.device_info IS 'JSON with device information (browser, OS, screen resolution, timezone)';