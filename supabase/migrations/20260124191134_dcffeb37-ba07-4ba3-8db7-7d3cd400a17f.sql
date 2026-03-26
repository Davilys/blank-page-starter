-- Add contract_id column to invoices table for linking payments to contracts
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.contracts(id);

-- Add pix_qr_code column for storing the base64 QR code image
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS pix_qr_code TEXT;

-- Add pix_payload column for storing the copy-paste code
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS pix_payload TEXT;

-- Add payment_link column for storing the invoice URL
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS payment_link TEXT;