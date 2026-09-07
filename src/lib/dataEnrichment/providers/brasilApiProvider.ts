/** Provedor de dados de CNPJ via Edge Function (BrasilAPI). */
import { supabase } from '@/integrations/supabase/client';
import type { EnrichmentProvider, EnrichmentResult } from '../types';

export const brasilApiProvider: EnrichmentProvider = {
  id: 'brasilapi-cnpj',
  source: 'BrasilAPI',
  isAvailable: () => true,
  async fetch(cnpj: string): Promise<EnrichmentResult> {
    try {
      const { data, error } = await supabase.functions.invoke('enrich-client-data', {
        body: { type: 'cnpj', value: cnpj },
      });
      if (error) {
        return {
          status: 'error',
          message: 'Não foi possível consultar os dados agora. Tente novamente.',
          sources: ['BrasilAPI'],
        };
      }
      return data as EnrichmentResult;
    } catch {
      return {
        status: 'error',
        message: 'Não foi possível consultar os dados agora. Tente novamente.',
        sources: ['BrasilAPI'],
      };
    }
  },
};
