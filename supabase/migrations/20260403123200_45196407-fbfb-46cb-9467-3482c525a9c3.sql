
-- ai_usage_logs
DROP POLICY IF EXISTS "Service can insert ai_usage_logs" ON public.ai_usage_logs;
CREATE POLICY "Authenticated can insert ai_usage_logs"
  ON public.ai_usage_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- inpi_knowledge_base
DROP POLICY IF EXISTS "Service role can insert inpi knowledge" ON public.inpi_knowledge_base;
CREATE POLICY "Admins can insert inpi knowledge"
  ON public.inpi_knowledge_base FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Service role can update inpi knowledge" ON public.inpi_knowledge_base;
CREATE POLICY "Admins can update inpi knowledge"
  ON public.inpi_knowledge_base FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- inpi_sync_logs
DROP POLICY IF EXISTS "Service role can manage sync logs" ON public.inpi_sync_logs;
CREATE POLICY "Admins can manage sync logs"
  ON public.inpi_sync_logs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- intelligence_process_history
DROP POLICY IF EXISTS "Service can insert intelligence history" ON public.intelligence_process_history;
CREATE POLICY "Admins can insert intelligence history"
  ON public.intelligence_process_history FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Service can update intelligence history" ON public.intelligence_process_history;
CREATE POLICY "Admins can update intelligence history"
  ON public.intelligence_process_history FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- notification_dispatch_logs
DROP POLICY IF EXISTS "Service can insert dispatch logs" ON public.notification_dispatch_logs;
CREATE POLICY "Admins can insert dispatch logs"
  ON public.notification_dispatch_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- promotion_expiration_logs
DROP POLICY IF EXISTS "Service can insert promotion logs" ON public.promotion_expiration_logs;
CREATE POLICY "Admins can insert promotion logs"
  ON public.promotion_expiration_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- upsell_monetization_logs
DROP POLICY IF EXISTS "Service can insert upsell logs" ON public.upsell_monetization_logs;
CREATE POLICY "Admins can insert upsell logs"
  ON public.upsell_monetization_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- marketing_attribution: keep for authenticated users (tracking)
DROP POLICY IF EXISTS "Public can insert marketing_attribution" ON public.marketing_attribution;
CREATE POLICY "Authenticated can insert marketing_attribution"
  ON public.marketing_attribution FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- viability_searches: remove duplicate public policy
DROP POLICY IF EXISTS "Anyone can insert viability search" ON public.viability_searches;
