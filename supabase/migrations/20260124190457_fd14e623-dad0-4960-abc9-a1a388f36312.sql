-- Add payment_method column to contracts table for post-signature payment processing
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT NULL;

-- Add comment explaining the column purpose
COMMENT ON COLUMN public.contracts.payment_method IS 'Payment method selected: avista, cartao6x, boleto3x';