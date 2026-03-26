-- Drop the overly permissive update policy
DROP POLICY IF EXISTS "Anyone can update their own lead by email" ON public.leads;

-- Create a more restrictive policy that only allows updating form_started_at and last_reminder_sent_at
-- Note: The Edge Functions use service role key which bypasses RLS, so this mainly protects from client-side abuse