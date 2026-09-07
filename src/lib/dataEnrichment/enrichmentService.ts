/**
 * Orquestra a consulta cadastral: escolhe o provedor (CNPJ > CPF),
 * complementa o endereço via CEP e aplica cache/anti-duplicidade.
 */
import { brasilApiProvider } from './providers/brasilApiProvider';
import { cpfProvider } from './providers/cpfProvider';
import { viaCepProvider } from './providers/viaCepProvider';
import { normalizeZip } from './comparisonService';
import type { CrmClientSnapshot, EnrichmentResult } from './types';

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; result: EnrichmentResult }>();
const inflight = new Map<string, Promise<EnrichmentResult>>();

const onlyDigits = (v?: string | null) => (v || '').replace(/\D/g, '');

export const resolveIdentifier = (client: CrmClientSnapshot) => {
  const cnpj = onlyDigits(client.cnpj) || (onlyDigits(client.cpf_cnpj).length === 14 ? onlyDigits(client.cpf_cnpj) : '');
  if (cnpj.length === 14) return { type: 'cnpj' as const, value: cnpj };
  const cpf = onlyDigits(client.cpf) || (onlyDigits(client.cpf_cnpj).length === 11 ? onlyDigits(client.cpf_cnpj) : '');
  if (cpf.length === 11) return { type: 'cpf' as const, value: cpf };
  return null;
};

export const enrichClient = async (client: CrmClientSnapshot): Promise<EnrichmentResult> => {
  const id = resolveIdentifier(client);
  if (!id) {
    return {
      status: 'invalid',
      success: false,
      status: 'invalid_document',
      message: 'Não foi possível realizar a consulta porque falta CPF ou CNPJ no cadastro.',
      source: null,
      documentType: 'cpf',
    };
  }

  if (id.type === 'cpf') {
    return cpfProvider.lookupByCpf(id.value);
  }

  const cacheKey = `cnpj:${id.value}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.result;

  const pending = inflight.get(cacheKey);
  if (pending) return pending;

  const run = (async (): Promise<EnrichmentResult> => {
    const result = await brasilApiProvider.fetch(id.value);

    if (result.status === 'success' && result.data) {
      const zip = normalizeZip(result.data.zip_code);
      const incompleteAddress = !result.data.address || !result.data.city || !result.data.neighborhood;
      if (zip.length === 8 && incompleteAddress) {
        const cepResult = await viaCepProvider.fetch(zip);
        if (cepResult.status === 'success' && cepResult.data) {
          result.data = {
            ...result.data,
            address: result.data.address || cepResult.data.address,
            neighborhood: result.data.neighborhood || cepResult.data.neighborhood,
            city: result.data.city || cepResult.data.city,
            state: result.data.state || cepResult.data.state,
          };
        }
      }
      cache.set(cacheKey, { at: Date.now(), result });
    }
    return result;
  })();

  inflight.set(cacheKey, run);
  try {
    return await run;
  } finally {
    inflight.delete(cacheKey);
  }
};
