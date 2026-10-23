TS public.notification_dispatch_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  channel text NOT NULL,
  recipient_phone text,
  recipient_email text,
  recipient_user_id uuid,
  status text NOT NULL DEFAULT 'failed',
  payload jsonb,
  response_body text,
  error_message text,
  attempts integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.notification_dispatch_logs ENABLE ROW LEVEL SECURITY;

-- Políticas
DROP POLICY IF EXISTS "Admins can view dispatch logs" ON public.notification_dispatch_logs;
CREATE POLICY "Admins can view dispatch logs"
  ON public.notification_dispatch_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service can insert dispatch logs" ON public.notification_dispatch_logs;
CREATE POLICY "Service can insert dispatch logs"
  ON public.notification_dispatch_logs FOR INSERT
  WITH CHECK (true);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_event ON public.notification_dispatch_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_channel ON public.notification_dispatch_logs(channel);
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_status ON public.notification_dispatch_logs(status);
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_created ON public.notification_dispatch_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_user ON public.notification_dispatch_logs(recipient_user_id);

-- Garantir que notifications tem coluna link (para CRM)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read boolean DEFAULT false;

-- END LOCAL BOOTSTRAP 20260218224357_684c3bbc-9af3-48be-b19c-435aca19afb9.sql

-- BEGIN LOCAL BOOTSTRAP 20260219204133_08e265e5-b042-40df-b831-180d4c01bc08.sql
-- Adicionar coluna created_by na tabela contracts
-- Registra qual admin criou o contrato para atribuição automática de responsável
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Índice para performance nas queries de atribuição
CREATE INDEX IF NOT EXISTS idx_contracts_created_by ON public.contracts(created_by);

-- END LOCAL BOOTSTRAP 20260219204133_08e265e5-b042-40df-b831-180d4c01bc08.sql

-- BEGIN LOCAL BOOTSTRAP 20260220010001_af1b7bf3-c8c5-4a10-a48c-134f80266676.sql
-- Cria uma função SECURITY DEFINER para verificar se o perfil acessado é o consultor atribuído ao usuário atual
-- Isso evita recursão infinita na RLS ao consultar a própria tabela profiles
CREATE OR REPLACE FUNCTION public.is_assigned_admin_of_current_user(_admin_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND (
        (assigned_to = _admin_id AND assigned_to IS NOT NULL)
        OR
        (created_by = _admin_id AND created_by IS NOT NULL)
      )
  )
$$;

-- Adiciona política que permite ao cliente visualizar o perfil do admin atribuído a ele
CREATE POLICY "Clients can view their assigned admin profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.is_assigned_admin_of_current_user(id)
);
-- END LOCAL BOOTSTRAP 20260220010001_af1b7bf3-c8c5-4a10-a48c-134f80266676.sql

-- BEGIN LOCAL BOOTSTRAP 20260221013919_432f053f-3688-41fe-896e-f88aba34e952.sql
ALTER TABLE public.email_accounts ADD COLUMN assigned_to uuid;
-- END LOCAL BOOTSTRAP 20260221013919_432f053f-3688-41fe-896e-f88aba34e952.sql

-- BEGIN LOCAL BOOTSTRAP 20260221024011_20f11925-28f1-49a4-b56a-18618c752396.sql

INSERT INTO public.email_templates (name, subject, body, trigger_event, is_active)
VALUES (
  'Link de Assinatura',
  '[WebMarcas] {{documento_tipo}} pendente de assinatura - {{marca}}',
  '<div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #1a1a2e; margin: 0;">WebMarcas</h2>
    <p style="color: #666; font-size: 14px;">Registro e Proteção de Marcas</p>
  </div>
  
  <p style="font-size: 16px; color: #333;">Olá <strong>{{nome}}</strong>,</p>
  
  <p style="font-size: 15px; color: #333; line-height: 1.6;">
    Você possui um documento pendente de assinatura eletrônica:
  </p>
  
  <div style="background: #f8f9fa; border-left: 4px solid #4f46e5; padding: 15px 20px; margin: 20px 0; border-radius: 4px;">
    <p style="margin: 0; font-size: 15px;">📄 <strong>{{documento_tipo}}</strong>: {{marca}}</p>
  </div>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="{{link_assinatura}}" style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
      ✍️ Assinar Documento
    </a>
  </div>
  
  <p style="font-size: 14px; color: #e74c3c; text-align: center;">
    ⚠️ Este link expira em <strong>{{data_expiracao}}</strong>.
  </p>
  
  <p style="font-size: 14px; color: #555; line-height: 1.6;">
    A assinatura eletrônica tem validade jurídica conforme Lei 14.063/2020 e será registrada em blockchain para garantir autenticidade.
  </p>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  
  <p style="font-size: 13px; color: #888; text-align: center;">
    Dúvidas? Entre em contato:<br/>
    📞 (11) 4200-1656 | 📧 contato@webmarcas.com.br<br/>
    🌐 <a href="https://webmarcas.net" style="color: #4f46e5;">www.webmarcas.net</a>
  </p>
</div>',
  'signature_request',
  true
);

