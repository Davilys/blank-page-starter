import { describe, it, expect } from 'vitest';
import {
  buildDespacho003InvoiceDescription, buildDespacho003Subject, buildDespacho003EmailBody,
  fillDespacho003Charge, missingDespacho003Fields,
} from './despacho003';

const base = { nomeEtapa: 'PUBLICAÇÃO DESPACHO 003', nomeCliente: 'Cliente Teste', marca: 'MARCA X', numeroProcesso: '912345678' };

describe('despacho 003', () => {
  it('descrição Asaas no padrão', () => {
    expect(buildDespacho003InvoiceDescription({ marca: 'MARCA X', numeroProcesso: '912345678' }))
      .toBe('Honorários de assessoria e acompanhamento da fase de publicação do despacho 003 — Marca MARCA X — Processo 912345678.');
  });
  it('assunto usa nome atual da etapa', () => {
    expect(buildDespacho003Subject({ nomeEtapa: 'NOVO NOME', marca: 'MARCA X' })).toBe('NOVO NOME — acompanhamento da marca MARCA X');
  });
  it('preenche com a cobrança efetiva e não deixa placeholders', () => {
    const out = fillDespacho003Charge(buildDespacho003EmailBody(base), { value: 1621, dueDate: '2026-10-18', link: 'https://asaas/x' });
    expect(out).toContain('R$ 1.621,00');
    expect(out).toContain('18/10/2026');
    expect(out).toContain('https://asaas/x');
    expect(out).not.toMatch(/\[[A-Z_]+\]/);
    expect(out.toLowerCase()).not.toMatch(/exigência|documentos adicionais|taxa do inpi/);
  });
  it('usa o valor da cobrança, não fixo', () => {
    expect(fillDespacho003Charge(buildDespacho003EmailBody(base), { value: 999.5, dueDate: '2026-10-18', link: 'l' })).toContain('R$ 999,50');
  });
  it('bloqueia sem link ou dados', () => {
    expect(() => fillDespacho003Charge(buildDespacho003EmailBody(base), { value: 1621, dueDate: '2026-10-18', link: '' })).toThrow();
    expect(missingDespacho003Fields({ ...base, numeroProcesso: '' })).toContain('Número do processo');
  });
});
