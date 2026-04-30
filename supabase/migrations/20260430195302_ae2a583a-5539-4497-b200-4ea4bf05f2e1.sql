ALTER TABLE public.award_entries
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'essencial'
  CHECK (plan IN ('essencial','premium','corporativo'));