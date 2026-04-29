ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_document_type_check;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_document_type_check
  CHECK (document_type = ANY (ARRAY[
    'contract'::text,
    'signed_contract'::text,
    'contrato'::text,
    'anexo'::text,
    'outro'::text,
    'procuracao'::text,
    'invoice'::text,
    'receipt'::text,
    'identity'::text,
    'power_of_attorney'::text,
    'other'::text,
    'distrato'::text,
    'distrato_multa'::text,
    'distrato_sem_multa'::text
  ]));