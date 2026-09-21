import { describe, expect, it } from 'vitest';
import {
  ADDITIONAL_COSTS_DRAFT, approvedAdditionalCostsDelivery, detectsAdditionalCostIntent,
  planAdditionalCostsDelivery, recordAdditionalCostsDelivery, COSTS_FOLLOW_UP, costsFollowUpAfterDelivery, clarificationPrompt, nextCostsFollowUp,
} from './additionalCostsDraft';

describe('additional-costs official draft transport', () => {
  it.each([
    'Tem algo a mais para pagar?',
    'Qual é o custo total com as taxas do INPI?',
    'Tem algum valor extra depois?',
    'O que está incluso nos honorários?',
    'E se tiver exigência ou publicação?',
  ])('detects the additional-cost intent: %s', (message) => {
    expect(detectsAdditionalCostIntent(message)).toBe(true);
  });
  it('sends audio first and the exact text second when audio is available', () => {
    expect(planAdditionalCostsDelivery(true).map((item) => item.kind)).toEqual(['audio', 'text']);
  });
  it('falls back to exact text only when audio is unavailable', () => {
    expect(planAdditionalCostsDelivery(false).map((item) => item.kind)).toEqual(['text']);
  });
  it('waits only within 30-40 seconds before the exact clarification question', () => {
    const plan = costsFollowUpAfterDelivery(new Date('2026-09-21T12:00:00Z'), 35_000);
    expect(plan.dueAt).toBe('2026-09-21T12:00:35.000Z');
    expect(clarificationPrompt(new Date('2026-09-21T12:00:34Z'), plan.dueAt)).toBeNull();
    expect(clarificationPrompt(new Date('2026-09-21T12:00:35Z'), plan.dueAt)).toBe('Até aqui, ficou alguma dúvida?');
    expect(() => costsFollowUpAfterDelivery(new Date(), 29_999)).toThrow();
    expect(() => costsFollowUpAfterDelivery(new Date(), 40_001)).toThrow();
  });
  it('uses the exact continuation question and uses the exact supplied collection-opening copy', () => {
    expect(nextCostsFollowUp('waiting_clarification', 'Tudo certo')).toEqual({
      stage: 'waiting_continuation', message: 'Perfeito! Vamos dar sequência ao processo de registro?',
    });
    expect(nextCostsFollowUp('waiting_continuation', 'Sim')).toEqual({ stage: 'ready_for_collection', message: 'Preciso destes dados para te enviar a proposta personalizada e, aprovando, iniciar o registro no INPI:' });
    expect(COSTS_FOLLOW_UP.collectionOpening).toBe('Preciso destes dados para te enviar a proposta personalizada e, aprovando, iniciar o registro no INPI:');
  });
  it('does not pressure or advance when the answer is ambiguous or contains a doubt', () => {
    expect(nextCostsFollowUp('waiting_clarification', 'Ainda tenho dúvida sobre a taxa')).toEqual({ stage: 'waiting_clarification', message: null });
    expect(nextCostsFollowUp('waiting_continuation', 'Vou pensar')).toEqual({ stage: 'waiting_continuation', message: null });
  });
  it('records both deliveries and treats four text blocks as mandatory even after audio failure', () => {
    expect(recordAdditionalCostsDelivery('c1', 'sent', 4)).toMatchObject({ completed: true, audio: 'sent', textBlocksSent: 4 });
    expect(recordAdditionalCostsDelivery('c1', 'failed', 4)).toMatchObject({ completed: true, audio: 'failed', textBlocksSent: 4 });
    expect(recordAdditionalCostsDelivery('c1', 'sent', 3).completed).toBe(false);
  });
  it('keeps the content blocked while legal and boleto conflicts remain', () => {
    expect(ADDITIONAL_COSTS_DRAFT.status).toBe('blocked_pending_caroline_approval');
    expect(ADDITIONAL_COSTS_DRAFT.blockers).toEqual(['diario_oficial_requires_caroline_rpi_validation']);
    expect(ADDITIONAL_COSTS_DRAFT.blocks[0]).toContain('3x de R$399 no boleto');
    expect(approvedAdditionalCostsDelivery(true)).toEqual([]);
  });
  it('pins the private source audio by hash without committing its bytes', () => {
    expect(ADDITIONAL_COSTS_DRAFT.audio.sha256).toHaveLength(64);
    expect(ADDITIONAL_COSTS_DRAFT.audio.durationSeconds).toBeCloseTo(62.149979);
  });
});
