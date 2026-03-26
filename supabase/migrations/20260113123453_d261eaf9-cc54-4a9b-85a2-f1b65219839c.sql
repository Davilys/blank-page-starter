-- Criar tabela para armazenar consultas de viabilidade
CREATE TABLE public.viability_searches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_name TEXT NOT NULL,
  business_area TEXT NOT NULL,
  result_level TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  ip_hash TEXT
);

-- Habilitar RLS
ALTER TABLE public.viability_searches ENABLE ROW LEVEL SECURITY;

-- Permitir inserção por qualquer um (consulta pública)
CREATE POLICY "Anyone can insert viability search" 
  ON public.viability_searches FOR INSERT 
  WITH CHECK (true);

-- Permitir leitura pública das últimas consultas (últimas 24h)
CREATE POLICY "Anyone can read recent searches" 
  ON public.viability_searches FOR SELECT 
  USING (created_at > now() - interval '24 hours');

-- Habilitar realtime para atualizações em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.viability_searches;