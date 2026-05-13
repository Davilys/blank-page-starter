
WITH ranked AS (
  SELECT id, rpi_number,
    ROW_NUMBER() OVER (
      PARTITION BY rpi_number
      ORDER BY (CASE WHEN status = 'completed' THEN 0 ELSE 1 END), created_at DESC
    ) AS rn
  FROM public.rpi_uploads
  WHERE rpi_number IS NOT NULL
),
dups AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM public.rpi_entries WHERE rpi_upload_id IN (SELECT id FROM dups);

WITH ranked AS (
  SELECT id, rpi_number,
    ROW_NUMBER() OVER (
      PARTITION BY rpi_number
      ORDER BY (CASE WHEN status = 'completed' THEN 0 ELSE 1 END), created_at DESC
    ) AS rn
  FROM public.rpi_uploads
  WHERE rpi_number IS NOT NULL
)
DELETE FROM public.rpi_uploads WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
