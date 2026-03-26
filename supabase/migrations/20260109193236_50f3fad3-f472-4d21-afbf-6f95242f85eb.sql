-- Create table for Perfex customers (external customers not yet in auth system)
CREATE TABLE public.perfex_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfex_id TEXT UNIQUE NOT NULL,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  company_name TEXT,
  cpf_cnpj TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  active BOOLEAN DEFAULT true,
  synced_profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add perfex_customer_id to contracts table for linking to external customers
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS perfex_customer_id UUID REFERENCES public.perfex_customers(id);

-- Enable RLS on perfex_customers
ALTER TABLE public.perfex_customers ENABLE ROW LEVEL SECURITY;

-- RLS policies for perfex_customers (admin only)
CREATE POLICY "Admins can manage perfex customers"
ON public.perfex_customers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_perfex_customers_perfex_id ON public.perfex_customers(perfex_id);
CREATE INDEX idx_perfex_customers_email ON public.perfex_customers(email);
CREATE INDEX idx_contracts_perfex_customer_id ON public.contracts(perfex_customer_id);

-- Trigger to update updated_at
CREATE TRIGGER update_perfex_customers_updated_at
BEFORE UPDATE ON public.perfex_customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();