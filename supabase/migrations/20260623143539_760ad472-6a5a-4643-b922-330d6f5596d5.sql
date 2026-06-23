
-- 1) Consolida status "certificados" (plural) em "certificado"
UPDATE public.publicacoes_marcas
SET status = 'certificado', updated_at = now()
WHERE status = 'certificados';

-- 2) Recalcula prazo baseado no status para linhas com prazo padrão antigo (30 dias) ou sem prazo
-- Não toca em linhas com descricao_prazo específica (já editada manualmente)
WITH rules AS (
  SELECT * FROM (VALUES
    ('003',              60, 'Prazo para oposição'),
    ('oposicao',         60, 'Prazo para oposição'),
    ('exigencia_merito', 60, 'Cumprimento de exigência de mérito'),
    ('indeferimento',    60, 'Prazo para recurso (indeferimento)'),
    ('deferimento',      60, 'Pagamento de taxas (deferimento)'),
    ('renovacao',        60, 'Prazo para protocolar renovação')
  ) AS r(status, dias, descricao)
)
UPDATE public.publicacoes_marcas pm
SET 
  proximo_prazo_critico = (pm.data_publicacao_rpi + (r.dias || ' days')::interval)::date,
  descricao_prazo = r.descricao,
  updated_at = now()
FROM rules r
WHERE pm.status = r.status
  AND pm.data_publicacao_rpi IS NOT NULL
  AND (pm.descricao_prazo IS NULL OR pm.descricao_prazo = 'Prazo padrão - 30 dias');

-- 3) Certificado: prazo de renovação = 9 anos a partir da data do certificado ou da publicação
UPDATE public.publicacoes_marcas
SET 
  proximo_prazo_critico = (COALESCE(data_certificado, data_publicacao_rpi) + interval '9 years')::date,
  descricao_prazo = 'Renovação ordinária - 9 anos',
  updated_at = now()
WHERE status = 'certificado'
  AND COALESCE(data_certificado, data_publicacao_rpi) IS NOT NULL
  AND (descricao_prazo IS NULL OR descricao_prazo = 'Prazo padrão - 30 dias');
