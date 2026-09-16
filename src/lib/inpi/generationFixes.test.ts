import { describe, expect, it } from 'vitest';
import { orientationItemText } from './orientationDisplay';
import { isTrustedInpiStep } from '../../../supabase/functions/_shared/inpiInternalAuth';

describe('autenticação da execução interna', () => {
  const headers = (token = 'test-server-key', internal = '1') => new Headers({ Authorization: `Bearer ${token}`, 'x-internal-job': internal });
  it('aceita a chave do servidor somente com o cabeçalho interno', () => {
    expect(isTrustedInpiStep(headers(), 'test-server-key')).toBe(true);
  });
  it('não aceita somente o cabeçalho interno com JWT de usuário', () => {
    expect(isTrustedInpiStep(headers('user-jwt'), 'test-server-key')).toBe(false);
  });
  it('não aceita chave ausente nem o sentinela antigo', () => {
    expect(isTrustedInpiStep(headers('__none__'), undefined)).toBe(false);
    expect(isTrustedInpiStep(headers(''), '')).toBe(false);
  });
  it('não trata chamada normal como job interno', () => {
    expect(isTrustedInpiStep(headers('test-server-key', '0'), 'test-server-key')).toBe(false);
    expect(isTrustedInpiStep(new Headers(), 'test-server-key')).toBe(false);
  });
});

describe('orientação legível', () => {
  it('formata fundamento e fontes', () => {
    expect(orientationItemText({ titulo: 'Cotejo', descricao: 'Comparar conjuntos.', fontes: ['DOC:01'] }))
      .toBe('Cotejo — Comparar conjuntos. · Fontes: DOC:01');
  });
  it('preserva a finalidade da prova sem JSON', () => {
    expect(orientationItemText({ documento: 'DOC:02', o_que_demonstra: 'Uso público', forca: 'media' }))
      .toBe('DOC:02 — Uso público');
  });
  it('formata recomendação documental', () => {
    expect(orientationItemText({ documento: 'GRU', finalidade: 'Conferir vinculação' }))
      .toBe('GRU — Conferir vinculação');
  });
  it('preserva textos e trata valores inesperados', () => {
    expect(orientationItemText('Sem mudanças')).toBe('Sem mudanças');
    expect(orientationItemText(null)).toBe('');
    expect(orientationItemText({ fontes: [{ segredo: 'não exibir' }] })).not.toContain('segredo');
  });
});
