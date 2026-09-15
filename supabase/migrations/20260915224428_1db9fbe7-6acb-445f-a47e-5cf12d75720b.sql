-- Acesso privado ao bucket de documentos dos casos de Recursos INPI (somente administradores).
CREATE POLICY "Admins read inpi recursos docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'inpi-recursos-docs' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins upload inpi recursos docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'inpi-recursos-docs' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins update inpi recursos docs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'inpi-recursos-docs' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'inpi-recursos-docs' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins delete inpi recursos docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'inpi-recursos-docs' AND public.has_role(auth.uid(),'admin'));