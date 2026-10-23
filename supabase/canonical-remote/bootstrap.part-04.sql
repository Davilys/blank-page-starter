_random_uuid(),
  meta_pixel_id text,
  meta_business_id text,
  is_connected boolean NOT NULL DEFAULT false,
  last_sync timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage marketing_config"
  ON public.marketing_config FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_campaign_id text,
  campaign_name text NOT NULL,
  adset_name text,
  ad_name text,
  status text DEFAULT 'active',
  spend numeric DEFAULT 0,
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  leads_count integer DEFAULT 0,
  cpl numeric DEFAULT 0,
  revenue numeric DEFAULT 0,
  roi numeric DEFAULT 0,
  synced_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage marketing_campaigns"
  ON public.marketing_campaigns FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.marketing_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  fbclid text,
  meta_campaign_id text,
  meta_adset_id text,
  meta_ad_id text,
  revenue numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_attribution ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage marketing_attribution"
  ON public.marketing_attribution FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can insert marketing_attribution"
  ON public.marketing_attribution FOR INSERT
  WITH CHECK (true);

-- END LOCAL BOOTSTRAP 20260305022724_fe59c7b5-3e81-4fb0-9712-d9fdeb7dd068.sql

-- BEGIN LOCAL BOOTSTRAP 20260305023930_36dc7ec3-f406-42f5-8c26-54c80b46745d.sql

-- Marketing Data Warehouse: Ads table (ad-level data from Meta/Google)
CREATE TABLE public.marketing_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'meta',
  meta_ad_id TEXT,
  meta_adset_id TEXT,
  ad_name TEXT,
  adset_name TEXT,
  status TEXT DEFAULT 'active',
  spend NUMERIC DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  leads_count INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  cpc NUMERIC DEFAULT 0,
  cpm NUMERIC DEFAULT 0,
  cpl NUMERIC DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(meta_ad_id)
);

-- Marketing Data Warehouse: Daily performance snapshots
CREATE TABLE public.marketing_ad_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  ad_id UUID REFERENCES public.marketing_ads(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'meta',
  date DATE NOT NULL,
  spend NUMERIC DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  leads_count INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  cpc NUMERIC DEFAULT 0,
  cpm NUMERIC DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ad_id, date)
);

