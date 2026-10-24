import { describe, it, expect } from 'vitest';
import { dentroHorarioComercial, cadastroSustentaTexto } from '../../../../supabase/functions/check-publicacao-notificacoes/guard';
// SP = UTC-3
const u = (iso: string) => new Date(iso);
describe('horario comercial SP', () => {
  it('seg 10:00 sim', () => expect(dentroHorarioComercial(u('2026-10-26T13:00:00Z'))).toBe(true));
  it('seg 09:59 nao', () => expect(dentroHorarioComercial(u('2026-10-26T12:59:59Z'))).toBe(false));
  it('sex 17:59 sim', () => expect(dentroHorarioComercial(u('2026-10-30T20:59:59Z'))).toBe(true));
  it('sex 18:00 nao', () => expect(dentroHorarioComercial(u('2026-10-30T21:00:00Z'))).toBe(false));
  it('sabado 11:00 nao', () => expect(dentroHorarioComercial(u('2026-10-24T14:00:00Z'))).toBe(false));
  it('domingo 12:00 nao', () => expect(dentroHorarioComercial(u('2026-10-25T15:00:00Z'))).toBe(false));
  it('seg 01:00Z (domingo 22h SP) nao', () => expect(dentroHorarioComercial(u('2026-10-26T01:00:00Z'))).toBe(false));
});
describe('cadastro sustenta texto', () => {
  const ok = { status: 'Exigência de mérito', data_publicacao_rpi: '2026-09-18', cumprimento_status: 'nao_respondeu' };
  it('exigencia com data', () => expect(cadastroSustentaTexto(ok, {})).toBe(true));
  it('sem data', () => expect(cadastroSustentaTexto({ ...ok, data_publicacao_rpi: null }, {})).toBe(false));
  it('indeferimento', () => expect(cadastroSustentaTexto({ ...ok, status: 'Indeferimento' }, {})).toBe(false));
  it('desistiu', () => expect(cadastroSustentaTexto({ ...ok, cumprimento_status: 'desistiu' }, {})).toBe(false));
  it('aguardando pagamento', () => expect(cadastroSustentaTexto({ ...ok, cumprimento_status: 'aguardando_pagamento' }, {})).toBe(false));
});
