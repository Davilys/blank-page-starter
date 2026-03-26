-- Add client_funnel_type column to profiles table
-- Default 'juridico' to preserve all existing clients in the legal funnel
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS client_funnel_type text DEFAULT 'juridico';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.client_funnel_type IS 'Type of funnel: comercial (sales) or juridico (legal/INPI processes)';