-- Marketing Data Warehouse: Conversions tracking
CREATE TABLE public.marketing_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID,
  client_id UUID,
  contract_id UUID,
  invoice_id UUID,
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  ad_id UUID REFERENCES public.marketing_ads(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  event_value NUMERIC DEFAULT 0,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  fbclid TEXT,
  gclid TEXT,
  attribution_model TEXT DEFAULT 'last_click',
  platform TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Marketing Budget Alerts
CREATE TABLE public.marketing_budget_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  threshold_value NUMERIC NOT NULL,
  current_value NUMERIC DEFAULT 0,
  is_triggered BOOLEAN DEFAULT false,
  triggered_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add new columns to marketing_campaigns for enhanced tracking
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'meta';
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS ctr NUMERIC DEFAULT 0;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS cpc NUMERIC DEFAULT 0;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS cpm NUMERIC DEFAULT 0;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS conversions INTEGER DEFAULT 0;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS daily_budget NUMERIC DEFAULT 0;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS monthly_budget_limit NUMERIC DEFAULT 0;

-- Add new columns to marketing_attribution for enhanced tracking
ALTER TABLE public.marketing_attribution ADD COLUMN IF NOT EXISTS gclid TEXT;
ALTER TABLE public.marketing_attribution ADD COLUMN IF NOT EXISTS landing_page TEXT;
ALTER TABLE public.marketing_attribution ADD COLUMN IF NOT EXISTS referrer TEXT;
ALTER TABLE public.marketing_attribution ADD COLUMN IF NOT EXISTS attribution_model TEXT DEFAULT 'last_click';
ALTER TABLE public.marketing_attribution ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;
ALTER TABLE public.marketing_attribution ADD COLUMN IF NOT EXISTS contract_id UUID;
ALTER TABLE public.marketing_attribution ADD COLUMN IF NOT EXISTS invoice_id UUID;

-- Add Google Ads config to marketing_config
ALTER TABLE public.marketing_config ADD COLUMN IF NOT EXISTS google_ads_customer_id TEXT;
ALTER TABLE public.marketing_config ADD COLUMN IF NOT EXISTS google_ads_connected BOOLEAN DEFAULT false;
ALTER TABLE public.marketing_config ADD COLUMN IF NOT EXISTS sync_interval_minutes INTEGER DEFAULT 60;
ALTER TABLE public.marketing_config ADD COLUMN IF NOT EXISTS budget_alert_enabled BOOLEAN DEFAULT true;

-- RLS for new tables
ALTER TABLE public.marketing_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_ad_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_budget_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage marketing_ads" ON public.marketing_ads FOR ALL TO authenticated USING (public.has_current_user_role('admin'::app_role));
CREATE POLICY "Admins can manage marketing_ad_performance" ON public.marketing_ad_performance FOR ALL TO authenticated USING (public.has_current_user_role('admin'::app_role));
CREATE POLICY "Admins can manage marketing_conversions" ON public.marketing_conversions FOR ALL TO authenticated USING (public.has_current_user_role('admin'::app_role));
CREATE POLICY "Admins can manage marketing_budget_alerts" ON public.marketing_budget_alerts FOR ALL TO authenticated USING (public.has_current_user_role('admin'::app_role));

-- END LOCAL BOOTSTRAP 20260305023930_36dc7ec3-f406-42f5-8c26-54c80b46745d.sql

-- BEGIN LOCAL BOOTSTRAP 20260305024418_98904e05-4f8f-439d-b52f-3a6058face52.sql

-- AI Generated Ads storage
CREATE TABLE public.marketing_generated_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name TEXT,
  platform TEXT NOT NULL DEFAULT 'meta',
  target_audience TEXT,
  objective TEXT,
  headline TEXT NOT NULL,
  primary_text TEXT NOT NULL,
  description TEXT,
  call_to_action TEXT,
  generated_by TEXT DEFAULT 'lovable_ai',
  status TEXT DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- A/B Test tracking
CREATE TABLE public.marketing_ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name TEXT NOT NULL,
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'running',
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  winner_variant TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- A/B Test variants
CREATE TABLE public.marketing_ab_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID REFERENCES public.marketing_ab_tests(id) ON DELETE CASCADE NOT NULL,
  variant_name TEXT NOT NULL,
  headline TEXT,
  primary_text TEXT,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  leads INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  spend NUMERIC DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  cpl NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI Audience suggestions
CREATE TABLE public.marketing_audience_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_type TEXT NOT NULL DEFAULT 'interest',
  name TEXT NOT NULL,
  description TEXT,
  estimated_reach TEXT,
  confidence_score NUMERIC DEFAULT 0,
  source TEXT DEFAULT 'ai_analysis',
  is_applied BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.marketing_generated_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_ab_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_audience_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage marketing_generated_ads" ON public.marketing_generated_ads FOR ALL TO authenticated USING (public.has_current_user_role('admin'::app_role));
CREATE POLICY "Admins manage marketing_ab_tests" ON public.marketing_ab_tests FOR ALL TO authenticated USING (public.has_current_user_role('admin'::app_role));
CREATE POLICY "Admins manage marketing_ab_variants" ON public.marketing_ab_variants FOR ALL TO authenticated USING (public.has_current_user_role('admin'::app_role));
CREATE POLICY "Admins manage marketing_audience_suggestions" ON public.marketing_audience_suggestions FOR ALL TO authenticated USING (public.has_current_user_role('admin'::app_role));

-- END LOCAL BOOTSTRAP 20260305024418_98904e05-4f8f-439d-b52f-3a6058face52.sql

-- BEGIN LOCAL BOOTSTRAP 20260305030244_92f0b990-d8ca-4a86-9e9f-1ba5d47bed9f.sql

-- Trigger 1: Auto-populate marketing_conversions when a lead is created
CREATE OR REPLACE FUNCTION public.on_lead_created_marketing_conversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO marketing_conversions (lead_id, event_name, platform, utm_source, utm_medium, utm_campaign, created_at)
  VALUES (NEW.id, 'LeadCreated', 'website', NULL, NULL, NULL, NOW());
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lead_created_marketing_conversion
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.on_lead_created_marketing_conversion();

-- Trigger 2: Auto-populate marketing_conversions when a contract is signed
CREATE OR REPLACE FUNCTION public.on_contract_signed_marketing_conversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.signature_status = 'signed' AND (OLD.signature_status IS NULL OR OLD.signature_status != 'signed') THEN
    INSERT INTO marketing_conversions (contract_id, client_id, event_name, event_value, platform, created_at)
    VALUES (NEW.id, NEW.user_id, 'ContractSigned', NEW.contract_value, 'website', NOW());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contract_signed_marketing_conversion
AFTER UPDATE OF signature_status ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.on_contract_signed_marketing_conversion();

-- Trigger 3: Auto-populate marketing_conversions when an invoice is paid
CREATE OR REPLACE FUNCTION public.on_invoice_paid_marketing_conversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    INSERT INTO marketing_conversions (invoice_id, client_id, event_name, event_value, platform, created_at)
    VALUES (NEW.id, NEW.user_id, 'PaymentCompleted', NEW.amount, 'website', NOW());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invoice_paid_marketing_conversion
AFTER UPDATE OF status ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.on_invoice_paid_marketing_conversion();

-- END LOCAL BOOTSTRAP 20260305030244_92f0b990-d8ca-4a86-9e9f-1ba5d47bed9f.sql

-- BEGIN LOCAL BOOTSTRAP 20260305192612_9f0d0e72-544e-4948-a08f-f296d86236ef.sql
ALTER TABLE public.brand_processes DROP CONSTRAINT IF EXISTS brand_processes_status_check;

ALTER TABLE public.brand_processes ADD CONSTRAINT brand_processes_status_check CHECK (status IN (
  'em_andamento',
  '003',
  'oposicao',
  'exigencia_merito',
  'deferido',
  'deferimento',
  'indeferido',
  'indeferimento',
  'certificado',
  'renovacao',
  'arquivado',
  'publicado_rpi',
  'em_exame',
  'concedido'
));
-- END LOCAL BOOTSTRAP 20260305192612_9f0d0e72-544e-4948-a08f-f296d86236ef.sql

-- BEGIN LOCAL BOOTSTRAP 20260306045045_f42dea1b-e0ab-4c63-abbe-da822c8828b9.sql

INSERT INTO public.contract_templates (name, content, is_active, variables)
VALUES 
(
  'Contrato Premium - Registro de Marca INPI',
  'CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS DE ASSESSORAMENTO PREMIUM PARA REGISTRO DE MARCA JUNTO AO INPI

Por este instrumento particular de prestação de serviços, que fazem, de um lado:

I) WebMarcas Intelligence PI, com sede na cidade de SÃO PAULO, Estado de SP, na AVENIDA BRIGADEIRO LUIS ANTONIO, Nº: 2696, CEP: 01402-000, inscrita no CNPJ/MF sob o Nº: 39.528.012/0001-29, neste ato representada por seu titular, senhor Davilys Danques de Oliveira Cunha, brasileiro, casado, regularmente inscrito no RG sob o Nº 50.688.779-0 e CPF sob o Nº 393.239.118-79, a seguir denominada CONTRATADA.

II) {{razao_social_ou_nome}}, {{dados_cnpj}}com sede na {{endereco_completo}}, neste ato representada por {{nome_cliente}}, CPF sob o nº {{cpf}}, com endereço de e-mail para faturamento {{email}} e Tel: {{telefone}}, ("Contratante").

