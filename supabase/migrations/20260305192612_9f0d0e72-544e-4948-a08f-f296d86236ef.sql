ALTER TABLE public.brand_processes DROP CONSTRAINT IF EXISTS brand_processes_status_check;

ALTER TABLE public.brand_processes ADD CONSTRAINT brand_processes_status_check CHECK (status IN (
  'em_andamento',
  '003',
  'oposicao',
  'exigencia_merito',
  'deferido',
  'deferimento',
  'indeferido',
  'indeferimento',
  'certificado',
  'renovacao',
  'arquivado',
  'publicado_rpi',
  'em_exame',
  'concedido'
));