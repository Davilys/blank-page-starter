ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS additional_phones text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS additional_emails text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS trade_name text,
  ADD COLUMN IF NOT EXISTS registration_status text,
  ADD COLUMN IF NOT EXISTS cnae text,
  ADD COLUMN IF NOT EXISTS opening_date date,
  ADD COLUMN IF NOT EXISTS share_capital numeric;