-- END LOCAL BOOTSTRAP 20260221024011_20f11925-28f1-49a4-b56a-18618c752396.sql

-- BEGIN LOCAL BOOTSTRAP 20260221031908_544fb4a0-1c62-4ad7-a260-41f48c2d63ad.sql

CREATE TABLE public.channel_notification_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage channel notification templates"
ON public.channel_notification_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_channel_notification_templates_updated_at
BEFORE UPDATE ON public.channel_notification_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- END LOCAL BOOTSTRAP 20260221031908_544fb4a0-1c62-4ad7-a260-41f48c2d63ad.sql

-- BEGIN LOCAL BOOTSTRAP 20260222052635_ac5ec245-9caa-48a0-87a3-8e65fe33328d.sql
-- Add folder column to email_inbox to distinguish inbox vs sent emails synced from IMAP
ALTER TABLE public.email_inbox ADD COLUMN IF NOT EXISTS folder text NOT NULL DEFAULT 'inbox';

-- Add index for faster filtering by folder
CREATE INDEX IF NOT EXISTS idx_email_inbox_folder ON public.email_inbox (folder);

-- Add To header field support for sent emails
ALTER TABLE public.email_inbox ADD COLUMN IF NOT EXISTS to_name text;
-- END LOCAL BOOTSTRAP 20260222052635_ac5ec245-9caa-48a0-87a3-8e65fe33328d.sql

-- BEGIN LOCAL BOOTSTRAP 20260222222431_64797194-6b32-4aac-927f-8db5c8d030d5.sql

-- Table: AI Providers
CREATE TABLE public.ai_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('openai', 'gemini', 'deepseek', 'lovable')),
  api_key TEXT,
  model TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_fallback BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ai_providers"
  ON public.ai_providers FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_ai_providers_updated_at
  BEFORE UPDATE ON public.ai_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Table: AI Usage Logs
CREATE TABLE public.ai_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  module TEXT NOT NULL,
  task_type TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  response_time_ms INTEGER,
  tokens_used INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ai_usage_logs"
  ON public.ai_usage_logs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert ai_usage_logs"
  ON public.ai_usage_logs FOR INSERT
  WITH CHECK (true);

-- Seed default Lovable AI provider (always available, no key needed)
INSERT INTO public.ai_providers (name, provider_type, api_key, model, is_active, is_fallback)
VALUES ('Lovable AI', 'lovable', NULL, 'google/gemini-3-flash-preview', true, false);

-- END LOCAL BOOTSTRAP 20260222222431_64797194-6b32-4aac-927f-8db5c8d030d5.sql

-- BEGIN LOCAL BOOTSTRAP 20260222233916_68e8607e-5beb-40f6-9393-3b11728a2a6b.sql

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

-- END LOCAL BOOTSTRAP 20260222233916_68e8607e-5beb-40f6-9393-3b11728a2a6b.sql

-- BEGIN LOCAL BOOTSTRAP 20260223015015_08f7b437-5e21-44bb-946a-174313503ea1.sql

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

-- END LOCAL BOOTSTRAP 20260223015015_08f7b437-5e21-44bb-946a-174313503ea1.sql

