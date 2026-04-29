WITH signed_contracts AS (
  SELECT c.id AS contract_id, c.user_id, c.process_id, c.document_type, c.subject
  FROM public.contracts c
  WHERE c.signature_status = 'signed'
),
missing AS (
  SELECT sc.*
  FROM signed_contracts sc
  LEFT JOIN public.documents d
    ON d.contract_id = sc.contract_id
   AND d.document_type IN ('contrato','distrato','distrato_multa','distrato_sem_multa','procuracao','contract')
  WHERE d.id IS NULL
),
latest_pdf AS (
  SELECT m.contract_id, m.user_id, m.process_id, m.document_type, m.subject,
         o.name AS storage_name,
         (o.metadata->>'size')::bigint AS storage_size
  FROM missing m
  JOIN LATERAL (
    SELECT name, metadata, created_at
    FROM storage.objects
    WHERE bucket_id = 'documents'
      AND name LIKE ('signed-contracts/' || m.contract_id || '/%')
    ORDER BY created_at DESC
    LIMIT 1
  ) o ON true
)
INSERT INTO public.documents (
  name, document_type, file_url, file_size, mime_type,
  user_id, process_id, contract_id, uploaded_by
)
SELECT
  COALESCE(lp.subject, 'Documento Assinado'),
  CASE
    WHEN lower(COALESCE(lp.document_type,'')) = 'contract' THEN 'contrato'
    WHEN lower(COALESCE(lp.document_type,'')) IN ('contrato','procuracao','distrato','distrato_multa','distrato_sem_multa')
      THEN lower(lp.document_type)
    ELSE 'contrato'
  END,
  'https://scpbqsvwojhbxihyqbdz.supabase.co/storage/v1/object/public/documents/' || lp.storage_name,
  lp.storage_size,
  'application/pdf',
  lp.user_id,
  lp.process_id,
  lp.contract_id,
  'system-backfill'
FROM latest_pdf lp;