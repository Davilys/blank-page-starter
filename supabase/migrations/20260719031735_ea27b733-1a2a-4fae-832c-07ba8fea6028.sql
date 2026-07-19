UPDATE public.inpi_resource_evidences
SET placement = 'inline', updated_at = now()
WHERE included = true AND placement <> 'inline';