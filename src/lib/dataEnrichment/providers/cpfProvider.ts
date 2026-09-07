/**
 * Provedor de CPF.
 * Nenhum provedor oficial/comercial está configurado — a consulta permanece indisponível.
 * NUNCA utilizar bases vazadas, scraping ou fontes não autorizadas.
 * Para habilitar no futuro (Serpro ou provedor pago), implemente a chamada na Edge Function
 * `enrich-client-data` (type = 'cpf') com as credenciais em Secrets e ajuste `isAvailable()`.
 */
import type { EnrichmentProvider, EnrichmentResult } from '../types';

export const cpfProvider: EnrichmentProvider = {
  id: 'cpf-nao-configurado',
  source: 'CPF Provider',
  isAvailable: () => false,
  async fetch(): Promise<EnrichmentResult> {
    return {
      status: 'unavailable',
      message: 'Consulta de CPF não disponível no momento.',
      sources: [],
    };
  },
};
