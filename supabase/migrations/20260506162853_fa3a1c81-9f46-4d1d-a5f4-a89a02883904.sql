-- 1) Marca como 'renegociada' tudo que já foi para renegociacoes (5x) ou negociacoes_devedor tipo 'negociar'
UPDATE public.cobrancas_vencidas cv
SET status = 'renegociada', updated_at = now()
WHERE cv.status = 'pendente_renegociacao'
  AND cv.asaas_payment_id IN (
    SELECT unnest(parcelas_originais_ids) FROM public.renegociacoes
    UNION
    SELECT unnest(parcelas_originais_ids) FROM public.negociacoes_devedor WHERE tipo = 'negociar'
  );

-- 2) Marca como 'cobrada' tudo que entrou em cobrança única
UPDATE public.cobrancas_vencidas cv
SET status = 'cobrada', updated_at = now()
WHERE cv.status = 'pendente_renegociacao'
  AND cv.asaas_payment_id IN (
    SELECT unnest(parcelas_originais_ids) FROM public.negociacoes_devedor WHERE tipo = 'cobrar'
  );