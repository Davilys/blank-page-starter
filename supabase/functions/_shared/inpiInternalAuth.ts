/** Never trust the internal header alone or accept a missing server secret. */
export function isTrustedInpiStep(headers: Headers, serviceKey: string | undefined): boolean {
  return Boolean(serviceKey?.trim())
    && headers.get('x-internal-job') === '1'
    && headers.get('Authorization') === `Bearer ${serviceKey}`;
}
