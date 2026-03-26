-- Add custom_due_date column to contracts table for admin-specified payment dates
-- This column stores the custom due date for PIX/Boleto payments when admin selects a specific date
-- If null, the system uses the default automatic date calculation

ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS custom_due_date DATE NULL;

COMMENT ON COLUMN public.contracts.custom_due_date IS 'Admin-specified custom due date for PIX/Boleto payments. If null, uses automatic date calculation.';