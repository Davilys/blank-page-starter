UPDATE public.system_settings
SET value = jsonb_set(
  jsonb_set(
    value::jsonb,
    '{publicacao,milestone_enabled}',
    'false'::jsonb,
    true
  ),
  '{cobranca,milestone_enabled}',
  'false'::jsonb,
  true
)
WHERE key = 'award_config'
  AND (
    NOT (value::jsonb -> 'publicacao' ? 'milestone_enabled')
    OR NOT (value::jsonb -> 'cobranca' ? 'milestone_enabled')
  );