-- BEGIN LOCAL BOOTSTRAP 20260224040154_560a8578-c393-419b-bbf3-0c650aa7ccf1.sql
-- Allow anonymous users to verify contracts by blockchain hash (public verification page)
CREATE POLICY "Public can verify contracts by hash"
  ON public.contracts
  FOR SELECT
  TO anon
  USING (blockchain_hash IS NOT NULL);

-- Allow anonymous users to read documents linked to verified contracts
CREATE POLICY "Public can read documents for verified contracts"
  ON public.documents
  FOR SELECT
  TO anon
  USING (
    contract_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.contracts c 
      WHERE c.id = documents.contract_id 
      AND c.blockchain_hash IS NOT NULL
    )
  );
-- END LOCAL BOOTSTRAP 20260224040154_560a8578-c393-419b-bbf3-0c650aa7ccf1.sql

-- BEGIN LOCAL BOOTSTRAP 20260225035917_ae374caf-1fd6-4175-9839-48f3b8362253.sql
ALTER TABLE rpi_entries
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS linked_at timestamptz;
-- END LOCAL BOOTSTRAP 20260225035917_ae374caf-1fd6-4175-9839-48f3b8362253.sql

-- BEGIN LOCAL BOOTSTRAP 20260225044652_df6dbede-3828-4793-8769-8dfe23e60769.sql

-- Tabela principal: publicacoes_marcas (isolada, sem alterar nada existente)
CREATE TABLE public.publicacoes_marcas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid REFERENCES public.brand_processes(id) ON DELETE CASCADE NOT NULL,
  client_id uuid NOT NULL,
  admin_id uuid,
  status text NOT NULL DEFAULT 'depositada',
  tipo_publicacao text DEFAULT 'publicacao_rpi',
  data_deposito date,
  data_publicacao_rpi date,
  prazo_oposicao date,
  data_decisao date,
  data_certificado date,
  data_renovacao date,
  proximo_prazo_critico date,
  descricao_prazo text,
  oposicao_protocolada boolean DEFAULT false,
  oposicao_data date,
  comentarios_internos text,
  documento_rpi_url text,
  rpi_number text,
  rpi_link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(process_id)
);

-- Tabela de logs de auditoria
CREATE TABLE public.publicacao_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publicacao_id uuid REFERENCES public.publicacoes_marcas(id) ON DELETE CASCADE NOT NULL,
  admin_id uuid,
  admin_email text,
  campo_alterado text NOT NULL,
  valor_anterior text,
  valor_novo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.publicacoes_marcas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publicacao_logs ENABLE ROW LEVEL SECURITY;

-- Politicas RLS: somente admins
CREATE POLICY "Admins can manage publicacoes"
  ON public.publicacoes_marcas FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage publicacao logs"
  ON public.publicacao_logs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger para updated_at automático
CREATE TRIGGER update_publicacoes_marcas_updated_at
  BEFORE UPDATE ON public.publicacoes_marcas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indices para performance
CREATE INDEX idx_publicacoes_marcas_client_id ON public.publicacoes_marcas(client_id);
CREATE INDEX idx_publicacoes_marcas_status ON public.publicacoes_marcas(status);
CREATE INDEX idx_publicacoes_marcas_proximo_prazo ON public.publicacoes_marcas(proximo_prazo_critico);
CREATE INDEX idx_publicacao_logs_publicacao_id ON public.publicacao_logs(publicacao_id);

-- END LOCAL BOOTSTRAP 20260225044652_df6dbede-3828-4793-8769-8dfe23e60769.sql

-- BEGIN LOCAL BOOTSTRAP 20260225051719_80e50aae-ce42-4215-898e-96a0f2b57ff0.sql

-- RLS para clientes verem seus proprios registros de publicacao
CREATE POLICY "Clients can view own publicacoes"
  ON public.publicacoes_marcas FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

-- Ativar realtime na tabela publicacoes_marcas
ALTER PUBLICATION supabase_realtime ADD TABLE public.publicacoes_marcas;

-- END LOCAL BOOTSTRAP 20260225051719_80e50aae-ce42-4215-898e-96a0f2b57ff0.sql

-- BEGIN LOCAL BOOTSTRAP 20260225054629_17e63308-b235-45ca-be2e-5a7934e6003f.sql

