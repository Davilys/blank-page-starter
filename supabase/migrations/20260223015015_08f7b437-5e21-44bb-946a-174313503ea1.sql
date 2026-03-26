
-- =========================================
-- Motor de Monetização Híbrido - Tabelas Auxiliares
-- NÃO altera nenhuma tabela existente
-- =========================================

-- 1) Tabela de logs de upsell (registra aceite/recusa)
CREATE TABLE public.upsell_monetization_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  classe_principal TEXT,
  segmento TEXT,
  score_comercial NUMERIC DEFAULT 0,
  upsell_sugerido TEXT NOT NULL,
  upsell_tipo TEXT DEFAULT 'classe_complementar',
  aceitou BOOLEAN DEFAULT NULL,
  justificativa TEXT,
  confidence_index NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.upsell_monetization_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage upsell logs"
  ON public.upsell_monetization_logs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert upsell logs"
  ON public.upsell_monetization_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view own upsell logs"
  ON public.upsell_monetization_logs FOR SELECT
  USING (auth.uid() = user_id);

-- 2) Tabela de pesos do motor (aprendizado)
CREATE TABLE public.upsell_engine_weights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dimension TEXT NOT NULL,
  dimension_value TEXT NOT NULL,
  peso NUMERIC NOT NULL DEFAULT 50,
  taxa_aceite NUMERIC DEFAULT 0,
  total_sugestoes INTEGER DEFAULT 0,
  total_aceites INTEGER DEFAULT 0,
  confidence_index NUMERIC DEFAULT 0,
  is_premium BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(dimension, dimension_value)
);

ALTER TABLE public.upsell_engine_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage engine weights"
  ON public.upsell_engine_weights FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage engine weights"
  ON public.upsell_engine_weights FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3) Tabela de configuração do motor
CREATE TABLE public.upsell_engine_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  engine_enabled BOOLEAN DEFAULT true,
  mode TEXT DEFAULT 'fixed',
  global_confidence NUMERIC DEFAULT 0,
  last_recalculation TIMESTAMP WITH TIME ZONE,
  last_optimization TIMESTAMP WITH TIME ZONE,
  stats JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.upsell_engine_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage engine config"
  ON public.upsell_engine_config FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default config
INSERT INTO public.upsell_engine_config (engine_enabled, mode, global_confidence)
VALUES (true, 'fixed', 0);

-- 4) Função de recalcular pesos
CREATE OR REPLACE FUNCTION public.recalculate_upsell_weights()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
  rec RECORD;
  total_logs INTEGER;
  global_conf NUMERIC;
  updated_count INTEGER := 0;
BEGIN
  -- Recalcular por classe
  FOR rec IN
    SELECT classe_principal as dim_val, 
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE aceitou = true) as aceitos
    FROM upsell_monetization_logs
    WHERE classe_principal IS NOT NULL AND aceitou IS NOT NULL
    GROUP BY classe_principal
  LOOP
    INSERT INTO upsell_engine_weights (dimension, dimension_value, peso, taxa_aceite, total_sugestoes, total_aceites, confidence_index, is_premium)
    VALUES (
      'classe', rec.dim_val,
      CASE WHEN rec.total >= 5 THEN (rec.aceitos::NUMERIC / rec.total) * 100 ELSE 50 END,
      CASE WHEN rec.total > 0 THEN (rec.aceitos::NUMERIC / rec.total) * 100 ELSE 0 END,
      rec.total, rec.aceitos,
      LEAST(100, rec.total * 5),
      (rec.aceitos::NUMERIC / GREATEST(rec.total, 1)) * 100 > 60
    )
    ON CONFLICT (dimension, dimension_value) DO UPDATE SET
      peso = CASE WHEN rec.total >= 5 THEN (rec.aceitos::NUMERIC / rec.total) * 100 ELSE 50 END,
      taxa_aceite = CASE WHEN rec.total > 0 THEN (rec.aceitos::NUMERIC / rec.total) * 100 ELSE 0 END,
      total_sugestoes = rec.total,
      total_aceites = rec.aceitos,
      confidence_index = LEAST(100, rec.total * 5),
      is_premium = (rec.aceitos::NUMERIC / GREATEST(rec.total, 1)) * 100 > 60,
      updated_at = now();
    updated_count := updated_count + 1;
  END LOOP;

  -- Recalcular por segmento
  FOR rec IN
    SELECT segmento as dim_val,
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE aceitou = true) as aceitos
    FROM upsell_monetization_logs
    WHERE segmento IS NOT NULL AND aceitou IS NOT NULL
    GROUP BY segmento
  LOOP
    INSERT INTO upsell_engine_weights (dimension, dimension_value, peso, taxa_aceite, total_sugestoes, total_aceites, confidence_index, is_premium)
    VALUES (
      'segmento', rec.dim_val,
      CASE WHEN rec.total >= 5 THEN (rec.aceitos::NUMERIC / rec.total) * 100 ELSE 50 END,
      CASE WHEN rec.total > 0 THEN (rec.aceitos::NUMERIC / rec.total) * 100 ELSE 0 END,
      rec.total, rec.aceitos,
      LEAST(100, rec.total * 5),
      (rec.aceitos::NUMERIC / GREATEST(rec.total, 1)) * 100 > 60
    )
    ON CONFLICT (dimension, dimension_value) DO UPDATE SET
      peso = CASE WHEN rec.total >= 5 THEN (rec.aceitos::NUMERIC / rec.total) * 100 ELSE 50 END,
      taxa_aceite = CASE WHEN rec.total > 0 THEN (rec.aceitos::NUMERIC / rec.total) * 100 ELSE 0 END,
      total_sugestoes = rec.total,
      total_aceites = rec.aceitos,
      confidence_index = LEAST(100, rec.total * 5),
      is_premium = (rec.aceitos::NUMERIC / GREATEST(rec.total, 1)) * 100 > 60,
      updated_at = now();
    updated_count := updated_count + 1;
  END LOOP;

  -- Calcular confiança global
  SELECT COUNT(*) INTO total_logs FROM upsell_monetization_logs WHERE aceitou IS NOT NULL;
  global_conf := LEAST(100, COALESCE(total_logs, 0) * 2);

  -- Determinar modo
  UPDATE upsell_engine_config SET
    global_confidence = global_conf,
    mode = CASE
      WHEN global_conf < 40 THEN 'fixed'
      WHEN global_conf < 70 THEN 'hybrid'
      ELSE 'intelligent'
    END,
    last_recalculation = now(),
    stats = json_build_object(
      'total_logs', total_logs,
      'weights_updated', updated_count,
      'recalculated_at', now()
    )::jsonb,
    updated_at = now();

  result := json_build_object(
    'success', true,
    'weights_updated', updated_count,
    'total_logs', total_logs,
    'global_confidence', global_conf,
    'mode', CASE
      WHEN global_conf < 40 THEN 'fixed'
      WHEN global_conf < 70 THEN 'hybrid'
      ELSE 'intelligent'
    END
  );

  RETURN result;
END;
$$;
