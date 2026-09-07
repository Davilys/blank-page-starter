/**
 * Provedor de CPF.
 * Consulta CPF oficial via SERPRO, mediada pela Edge Function protegida.
 * NUNCA utilizar bases vazadas, scraping ou fontes não autorizadas.
 * Para habilitar no futuro (Serpro ou provedor pago), implemente a chamada na Edge Function
 * `enrich-client-data` (type = 'cpf') com as credenciais em Secrets e ajuste `isAvailable()`.
 */
import { supabase } from '@/integrations/supabase/client';
import { parseProviderResponse } from '../providerResponse';
import type { CpfProvider, EnrichmentResult } from '../types';

const failure = (message = 'Não foi possível consultar os dados agora. Tente novamente.'): EnrichmentResult => ({
  success: false, status: 'provider_error', message, source: 'SERPRO', documentType: 'cpf',
});

export const cpfProvider: CpfProvider = {
  id: 'serpro-cpf',
  source: 'SERPRO',
  isAvailable: () => true,
  async lookupByCpf(cpf: string, birthDate?: string | null): Promise<EnrichmentResult> {
    if (!birthDate) return {
      success: false,
      status: 'missing_birth_date',
      message: 'Informe a data de nascimento no cadastro para consultar o CPF na fonte oficial.',
      source: 'SERPRO',
      documentType: 'cpf',
    };
    try {
      const { data, error } = await supabase.functions.invoke('enrich-client-data', {
        body: { type: 'cpf', value: cpf, birthDate },
      });
      if (data) return parseProviderResponse(data);
      if (error) return failure();
      return failure();
    } catch {
      return failure();
    }
  },
  async fetch(cpf: string): Promise<EnrichmentResult> { return this.lookupByCpf(cpf); },
};
