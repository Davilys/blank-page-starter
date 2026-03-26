-- Add storage policy for admins to upload client documents
CREATE POLICY "Admins can upload client documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' AND 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Add storage policy for admins to read client documents
CREATE POLICY "Admins can read client documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' AND 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Add storage policy for admins to delete client documents
CREATE POLICY "Admins can delete client documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' AND 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Add storage policy for users to read their own documents
CREATE POLICY "Users can read own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);