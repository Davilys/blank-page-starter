
-- Step 4 fixed: For orphan cards, only enrich brand_name/ncl_class without setting process_id to avoid unique constraint
UPDATE publicacoes_marcas pm
SET brand_name_rpi = COALESCE(NULLIF(pm.brand_name_rpi, ''), bp.brand_name),
    ncl_class = COALESCE(pm.ncl_class, array_to_string(bp.ncl_classes, ', '))
FROM brand_processes bp
WHERE pm.process_id IS NULL
  AND pm.process_number_rpi IS NOT NULL
  AND pm.process_number_rpi != ''
  AND (pm.brand_name_rpi IS NULL OR pm.brand_name_rpi = '' OR pm.ncl_class IS NULL)
  AND REGEXP_REPLACE(bp.process_number, '[^0-9]', '', 'g') = REGEXP_REPLACE(pm.process_number_rpi, '[^0-9]', '', 'g')
  AND REGEXP_REPLACE(bp.process_number, '[^0-9]', '', 'g') != '';
