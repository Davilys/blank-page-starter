
-- =====================================================
-- MOTOR PREDITIVO - FASE 1 (100% ADITIVO)
-- Nenhuma tabela existente é alterada
-- =====================================================

-- 1. Tabela analítica de histórico de processos
CREATE TABLE public.intelligence_process_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id UUID REFERENCES public.brand_processes(id) ON DELETE CASCADE,
  classe TEXT,
  tipo_marca TEXT DEFAULT 'nominativa',
  teve_oposicao BOOLEAN DEFAULT false,
  teve_exigencia BOOLEAN DEFAULT false,
  teve_recurso BOOLEAN DEFAULT false,
  resultado_final TEXT, -- deferido, indeferido, arquivado
  tempo_total_dias INTEGER,
  ano_finalizacao INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(process_id)
);

-- RLS: apenas admins
ALTER TABLE public.intelligence_process_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage intelligence history"
  ON public.intelligence_process_history
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert intelligence history"
  ON public.intelligence_process_history
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can update intelligence history"
  ON public.intelligence_process_history
  FOR UPDATE
  USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_intelligence_history_updated_at
  BEFORE UPDATE ON public.intelligence_process_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Função para calcular score preditivo
CREATE OR REPLACE FUNCTION public.calculate_predictive_score(p_classe TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  taxa_deferimento NUMERIC := 0;
  taxa_recurso NUMERIC := 0;
  impacto_oposicao NUMERIC := 0;
  impacto_exigencia NUMERIC := 0;
  fator_tempo NUMERIC := 0;
  score NUMERIC := 0;
  total_julgados INTEGER := 0;
  total_deferidos INTEGER := 0;
  total_com_recurso INTEGER := 0;
  recursos_deferidos INTEGER := 0;
  total_com_oposicao INTEGER := 0;
  deferidos_com_oposicao INTEGER := 0;
  total_com_exigencia INTEGER := 0;
  deferidos_com_exigencia INTEGER := 0;
  tempo_medio NUMERIC := 0;
  tempo_ref NUMERIC := 365; -- referência: 1 ano
BEGIN
  -- Taxa de deferimento por classe
  SELECT 
    COUNT(*) FILTER (WHERE resultado_final IN ('deferido', 'indeferido', 'arquivado')),
    COUNT(*) FILTER (WHERE resultado_final = 'deferido')
  INTO total_julgados, total_deferidos
  FROM intelligence_process_history
  WHERE (p_classe IS NULL OR classe = p_classe);

  IF total_julgados > 0 THEN
    taxa_deferimento := (total_deferidos::NUMERIC / total_julgados) * 100;
  END IF;

  -- Taxa de sucesso em recurso
  SELECT
    COUNT(*) FILTER (WHERE teve_recurso = true),
    COUNT(*) FILTER (WHERE teve_recurso = true AND resultado_final = 'deferido')
  INTO total_com_recurso, recursos_deferidos
  FROM intelligence_process_history
  WHERE (p_classe IS NULL OR classe = p_classe);

  IF total_com_recurso > 0 THEN
    taxa_recurso := (recursos_deferidos::NUMERIC / total_com_recurso) * 100;
  END IF;

  -- Impacto da oposição
  SELECT
    COUNT(*) FILTER (WHERE teve_oposicao = true),
    COUNT(*) FILTER (WHERE teve_oposicao = true AND resultado_final = 'deferido')
  INTO total_com_oposicao, deferidos_com_oposicao
  FROM intelligence_process_history
  WHERE (p_classe IS NULL OR classe = p_classe);

  IF total_com_oposicao > 0 THEN
    impacto_oposicao := (deferidos_com_oposicao::NUMERIC / total_com_oposicao) * 100;
  END IF;

  -- Impacto da exigência
  SELECT
    COUNT(*) FILTER (WHERE teve_exigencia = true),
    COUNT(*) FILTER (WHERE teve_exigencia = true AND resultado_final = 'deferido')
  INTO total_com_exigencia, deferidos_com_exigencia
  FROM intelligence_process_history
  WHERE (p_classe IS NULL OR classe = p_classe);

  IF total_com_exigencia > 0 THEN
    impacto_exigencia := (deferidos_com_exigencia::NUMERIC / total_com_exigencia) * 100;
  END IF;

  -- Fator tempo (quanto mais rápido, melhor)
  SELECT COALESCE(AVG(tempo_total_dias), 0)
  INTO tempo_medio
  FROM intelligence_process_history
  WHERE (p_classe IS NULL OR classe = p_classe)
    AND tempo_total_dias IS NOT NULL AND tempo_total_dias > 0;

  IF tempo_medio > 0 THEN
    fator_tempo := GREATEST(0, LEAST(100, (1 - (tempo_medio / (tempo_ref * 3))) * 100));
  ELSE
    fator_tempo := 50; -- neutro se sem dados
  END IF;

  -- Score composto
  score := (taxa_deferimento * 0.4) + (taxa_recurso * 0.2) + (impacto_oposicao * 0.2) + (impacto_exigencia * 0.1) + (fator_tempo * 0.1);
  score := GREATEST(0, LEAST(100, score));

  result := json_build_object(
    'score', ROUND(score, 1),
    'classificacao', CASE
      WHEN score >= 80 THEN 'Alta previsibilidade'
      WHEN score >= 60 THEN 'Estável'
      WHEN score >= 40 THEN 'Risco moderado'
      ELSE 'Alto risco'
    END,
    'taxa_deferimento', ROUND(taxa_deferimento, 1),
    'taxa_recurso', ROUND(taxa_recurso, 1),
    'impacto_oposicao', ROUND(impacto_oposicao, 1),
    'impacto_exigencia', ROUND(impacto_exigencia, 1),
    'fator_tempo', ROUND(fator_tempo, 1),
    'tempo_medio_dias', ROUND(tempo_medio),
    'total_julgados', total_julgados,
    'total_deferidos', total_deferidos,
    'total_com_recurso', total_com_recurso,
    'total_com_oposicao', total_com_oposicao,
    'total_com_exigencia', total_com_exigencia
  );

  RETURN result;
END;
$$;

-- 3. Função para obter métricas por classe (ranking)
CREATE OR REPLACE FUNCTION public.get_class_ranking()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_data ORDER BY score DESC)
  INTO result
  FROM (
    SELECT 
      classe,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE resultado_final = 'deferido') as deferidos,
      COUNT(*) FILTER (WHERE resultado_final = 'indeferido') as indeferidos,
      COUNT(*) FILTER (WHERE resultado_final = 'arquivado') as arquivados,
      ROUND(AVG(tempo_total_dias) FILTER (WHERE tempo_total_dias > 0)) as tempo_medio,
      CASE 
        WHEN COUNT(*) FILTER (WHERE resultado_final IN ('deferido','indeferido','arquivado')) > 0 
        THEN ROUND((COUNT(*) FILTER (WHERE resultado_final = 'deferido')::NUMERIC / 
              COUNT(*) FILTER (WHERE resultado_final IN ('deferido','indeferido','arquivado'))) * 100, 1)
        ELSE 0
      END as score
    FROM intelligence_process_history
    WHERE classe IS NOT NULL
    GROUP BY classe
    HAVING COUNT(*) >= 1
  ) row_data;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- 4. Função para evolução anual
