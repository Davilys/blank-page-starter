-- Remove Perfex CRM integration from database

-- Drop the perfex_customers table
DROP TABLE IF EXISTS public.perfex_customers CASCADE;

-- Remove perfex column from contracts table (foreign key already dropped by CASCADE)
ALTER TABLE public.contracts DROP COLUMN IF EXISTS perfex_contract_id;
ALTER TABLE public.contracts DROP COLUMN IF EXISTS perfex_customer_id;

-- Remove perfex_customer_id from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS perfex_customer_id;

-- Delete perfex settings from system_settings
DELETE FROM public.system_settings WHERE key = 'perfex';