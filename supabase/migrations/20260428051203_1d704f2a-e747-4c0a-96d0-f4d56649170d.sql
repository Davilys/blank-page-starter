-- 1. Coluna plan_type
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS plan_type TEXT
  CHECK (plan_type IN ('essencial','premium','corporativo'));

-- 2. Backfill heurístico
UPDATE public.contracts
SET plan_type = CASE
  WHEN payment_method ILIKE '%avista%' OR payment_method ILIKE '%pix%' THEN 'essencial'
  WHEN contract_value IS NOT NULL AND contract_value BETWEEN 600 AND 800 THEN 'essencial'
  WHEN contract_value IS NOT NULL AND contract_value BETWEEN 350 AND 450 THEN 'premium'
  WHEN contract_value IS NOT NULL AND contract_value BETWEEN 1500 AND 1800 THEN 'corporativo'
  WHEN contract_value IS NOT NULL AND contract_value BETWEEN 1100 AND 1300 THEN 'essencial' -- cartão 6x ~1194
  ELSE NULL
END
WHERE plan_type IS NULL;

-- 3. Índice
CREATE INDEX IF NOT EXISTS idx_contracts_plan_type ON public.contracts(plan_type);
CREATE INDEX IF NOT EXISTS idx_contracts_user_plan ON public.contracts(user_id, plan_type);