ALTER TABLE public.publicacoes_marcas
  DROP CONSTRAINT IF EXISTS publicacoes_marcas_cumprimento_status_check;
ALTER TABLE public.publicacoes_marcas
  ADD CONSTRAINT publicacoes_marcas_cumprimento_status_check
  CHECK (cumprimento_status IS NULL OR cumprimento_status IN ('cumprido','contato_agendado','aguardando_pagamento','desistiu'));