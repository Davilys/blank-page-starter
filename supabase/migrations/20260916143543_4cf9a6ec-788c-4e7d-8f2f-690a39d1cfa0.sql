DROP POLICY IF EXISTS "Acesso liberado a Recursos INPI - leitura" ON public.inpi_resources;
DROP POLICY IF EXISTS "Acesso liberado a Recursos INPI - escrita" ON public.inpi_resources;
DROP POLICY IF EXISTS "Acesso liberado a Recursos INPI - alteracao" ON public.inpi_resources;
DROP POLICY IF EXISTS "Acesso liberado a Recursos INPI - exclusao" ON public.inpi_resources;

CREATE POLICY "Acesso liberado a Recursos INPI - leitura" ON public.inpi_resources
  FOR SELECT TO authenticated USING (public.has_inpi_resources_access(auth.uid(), false));
CREATE POLICY "Acesso liberado a Recursos INPI - escrita" ON public.inpi_resources
  FOR INSERT TO authenticated WITH CHECK (public.has_inpi_resources_access(auth.uid(), true));
CREATE POLICY "Acesso liberado a Recursos INPI - alteracao" ON public.inpi_resources
  FOR UPDATE TO authenticated USING (public.has_inpi_resources_access(auth.uid(), true))
  WITH CHECK (public.has_inpi_resources_access(auth.uid(), true));
CREATE POLICY "Acesso liberado a Recursos INPI - exclusao" ON public.inpi_resources
  FOR DELETE TO authenticated USING (public.has_inpi_resources_access(auth.uid(), true));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inpi_resources TO authenticated;
GRANT ALL ON public.inpi_resources TO service_role;