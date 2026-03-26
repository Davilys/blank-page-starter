-- Tornar o bucket documents público
UPDATE storage.buckets SET public = true WHERE id = 'documents';

-- Política para leitura pública de todos os arquivos do bucket documents
CREATE POLICY "Acesso publico para leitura documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents');

-- Política para upload por usuários autenticados
CREATE POLICY "Usuarios autenticados podem fazer upload documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- Política para update por usuários autenticados
CREATE POLICY "Usuarios autenticados podem atualizar documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- Política para admins deletarem documentos
CREATE POLICY "Admins podem deletar documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' 
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
  )
);