As partes celebram o presente Acordo de Tarifas, que se regerá pelas cláusulas e condições abaixo:

1. CLÁUSULA PRIMEIRA – DO OBJETO

1.1 A CONTRATADA prestará os serviços de preparo, protocolo e acompanhamento do pedido de registro da marca "{{marca}}" junto ao INPI até a conclusão do processo, incluindo o cumprimento de todas as exigências, oposições e recursos necessários, no ramo de atividade: {{ramo_atividade}}.

2. CLÁUSULA SEGUNDA – DA RESPONSABILIDADE SOBRE OS SERVIÇOS CONTRATADOS

2.1 Executar os serviços com responsabilidade e qualidade;
2.2 Fornecer cópia digital dos atos praticados junto ao INPI;
2.3 Comunicar à CONTRATANTE eventuais impedimentos ou exigências;
2.4 Acompanhar semanalmente o processo no INPI e informar colidências, exigências ou publicações;
2.5 Garantir o investimento da CONTRATANTE com nova tentativa sem custos adicionais de honorários caso o registro seja negado.

3. CLÁUSULA TERCEIRA - DAS OBRIGAÇÕES GERAIS DA CONTRATADA

3.1 Enviar cópias digitais por e-mail e relatório anual do processo;
3.2 Executar os serviços conforme o contrato e a legislação;
3.3 Cumprir prazos e exigências do INPI;
3.4 Comunicar impedimentos imediatamente, a fim de cumprir as normas do INPI para garantir o registro.

4. CLÁUSULA QUARTA – DAS OBRIGAÇÕES GERAIS DA CONTRATANTE

4.1 A CONTRATANTE obriga-se a efetuar os pagamentos na forma, prazos e condições estabelecidas neste instrumento.
4.2 A CONTRATANTE compromete-se a fornecer à CONTRATADA todas as informações, documentos e materiais solicitados, de forma completa e dentro dos prazos estipulados.
4.3 A CONTRATANTE poderá solicitar ajustes ou correções nos serviços prestados somente quando houver divergência comprovada com o objeto deste contrato.
4.4 A CONTRATANTE reconhece que a CONTRATADA atua como assessoria técnica e jurídica especializada, sendo que a decisão final sobre a concessão do registro de marca cabe exclusivamente ao INPI.

5. CLÁUSULA QUINTA – DAS CONDIÇÕES DE PAGAMENTO

5.1 Os pagamentos à CONTRATADA serão efetuados mediante assinatura mensal recorrente no valor de R$ 398,00 (trezentos e noventa e oito reais), cobrada automaticamente via cartão de crédito, com vigência a partir da data de assinatura deste contrato.
5.2 Taxas do INPI e anuidade: As taxas federais obrigatórias (GRU) serão de responsabilidade exclusiva do CONTRATANTE, devendo ser recolhidas diretamente ao INPI e a taxa de anuidade valor de R$398,00 a ser paga sempre do 05/12 de cada ano. Após essas etapas, o requerente receberá o certificado de registro válido por 10 anos, com direito à renovação.
5.3 O cadastro do CONTRATANTE junto ao INPI é realizado pela CONTRATADA previamente ao pagamento das taxas federais.
5.4 O atraso no pagamento da mensalidade implicará em acréscimo de multa e juros conforme cláusula sétima.

6. CLÁUSULA SEXTA – DO PRAZO DE VIGÊNCIA

6.1 O presente contrato terá vigência a partir da data de sua assinatura e perdurará até o final do decênio de registro de marca junto ao INPI, podendo ser renovado mediante termo aditivo.

7. CLÁUSULA SÉTIMA – DA INADIMPLÊNCIA

7.1 No caso de inadimplência, a CONTRATANTE estará sujeita a:
a) Multa de 10% (dez por cento) sobre o valor total devido;
b) Juros de mora de 1% (um por cento) ao mês;
c) Correção monetária pelo IGPM/FGV;
d) Suspensão imediata dos serviços até a regularização do débito;
e) Inscrição em cadastros de proteção ao crédito após 30 dias de inadimplência.

8. CLÁUSULA OITAVA – DA CONFIDENCIALIDADE

8.1 As partes se comprometem a manter em sigilo absoluto todas as informações confidenciais trocadas durante a execução do contrato, incluindo dados pessoais, comerciais e estratégicos.
8.2 Esta obrigação de confidencialidade permanecerá vigente por prazo indeterminado, mesmo após o término deste contrato.

9. CLÁUSULA NONA – DA RESCISÃO

9.1 Este contrato poderá ser rescindido por qualquer das partes mediante aviso prévio de 30 (trinta) dias, por escrito.
9.2 A CONTRATANTE somente poderá cancelar o contrato se não houver débitos pendentes com a CONTRATADA.
9.3 Em caso de rescisão antecipada por iniciativa da CONTRATANTE, não haverá devolução de valores já pagos referentes a serviços executados ou em andamento.

10. CLÁUSULA DÉCIMA – DAS CONDIÇÕES GERAIS

