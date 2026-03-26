-- Remover constraint antiga
ALTER TABLE documents 
DROP CONSTRAINT IF EXISTS documents_document_type_check;

-- Adicionar nova constraint com todos os tipos necessários
ALTER TABLE documents 
ADD CONSTRAINT documents_document_type_check 
CHECK (document_type = ANY (ARRAY[
  'contrato',
  'procuracao', 
  'certificado',
  'comprovante',
  'parecer',
  'rpi',
  'laudo',
  'notificacao',
  'anexo',
  'outro'
]::text[]));