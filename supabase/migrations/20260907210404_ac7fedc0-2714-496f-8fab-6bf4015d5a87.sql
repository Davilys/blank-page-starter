ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date date;

COMMENT ON COLUMN public.profiles.birth_date IS 'Data de nascimento usada, mediante ação do administrador, na consulta cadastral oficial de CPF.';