10.1 Fica pactuada entre as partes a prestação dos serviços de acompanhamento e vigilância do(s) processo(s) referentes à marca {{marca}}.
10.2 Durante a tramitação do processo junto ao INPI, poderão surgir situações que exijam a apresentação de documentos adicionais, os quais deverão ser providenciados pela CONTRATANTE em tempo hábil.
10.3 A CONTRATADA se compromete a cumprir todas as exigências, oposições e recursos necessários sem custo adicional de honorários, estando estes já contemplados na mensalidade do Plano Premium. O recolhimento das taxas federais (GRU) será de responsabilidade da CONTRATANTE e deverá ser realizado conforme a liberação dos respectivos despachos publicados na Revista da Propriedade Industrial (RPI).

11. CLÁUSULA DÉCIMA PRIMEIRA – DAS DISPOSIÇÕES FINAIS

11.1 Este contrato representa o acordo integral entre as partes, substituindo quaisquer negociações ou acordos anteriores, verbais ou escritos.
11.2 A tolerância de uma das partes quanto ao descumprimento de qualquer obrigação pela outra não implica novação ou renúncia de direitos.
11.3 Qualquer alteração deste contrato somente será válida se formalizada por escrito e assinada por ambas as partes.

12. CLÁUSULA DÉCIMA SEGUNDA – DO FORO

12.1 Para dirimir quaisquer dúvidas ou controvérsias oriundas do presente instrumento, as partes elegem o Foro da Comarca de São Paulo – SP, com renúncia expressa a qualquer outro, por mais privilegiado que seja.

Por estarem justas e contratadas, as partes assinam o presente instrumento em 02 (duas) vias de igual teor e forma, na presença das testemunhas abaixo.

São Paulo, {{data_extenso}}.

CONTRATADA:
WebMarcas Intelligence PI
CNPJ: 39.528.012/0001-29

CONTRATANTE:
{{nome_cliente}}
CPF/CNPJ: {{cpf_cnpj}}',
  true,
  '["nome_cliente","cpf","cpf_cnpj","email","telefone","razao_social_ou_nome","dados_cnpj","endereco_completo","marca","ramo_atividade","data_extenso","forma_pagamento_detalhada"]'::jsonb
),
(
  'Contrato Corporativo - Registro de Marca INPI',
  'CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS CORPORATIVO PARA REGISTRO DE MARCA JUNTO AO INPI

Por este instrumento particular de prestação de serviços, que fazem, de um lado:

I) WebMarcas Intelligence PI, com sede na cidade de SÃO PAULO, Estado de SP, na AVENIDA BRIGADEIRO LUIS ANTONIO, Nº: 2696, CEP: 01402-000, inscrita no CNPJ/MF sob o Nº: 39.528.012/0001-29, neste ato representada por seu titular, senhor Davilys Danques de Oliveira Cunha, brasileiro, casado, regularmente inscrito no RG sob o Nº 50.688.779-0 e CPF sob o Nº 393.239.118-79, a seguir denominada CONTRATADA.

II) {{razao_social_ou_nome}}, {{dados_cnpj}}com sede na {{endereco_completo}}, neste ato representada por {{nome_cliente}}, CPF sob o nº {{cpf}}, com endereço de e-mail para faturamento {{email}} e Tel: {{telefone}}, ("Contratante").

As partes celebram o presente Acordo de Tarifas, que se regerá pelas cláusulas e condições abaixo:

1. CLÁUSULA PRIMEIRA – DO OBJETO

1.1 A CONTRATADA prestará os serviços de preparo, protocolo e acompanhamento de registros de marcas ilimitados junto ao INPI até a conclusão dos processos, incluindo o cumprimento de todas as exigências, oposições e recursos necessários, no ramo de atividade: {{ramo_atividade}}.

2. CLÁUSULA SEGUNDA – DA RESPONSABILIDADE SOBRE OS SERVIÇOS CONTRATADOS

2.1 Executar os serviços com responsabilidade e qualidade;
2.2 Fornecer cópia digital dos atos praticados junto ao INPI;
2.3 Comunicar à CONTRATANTE eventuais impedimentos ou exigências;
2.4 Acompanhar semanalmente o processo no INPI e informar colidências, exigências ou publicações;
2.5 Garantir o investimento da CONTRATANTE com nova tentativa sem custos adicionais de honorários caso o registro seja negado.

3. CLÁUSULA TERCEIRA - DAS OBRIGAÇÕES GERAIS DA CONTRATADA

3.1 Enviar cópias digitais por e-mail e relatório anual do processo;
3.2 Executar os serviços conforme o contrato e a legislação;
3.3 Cumprir prazos e exigências do INPI;
3.4 Comunicar impedimentos imediatamente, a fim de cumprir as normas do INPI para garantir o registro.

4. CLÁUSULA QUARTA – DAS OBRIGAÇÕES GERAIS DA CONTRATANTE

4.1 A CONTRATANTE obriga-se a efetuar os pagamentos na forma, prazos e condições estabelecidas neste instrumento.
4.2 A CONTRATANTE compromete-se a fornecer à CONTRATADA todas as informações, documentos e materiais solicitados, de forma completa e dentro dos prazos estipulados.
4.3 A CONTRATANTE poderá solicitar ajustes ou correções nos serviços prestados somente quando houver divergência comprovada com o objeto deste contrato.
4.4 A CONTRATANTE reconhece que a CONTRATADA atua como assessoria técnica e jurídica especializada, sendo que a decisão final sobre a concessão do registro de marca cabe exclusivamente ao INPI.

5. CLÁUSULA QUINTA – DAS CONDIÇÕES DE PAGAMENTO

