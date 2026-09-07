import { describe, expect, it } from 'vitest';
import { buildComparison, normalizeEmail, normalizePhone, samePhone } from './comparisonService';
import { buildMergePayload } from './mergeService';
import type { CrmClientSnapshot, EnrichedData } from './types';

const client = (overrides: Partial<CrmClientSnapshot> = {}): CrmClientSnapshot => ({
  id: 'client-1',
  phone: '(11) 99999-9999',
  email: 'Atual@Empresa.com ',
  additional_phones: [],
  additional_emails: [],
  ...overrides,
});

describe('normalização cadastral', () => {
  it('reconhece formatos equivalentes de telefone', () => {
    expect(normalizePhone('+55 11 99999-9999')).toBe('11999999999');
    expect(samePhone('(11) 99999-9999', '11999999999')).toBe(true);
  });

  it('normaliza e-mail sem diferenciar maiúsculas e espaços', () => {
    expect(normalizeEmail(' Cliente@Empresa.COM ')).toBe('cliente@empresa.com');
  });
});

describe('comparação e merge aditivo', () => {
  it('não oferece telefone ou e-mail já cadastrados como novos', () => {
    const found: EnrichedData = { phones: ['+55 11 99999-9999'], emails: [' atual@empresa.COM'] };
    const items = buildComparison(client(), found);
    expect(items.every(item => item.status === 'unchanged')).toBe(true);
  });

  it('preserva contatos atuais e adiciona somente novos', () => {
    const current = client();
    const items = buildComparison(current, {
      phones: ['(11) 98888-8888'],
      emails: ['novo@empresa.com'],
    });
    const selected = new Set(items.map(item => item.key));
    const { payload } = buildMergePayload(current, items, selected);
    expect(payload.phone).toBeUndefined();
    expect(payload.email).toBeUndefined();
    expect(payload.additional_phones).toEqual(['(11) 98888-8888']);
    expect(payload.additional_emails).toEqual(['novo@empresa.com']);
  });

  it('preenche os campos principais quando estão vazios', () => {
    const current = client({ phone: null, email: null });
    const items = buildComparison(current, { phones: ['11988888888'], emails: ['novo@empresa.com'] });
    const { payload } = buildMergePayload(current, items, new Set(items.map(item => item.key)));
    expect(payload.phone).toBe('(11) 98888-8888');
    expect(payload.email).toBe('novo@empresa.com');
    expect(payload.additional_phones).toBeUndefined();
    expect(payload.additional_emails).toBeUndefined();
  });

  it('atualiza endereço e empresa somente quando selecionados', () => {
    const current = client({ address: 'Rua Antiga', company_name: 'Empresa Antiga' });
    const items = buildComparison(current, { address: 'Rua Nova', company_name: 'Empresa Nova' });
    const address = items.find(item => item.key === 'address');
    expect(address).toBeDefined();
    const { payload } = buildMergePayload(current, items, new Set(address ? [address.key] : []));
    expect(payload.address).toBe('Rua Nova');
    expect(payload.company_name).toBeUndefined();
  });
});