/** Tipos compartilhados da camada de enriquecimento cadastral. */

export type EnrichmentSource = 'BrasilAPI' | 'ViaCEP' | 'SERPRO';
export type DocumentType = 'cnpj' | 'cpf' | 'cep';

export interface EnrichedAddress {
  zip_code?: string | null;
  address?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface EnrichedData extends EnrichedAddress {
  full_name?: string | null;
  company_name?: string | null;
  trade_name?: string | null;
  registration_status?: string | null;
  cnae?: string | null;
  opening_date?: string | null;
  share_capital?: number | null;
  emails?: string[];
  phones?: string[];
}

export type EnrichmentStatus =
  | 'success'
  | 'provider_unavailable'
  | 'missing_birth_date'
  | 'invalid_document'
  | 'not_found'
  | 'rate_limited'
  | 'timeout'
  | 'provider_error'
  | 'unauthorized';

export interface EnrichmentResult {
  success: boolean;
  status: EnrichmentStatus;
  /** Mensagem amigável já pronta para exibição (nunca técnica). */
  message?: string;
  source: EnrichmentSource | null;
  documentType: DocumentType;
  data?: EnrichedData;
}

/** Contrato genérico de provedor — permite plugar Serpro ou provedor pago no futuro. */
export interface EnrichmentProvider {
  readonly id: string;
  readonly source: EnrichmentSource;
  /** Indica se o provedor está configurado e pode ser usado. */
  isAvailable(): boolean;
  fetch(identifier: string): Promise<EnrichmentResult>;
}

export interface CpfProvider extends EnrichmentProvider {
  lookupByCpf(cpf: string, birthDate?: string | null): Promise<EnrichmentResult>;
}

/** Dados atuais do CRM usados na comparação. */
export interface CrmClientSnapshot {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  cpf_cnpj?: string | null;
  birth_date?: string | null;
  company_name?: string | null;
  trade_name?: string | null;
  registration_status?: string | null;
  cnae?: string | null;
  opening_date?: string | null;
  share_capital?: number | null;
  address?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  additional_phones?: string[] | null;
  additional_emails?: string[] | null;
}

export type ComparisonStatus = 'unchanged' | 'updated' | 'new';

export type ComparisonKind = 'field' | 'phone' | 'email';

export interface ComparisonItem {
  key: string;
  /** Coluna de destino em `profiles` (apenas para kind = 'field'). */
  column?: keyof CrmClientSnapshot;
  label: string;
  group: 'pessoal' | 'endereco' | 'empresa' | 'contato';
  kind: ComparisonKind;
  currentValue: string;
  foundValue: string;
  status: ComparisonStatus;
  /** Valor bruto a ser gravado quando selecionado. */
  rawValue: string | number | null;
}