CREATE OR REPLACE FUNCTION public.get_annual_evolution()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_data ORDER BY ano)
  INTO result
  FROM (
    SELECT 
      ano_finalizacao as ano,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE resultado_final = 'deferido') as deferidos,
      CASE 
        WHEN COUNT(*) > 0 
        THEN ROUND((COUNT(*) FILTER (WHERE resultado_final = 'deferido')::NUMERIC / COUNT(*)) * 100, 1)
        ELSE 0
      END as taxa_sucesso,
      ROUND(AVG(tempo_total_dias) FILTER (WHERE tempo_total_dias > 0)) as tempo_medio
    FROM intelligence_process_history
    WHERE ano_finalizacao IS NOT NULL
    GROUP BY ano_finalizacao
  ) row_data;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- 5. Função para sincronizar dados existentes na tabela analítica
CREATE OR REPLACE FUNCTION public.sync_intelligence_history()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  synced INTEGER := 0;
  proc RECORD;
  has_opposition BOOLEAN;
  has_exigency BOOLEAN;
  has_appeal BOOLEAN;
  final_result TEXT;
  total_days INTEGER;
  finish_year INTEGER;
  classe_val TEXT;
BEGIN
  FOR proc IN 
    SELECT bp.id, bp.ncl_classes, bp.business_area, bp.status, bp.pipeline_stage,
           bp.deposit_date, bp.created_at, bp.grant_date
    FROM brand_processes bp
  LOOP
    -- Determinar resultado final baseado no status/pipeline
    final_result := NULL;
    IF proc.status = 'registrada' OR proc.pipeline_stage = 'deferido' OR proc.pipeline_stage = 'registrada' THEN
      final_result := 'deferido';
    ELSIF proc.status = 'indeferido' OR proc.pipeline_stage = 'indeferido' THEN
      final_result := 'indeferido';
    ELSIF proc.status = 'arquivado' OR proc.pipeline_stage = 'arquivado' THEN
      final_result := 'arquivado';
    END IF;

    -- Verificar oposições, exigências e recursos via inpi_resources
    SELECT 
      EXISTS(SELECT 1 FROM inpi_resources WHERE process_number IN (
        SELECT process_number FROM brand_processes WHERE id = proc.id
      ) AND resource_type = 'oposicao'),
      EXISTS(SELECT 1 FROM inpi_resources WHERE process_number IN (
        SELECT process_number FROM brand_processes WHERE id = proc.id
      ) AND resource_type LIKE '%exigencia%'),
      EXISTS(SELECT 1 FROM inpi_resources WHERE process_number IN (
        SELECT process_number FROM brand_processes WHERE id = proc.id
      ) AND resource_type = 'recurso')
    INTO has_opposition, has_exigency, has_appeal;

    -- Classe NCL (primeira da lista)
    classe_val := NULL;
    IF proc.ncl_classes IS NOT NULL AND array_length(proc.ncl_classes, 1) > 0 THEN
      classe_val := 'NCL ' || proc.ncl_classes[1]::TEXT;
    ELSIF proc.business_area IS NOT NULL THEN
      classe_val := proc.business_area;
    END IF;

    -- Tempo total
    total_days := NULL;
    IF proc.grant_date IS NOT NULL AND proc.deposit_date IS NOT NULL THEN
      total_days := (proc.grant_date - proc.deposit_date);
    ELSIF proc.grant_date IS NOT NULL AND proc.created_at IS NOT NULL THEN
      total_days := EXTRACT(DAY FROM (proc.grant_date::timestamp - proc.created_at::timestamp))::INTEGER;
    ELSIF final_result IS NOT NULL AND proc.created_at IS NOT NULL THEN
      total_days := EXTRACT(DAY FROM (now() - proc.created_at))::INTEGER;
    END IF;

    -- Ano de finalização
    finish_year := NULL;
    IF proc.grant_date IS NOT NULL THEN
      finish_year := EXTRACT(YEAR FROM proc.grant_date);
    ELSIF final_result IS NOT NULL THEN
      finish_year := EXTRACT(YEAR FROM now());
    END IF;

    -- Upsert
    INSERT INTO intelligence_process_history (
      process_id, classe, tipo_marca,
      teve_oposicao, teve_exigencia, teve_recurso,
      resultado_final, tempo_total_dias, ano_finalizacao
    ) VALUES (
      proc.id, classe_val, 'nominativa',
      has_opposition, has_exigency, has_appeal,
      final_result, total_days, finish_year
    )
    ON CONFLICT (process_id) DO UPDATE SET
      classe = EXCLUDED.classe,
      teve_oposicao = EXCLUDED.teve_oposicao,
      teve_exigencia = EXCLUDED.teve_exigencia,
      teve_recurso = EXCLUDED.teve_recurso,
      resultado_final = EXCLUDED.resultado_final,
      tempo_total_dias = EXCLUDED.tempo_total_dias,
      ano_finalizacao = EXCLUDED.ano_finalizacao,
      updated_at = now();

    synced := synced + 1;
  END LOOP;

  RETURN json_build_object('synced', synced);
END;
$$;
