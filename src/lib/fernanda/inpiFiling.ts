export type DeliveryState = 'not_created' | 'created' | 'sent';
export type ConfirmationState = 'not_confirmed' | 'confirmed';

export type InpiFilingStage =
  | 'awaiting_contract_sent'
  | 'awaiting_contract_signature_notification'
  | 'ready_to_generate_gru'
  | 'awaiting_gru_sent'
  | 'ready_to_generate_power_of_attorney'
  | 'awaiting_power_of_attorney_sent'
  | 'awaiting_power_of_attorney_signature_notification'
  | 'awaiting_gru_payment_proof'
  | 'awaiting_gru_payment_verification'
  | 'awaiting_final_review'
  | 'ready_for_filing_authorization'
  | 'ready_to_file'
  | 'filed';

export type InpiFilingCase = {
  caseId: string;
  contract: { delivery: DeliveryState; signature: ConfirmationState; crmNotificationId?: string };
  gru: { delivery: DeliveryState; proof: ConfirmationState; payment: ConfirmationState; currentFeeVerified: boolean };
  powerOfAttorney: { delivery: DeliveryState; signature: ConfirmationState; crmNotificationId?: string };
  clientAuthorization: boolean;
  finalClientDataReviewed: boolean;
  brandAndClassReviewed: boolean;
  finalPackageReviewed: boolean;
  filingAuthorization: boolean;
  filed: boolean;
  stage: InpiFilingStage;
};

export const EMPTY_INPI_FILING_CASE: InpiFilingCase = {
  caseId: 'unset',
  contract: { delivery: 'not_created', signature: 'not_confirmed' },
  gru: { delivery: 'not_created', proof: 'not_confirmed', payment: 'not_confirmed', currentFeeVerified: false },
  powerOfAttorney: { delivery: 'not_created', signature: 'not_confirmed' },
  clientAuthorization: false,
  finalClientDataReviewed: false,
  brandAndClassReviewed: false,
  finalPackageReviewed: false,
  filingAuthorization: false,
  filed: false,
  stage: 'awaiting_contract_sent',
};

export function nextInpiFilingStage(value: Omit<InpiFilingCase, 'stage'>): InpiFilingStage {
  if (value.contract.delivery !== 'sent') return 'awaiting_contract_sent';
  if (value.contract.signature !== 'confirmed' || !value.contract.crmNotificationId) return 'awaiting_contract_signature_notification';
  if (!value.clientAuthorization || !value.finalClientDataReviewed || !value.brandAndClassReviewed || !value.gru.currentFeeVerified) return 'ready_to_generate_gru';
  if (value.gru.delivery === 'not_created') return 'ready_to_generate_gru';
  if (value.gru.delivery !== 'sent') return 'awaiting_gru_sent';
  if (value.powerOfAttorney.delivery === 'not_created') return 'ready_to_generate_power_of_attorney';
  if (value.powerOfAttorney.delivery !== 'sent') return 'awaiting_power_of_attorney_sent';
  if (value.powerOfAttorney.signature !== 'confirmed' || !value.powerOfAttorney.crmNotificationId) return 'awaiting_power_of_attorney_signature_notification';
  if (value.gru.proof !== 'confirmed') return 'awaiting_gru_payment_proof';
  if (value.gru.payment !== 'confirmed') return 'awaiting_gru_payment_verification';
  if (!value.finalPackageReviewed) return 'awaiting_final_review';
  if (!value.filingAuthorization) return 'ready_for_filing_authorization';
  if (!value.filed) return 'ready_to_file';
  return 'filed';
}

export function refreshInpiFilingStage(value: InpiFilingCase): InpiFilingCase {
  return { ...value, stage: nextInpiFilingStage(value) };
}

export function applyCrmNotification(value: InpiFilingCase, event: { id: string; type: 'contract_signed' | 'power_of_attorney_signed' }) {
  if (!event.id) throw new Error('crm_notification_id_required');
  if (event.type === 'contract_signed') {
    if (value.contract.delivery !== 'sent') throw new Error('contract_not_sent');
    if (value.contract.crmNotificationId === event.id) return value;
    if (value.contract.signature === 'confirmed') throw new Error('contract_signature_already_confirmed_by_other_event');
    return refreshInpiFilingStage({ ...value, contract: { ...value.contract, signature: 'confirmed', crmNotificationId: event.id } });
  }
  if (value.powerOfAttorney.delivery !== 'sent') throw new Error('power_of_attorney_not_sent');
  if (value.powerOfAttorney.crmNotificationId === event.id) return value;
  if (value.powerOfAttorney.signature === 'confirmed') throw new Error('power_of_attorney_signature_already_confirmed_by_other_event');
  return refreshInpiFilingStage({ ...value, powerOfAttorney: { ...value.powerOfAttorney, signature: 'confirmed', crmNotificationId: event.id } });
}

export function canFileInpiRequest(value: InpiFilingCase) {
  return value.stage === 'ready_to_file';
}

export function assertNoSecretMaterial(value: unknown) {
  if (/password|senha|credential|credencial|cookie|token|totp|secret/i.test(JSON.stringify(value))) throw new Error('secret_material_forbidden');
}
