
-- Remove old duplicate policies that survived the partial first migration
DROP POLICY IF EXISTS "Service role can insert inpi knowledge" ON public.inpi_knowledge_base;
DROP POLICY IF EXISTS "Service role can update inpi knowledge" ON public.inpi_knowledge_base;
DROP POLICY IF EXISTS "Service role can manage sync logs" ON public.inpi_sync_logs;
DROP POLICY IF EXISTS "Service can insert ai_usage_logs" ON public.ai_usage_logs;

-- Also drop the contracts public verify policy (it was created in first partial migration)
DROP POLICY IF EXISTS "Public can verify contracts by hash" ON public.contracts;
