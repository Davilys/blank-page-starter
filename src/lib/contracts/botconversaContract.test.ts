import { describe, expect, it } from 'vitest';
import {
  contractValue,
  isValidCpf,
  renderStandardContract,
  validateBotConversaContractInput,
} from '../../../supabase/functions/_shared/botconversaContract';

const valid = {
  event_id: 'bot-event-20260917-0001', full_name: 'Ana da Silva', email: 'ana@example.com', phone: '(11) 99999-9999',
  cpf: '529.982.247-25', address: 'Rua das Flores, 100', neighborhood: 'Centro', city: 'São Paulo', state: 'sp', cep: '01001-000',
  brand_name: 'Marca & Café', business_area: 'Comércio de cafés especiais', payment_method: 'avista',
};

describe('BotConversa contract payload', () => {
  it('validates the canonical payload and normalises state', () => {
    const parsed = validateBotConversaContractInput(valid);
    expect(parsed.errors).toEqual([]);
    expect(parsed.data?.state).toBe('SP');
  });
  it('uses the WhatsApp contact number when the agent does not collect a phone field', () => {
    const { phone, ...withoutPhone } = valid;
    const parsed = validateBotConversaContractInput({ ...withoutPhone, contact_phone: phone });
    expect(parsed.errors).toEqual([]);
    expect(parsed.data?.phone).toBe(phone);
  });
  it('accepts only CEP and residence number so the backend can resolve the address', () => {
    const { address, neighborhood, city, state, ...cepOnly } = valid;
    const parsed = validateBotConversaContractInput({ ...cepOnly, numero_residencia: '2299' });
    expect(parsed.errors).toEqual([]);
    expect(parsed.data?.address_number).toBe('2299');
    expect(parsed.data?.address).toBe('');
  });
  it('does not require RG or company name when CNPJ is supplied', () => {
    const parsed = validateBotConversaContractInput({ ...valid, cnpj: '60.869.686/0001-83' });
    expect(parsed.errors).toEqual([]);
    expect(parsed.data).not.toHaveProperty('rg');
  });
  it('normalises conversational payment labels', () => {
    expect(validateBotConversaContractInput({ ...valid, payment_method: 'Pix' }).data?.payment_method).toBe('avista');
    expect(validateBotConversaContractInput({ ...valid, payment_method: '3x no Boleto' }).data?.payment_method).toBe('boleto3x');
  });
  it('accepts the idempotency key exactly as BotConversa composes it', () => {
    const parsed = validateBotConversaContractInput({
      ...valid,
      event_id: 'contrato-+55 (11) 99999-9999-529.982.247-25-Marca & Café',
    });
    expect(parsed.errors).toEqual([]);
  });
  it('rejects invalid CPF and a missing idempotency event', () => {
    expect(isValidCpf('111.111.111-11')).toBe(false);
    const parsed = validateBotConversaContractInput({ ...valid, cpf: '111.111.111-11', event_id: 'short' });
    expect(parsed.errors).toContain('cpf inválido');
    expect(parsed.errors).toContain('event_id inválido');
  });
  it('uses the exact configured commercial values', () => {
    expect(contractValue('avista')).toBe(699);
    expect(contractValue('cartao6x')).toBe(1194);
    expect(contractValue('boleto3x')).toBe(1197);
  });
  it('escapes fields before placing them in contract HTML', () => {
    const parsed = validateBotConversaContractInput(valid);
    const html = renderStandardContract('<p>{{nome_cliente}} {{marca}} {{forma_pagamento_detalhada}}</p>', {
      ...parsed.data!, brand_name: '<img src=x onerror=alert(1)>',
    }, new Date('2026-09-17T12:00:00Z'));
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x');
  });
});

describe('preview dry-run contract', () => {
  it('uses an unmistakably synthetic payload shape', () => {
    const result = validateBotConversaContractInput({
      event_id: 'TESTE-FERNANDA-0001', flow_name: '1- INSTINC', agent_name: 'Fernanda Atendimento',
      full_name: 'TESTE Cliente Fernanda', email: 'fernanda@example.invalid', phone: '11999999999',
      cpf: '52998224725', cep: '01001000', address_number: '100', address: 'Rua Teste, 100',
      neighborhood: 'Centro', city: 'São Paulo', state: 'SP', brand_name: 'TESTE MARCA',
      business_area: 'Cafeteria sintética', payment_method: 'pix',
    });
    expect(result.errors).toEqual([]);
    expect(result.data).toMatchObject({ event_id: 'TESTE-FERNANDA-0001', flow_name: '1- INSTINC', payment_method: 'avista' });
  });
});
