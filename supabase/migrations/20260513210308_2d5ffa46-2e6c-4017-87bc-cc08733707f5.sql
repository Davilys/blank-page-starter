CREATE POLICY "Public can read active contract templates"
ON public.contract_templates
FOR SELECT
TO anon, authenticated
USING (is_active = true);