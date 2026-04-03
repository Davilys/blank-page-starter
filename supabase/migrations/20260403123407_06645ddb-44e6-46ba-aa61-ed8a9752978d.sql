
-- Enable RLS on inpiknowledgebase (failed in partial first migration)
ALTER TABLE public.inpiknowledgebase ENABLE ROW LEVEL SECURITY;

-- Add policies for inpiknowledgebase
CREATE POLICY "Authenticated can read inpiknowledgebase"
  ON public.inpiknowledgebase FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage inpiknowledgebase"
  ON public.inpiknowledgebase FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix viability_searches: restrict to authenticated only (not anon)
DROP POLICY IF EXISTS "Anyone can insert viability searches" ON public.viability_searches;
CREATE POLICY "Authenticated can insert viability searches"
  ON public.viability_searches FOR INSERT
  TO authenticated
  WITH CHECK (true);
