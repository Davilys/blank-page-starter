import { describe, expect, it } from 'vitest';
import { EMPTY_INPI_FILING_CASE, applyCrmNotification, assertNoSecretMaterial, canFileInpiRequest, refreshInpiFilingStage, type InpiFilingCase } from './inpiFiling';
const base = (): InpiFilingCase => ({ ...EMPTY_INPI_FILING_CASE, caseId: 'synthetic', contract: { ...EMPTY_INPI_FILING_CASE.contract }, gru: { ...EMPTY_INPI_FILING_CASE.gru }, powerOfAttorney: { ...EMPTY_INPI_FILING_CASE.powerOfAttorney } });

describe('INPI future filing state machine', () => {
  it('does not confuse contract created, sent and signed', () => {
    let value = refreshInpiFilingStage({ ...base(), contract: { delivery: 'created', signature: 'not_confirmed' } });
    expect(value.stage).toBe('awaiting_contract_sent');
    value = refreshInpiFilingStage({ ...value, contract: { ...value.contract, delivery: 'sent' } });
    expect(value.stage).toBe('awaiting_contract_signature_notification');
    expect(() => applyCrmNotification(base(), { id: 'crm-1', type: 'contract_signed' })).toThrow('contract_not_sent');
  });
  it('accepts the same CRM signature notification idempotently', () => {
    const sent = refreshInpiFilingStage({ ...base(), contract: { delivery: 'sent', signature: 'not_confirmed' } });
    const signed = applyCrmNotification(sent, { id: 'crm-contract-1', type: 'contract_signed' });
    expect(applyCrmNotification(signed, { id: 'crm-contract-1', type: 'contract_signed' })).toEqual(signed);
  });
  it('requires authorization, reviewed data, brand/class and current GRU fee before GRU progression', () => {
    const sent = refreshInpiFilingStage({ ...base(), contract: { delivery: 'sent', signature: 'confirmed', crmNotificationId: 'crm-contract-1' } });
    expect(sent.stage).toBe('ready_to_generate_gru');
    expect(refreshInpiFilingStage({ ...sent, gru: { ...sent.gru, delivery: 'created' } }).stage).toBe('ready_to_generate_gru');
  });
  it('requires GRU sent, procuração sent and CRM-confirmed signature in order', () => {
    let value = refreshInpiFilingStage({ ...base(), contract: { delivery: 'sent', signature: 'confirmed', crmNotificationId: 'c1' }, clientAuthorization: true, finalClientDataReviewed: true, brandAndClassReviewed: true, gru: { ...base().gru, currentFeeVerified: true, delivery: 'sent' } });
    expect(value.stage).toBe('ready_to_generate_power_of_attorney');
    value = refreshInpiFilingStage({ ...value, powerOfAttorney: { delivery: 'sent', signature: 'not_confirmed' } });
    expect(value.stage).toBe('awaiting_power_of_attorney_signature_notification');
    value = applyCrmNotification(value, { id: 'crm-poa-1', type: 'power_of_attorney_signed' });
    expect(value.stage).toBe('awaiting_gru_payment_proof');
  });
  it('keeps proof received separate from verified payment and final filing authority', () => {
    const ready = refreshInpiFilingStage({ ...base(), contract: { delivery: 'sent', signature: 'confirmed', crmNotificationId: 'c1' }, clientAuthorization: true, finalClientDataReviewed: true, brandAndClassReviewed: true, gru: { delivery: 'sent', currentFeeVerified: true, proof: 'confirmed', payment: 'not_confirmed' }, powerOfAttorney: { delivery: 'sent', signature: 'confirmed', crmNotificationId: 'p1' } });
    expect(ready.stage).toBe('awaiting_gru_payment_verification');
    expect(canFileInpiRequest(ready)).toBe(false);
    const reviewed = refreshInpiFilingStage({ ...ready, gru: { ...ready.gru, payment: 'confirmed' }, finalPackageReviewed: true, filingAuthorization: true });
    expect(reviewed.stage).toBe('ready_to_file');
    expect(canFileInpiRequest(reviewed)).toBe(true);
  });
  it('rejects secret material from workflow state', () => {
    expect(() => assertNoSecretMaterial({ caseId: 'safe', crmEvent: 'synthetic' })).not.toThrow();
    expect(() => assertNoSecretMaterial({ senha: 'never' })).toThrow('secret_material_forbidden');
  });
});
