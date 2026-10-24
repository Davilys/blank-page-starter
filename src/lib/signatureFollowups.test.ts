import { describe, it, expect } from 'vitest';
import { adjustToWindow, scheduleFollowups, buildFollowupWhatsApp } from '../../supabase/functions/_shared/signatureFollowups';

const data = { nome: 'Davilys Cunha', documento: 'contrato', marca: 'UAU', link: 'https://x/assinar/t', valor: 'R$ 699,00' };

describe('lembretes de assinatura', () => {
  it('envio às 22h de São Paulo vai para 8h do dia seguinte', () => {
    const d = adjustToWindow(new Date('2026-10-24T01:00:00Z')); // 22h BRT do dia 23
    expect(d.toISOString()).toBe('2026-10-24T11:00:00.000Z');
  });

  it('agenda 24h, 48h e o 3º antes do vencimento de 72h', () => {
    const gen = new Date('2026-10-23T13:00:00Z'); // 10h BRT
    const exp = new Date(gen.getTime() + 72 * 3600_000);
    const [a, b, c] = scheduleFollowups(gen, exp);
    expect(a.toISOString()).toBe('2026-10-24T13:00:00.000Z');
    expect(b.toISOString()).toBe('2026-10-25T13:00:00.000Z');
    expect(c.getTime()).toBeLessThan(exp.getTime());
    expect(c.getTime()).toBeGreaterThan(b.getTime());
  });

  it('as três mensagens são diferentes', () => {
    const msgs = [1, 2, 3].map((s) => buildFollowupWhatsApp(s as 1 | 2 | 3, data));
    expect(new Set(msgs).size).toBe(3);
  });

  it('procuração (sem valor) não cita valor no último aviso', () => {
    const m = buildFollowupWhatsApp(3, { ...data, documento: 'procuração', valor: null });
    expect(m).not.toContain('R$');
    expect(buildFollowupWhatsApp(3, data)).toContain('R$ 699,00');
  });
});
