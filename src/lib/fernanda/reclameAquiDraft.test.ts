import { describe, expect, it } from 'vitest';
import {
  RECLAME_AQUI_PACKAGE, RECLAME_AQUI_SAFE_TEXT, detectsReclameAquiIntent,
  planApprovedReclameAquiPackage, planSafeReclameAquiFallback, recordReclameAquiDelivery,
} from './reclameAquiDraft';

describe('Reclame Aqui objection package', () => {
  it.each(['Vi uma reclamação', 'Vocês têm reclamação?', 'Vi no Reclame Aqui'])('detects: %s', (text) => {
    expect(detectsReclameAquiIntent(text)).toBe(true);
  });
  it('keeps accusatory audio blocked without evidence and Caroline approval', () => {
    expect(RECLAME_AQUI_PACKAGE.status).toBe('blocked_pending_evidence_and_caroline');
    expect(RECLAME_AQUI_PACKAGE.blockers).toEqual(['public_evidence_not_verified', 'caroline_approval_missing']);
    expect(planApprovedReclameAquiPackage()).toEqual([]);
  });
  it('uses safe text, exactly three images, then the exact closing question', () => {
    const plan = planSafeReclameAquiFallback(['img-1', 'img-2', 'img-3']);
    expect(plan.map((item) => item.kind)).toEqual(['text', 'image', 'image', 'image', 'text']);
    expect(plan[0]).toEqual({ kind: 'text', body: RECLAME_AQUI_SAFE_TEXT });
    expect(plan.at(-1)).toEqual({ kind: 'text', body: 'Ficou alguma dúvida sobre isso?' });
  });
  it('refuses incomplete evidence image packages', () => {
    expect(() => planSafeReclameAquiFallback(['img-1', 'img-2'])).toThrow('three_images_required');
  });
  it('records every channel part and completes only with text, 3 images and closing question', () => {
    const complete = recordReclameAquiDelivery({ conversationId: 'c1', audio: 'blocked', safeTextSent: true, imagesSent: 3, closingQuestionSent: true });
    expect(complete.complete).toBe(true);
    const partial = recordReclameAquiDelivery({ conversationId: 'c1', audio: 'blocked', safeTextSent: true, imagesSent: 2, closingQuestionSent: true });
    expect(partial.complete).toBe(false);
  });
  it('contains no unsupported accusation in the safe fallback', () => {
    expect(RECLAME_AQUI_SAFE_TEXT).not.toMatch(/perfil falso|mesma pessoa|ex-funcion[aá]ria|prejudicar/i);
  });
});
