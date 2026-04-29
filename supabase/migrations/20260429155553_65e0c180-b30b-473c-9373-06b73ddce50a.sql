-- Backfill plan_type by template (most reliable)
UPDATE public.contracts SET plan_type = 'essencial'
WHERE plan_type IS NULL
  AND template_id IN (
    SELECT id FROM public.contract_templates
    WHERE LOWER(name) LIKE '%padrão%registro de marca%'
       OR LOWER(name) LIKE '%padrao%registro de marca%'
  );

UPDATE public.contracts SET plan_type = 'premium'
WHERE plan_type IS NULL
  AND template_id IN (
    SELECT id FROM public.contract_templates
    WHERE LOWER(name) LIKE '%premium%registro de marca%'
  );

UPDATE public.contracts SET plan_type = 'corporativo'
WHERE plan_type IS NULL
  AND template_id IN (
    SELECT id FROM public.contract_templates
    WHERE LOWER(name) LIKE '%corporativo%registro de marca%'
  );

-- Fallback by exact value for contracts without template_id
UPDATE public.contracts SET plan_type = 'essencial'
WHERE plan_type IS NULL AND template_id IS NULL AND contract_value IN (699, 698.97);

UPDATE public.contracts SET plan_type = 'premium'
WHERE plan_type IS NULL AND template_id IS NULL AND contract_value = 398;

UPDATE public.contracts SET plan_type = 'corporativo'
WHERE plan_type IS NULL AND template_id IS NULL AND contract_value = 1621;