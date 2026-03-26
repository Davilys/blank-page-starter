-- 1. Add DELETE policy for contracts table (admins only)
CREATE POLICY "Admins can delete contracts"
ON public.contracts
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Drop the existing foreign key constraint
ALTER TABLE public.contracts
DROP CONSTRAINT IF EXISTS contracts_lead_id_fkey;

-- 3. Re-add the foreign key with ON DELETE SET NULL
ALTER TABLE public.contracts
ADD CONSTRAINT contracts_lead_id_fkey
FOREIGN KEY (lead_id) REFERENCES public.leads(id)
ON DELETE SET NULL;