-- 1. Tornar process_id e client_id nullable
ALTER TABLE publicacoes_marcas ALTER COLUMN process_id DROP NOT NULL;
ALTER TABLE publicacoes_marcas ALTER COLUMN client_id DROP NOT NULL;

-- 2. Adicionar colunas de rastreamento RPI
ALTER TABLE publicacoes_marcas ADD COLUMN IF NOT EXISTS rpi_entry_id uuid UNIQUE;
ALTER TABLE publicacoes_marcas ADD COLUMN IF NOT EXISTS brand_name_rpi text;
ALTER TABLE publicacoes_marcas ADD COLUMN IF NOT EXISTS process_number_rpi text;

-- END LOCAL BOOTSTRAP 20260225054629_17e63308-b235-45ca-be2e-5a7934e6003f.sql

-- BEGIN LOCAL BOOTSTRAP 20260225065013_45f6d078-c4e9-44ae-86eb-16f492070a56.sql

-- Add last_notification_sent_at to publicacoes_marcas for notification dedup
ALTER TABLE public.publicacoes_marcas 
ADD COLUMN IF NOT EXISTS last_notification_sent_at timestamp with time zone DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN public.publicacoes_marcas.last_notification_sent_at IS 'Timestamp of last automated notification sent for this publication, used for dedup';

-- END LOCAL BOOTSTRAP 20260225065013_45f6d078-c4e9-44ae-86eb-16f492070a56.sql

-- BEGIN LOCAL BOOTSTRAP 20260225133413_e4370ea1-47fd-4d37-b490-e606bb55b8d0.sql

-- Add Google Meet columns to client_appointments
ALTER TABLE public.client_appointments ADD COLUMN IF NOT EXISTS google_meet_link TEXT;
ALTER TABLE public.client_appointments ADD COLUMN IF NOT EXISTS google_event_id TEXT;

-- Add Google Meet columns to meetings
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS google_meet_link TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS google_event_id TEXT;

-- END LOCAL BOOTSTRAP 20260225133413_e4370ea1-47fd-4d37-b490-e606bb55b8d0.sql

-- BEGIN LOCAL BOOTSTRAP 20260226031038_e794a6c2-f44a-4c44-9100-83ad0fc8d77f.sql

-- 1. Novas colunas na tabela leads (aditivo)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_temperature text DEFAULT 'frio',
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz,
  ADD COLUMN IF NOT EXISTS remarketing_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- 2. Tabela lead_activities
CREATE TABLE IF NOT EXISTS public.lead_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  admin_id uuid,
  activity_type text NOT NULL,
  content text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lead_activities"
  ON public.lead_activities FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. Tabela lead_remarketing_campaigns
CREATE TABLE IF NOT EXISTS public.lead_remarketing_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'personalizado',
  subject text,
  body text,
  target_status text[] DEFAULT '{}',
  target_origin text[] DEFAULT '{}',
  scheduled_at timestamptz,
  sent_at timestamptz,
  total_sent integer DEFAULT 0,
  total_opened integer DEFAULT 0,
  created_by uuid,
  status text NOT NULL DEFAULT 'rascunho',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_remarketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lead_remarketing_campaigns"
  ON public.lead_remarketing_campaigns FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- END LOCAL BOOTSTRAP 20260226031038_e794a6c2-f44a-4c44-9100-83ad0fc8d77f.sql

-- BEGIN LOCAL BOOTSTRAP 20260226055141_e5895465-3777-4432-8e5d-446a779f0f1d.sql

-- Tabela de fila de remarketing
CREATE TABLE public.lead_remarketing_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NULL,
  lead_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'pending',
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  subject text NULL,
  body text NULL
);

-- RLS
ALTER TABLE public.lead_remarketing_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage remarketing queue"
ON public.lead_remarketing_queue
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage remarketing queue"
ON public.lead_remarketing_queue
FOR ALL
USING (true)
WITH CHECK (true);

