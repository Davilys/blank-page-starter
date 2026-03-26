UPDATE system_settings 
SET value = jsonb_set(
  value,
  '{stages}',
  (
    SELECT jsonb_agg(
      CASE 
        WHEN elem->>'id' = 'exigencia_de_mrito' 
        THEN jsonb_set(elem, '{id}', '"exigencia_merito"')
        ELSE elem
      END
    )
    FROM jsonb_array_elements(value->'stages') elem
  )
)
WHERE key = 'admin_kanban_juridico_stages';