ALTER TABLE public.brand_processes DROP CONSTRAINT brand_processes_status_check;

ALTER TABLE public.brand_processes ADD CONSTRAINT brand_processes_status_check CHECK (
  pipeline_stage IS NULL OR pipeline_stage = ANY (ARRAY[
    'protocolado', '003', 'oposicao', 'exigencia_merito', 'exigencia_de_mrito',
    'indeferimento', 'indeferido', 'notificacao', 'deferimento', 'deferido',
    'certificados', 'certificado', 'renovacao', 'distrato', 'assinou_contrato',
    'pagamento_ok', 'pagou_taxa', 'taxa_inpi_paga', 'em_andamento', 'depositada',
    'arquivado', 'arquivados', 'publicado_rpi', 'em_exame', 'concedido', 'registrada'
  ])
);