-- Add separate cpf and cnpj columns to profiles table
-- This allows storing CPF (personal) and CNPJ (company) separately

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cpf text,
ADD COLUMN IF NOT EXISTS cnpj text;

-- Migrate existing data from cpf_cnpj to the appropriate new column
-- If length is 11 digits (CPF), put in cpf column
-- If length is 14 digits (CNPJ), put in cnpj column
UPDATE public.profiles 
SET cpf = cpf_cnpj 
WHERE cpf_cnpj IS NOT NULL 
AND LENGTH(REGEXP_REPLACE(cpf_cnpj, '\D', '', 'g')) = 11;

UPDATE public.profiles 
SET cnpj = cpf_cnpj 
WHERE cpf_cnpj IS NOT NULL 
AND LENGTH(REGEXP_REPLACE(cpf_cnpj, '\D', '', 'g')) = 14;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.cpf IS 'CPF do representante legal (pessoa física)';
COMMENT ON COLUMN public.profiles.cnpj IS 'CNPJ da empresa (pessoa jurídica)';