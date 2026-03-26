
-- Tabela de base de conhecimento automática do INPI
CREATE TABLE IF NOT EXISTS public.inpi_knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL, -- 'taxas', 'prazos', 'despachos', 'resolucoes', 'circulares', 'manual', 'jurisprudencia', 'noticias'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_url TEXT,
  source_date DATE,
  valid_until DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER DEFAULT 5, -- 1 = crítico, 10 = baixo
  tags TEXT[] DEFAULT '{}',
  raw_html TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de log de sincronizações com INPI
CREATE TABLE IF NOT EXISTS public.inpi_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled' | 'manual'
  status TEXT NOT NULL DEFAULT 'running', -- 'running' | 'success' | 'partial' | 'failed'
  categories_synced TEXT[] DEFAULT '{}',
  items_created INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  details JSONB DEFAULT '{}',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_inpi_knowledge_category ON public.inpi_knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_inpi_knowledge_active ON public.inpi_knowledge_base(is_active);
CREATE INDEX IF NOT EXISTS idx_inpi_knowledge_priority ON public.inpi_knowledge_base(priority);
CREATE INDEX IF NOT EXISTS idx_inpi_sync_logs_started ON public.inpi_sync_logs(started_at DESC);

-- RLS
ALTER TABLE public.inpi_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inpi_sync_logs ENABLE ROW LEVEL SECURITY;

-- Políticas: admins gerenciam, edge functions inserem via service role
CREATE POLICY "Admins can manage inpi knowledge base"
  ON public.inpi_knowledge_base
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone authenticated can read inpi knowledge base"
  ON public.inpi_knowledge_base
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

CREATE POLICY "Service role can insert inpi knowledge"
  ON public.inpi_knowledge_base
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update inpi knowledge"
  ON public.inpi_knowledge_base
  FOR UPDATE
  USING (true);

