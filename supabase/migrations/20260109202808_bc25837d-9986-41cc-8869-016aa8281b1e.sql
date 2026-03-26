-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can update contract signatures" ON public.contracts;

-- Create a proper policy for users to update their own contracts (for signature)
CREATE POLICY "Users can update own contracts for signature" 
ON public.contracts 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create policy for admins to update any contract
CREATE POLICY "Admins can update all contracts" 
ON public.contracts 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));