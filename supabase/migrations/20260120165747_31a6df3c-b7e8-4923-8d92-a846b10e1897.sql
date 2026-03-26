-- Remove public read policy from documents bucket
DROP POLICY IF EXISTS "Acesso publico para leitura documents" ON storage.objects;
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view documents" ON storage.objects;

-- Create secure policy: only authenticated users (owners or admins) can read
CREATE POLICY "Authenticated users can read own documents" ON storage.objects
FOR SELECT USING (
  bucket_id = 'documents' AND (
    auth.uid() IS NOT NULL AND (
      (auth.uid())::text = (storage.foldername(name))[1] OR
      public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  )
);

-- Restrict viability_searches to authenticated users only
DROP POLICY IF EXISTS "Anyone can read recent searches" ON public.viability_searches;

CREATE POLICY "Authenticated can read recent searches" ON public.viability_searches
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  created_at > now() - interval '24 hours'
);