DROP POLICY IF EXISTS "Admins full access documents bucket" ON storage.objects;

CREATE POLICY "Admins full access documents bucket"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);