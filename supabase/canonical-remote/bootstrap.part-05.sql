os, sem prejuízo das demais medidas legais cabíveis.\n\nCLÁUSULA QUARTA – DA CONFIDENCIALIDADE\n\n4.1. As partes comprometem-se a manter sigilo e confidencialidade sobre todas as informações e termos do presente distrato, bem como sobre quaisquer informações comerciais, técnicas ou estratégicas da outra parte, que tenham tido acesso em razão do Contrato Original e deste distrato, sob pena de responderem por perdas e danos.\n\nCLÁUSULA QUINTA – DA INDEPENDÊNCIA DAS CLÁUSULAS\n\n5.1. Caso qualquer disposição deste distrato seja considerada inválida, ilegal ou inexequível em qualquer jurisdição, tal invalidade, ilegalidade ou inexequibilidade não afetará a validade, legalidade ou exequibilidade das demais disposições deste distrato, nem a validade, legalidade ou exequibilidade de tal disposição em qualquer outra jurisdição.\n\nCLÁUSULA SEXTA – DA LEGISLAÇÃO APLICÁVEL E ELEIÇÃO DE FORO\n\n6.1. O presente distrato será regido e interpretado de acordo com as leis da República Federativa do Brasil.\n\n6.2. Fica eleito o Foro da Comarca de São Paulo, Estado de São Paulo, para dirimir quaisquer dúvidas ou litígios oriundos do presente distrato, com expressa renúncia a qualquer outro, por mais privilegiado que seja.\n\nPor estarem justas e contratadas, as partes assinam o presente de igual teor e forma, de forma digital válida juridicamente.\n\nSão Paulo, {{data_distrato}}.\n\n{contract_signature}',
    variables = '["{{nome_empresa}}", "{{endereco_empresa}}", "{{cidade}}", "{{estado}}", "{{cep}}", "{{cnpj}}", "{{nome_representante}}", "{{cpf_representante}}", "{{email}}", "{{telefone}}", "{{marca}}", "{{data_distrato}}"]'::jsonb,
    updated_at = now()
WHERE name = 'Distrato sem Multa - Padrão';
-- END LOCAL BOOTSTRAP 20260321213216_395c85e5-fa67-407a-af7f-f6ccb7b8e104.sql

-- BEGIN LOCAL BOOTSTRAP 20260324173434_4d20bcc3-efe3-4315-b6a7-9ca48723d7a7.sql
ALTER TABLE public.inpi_resources DROP CONSTRAINT IF EXISTS inpi_resources_resource_type_check;

ALTER TABLE public.inpi_resources
ADD CONSTRAINT inpi_resources_resource_type_check
CHECK (
  resource_type = ANY (
    ARRAY[
      'indeferimento'::text,
      'exigencia_merito'::text,
      'oposicao'::text,
      'notificacao_extrajudicial'::text,
      'resposta_notificacao_extrajudicial'::text,
      'troca_procurador'::text,
      'nomeacao_procurador'::text
    ]
  )
);
-- END LOCAL BOOTSTRAP 20260324173434_4d20bcc3-efe3-4315-b6a7-9ca48723d7a7.sql

-- BEGIN LOCAL BOOTSTRAP 20260326020025_2ed111c5-2cba-4113-af59-a6275bc2aace.sql
ALTER TABLE public.brand_processes DROP CONSTRAINT brand_processes_status_check;

ALTER TABLE public.brand_processes ADD CONSTRAINT brand_processes_status_check CHECK (
  pipeline_stage IS NULL OR pipeline_stage = ANY (ARRAY[
    'protocolado', '003', 'oposicao', 'exigencia_merito', 'exigencia_de_mrito',
    'indeferimento', 'notificacao', 'deferimento', 'certificados', 'certificado',
    'renovacao', 'distrato', 'assinou_contrato', 'pagamento_ok', 'pagou_taxa',
    'taxa_inpi_paga', 'em_andamento', 'depositada', 'arquivado',
    'publicado_rpi', 'em_exame', 'deferido', 'concedido', 'registrada'
  ])
);
-- END LOCAL BOOTSTRAP 20260326020025_2ed111c5-2cba-4113-af59-a6275bc2aace.sql

-- BEGIN LOCAL BOOTSTRAP 20260326020558_4ec1aaf9-2e29-41c3-8930-b0d05d63ca05.sql
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
-- END LOCAL BOOTSTRAP 20260326020558_4ec1aaf9-2e29-41c3-8930-b0d05d63ca05.sql
