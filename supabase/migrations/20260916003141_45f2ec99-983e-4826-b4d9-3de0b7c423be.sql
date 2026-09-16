CREATE OR REPLACE FUNCTION public.is_master_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid() AND u.email = 'davillys@gmail.com'
  )
$$;

DROP POLICY IF EXISTS "Master can upload perfex-import" ON storage.objects;
DROP POLICY IF EXISTS "Master can read perfex-import" ON storage.objects;
DROP POLICY IF EXISTS "Master can update perfex-import" ON storage.objects;
DROP POLICY IF EXISTS "Master can delete perfex-import" ON storage.objects;

CREATE POLICY "Master can upload perfex-import" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'perfex-import' AND public.is_master_user());

CREATE POLICY "Master can read perfex-import" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'perfex-import' AND public.is_master_user());

CREATE POLICY "Master can update perfex-import" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'perfex-import' AND public.is_master_user())
  WITH CHECK (bucket_id = 'perfex-import' AND public.is_master_user());

CREATE POLICY "Master can delete perfex-import" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'perfex-import' AND public.is_master_user());