5.1 Os pagamentos à CONTRATADA serão efetuados mediante assinatura mensal recorrente no valor de R$ 1.194,00 (mil cento e noventa e quatro reais), cobrada automaticamente via cartão de crédito, com vigência a partir da data de assinatura deste contrato.
5.2 Taxas do INPI e anuidade: As taxas federais obrigatórias (GRU) serão de responsabilidade exclusiva do CONTRATANTE, devendo ser recolhidas diretamente ao INPI e a taxa de anuidade valor de R$1.194,00 a ser paga sempre do 05/12 de cada ano. Após essas etapas, o requerente receberá o certificado de registro válido por 10 anos, com direito à renovação.
5.3 O cadastro do CONTRATANTE junto ao INPI é realizado pela CONTRATADA previamente ao pagamento das taxas federais.
5.4 O atraso no pagamento da mensalidade implicará em acréscimo de multa e juros conforme cláusula sétima.

6. CLÁUSULA SEXTA – DO PRAZO DE VIGÊNCIA

6.1 O presente contrato terá vigência a partir da data de sua assinatura e perdurará até o final do decênio de registro de marca junto ao INPI, podendo ser renovado mediante termo aditivo.

7. CLÁUSULA SÉTIMA – DA INADIMPLÊNCIA

7.1 No caso de inadimplência, a CONTRATANTE estará sujeita a:
a) Multa de 10% (dez por cento) sobre o valor total devido;
b) Juros de mora de 1% (um por cento) ao mês;
c) Correção monetária pelo IGPM/FGV;
d) Suspensão imediata dos serviços até a regularização do débito;
e) Inscrição em cadastros de proteção ao crédito após 30 dias de inadimplência.

8. CLÁUSULA OITAVA – DA CONFIDENCIALIDADE

8.1 As partes se comprometem a manter em sigilo absoluto todas as informações confidenciais trocadas durante a execução do contrato, incluindo dados pessoais, comerciais e estratégicos.
8.2 Esta obrigação de confidencialidade permanecerá vigente por prazo indeterminado, mesmo após o término deste contrato.

9. CLÁUSULA NONA – DA RESCISÃO

9.1 Este contrato poderá ser rescindido por qualquer das partes mediante aviso prévio de 30 (trinta) dias, por escrito.
9.2 A CONTRATANTE somente poderá cancelar o contrato se não houver débitos pendentes com a CONTRATADA.
9.3 Em caso de rescisão antecipada por iniciativa da CONTRATANTE, não haverá devolução de valores já pagos referentes a serviços executados ou em andamento.

10. CLÁUSULA DÉCIMA – DAS CONDIÇÕES GERAIS

10.1 Fica pactuada entre as partes a prestação dos serviços de acompanhamento e vigilância do(s) processo(s) referentes à marca {{marca}}.
10.2 Durante a tramitação do processo junto ao INPI, poderão surgir situações que exijam a apresentação de documentos adicionais, os quais deverão ser providenciados pela CONTRATANTE em tempo hábil.
10.3 A CONTRATADA se compromete a cumprir todas as exigências, oposições e recursos necessários sem custo adicional de honorários, estando estes já contemplados na mensalidade do Plano Corporativo. O recolhimento das taxas federais (GRU) será de responsabilidade da CONTRATANTE e deverá ser realizado conforme a liberação dos respectivos despachos publicados na Revista da Propriedade Industrial (RPI).
10.4 O Plano Corporativo contempla registros de marcas ilimitados, vinculados exclusivamente ao CPF ou CNPJ do CONTRATANTE que realizou a contratação. Todas as marcas registradas sob este plano deverão ser tituladas no mesmo CPF ou CNPJ cadastrado. Caso o CONTRATANTE deseje registrar marcas em outro CPF ou CNPJ, deverá contratar um novo plano específico para tal finalidade.

11. CLÁUSULA DÉCIMA PRIMEIRA – DAS DISPOSIÇÕES FINAIS

11.1 Este contrato representa o acordo integral entre as partes, substituindo quaisquer negociações ou acordos anteriores, verbais ou escritos.
11.2 A tolerância de uma das partes quanto ao descumprimento de qualquer obrigação pela outra não implica novação ou renúncia de direitos.
11.3 Qualquer alteração deste contrato somente será válida se formalizada por escrito e assinada por ambas as partes.

12. CLÁUSULA DÉCIMA SEGUNDA – DO FORO

12.1 Para dirimir quaisquer dúvidas ou controvérsias oriundas do presente instrumento, as partes elegem o Foro da Comarca de São Paulo – SP, com renúncia expressa a qualquer outro, por mais privilegiado que seja.

Por estarem justas e contratadas, as partes assinam o presente instrumento em 02 (duas) vias de igual teor e forma, na presença das testemunhas abaixo.

São Paulo, {{data_extenso}}.

CONTRATADA:
WebMarcas Intelligence PI
CNPJ: 39.528.012/0001-29

CONTRATANTE:
{{nome_cliente}}
CPF/CNPJ: {{cpf_cnpj}}',
  true,
  '["nome_cliente","cpf","cpf_cnpj","email","telefone","razao_social_ou_nome","dados_cnpj","endereco_completo","marca","ramo_atividade","data_extenso","forma_pagamento_detalhada"]'::jsonb
);

-- END LOCAL BOOTSTRAP 20260306045045_f42dea1b-e0ab-4c63-abbe-da822c8828b9.sql

-- BEGIN LOCAL BOOTSTRAP 20260309185813_6ebb1b23-8a0e-4553-9f35-b40e8f9433b4.sql

