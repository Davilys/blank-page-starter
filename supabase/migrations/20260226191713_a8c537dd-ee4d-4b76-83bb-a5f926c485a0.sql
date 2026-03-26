-- Add FK from lead_remarketing_queue.lead_id to leads.id
ALTER TABLE public.lead_remarketing_queue
  ADD CONSTRAINT lead_remarketing_queue_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

-- Add FK from client_remarketing_queue.client_id to profiles.id
ALTER TABLE public.client_remarketing_queue
  ADD CONSTRAINT client_remarketing_queue_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE CASCADE;