
-- Bucket privado para upload do dump Perfex (ZIP/SQL) + NDJSON gerados
INSERT INTO storage.buckets (id, name, public)
VALUES ('perfex-import', 'perfex-import', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Master can read perfex-import" ON storage.objects;
CREATE POLICY "Master can read perfex-import"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'perfex-import' AND EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'davillys@gmail.com'));

DROP POLICY IF EXISTS "Master can upload perfex-import" ON storage.objects;
CREATE POLICY "Master can upload perfex-import"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'perfex-import' AND EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'davillys@gmail.com'));

DROP POLICY IF EXISTS "Master can update perfex-import" ON storage.objects;
CREATE POLICY "Master can update perfex-import"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'perfex-import' AND EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'davillys@gmail.com'));

DROP POLICY IF EXISTS "Master can delete perfex-import" ON storage.objects;
CREATE POLICY "Master can delete perfex-import"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'perfex-import' AND EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'davillys@gmail.com'));

-- Garantir RPC auxiliar (idempotente)
CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(lookup_email text)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM auth.users WHERE email = lower(trim(lookup_email)) LIMIT 1;
$$;
