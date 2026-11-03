import { describe, expect, it } from 'vitest';
import { validateContactInput, validateLeadInput } from './trademarkSearchService';
import { BRAND_STAGES } from './types';

describe('validateContactInput (primeira tela: estágio atual da marca)', () => {
  it('aceita cada uma das 4 opções confirmadas pelo cliente', () => {
    for (const stage of BRAND_STAGES) expect(validateContactInput(stage, BRAND_STAGES)).toBeNull();
  });
  it('rejeita estágio vazio ou fora das opções', () => {
    expect(validateContactInput('', BRAND_STAGES)?.code).toBe('invalid_input');
    expect(validateContactInput('Qualquer coisa', BRAND_STAGES)?.code).toBe('invalid_input');
  });
});

describe('validateLeadInput (segunda tela: nome, WhatsApp, e-mail)', () => {
  it('aceita nome, WhatsApp com DDD e e-mail válidos', () => {
    expect(validateLeadInput('João Silva', '(11) 91112-0225', 'joao@email.com')).toBeNull();
  });
  it('rejeita nome vazio ou curto', () => {
    expect(validateLeadInput('', '(11) 91112-0225', 'joao@email.com')?.code).toBe('invalid_input');
    expect(validateLeadInput('Al', '(11) 91112-0225', 'joao@email.com')?.code).toBe('invalid_input');
  });
  it('rejeita WhatsApp sem DDD', () => {
    expect(validateLeadInput('João Silva', '91112-0225', 'joao@email.com')?.message).toContain('WhatsApp');
  });
  it('rejeita e-mail inválido', () => {
    expect(validateLeadInput('João Silva', '(11) 91112-0225', 'nao-e-email')?.message).toContain('e-mail');
    expect(validateLeadInput('João Silva', '(11) 91112-0225', '')?.code).toBe('invalid_input');
  });
});
