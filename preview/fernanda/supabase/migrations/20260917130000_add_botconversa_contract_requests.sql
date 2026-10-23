-- Idempotency and audit trail for BotConversa -> contract creation.
-- This table intentionally stores no customer document or message content.
CREATE TABLE IF NOT EXISTS public.botconversa_contract_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'botconversa',
  flow_name text NOT NULL,
  agent_name text NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  contract_number text,
  signature_token text,
  error_code text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_botconversa_contract_requests_status ON public.botconversa_contract_requests(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_botconversa_contract_requests_contract ON public.botconversa_contract_requests(contract_id) WHERE contract_id IS NOT NULL;

ALTER TABLE public.botconversa_contract_requests ENABLE ROW LEVEL SECURITY;

-- Only server-side functions (service role) can create or read webhook requests.
-- Administrators may inspect the audit trail in the CRM later without exposing it to clients.
CREATE POLICY "Admins can view BotConversa contract requests"
ON public.botconversa_contract_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
