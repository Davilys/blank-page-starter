DELETE FROM publicacoes_marcas pm1
WHERE pm1.process_id IS NULL 
  AND pm1.client_id IS NULL
  AND pm1.process_number_rpi IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM publicacoes_marcas pm2
    WHERE pm2.process_number_rpi = pm1.process_number_rpi
      AND pm2.id != pm1.id
      AND pm2.process_id IS NOT NULL
  );