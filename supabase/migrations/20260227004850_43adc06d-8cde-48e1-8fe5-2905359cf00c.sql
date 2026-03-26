ALTER TABLE public.inpi_resources DROP CONSTRAINT inpi_resources_resource_type_check;

ALTER TABLE public.inpi_resources ADD CONSTRAINT inpi_resources_resource_type_check CHECK (resource_type = ANY (ARRAY['indeferimento'::text, 'exigencia_merito'::text, 'oposicao'::text, 'notificacao_extrajudicial'::text]));