ALTER TABLE public.brand_processes DROP CONSTRAINT IF EXISTS brand_processes_status_check;
ALTER TABLE public.brand_processes ADD CONSTRAINT brand_processes_status_check CHECK (pipeline_stage IS NULL OR pipeline_stage IN ('protocolado', '003', 'oposicao', 'exigencia_merito', 'exigencia_de_mrito', 'indeferimento', 'notificacao', 'deferimento', 'certificados', 'certificado', 'renovacao', 'distrato', 'assinou_contrato', 'pagamento_ok', 'pagou_taxa', 'taxa_inpi_paga', 'em_andamento', 'depositada', 'arquivado'));

-- END LOCAL BOOTSTRAP 20260309185813_6ebb1b23-8a0e-4553-9f35-b40e8f9433b4.sql

-- BEGIN LOCAL BOOTSTRAP 20260309193920_c5c50d91-7114-4a24-b041-e65d21d68125.sql
UPDATE system_settings 
SET value = jsonb_set(
  value,
  '{stages}',
  (
    SELECT jsonb_agg(
      CASE 
        WHEN elem->>'id' = 'exigencia_de_mrito' 
        THEN jsonb_set(elem, '{id}', '"exigencia_merito"')
        ELSE elem
      END
    )
    FROM jsonb_array_elements(value->'stages') elem
  )
)
WHERE key = 'admin_kanban_juridico_stages';
-- END LOCAL BOOTSTRAP 20260309193920_c5c50d91-7114-4a24-b041-e65d21d68125.sql

-- BEGIN LOCAL BOOTSTRAP 20260310192311_f5697147-6a6b-459e-9930-accc5c349771.sql
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
-- END LOCAL BOOTSTRAP 20260310192311_f5697147-6a6b-459e-9930-accc5c349771.sql

-- BEGIN LOCAL BOOTSTRAP 20260310194347_94868519-5719-468b-b58f-f8a06b3c2e29.sql
-- Remove orphan publicações (no client linked) — these should never exist in the Kanban
DELETE FROM publicacoes_marcas WHERE client_id IS NULL;
-- END LOCAL BOOTSTRAP 20260310194347_94868519-5719-468b-b58f-f8a06b3c2e29.sql

-- BEGIN LOCAL BOOTSTRAP 20260311194250_e543bce7-fc97-484a-911d-07fc9ca31539.sql
ALTER TABLE public.inpi_resources DROP CONSTRAINT IF EXISTS inpi_resources_resource_type_check;

ALTER TABLE public.inpi_resources
ADD CONSTRAINT inpi_resources_resource_type_check
CHECK (
  resource_type = ANY (
    ARRAY[
      'indeferimento'::text,
      'exigencia_merito'::text,
      'oposicao'::text,
      'notificacao_extrajudicial'::text,
      'troca_procurador'::text,
      'nomeacao_procurador'::text
    ]
  )
);
-- END LOCAL BOOTSTRAP 20260311194250_e543bce7-fc97-484a-911d-07fc9ca31539.sql

-- BEGIN LOCAL BOOTSTRAP 20260313011616_f0fa0998-a9a8-4878-825d-6f3bb6b219d0.sql

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

-- END LOCAL BOOTSTRAP 20260313011616_f0fa0998-a9a8-4878-825d-6f3bb6b219d0.sql

-- BEGIN LOCAL BOOTSTRAP 20260313225732_c482271d-653d-48fd-8d4e-1ef9a0d113c7.sql

-- Add new columns to email_inbox for full content support
ALTER TABLE email_inbox ADD COLUMN IF NOT EXISTS imap_uid integer;
ALTER TABLE email_inbox ADD COLUMN IF NOT EXISTS snippet text;
ALTER TABLE email_inbox ADD COLUMN IF NOT EXISTS has_attachments boolean DEFAULT false;
ALTER TABLE email_inbox ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;
ALTER TABLE email_inbox ADD COLUMN IF NOT EXISTS body_fetched_at timestamptz;