CREATE POLICY "Admins can view sync logs"
  ON public.inpi_sync_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage sync logs"
  ON public.inpi_sync_logs
  FOR ALL
  WITH CHECK (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_inpi_knowledge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_inpi_knowledge_base_updated_at
  BEFORE UPDATE ON public.inpi_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION public.update_inpi_knowledge_updated_at();

-- Seed inicial com dados sempre atuais de 2026 (informações fixas que vêm do site INPI)
INSERT INTO public.inpi_knowledge_base (category, title, content, source_url, source_date, priority, tags) VALUES
(
  'taxas',
  'Tabela de Taxas INPI 2025-2026 (Resolução INPI/PR nº 262/2024)',
  'TAXAS OFICIAIS INPI VIGENTES 2025-2026 (Resolução INPI/PR nº 262/2024):

  PEDIDO DE REGISTRO DE MARCA:
  - Pessoa Natural / Micro / MEI: R$ 142,00 por classe (com redução 60%)
  - Pessoa Jurídica Normal: R$ 355,00 por classe
  - Entidade sem fins lucrativos / EPP: R$ 213,00 por classe

  RECURSO ADMINISTRATIVO (Art. 212 LPI):
  - Interposição de recurso: R$ 475,00

  CONCESSÃO DE REGISTRO:
  - Pessoa Natural / Micro / MEI: R$ 298,00 (com redução 60%)
  - Pessoa Jurídica Normal: R$ 745,00

  PRORROGAÇÃO DE REGISTRO:
  - Pessoa Natural / Micro / MEI: R$ 449,00 (com redução 60%)
  - Pessoa Jurídica Normal: R$ 1.122,00

  OPOSIÇÃO:
  - Interposição de oposição: R$ 475,00

  LICENÇA / CESSÃO:
  - Anotação de licença ou cessão: R$ 142,00
  
  OBSERVAÇÃO: As reduções de 60% são aplicadas automaticamente para pessoas físicas, MEI, microempresas e EPPs. Para aplicar a redução, o requerente deve declarar seu enquadramento no formulário de pedido.',
  'https://www.gov.br/inpi/pt-br/servicos/marcas/taxas',
  '2025-01-01',
  1,
  ARRAY['taxas', 'valores', '2025', '2026', 'resolucao']
),
(
  'prazos',
  'Prazos Legais e Processuais INPI 2026',
  'PRAZOS PROCESSUAIS VIGENTES NO INPI (Lei 9.279/96 + Manual de Marcas):

  EXAME DE MÉRITO:
  - Prazo médio para exame: 18 a 36 meses (depende da classe e volume)
  - Classes mais rápidas: serviços (26-30 meses)
  - Classes mais lentas: produtos (30-40 meses)

  RECURSO ADMINISTRATIVO (Art. 212 LPI):
  - Prazo para interpor recurso: 60 dias corridos após publicação na RPI
  - Contagem: inicia no dia seguinte à publicação
  - Sem prorrogação; prazo peremptório
  - Após recurso: 5 dias para intimação dos interessados apresentarem contrarrazões (60 dias)

  OPOSIÇÃO (Art. 158 LPI):
  - Prazo para oposição: 60 dias corridos após publicação do pedido deferido/indeferido para manifestação
  - Manifestação à oposição: 60 dias após intimação

  EXIGÊNCIA (Art. 157 LPI):
  - Prazo para atender exigência: 60 dias (pode ser prorrogado por igual período mediante petição)
  - Não atendimento: arquivamento do pedido

  NULIDADE ADMINISTRATIVA (Art. 168 LPI):
  - Pode ser requerida pelo INPI a qualquer tempo ou por interessado em até 180 dias da concessão

  EXTINÇÃO DO REGISTRO (Art. 142 LPI):
  - Registro vigente por 10 anos, renovável por períodos iguais e sucessivos
  - Prazo para solicitar prorrogação: até 6 meses antes do vencimento
  - Prorrogação em até 6 meses após vencimento (com adicional de 20% na taxa)',
  'https://www.gov.br/inpi/pt-br/servicos/marcas/prazos-e-procedimentos',
  '2025-01-01',
  1,
  ARRAY['prazos', 'recurso', 'oposição', 'exigencia', 'procedimentos']
),
(
  'despachos',
  'Tabela de Códigos de Despacho INPI mais comuns 2026',
  'PRINCIPAIS CÓDIGOS DE DESPACHO INPI (Revista da Propriedade Industrial - RPI):

  DESPACHOS FAVORÁVEIS:
  - IPPM7.1 / DEXP1.1: Depósito efetuado
  - IPPM17.1: Deferido (aprovado para registro)
  - IPPM18.1: Registro concedido
  - IPPM19.1: Prazo para pagamento da taxa de concessão
  - IPPM20.1: Prorrogação concedida

  DESPACHOS DE EXIGÊNCIA:
  - IPPM6.1: Exigência formal (documentação incompleta)
  - IPPM6.2: Exigência de mérito (questão técnica sobre a marca)
  - Prazo resposta: 60 dias corridos

  DESPACHOS DE INDEFERIMENTO:
  - IPPM8.1: Indeferimento – Marca não registrável (Art. 124 LPI)
  - IPPM8.2: Indeferimento – Marca de alto renome / famosa
  - IPPM8.3: Indeferimento – Colidência com marca registrada anterior
  - IPPM9.1: Arquivamento por não atendimento de exigência
  - IPPM10.1: Extinção do registro por caducidade
  
  DESPACHOS DE RECURSO / OPOSIÇÃO:
  - IPPM22.1: Recurso interposto
  - IPPM22.2: Recurso provido (favorável ao recorrente)
  - IPPM22.3: Recurso não provido (mantém indeferimento)
  - IPPM23.1: Oposição apresentada
  - IPPM24.1: Manifestação à oposição

  OUTROS:
  - IPPM25.1: Cessão anotada
  - IPPM26.1: Licença anotada
  - IPPM27.1: Cancelamento a pedido do titular',
  'https://www.gov.br/inpi/pt-br/servicos/marcas/despachos',
  '2025-01-01',
  2,
  ARRAY['despachos', 'codigos', 'rpi', 'status']
),
(
  'manual',
  'Manual de Marcas INPI - Critérios de Distintividade 2024',
  'CRITÉRIOS DO MANUAL DE MARCAS DO INPI (versão vigente 2024):

  DISTINTIVIDADE (Art. 122 LPI):
  A marca deve ser capaz de distinguir produtos/serviços de um estabelecimento dos de outro.
  
  GRAUS DE DISTINTIVIDADE (do mais ao menos proteção):
  1. Marcas de fantasia (máxima proteção) - Ex.: KODAK, XEROX
  2. Marcas arbitrárias - palavras existentes sem relação com o produto - Ex.: MAÇÃ para computadores
  3. Marcas sugestivas - sugerem qualidades sem descrever - Ex.: SORRISO para pasta dental
  4. Marcas descritivas (baixa proteção, normalmente indeferidas)
  5. Marcas genéricas (sem proteção alguma)

  IMPEDIMENTOS ABSOLUTOS (Art. 124 LPI) - Marcas NÃO registráveis:
  - Brasão, armas, medalha oficial
  - Sinal de uso comum (genérico, necessário, vulgar)
  - Forma necessária, comum ou funcional do produto
  - Sinal contrário à moral e bons costumes
  - Denominação ou sigla de entidade pública
  - Reprodução de sinal de uso comum
  - Indicação geográfica
  - Termo técnico ou científico
  - Cor pura e simples (sem forma especial)
  - Letra ou número isolado (sem combinação ou forma especial)

  IMPEDIMENTOS RELATIVOS (Art. 125 LPI) - Colidência:
  - Marca idêntica ou semelhante à anteriormente registrada para produto/serviço idêntico, semelhante ou afim
  - Critério de colidência: combinação de semelhança gráfica, fonética e ideológica
  - ANUALIDADE DA CLASSE: proteção se aplica à classe registrada

  COEXISTÊNCIA:
  - Possível quando marcas são distintas o suficiente E mercados são diferentes (sem risco de confusão/associação)
  - Casos especiais: acordos de coexistência entre titulares',
  'https://www.gov.br/inpi/pt-br/servicos/marcas/manual-de-marcas',
  '2024-01-01',
  1,
  ARRAY['manual', 'distintividade', 'impedimentos', 'criterios', 'colidencia']
);
