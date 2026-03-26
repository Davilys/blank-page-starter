import { supabase } from '@/integrations/supabase/client';

export interface INPIResultado {
  processo: string;
  marca: string;
  situacao: string;
  classe: string;
  titular: string;
}

export interface CNPJMatch {
  nome: string;
  cnpj: string;
  situacao: string;
}

export interface SocialMatch {
  plataforma: string;
  encontrado: boolean;
  url?: string;
  descricao?: string;
}

export interface WebMatch {
  titulo: string;
  url: string;
  descricao: string;
}

export interface ViabilityResult {
  success: boolean;
  isFamousBrand?: boolean;
  level: 'high' | 'medium' | 'low' | 'blocked';
  title: string;
  description: string;
  laudo?: string;
  classes?: number[];
  classDescriptions?: string[];
  searchDate?: string;
  error?: string;
  // Novos campos estruturados
  viabilidade?: 'VIAVEL_INICIAL' | 'POSSIVEL_COM_ALERTA' | 'INDISPONIVEL';
  inpiData?: {
    totalResultados: number;
    resultados: INPIResultado[];
    consultadoEm: string;
  };
  cnpjData?: {
    total: number;
    matches: CNPJMatch[];
  };
  internetData?: {
    socialMatches: SocialMatch[];
    webMatches: WebMatch[];
  };
}

export async function checkViability(brandName: string, businessArea: string): Promise<ViabilityResult> {
  // Add artificial delay of 3 seconds for more realistic UX
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const { data, error } = await supabase.functions.invoke('inpi-viability-check', {
    body: { brandName, businessArea },
  });

  if (error) {
    console.error('Viability check error:', error);
    return {
      success: false,
      level: 'low',
      title: 'Erro na Consulta',
      description: 'Não foi possível realizar a consulta. Tente novamente.',
      error: error.message,
    };
  }

  return data as ViabilityResult;
}
