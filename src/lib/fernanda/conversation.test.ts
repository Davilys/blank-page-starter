import { describe, expect, it } from 'vitest';
import {
  PRICES, canCreateContract, cancelFollowUpsOnInbound, contractReadiness, followUpSchedule,
  hasExactlyOneQuestion, markContractLinkSent, markContractRequested, nextQuestion,
  requestCarolineEscalation, shouldEscalateToCaroline, type Conversation,
} from './conversation';

const base: Conversation = { conversationId: 'c1', subscriberId: 's1', stage: 'discover_name', memory: {} };
const complete = {
  fullName: 'Ana Silva', brandName: 'Aurora', businessArea: 'Cafeteria', email: 'ana@example.com',
  cpf: '52998224725', cep: '01001000', addressNumber: '10', paymentMethod: 'avista' as const,
  phoneFromSubscriber: '5511999999999', principalClass: 30, suggestedClasses: [30, 35, 43], exactSearchCompleted: true,
};

describe('Fernanda continuous conversation core', () => {
  it('asks one question at a time and keeps the WhatsApp phone out of questions', () => {
    expect(nextQuestion(base)).toBe('Como você prefere que eu te chame?');
    expect(hasExactlyOneQuestion(nextQuestion(base)!)).toBe(true);
    expect(nextQuestion({ ...base, stage: 'collect_email' })).not.toMatch(/telefone|whatsapp/i);
  });
  it('uses the exact approved prices', () => {
    expect(PRICES.avista.total).toBe(699);
    expect(PRICES.cartao6x).toMatchObject({ total: 1194, display: '6x de R$ 199 (R$ 1.194)' });
    expect(PRICES.boleto3x).toMatchObject({ total: 1197, display: '3x de R$ 399 (R$ 1.197)' });
  });
  it('schedules 10 min, 24 h and 5 d from the same inactivity anchor', () => {
    expect(followUpSchedule(new Date('2026-09-21T12:00:00Z'))).toEqual([
      { step: 1, dueAt: '2026-09-21T12:10:00.000Z' },
      { step: 2, dueAt: '2026-09-22T12:00:00.000Z' },
      { step: 3, dueAt: '2026-09-26T12:00:00.000Z' },
    ]);
  });
  it('cancels the whole follow-up sequence on any inbound response', () => {
    const updated = cancelFollowUpsOnInbound(base, '2026-09-21T12:04:00Z');
    expect(updated.followupsCancelledAt).toBe('2026-09-21T12:04:00Z');
  });
  it('escalates complex legal matters only by asking permission for a concrete Caroline check', () => {
    expect(shouldEscalateToCaroline('Recebi uma oposição no INPI, o que faço?')).toBe(true);
    const escalated = requestCarolineEscalation(base, 'oposição no INPI');
    expect(escalated.stage).toBe('waiting_caroline');
    expect(escalated.pendingQuestion).toMatch(/Posso verificar/);
    expect(hasExactlyOneQuestion(escalated.pendingQuestion!)).toBe(true);
  });
  it('blocks contract creation until all collected state and exact search are ready', () => {
    expect(contractReadiness({ ...complete, exactSearchCompleted: undefined }).missing).toContain('exactSearchCompleted');
    expect(canCreateContract({ ...base, stage: 'ready_for_contract', memory: complete })).toBe(true);
  });
  it('creates the contract before the link can be marked as sent', () => {
    const requested = markContractRequested({ ...base, stage: 'ready_for_contract', memory: complete });
    expect(requested.stage).toBe('waiting_contract_link');
    expect(markContractLinkSent(requested).stage).toBe('contract_link_sent');
    expect(() => markContractLinkSent(base)).toThrow('contract_not_requested');
  });
});
