
UPDATE contracts c
SET contract_type_id = t.contract_type_id
FROM contract_templates t
WHERE c.template_id = t.id
AND c.contract_type_id IS NULL
AND t.contract_type_id IS NOT NULL;
