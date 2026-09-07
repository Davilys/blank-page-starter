/**
 * Merge aditivo: DADO EXISTENTE + DADO NOVO = PRESERVAR OS DOIS.
 * Nunca apaga telefone/e-mail existente e nunca cria duplicidade.
 */
import { normalizeEmail, samePhone } from './comparisonService';
import type { ComparisonItem, CrmClientSnapshot } from './types';

export interface MergeOutcome {
  /** Payload pronto para update em `profiles` (somente campos selecionados). */
  payload: Record<string, unknown>;
  /** Rótulos dos campos efetivamente atualizados (para o histórico). */
  updatedLabels: string[];
}

export const buildMergePayload = (
  current: CrmClientSnapshot,
  items: ComparisonItem[],
  selectedKeys: Set<string>,
): MergeOutcome => {
  const payload: Record<string, unknown> = {};
  const updatedLabels: string[] = [];

  const phones = [...(current.additional_phones || [])];
  const emails = [...(current.additional_emails || [])];
  let phonesChanged = false;
  let emailsChanged = false;

  for (const item of items) {
    if (!selectedKeys.has(item.key) || item.status === 'unchanged') continue;

    if (item.kind === 'phone') {
      const value = String(item.rawValue ?? '');
      const already =
        samePhone(current.phone, value) || phones.some(p => samePhone(p, value));
      if (already) continue;
      if (!current.phone) {
        payload.phone = value;
      } else {
        phones.push(value);
        phonesChanged = true;
      }
      updatedLabels.push('Telefone');
      continue;
    }

    if (item.kind === 'email') {
      const value = normalizeEmail(String(item.rawValue ?? ''));
      const already =
        normalizeEmail(current.email) === value ||
        emails.some(e => normalizeEmail(e) === value);
      if (already) continue;
      if (!current.email) {
        payload.email = value;
      } else {
        emails.push(value);
        emailsChanged = true;
      }
      updatedLabels.push('E-mail');
      continue;
    }

    if (item.column) {
      payload[item.column as string] = item.rawValue;
      updatedLabels.push(item.label);
    }
  }

  if (phonesChanged) payload.additional_phones = phones;
  if (emailsChanged) payload.additional_emails = emails;

  return { payload, updatedLabels: Array.from(new Set(updatedLabels)) };
};
