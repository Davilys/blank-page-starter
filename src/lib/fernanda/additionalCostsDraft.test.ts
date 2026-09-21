import { describe, expect, it } from 'vitest';
import {
  ADDITIONAL_COSTS_DRAFT, approvedAdditionalCostsDelivery, detectsAdditionalCostIntent,
  planAdditionalCostsDelivery,
} from './additionalCostsDraft';

describe('additional-costs official draft transport', () => {
  it.each([
    'Tem algo a mais para pagar?',
    'Qual é o custo total com as taxas do INPI?',
    'Tem algum valor extra depois?',
  ])('detects the additional-cost intent: %s', (message) => {
    expect(detectsAdditionalCostIntent(message)).toBe(true);
  });
  it('sends audio first and the exact text second when audio is available', () => {
    expect(planAdditionalCostsDelivery(true).map((item) => item.kind)).toEqual(['audio', 'text']);
  });
  it('falls back to exact text only when audio is unavailable', () => {
    expect(planAdditionalCostsDelivery(false).map((item) => item.kind)).toEqual(['text']);
  });
  it('keeps the content blocked while legal and boleto conflicts remain', () => {
    expect(ADDITIONAL_COSTS_DRAFT.status).toBe('blocked_pending_approval');
    expect(ADDITIONAL_COSTS_DRAFT.blockers).toContain('boleto_398_conflicts_with_approved_399');
    expect(approvedAdditionalCostsDelivery(true)).toEqual([]);
  });
  it('pins the private source audio by hash without committing its bytes', () => {
    expect(ADDITIONAL_COSTS_DRAFT.audio.sha256).toHaveLength(64);
    expect(ADDITIONAL_COSTS_DRAFT.audio.durationSeconds).toBeCloseTo(62.149979);
  });
});