-- Performance index
CREATE INDEX IF NOT EXISTS idx_email_inbox_account_folder_received ON email_inbox(account_id, folder, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_inbox_needs_hydration ON email_inbox(body_fetched_at) WHERE body_fetched_at IS NULL;

-- Storage bucket for email attachments (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('email-attachments', 'email-attachments', false) ON CONFLICT DO NOTHING;

-- RLS policies for email-attachments bucket
CREATE POLICY "Authenticated users can upload email attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'email-attachments');
CREATE POLICY "Authenticated users can read email attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'email-attachments');

-- END LOCAL BOOTSTRAP 20260313225732_c482271d-653d-48fd-8d4e-1ef9a0d113c7.sql

-- BEGIN LOCAL BOOTSTRAP 20260321213216_395c85e5-fa67-407a-af7f-f6ccb7b8e104.sql
UPDATE contract_templates 
SET content = E'Pelo presente instrumento particular de distrato, de um lado:\n\nI) WebMarcas Intelligence PI, pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o Nº: 39.528.012/0001-29, com sede na cidade de SÃO PAULO, Estado de SP, na Av. Brigadeiro Luís Antônio, 2696 - andar 2, sala 202 - Jardim Paulista, CEP: 01402-000, doravante denominada CONTRATADA;\n\nE, de outro lado:\n\nII) {{nome_empresa}}, com sede na {{endereco_empresa}}, na cidade de {{cidade}}, estado de {{estado}}, CEP {{cep}}, inscrita no CNPJ sob nº {{cnpj}}, neste ato representada por {{nome_representante}}, CPF sob o nº {{cpf_representante}}, com endereço de e-mail para faturamento {{email}} e Tel: {{telefone}}, doravante denominada CONTRATANTE.\n\nAs partes acima qualificadas, em comum e recíproco acordo, resolvem, por este instrumento e na melhor forma de direito, DISTRATAR o Contrato de Prestação de Serviços celebrado para preparo de depósito de registro de marca junto ao INSTITUTO NACIONAL DA PROPRIEDADE INDUSTRIAL, referente à marca {{marca}}, bem como o acompanhamento e supervisão do processo até sua fase processual seguinte, doravante denominado \"Contrato Original\", mediante as cláusulas e condições seguintes:\n\nCLÁUSULA PRIMEIRA – DO OBJETO DO DISTRATO E CONDIÇÕES DE RESCISÃO\n\n1.1. O presente instrumento tem como objeto o distrato do Contrato Original, celebrado entre as partes, que tinha como fundamento a prestação de serviços de preparo e depósito de registro de marca junto ao INSTITUTO NACIONAL DA PROPRIEDADE INDUSTRIAL, referente à marca {{marca}}, bem como o acompanhamento e supervisão do processo até sua fase processual seguinte.\n\n1.2. As partes, de forma livre e espontânea, e no pleno exercício de suas faculdades, declaram dissolver, a partir da data de assinatura deste distrato, todos os direitos e obrigações decorrentes do Contrato Original. Fica expressamente acordado que, em virtude do cancelamento, haverá um ônus financeiro correspondente ao valor de {{numero_parcelas}} parcela(s) de R$ {{valor_multa}}. A falta de pagamento deste ônus implicará na cobrança do valor total do serviço contratado, sujeito a protesto e demais medidas legais cabíveis.\n\n1.3. As partes declaram que, com a assinatura do presente distrato, o Contrato Original é considerado integralmente cumprido e extinto, ressalvadas as obrigações financeiras expressamente previstas neste instrumento, não havendo quaisquer outras pendências recíprocas, sejam elas financeiras, contratuais, ou de qualquer outra ordem, exceto as aqui estabelecidas.\n\n1.4. Este Distrato passa a vigorar entre as partes a partir da data de sua assinatura, independentemente do estágio de desenvolvimento financeiro ou jurídico das partes.\n\nCLÁUSULA SEGUNDA – DA QUITAÇÃO PLENA, IRREVOGÁVEL E IRRETRATÁVEL\n\n2.1. A CONTRATANTE, por este ato, concede à CONTRATADA, e esta à CONTRATANTE, a mais ampla, geral, rasa, plena, irrevogável e irretratável quitação de todas e quaisquer obrigações, direitos, deveres, créditos, débitos, responsabilidades, indenizações, multas, penalidades, perdas e danos, de qualquer natureza, presentes ou futuras, decorrentes ou relacionadas ao Contrato Original, para nada mais reclamar, a qualquer título e a qualquer tempo, judicial ou extrajudicialmente, ressalvadas as obrigações financeiras expressamente estabelecidas na Cláusula Primeira deste distrato.\n\n2.2. O presente distrato é celebrado em caráter irretratável e irrevogável, obrigando as partes por si, seus herdeiros e sucessores, a qualquer tempo e grau de desenvolvimento financeiro ou jurídico, não sendo admitida qualquer alegação de vício de consentimento, erro, dolo, coação, simulação ou fraude, para fins de sua anulação ou revisão.\n\nCLÁUSULA TERCEIRA – DA VEDAÇÃO A RECLAMAÇÕES E MEDIDAS ADVERSAS\n\n3.1. A CONTRATANTE, ao assinar o presente instrumento, reconhece e concorda expressamente que, em virtude da quitação plena, irrevogável e irretratável concedida na Cláusula Segunda, NÃO PODERÁ propor, iniciar, dar continuidade ou participar de qualquer tipo de reclamação, ação judicial, procedimento administrativo, queixa, denúncia, ou qualquer outra medida, de qualquer natureza, que vise a discutir, questionar, ou imputar responsabilidade à CONTRATADA, seus sócios, administradores, empregados, prepostos ou representantes, por fatos, atos ou omissões ocorridos durante a vigência ou em decorrência do Contrato Original, ressalvadas as obrigações financeiras expressamente estabelecidas na Cláusula Primeira deste distrato.\n\n3.2. A CONTRATANTE se compromete a abster-se de qualquer conduta que possa, direta ou indiretamente, causar prejuízo à imagem, reputação, bom nome, ou quaisquer outros direitos da CONTRATADA, de seus sócios, administradores, empregados, prepostos ou representantes, sob pena de responder por perdas e danos, sem prejuízo das demais medidas legais cabíveis.\n\nCLÁUSULA QUARTA – DA CONFIDENCIALIDADE\n\n4.1. As partes comprometem-se a manter sigilo e confidencialidade sobre todas as informações e termos do presente distrato, bem como sobre quaisquer informações comerciais, técnicas ou estratégicas da outra parte, que tenham tido acesso em razão do Contrato Original e deste distrato, sob pena de responderem por perdas e danos.\n\nCLÁUSULA QUINTA – DA INDEPENDÊNCIA DAS CLÁUSULAS\n\n5.1. Caso qualquer disposição deste distrato seja considerada inválida, ilegal ou inexequível em qualquer jurisdição, tal invalidade, ilegalidade ou inexequibilidade não afetará a validade, legalidade ou exequibilidade das demais disposições deste distrato, nem a validade, legalidade ou exequibilidade de tal disposição em qualquer outra jurisdição.\n\nCLÁUSULA SEXTA – DA LEGISLAÇÃO APLICÁVEL E ELEIÇÃO DE FORO\n\n6.1. O presente distrato será regido e interpretado de acordo com as leis da República Federativa do Brasil.\n\n6.2. Fica eleito o Foro da Comarca de São Paulo, Estado de São Paulo, para dirimir quaisquer dúvidas ou litígios oriundos do presente distrato, com expressa renúncia a qualquer outro, por mais privilegiado que seja.\n\nPor estarem justas e contratadas, as partes assinam o presente de igual teor e forma, de forma digital válida juridicamente.\n\nSão Paulo, {{data_distrato}}.\n\n{contract_signature}',
    variables = '["{{nome_empresa}}", "{{endereco_empresa}}", "{{cidade}}", "{{estado}}", "{{cep}}", "{{cnpj}}", "{{nome_representante}}", "{{cpf_representante}}", "{{email}}", "{{telefone}}", "{{marca}}", "{{numero_parcelas}}", "{{valor_multa}}", "{{data_distrato}}"]'::jsonb,
    updated_at = now()
WHERE name = 'Distrato com Multa - Padrão';

UPDATE contract_templates 
SET content = E'Pelo presente instrumento particular de distrato, de um lado:\n\nI) WebMarcas Intelligence PI, pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o Nº: 39.528.012/0001-29, com sede na cidade de SÃO PAULO, Estado de SP, na Av. Brigadeiro Luís Antônio, 2696 - andar 2, sala 202 - Jardim Paulista, CEP: 01402-000, doravante denominada CONTRATADA;\n\nE, de outro lado:\n\nII) {{nome_empresa}}, com sede na {{endereco_empresa}}, na cidade de {{cidade}}, estado de {{estado}}, CEP {{cep}}, inscrita no CNPJ sob nº {{cnpj}}, neste ato representada por {{nome_representante}}, CPF sob o nº {{cpf_representante}}, com endereço de e-mail para faturamento {{email}} e Tel: {{telefone}}, doravante denominada CONTRATANTE.\n\nAs partes acima qualificadas, em comum e recíproco acordo, resolvem, por este instrumento e na melhor forma de direito, DISTRATAR o Contrato de Prestação de Serviços celebrado para preparo de depósito de registro de marca junto ao INSTITUTO NACIONAL DA PROPRIEDADE INDUSTRIAL, referente à marca {{marca}}, bem como o acompanhamento e supervisão do processo até sua fase processual seguinte, doravante denominado \"Contrato Original\", mediante as cláusulas e condições seguintes:\n\nCLÁUSULA PRIMEIRA – DO OBJETO DO DISTRATO\n\n1.1. O presente instrumento tem como objeto o distrato do Contrato Original, celebrado entre as partes, que tinha como fundamento a prestação de serviços de preparo e depósito de registro de marca junto ao INSTITUTO NACIONAL DA PROPRIEDADE INDUSTRIAL, referente à marca {{marca}}, bem como o acompanhamento e supervisão do processo até sua fase processual seguinte.\n\n1.2. As partes, de forma livre e espontânea, e no pleno exercício de suas faculdades, declaram dissolver, a partir da data de assinatura deste distrato, todos os direitos e obrigações decorrentes do Contrato Original, de modo que não subsistam quaisquer resquícios de ônus financeiro, obrigacional, ou de qualquer outra natureza, relativos ao referido contrato.\n\nCLÁUSULA SEGUNDA – DA QUITAÇÃO PLENA, IRREVOGÁVEL E IRRETRATÁVEL\n\n2.1. A CONTRATANTE, por este ato, concede à CONTRATADA, e esta à CONTRATANTE, a mais ampla, geral, rasa, plena, irrevogável e irretratável quitação de todas e quaisquer obrigações, direitos, deveres, créditos, débitos, responsabilidades, indenizações, multas, penalidades, perdas e danos, de qualquer natureza, presentes ou futuras, decorrentes ou relacionadas ao Contrato Original, para nada mais reclamar, a qualquer título e a qualquer tempo, judicial ou extrajudicialmente.\n\n2.2. As partes declaram, expressamente, que, com a assinatura do presente distrato, o Contrato Original é considerado integralmente cumprido e extinto, não havendo quaisquer pendências recíprocas, sejam elas financeiras, contratuais, ou de qualquer outra ordem.\n\n2.3. O presente distrato é celebrado em caráter irretratável e irrevogável, obrigando as partes por si, seus herdeiros e sucessores, a qualquer tempo e grau de desenvolvimento financeiro ou jurídico, não sendo admitida qualquer alegação de vício de consentimento, erro, dolo, coação, simulação ou fraude, para fins de sua anulação ou revisão.\n\nCLÁUSULA TERCEIRA – DA VEDAÇÃO A RECLAMAÇÕES E MEDIDAS ADVERSAS\n\n3.1. A CONTRATANTE, ao assinar o presente instrumento, reconhece e concorda expressamente que, em virtude da quitação plena, irrevogável e irretratável concedida na Cláusula Segunda, NÃO PODERÁ propor, iniciar, dar continuidade ou participar de qualquer tipo de reclamação, ação judicial, procedimento administrativo, queixa, denúncia, ou qualquer outra medida, de qualquer natureza, que vise a discutir, questionar, ou imputar responsabilidade à CONTRATADA, seus sócios, administradores, empregados, prepostos ou representantes, por fatos, atos ou omissões ocorridos durante a vigência ou em decorrência do Contrato Original.\n\n3.2. A CONTRATANTE se compromete a abster-se de qualquer conduta que possa, direta ou indiretamente, causar prejuízo à imagem, reputação, bom nome, ou quaisquer outros direitos da CONTRATADA, de seus sócios, administradores, empregados, prepostos ou representantes, sob pena de responder por perdas e dan
