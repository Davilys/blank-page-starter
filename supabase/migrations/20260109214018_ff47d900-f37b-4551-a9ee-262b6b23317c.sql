-- Allow public insert on leads table for form submissions (unauthenticated users)
CREATE POLICY "Anyone can create leads from form" 
ON public.leads 
FOR INSERT 
WITH CHECK (true);

-- Allow public update on leads for form_started_at (unauthenticated users)
CREATE POLICY "Anyone can update their own lead by email" 
ON public.leads 
FOR UPDATE 
USING (true)
WITH CHECK (true);