-- Add unique index on cpf_cnpj (only for non-null values)
-- This prevents duplicate clients with same CPF/CNPJ
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_cpf_cnpj_unique 
ON public.profiles (cpf_cnpj) 
WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj != '';

-- Create a function to merge duplicate clients (for future use if needed)
CREATE OR REPLACE FUNCTION public.merge_duplicate_clients(keep_id uuid, merge_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Move all brand_processes to the kept client
  UPDATE public.brand_processes 
  SET user_id = keep_id 
  WHERE user_id = merge_id;
  
  -- Move all contracts to the kept client
  UPDATE public.contracts 
  SET user_id = keep_id 
  WHERE user_id = merge_id;
  
  -- Move all invoices to the kept client
  UPDATE public.invoices 
  SET user_id = keep_id 
  WHERE user_id = merge_id;
  
  -- Move all documents to the kept client
  UPDATE public.documents 
  SET user_id = keep_id 
  WHERE user_id = merge_id;
  
  -- Move all notifications to the kept client
  UPDATE public.notifications 
  SET user_id = keep_id 
  WHERE user_id = merge_id;
  
  -- Move all chat messages to the kept client
  UPDATE public.chat_messages 
  SET user_id = keep_id 
  WHERE user_id = merge_id;
  
  -- Move client activities
  UPDATE public.client_activities 
  SET user_id = keep_id 
  WHERE user_id = merge_id;
  
  -- Move client notes
  UPDATE public.client_notes 
  SET user_id = keep_id 
  WHERE user_id = merge_id;
  
  -- Move client appointments
  UPDATE public.client_appointments 
  SET user_id = keep_id 
  WHERE user_id = merge_id;
  
  -- Delete the merged profile (cascade will handle user_roles if FK exists)
  DELETE FROM public.profiles WHERE id = merge_id;
END;
$$;

COMMENT ON FUNCTION public.merge_duplicate_clients IS 'Merges all data from merge_id client into keep_id client and deletes the duplicate';