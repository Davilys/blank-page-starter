CREATE OR REPLACE FUNCTION public.has_inpi_resources_access(_user_id uuid, _need_edit boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND (
      public.has_role(_user_id, 'admin')
      OR EXISTS (
        SELECT 1 FROM public.admin_permissions ap
        WHERE ap.user_id = _user_id
          AND ap.permission_key = 'inpi_resources'
          AND ap.can_view
          AND (NOT _need_edit OR ap.can_edit)
      )
    )
$$;

GRANT EXECUTE ON FUNCTION public.has_inpi_resources_access(uuid, boolean) TO authenticated, service_role;

-- Tabelas com acesso total (leitura + escrita) para quem pode editar,
-- leitura para quem só pode visualizar.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'inpi_resource_cases','inpi_case_documents','inpi_case_orientations',
    'inpi_draft_versions','inpi_draft_reviews','inpi_case_approvals',
    'inpi_export_packages','inpi_generation_jobs','inpi_resource_evidences'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Acesso liberado a Recursos INPI - leitura', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Acesso liberado a Recursos INPI - escrita', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Acesso liberado a Recursos INPI - alteracao', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Acesso liberado a Recursos INPI - exclusao', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_inpi_resources_access(auth.uid(), false))', 'Acesso liberado a Recursos INPI - leitura', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_inpi_resources_access(auth.uid(), true))', 'Acesso liberado a Recursos INPI - escrita', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.has_inpi_resources_access(auth.uid(), true)) WITH CHECK (public.has_inpi_resources_access(auth.uid(), true))', 'Acesso liberado a Recursos INPI - alteracao', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_inpi_resources_access(auth.uid(), true))', 'Acesso liberado a Recursos INPI - exclusao', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Acesso liberado a Recursos INPI - leitura" ON public.inpi_ai_call_logs;
CREATE POLICY "Acesso liberado a Recursos INPI - leitura" ON public.inpi_ai_call_logs
  FOR SELECT TO authenticated USING (public.has_inpi_resources_access(auth.uid(), false));

-- Arquivos anexados aos casos (bucket privado)
DROP POLICY IF EXISTS "Recursos INPI - ler documentos do caso" ON storage.objects;
DROP POLICY IF EXISTS "Recursos INPI - enviar documentos do caso" ON storage.objects;
DROP POLICY IF EXISTS "Recursos INPI - atualizar documentos do caso" ON storage.objects;
DROP POLICY IF EXISTS "Recursos INPI - remover documentos do caso" ON storage.objects;
CREATE POLICY "Recursos INPI - ler documentos do caso" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'inpi-recursos-docs' AND public.has_inpi_resources_access(auth.uid(), false));
CREATE POLICY "Recursos INPI - enviar documentos do caso" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'inpi-recursos-docs' AND public.has_inpi_resources_access(auth.uid(), true));
CREATE POLICY "Recursos INPI - atualizar documentos do caso" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'inpi-recursos-docs' AND public.has_inpi_resources_access(auth.uid(), true));
CREATE POLICY "Recursos INPI - remover documentos do caso" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'inpi-recursos-docs' AND public.has_inpi_resources_access(auth.uid(), true));