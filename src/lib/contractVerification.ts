const OFFICIAL_VERIFICATION_ORIGIN = 'https://webmarcas.net';

export function normalizeBlockchainHash(value: string | null | undefined): string {
  return (value || '').toLowerCase().replace(/[^a-f0-9]/g, '').slice(0, 64);
}

export function isValidBlockchainHash(value: string | null | undefined): boolean {
  return /^[a-f0-9]{64}$/.test(normalizeBlockchainHash(value));
}

export function isValidUuid(value: string | null | undefined): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

export function getContractVerificationBaseUrl(): string {
  return OFFICIAL_VERIFICATION_ORIGIN;
}

export function getContractVerificationHost(): string {
  return new URL(OFFICIAL_VERIFICATION_ORIGIN).host;
}

export function buildContractVerificationUrl(hash: string): string {
  const normalizedHash = normalizeBlockchainHash(hash);
  return `${getContractVerificationBaseUrl()}/verificar-contrato?hash=${normalizedHash}`;
}