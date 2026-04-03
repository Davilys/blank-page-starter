
-- Fix client_remarketing_queue: drop both old policies, recreate correctly
DROP POLICY IF EXISTS "Service can manage client remarketing queue" ON public.client_remarketing_queue;
DROP POLICY IF EXISTS "Admins can manage client remarketing queue" ON public.client_remarketing_queue;
CREATE POLICY "Admins can manage client remarketing queue"
  ON public.client_remarketing_queue FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix lead_remarketing_queue
DROP POLICY IF EXISTS "Service can manage remarketing queue" ON public.lead_remarketing_queue;
DROP POLICY IF EXISTS "Admins can manage remarketing queue" ON public.lead_remarketing_queue;
DROP POLICY IF EXISTS "Admins can manage lead remarketing queue" ON public.lead_remarketing_queue;
CREATE POLICY "Admins can manage lead remarketing queue"
  ON public.lead_remarketing_queue FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix upsell_engine_weights
DROP POLICY IF EXISTS "Service can manage engine weights" ON public.upsell_engine_weights;
DROP POLICY IF EXISTS "Admins can manage engine weights" ON public.upsell_engine_weights;
CREATE POLICY "Admins can manage engine weights"
  ON public.upsell_engine_weights FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
