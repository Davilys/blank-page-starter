import { z } from 'zod';
import type { EnrichmentResult } from './types';

const enrichedDataSchema = z.object({
  full_name: z.string().nullable().optional(),
  company_name: z.string().nullable().optional(),
  trade_name: z.string().nullable().optional(),
  registration_status: z.string().nullable().optional(),
  cnae: z.string().nullable().optional(),
  opening_date: z.string().nullable().optional(),
  share_capital: z.number().nullable().optional(),
  zip_code: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  address_number: z.string().nullable().optional(),
  address_complement: z.string().nullable().optional(),
  neighborhood: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  emails: z.array(z.string()).optional(),
  phones: z.array(z.string()).optional(),
});

const responseSchema = z.object({
  success: z.boolean(),
  status: z.enum([
    'success',
    'provider_unavailable',
    'invalid_document',
    'not_found',
    'rate_limited',
    'timeout',
    'provider_error',
    'unauthorized',
  ]),
  source: z.enum(['BrasilAPI', 'ViaCEP', 'CPF Provider']).nullable(),
  documentType: z.enum(['cnpj', 'cpf', 'cep']),
  data: enrichedDataSchema.optional(),
  message: z.string().optional(),
});

export const parseProviderResponse = (value: unknown): EnrichmentResult => {
  const parsed = responseSchema.safeParse(value);
  if (parsed.success) return parsed.data as EnrichmentResult;
  return {
    success: false,
    status: 'provider_error',
    source: null,
    documentType: 'cnpj',
    message: 'Não foi possível consultar os dados agora. Tente novamente.',
  };
};