-- Index para o cron processor
CREATE INDEX idx_remarketing_queue_pending ON public.lead_remarketing_queue (status, scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_remarketing_queue_campaign ON public.lead_remarketing_queue (campaign_id);

-- Também garantir que a tabela lead_remarketing_campaigns existe com os campos necessários
-- Adicionar coluna channels e total_queued se não existirem
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lead_remarketing_campaigns' AND column_name = 'channels') THEN
    ALTER TABLE public.lead_remarketing_campaigns ADD COLUMN channels text[] DEFAULT '{email}'::text[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lead_remarketing_campaigns' AND column_name = 'total_queued') THEN
    ALTER TABLE public.lead_remarketing_campaigns ADD COLUMN total_queued integer DEFAULT 0;
  END IF;
END $$;

-- END LOCAL BOOTSTRAP 20260226055141_e5895465-3777-4432-8e5d-446a779f0f1d.sql

-- BEGIN LOCAL BOOTSTRAP 20260226173108_bd71eb7b-e0ad-4909-8fc2-7e22485180c6.sql

-- Tabela de campanhas de remarketing para clientes
CREATE TABLE public.client_remarketing_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'custom',
  subject text,
  body text,
  target_status text[] DEFAULT '{}',
  channels text[] DEFAULT '{email}',
  status text NOT NULL DEFAULT 'rascunho',
  total_sent integer DEFAULT 0,
  total_opened integer DEFAULT 0,
  total_queued integer DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_at timestamp with time zone,
  scheduled_at timestamp with time zone
);

ALTER TABLE public.client_remarketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage client remarketing campaigns"
  ON public.client_remarketing_campaigns FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Tabela de fila de remarketing para clientes
CREATE TABLE public.client_remarketing_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid REFERENCES public.client_remarketing_campaigns(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'pending',
  scheduled_for timestamp with time zone NOT NULL DEFAULT now(),
  sent_at timestamp with time zone,
  error_message text,
  subject text,
  body text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.client_remarketing_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage client remarketing queue"
  ON public.client_remarketing_queue FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage client remarketing queue"
  ON public.client_remarketing_queue FOR ALL
  USING (true)
  WITH CHECK (true);

-- END LOCAL BOOTSTRAP 20260226173108_bd71eb7b-e0ad-4909-8fc2-7e22485180c6.sql

-- BEGIN LOCAL BOOTSTRAP 20260226191713_a8c537dd-ee4d-4b76-83bb-a5f926c485a0.sql
-- Add FK from lead_remarketing_queue.lead_id to leads.id
ALTER TABLE public.lead_remarketing_queue
  ADD CONSTRAINT lead_remarketing_queue_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

-- Add FK from client_remarketing_queue.client_id to profiles.id
ALTER TABLE public.client_remarketing_queue
  ADD CONSTRAINT client_remarketing_queue_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
-- END LOCAL BOOTSTRAP 20260226191713_a8c537dd-ee4d-4b76-83bb-a5f926c485a0.sql

-- BEGIN LOCAL BOOTSTRAP 20260226225450_4cb2c75d-50f8-40ad-b0bd-f892d0ca28a2.sql

-- Add ncl_class column to publicacoes_marcas for manual Nice class assignment
ALTER TABLE public.publicacoes_marcas ADD COLUMN IF NOT EXISTS ncl_class text;

-- END LOCAL BOOTSTRAP 20260226225450_4cb2c75d-50f8-40ad-b0bd-f892d0ca28a2.sql

-- BEGIN LOCAL BOOTSTRAP 20260226233127_4e0bb0b3-a551-4a9e-9452-76657fec13af.sql

-- Add linking_method column to track how publications were linked to clients
ALTER TABLE public.publicacoes_marcas 
ADD COLUMN IF NOT EXISTS linking_method TEXT DEFAULT 'manual';

-- Add stale_since column to detect stalled processes
ALTER TABLE public.publicacoes_marcas 
ADD COLUMN IF NOT EXISTS stale_since TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN public.publicacoes_marcas.linking_method IS 'How the client was linked: manual, auto_process, auto_brand, fuzzy';
COMMENT ON COLUMN public.publicacoes_marcas.stale_since IS 'Timestamp when the publication was detected as stalled (no status change for 30+ days)';

-- END LOCAL BOOTSTRAP 20260226233127_4e0bb0b3-a551-4a9e-9452-76657fec13af.sql

-- BEGIN LOCAL BOOTSTRAP 20260227004850_43adc06d-8cde-48e1-8fe5-2905359cf00c.sql
ALTER TABLE public.inpi_resources DROP CONSTRAINT inpi_resources_resource_type_check;

ALTER TABLE public.inpi_resources ADD CONSTRAINT inpi_resources_resource_type_check CHECK (resource_type = ANY (ARRAY['indeferimento'::text, 'exigencia_merito'::text, 'oposicao'::text, 'notificacao_extrajudicial'::text]));
-- END LOCAL BOOTSTRAP 20260227004850_43adc06d-8cde-48e1-8fe5-2905359cf00c.sql

-- BEGIN LOCAL BOOTSTRAP 20260228063347_ee8356ea-655b-4fcf-8245-b66f37cd9002.sql

-- Permitir que usuarios autenticados leiam system_settings
CREATE POLICY "Authenticated users can read system settings"
ON public.system_settings
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Inserir configuracao padrao do kanban do cliente
INSERT INTO public.system_settings (key, value)
VALUES ('client_kanban_stages', '{"stages":[{"id":"em_andamento","name":"Em Andamento","color":"#3B82F6"},{"id":"publicado_rpi","name":"Publicado RPI","color":"#8B5CF6"},{"id":"em_exame","name":"Em Exame","color":"#F59E0B"},{"id":"deferido","name":"Deferido","color":"#10B981"},{"id":"concedido","name":"Concedido","color":"#22C55E"},{"id":"indeferido","name":"Indeferido","color":"#EF4444"},{"id":"arquivado","name":"Arquivado","color":"#6B7280"}]}')
ON CONFLICT (key) DO NOTHING;

-- END LOCAL BOOTSTRAP 20260228063347_ee8356ea-655b-4fcf-8245-b66f37cd9002.sql

-- BEGIN LOCAL BOOTSTRAP 20260302212508_7e03e17f-4dbe-43a0-a59c-07726f14ab67.sql
-- Migrate existing publicacoes_marcas status values to match juridico kanban stages
UPDATE public.publicacoes_marcas SET status = '003' WHERE status = 'depositada';
UPDATE public.publicacoes_marcas SET status = 'publicada' WHERE status = 'publicada';
UPDATE public.publicacoes_marcas SET status = 'oposicao' WHERE status = 'oposicao';
UPDATE public.publicacoes_marcas SET status = 'exigencia_merito' WHERE status = 'publicada';
UPDATE public.publicacoes_marcas SET status = 'deferimento' WHERE status = 'deferida';
UPDATE public.publicacoes_marcas SET status = 'certificado' WHERE status = 'certificada';
UPDATE public.publicacoes_marcas SET status = 'indeferimento' WHERE status = 'indeferida';
UPDATE public.publicacoes_marcas SET status = 'arquivado' WHERE status = 'arquivada';
UPDATE public.publicacoes_marcas SET status = 'renovacao' WHERE status = 'renovacao_pendente';

-- END LOCAL BOOTSTRAP 20260302212508_7e03e17f-4dbe-43a0-a59c-07726f14ab67.sql

-- BEGIN LOCAL BOOTSTRAP 20260303035939_8b6e10dd-0fc1-4fb3-87a1-7669ed5a4be6.sql
CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(lookup_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE email = lower(trim(lookup_email)) LIMIT 1;
$$;
-- END LOCAL BOOTSTRAP 20260303035939_8b6e10dd-0fc1-4fb3-87a1-7669ed5a4be6.sql

-- BEGIN LOCAL BOOTSTRAP 20260303195133_6c63f14e-3cca-4c1d-af3e-76cd23d5c46f.sql
UPDATE public.profiles SET assigned_to = '1ca389a4-bb64-4ff5-97ab-0a214ccab4b8' WHERE assigned_to = '8b5a4fc0-1fc4-402d-8ee9-c7cae2c0e39a';
-- END LOCAL BOOTSTRAP 20260303195133_6c63f14e-3cca-4c1d-af3e-76cd23d5c46f.sql

-- BEGIN LOCAL BOOTSTRAP 20260305022724_fe59c7b5-3e81-4fb0-9712-d9fdeb7dd068.sql

-- Marketing Intelligence tables

CREATE TABLE public.marketing_config (
  id uuid PRIMARY KEY DEFAULT gen
