/**
 * Provedor de CPF.
 * Nenhum provedor oficial/comercial está configurado — a consulta permanece indisponível.
 * NUNCA utilizar bases vazadas, scraping ou fontes não autorizadas.
 * Para habilitar no futuro (Serpro ou provedor pago), implemente a chamada na Edge Function
 * `enrich-client-data` (type = 'cpf') com as credenciais em Secrets e ajuste `isAvailable()`.
 */
import type { CpfProvider, EnrichmentResult } from '../types';

const unavailable = (): EnrichmentResult => ({
  success: false,
  status: 'provider_unavailable',
  message: 'Para este cadastro, a consulta automática de CPF ainda não está configurada.\nVocê pode continuar usando a atualização automática para empresas com CNPJ.',
  source: 'CPF Provider',
  documentType: 'cpf',
});

export const cpfProvider: CpfProvider = {
  id: 'cpf-nao-configurado',
  source: 'CPF Provider',
  isAvailable: () => false,
  async lookupByCpf(): Promise<EnrichmentResult> { return unavailable(); },
  async fetch(cpf: string): Promise<EnrichmentResult> { return this.lookupByCpf(cpf); },
};
