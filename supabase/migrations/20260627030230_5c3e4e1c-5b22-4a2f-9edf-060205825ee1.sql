ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS manually_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manually_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS manually_paid_by uuid;