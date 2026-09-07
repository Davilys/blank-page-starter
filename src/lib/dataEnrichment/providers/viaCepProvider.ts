/** Provedor de complemento de endereço por CEP (ViaCEP), via Edge Function. */
import { supabase } from '@/integrations/supabase/client';
import { parseProviderResponse } from '../providerResponse';
import type { EnrichmentProvider, EnrichmentResult } from '../types';

export const viaCepProvider: EnrichmentProvider = {
  id: 'viacep',
  source: 'ViaCEP',
  isAvailable: () => true,
  async fetch(cep: string): Promise<EnrichmentResult> {
    try {
      const { data, error } = await supabase.functions.invoke('enrich-client-data', {
        body: { type: 'cep', value: cep },
      });
      if (error) {
        return {
          success: false,
          status: 'provider_error',
          message: 'Não foi possível consultar os dados agora. Tente novamente.',
          source: 'ViaCEP',
          documentType: 'cep',
        };
      }
      return parseProviderResponse(data);
    } catch {
      return {
        success: false,
        status: 'provider_error',
        message: 'Não foi possível consultar os dados agora. Tente novamente.',
        source: 'ViaCEP',
        documentType: 'cep',
      };
    }
  },
};
