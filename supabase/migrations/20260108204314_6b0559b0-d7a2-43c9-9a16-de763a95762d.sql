-- Políticas de storage para permitir admins fazerem upload de PDFs da RPI
CREATE POLICY "Admins can upload RPI PDFs"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = 'rpi'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can read RPI files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = 'rpi'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete RPI files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = 'rpi'
  AND public.has_role(auth.uid(), 'admin')
);