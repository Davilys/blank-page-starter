-- Entrada de /consultar (pedido do titular, 31/10/2026): estágio atual da marca
-- (primeira tela) e contato (segunda tela: nome, WhatsApp, e-mail) ficam gravados
-- junto da consulta. Escrita via service role (edge webmarcas-inpi-search);
-- políticas RLS existentes preservadas; nenhuma automação é disparada aqui.
ALTER TABLE public.viability_searches
  ADD COLUMN IF NOT EXISTS brand_stage TEXT,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT;
