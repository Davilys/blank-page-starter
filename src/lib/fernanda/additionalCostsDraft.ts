/**
 * User-supplied commercial response, intentionally kept in DRAFT state.
 * It must not be sent until boleto pricing and RPI wording are approved.
 * The audio bytes are not committed to the repository; only their integrity
 * metadata is recorded so the private original can be attached at deploy time.
 */
import { COLLECTION_OPENING } from './conversation';

export const ADDITIONAL_COSTS_DRAFT = Object.freeze({
  status: 'blocked_pending_caroline_approval' as const,
  intent: 'additional_costs' as const,
  audio: {
    sha256: 'd5d8efd9acebe10acdfb3b2ff35260d0f44f71ce2f17ca3a1b3f865570160a1d',
    mimeType: 'audio/ogg',
    durationSeconds: 62.149979,
  },
  blocks: [
    '🔰*Valores e Condições Especiais:*\nR$699,00 à vista no Pix (43% OFF)\n\nou 3x de R$399 no boleto (sem juros).\n6x de R$199 no cartão (sem juros).',
    '💰 *Taxas do INPI:*\nValor único de R$440,00 referente ao protocolo e certificado federal.',
    '✅ Incluso ®️ :\n- Registro do nome + logotipo\n- Protocolo no INPI em até 48h\n- Acompanhamento e vigilância por 12 meses\n- Garantia total: se o INPI arquivar, registramos nova marca sem custo.',
    '_Se houver exigências ou publicações extras, os custos serão cobrados conforme nosso contrato e serão publicados no Diário Oficial para garantir transparência._\n\nApós isso, você recebe o certificado válido por 10 anos, com direito a renovação.',
  ],
  blockers: ['diario_oficial_requires_caroline_rpi_validation'],
});

export type DeliveryAction =
  | { kind: 'audio'; sha256: string; mimeType: string }
  | { kind: 'text'; body: string };

export const COSTS_FOLLOW_UP = Object.freeze({
  minDelayMs: 30_000,
  maxDelayMs: 40_000,
  clarificationQuestion: 'Até aqui, ficou alguma dúvida?',
  continuationQuestion: 'Perfeito! Vamos dar sequência ao processo de registro?',
  collectionOpening: COLLECTION_OPENING,
});

export type CostsFollowUpStage = 'waiting_delay' | 'waiting_clarification' | 'waiting_continuation' | 'ready_for_collection';

export function costsFollowUpAfterDelivery(deliveredAt: Date, delayMs: number) {
  if (delayMs < COSTS_FOLLOW_UP.minDelayMs || delayMs > COSTS_FOLLOW_UP.maxDelayMs) throw new Error('delay_outside_30_40_seconds');
  return { stage: 'waiting_delay' as const, dueAt: new Date(deliveredAt.getTime() + delayMs).toISOString() };
}

export function clarificationPrompt(now: Date, dueAt: string) {
  if (now.getTime() < Date.parse(dueAt)) return null;
  return COSTS_FOLLOW_UP.clarificationQuestion;
}

export function acceptsNoRemainingDoubt(message: string) {
  return /^(?:n[aã]o(?:,?\s*(?:ficou|tenho|tudo certo|est[aá] tudo certo))?|tudo certo|entendi|ficou claro|ok|sim,?\s*(?:tudo certo|entendi))\b/i.test(message.trim());
}

export function acceptsContinueRegistration(message: string) {
  return /^(?:sim|vamos|pode|quero|claro|bora|ok)\b/i.test(message.trim());
}

export function nextCostsFollowUp(stage: CostsFollowUpStage, message?: string) {
  if (stage === 'waiting_clarification' && message && acceptsNoRemainingDoubt(message)) {
    return { stage: 'waiting_continuation' as const, message: COSTS_FOLLOW_UP.continuationQuestion };
  }
  if (stage === 'waiting_continuation' && message && acceptsContinueRegistration(message)) {
    // The user has not supplied the exact collection-opening copy yet.
    return { stage: 'ready_for_collection' as const, message: COSTS_FOLLOW_UP.collectionOpening };
  }
  return { stage, message: null };
}

export function detectsAdditionalCostIntent(message: string) {
  return /(?:algo|mais|extra|adicional|outra).*(?:pagar|pagamento|custo|taxa|valor)|(?:taxa|custo|valor|honor[aá]rio).*(?:inpi|extra|adicional|depois|inclus)|(?:quanto).*(?:total|final)|(?:exig[eê]ncia|publica[cç][aã]o)|(?:o que|que).*(?:inclus)/i.test(message);
}

export type DeliveryReceipt = {
  conversationId: string;
  audio: 'sent' | 'failed' | 'unsupported' | 'not_attempted';
  textBlocksSent: number;
  completed: boolean;
};

export function recordAdditionalCostsDelivery(
  conversationId: string,
  audio: DeliveryReceipt['audio'],
  textBlocksSent: number,
): DeliveryReceipt {
  if (textBlocksSent < 0 || textBlocksSent > ADDITIONAL_COSTS_DRAFT.blocks.length) throw new Error('invalid_text_block_count');
  return {
    conversationId,
    audio,
    textBlocksSent,
    completed: textBlocksSent === ADDITIONAL_COSTS_DRAFT.blocks.length &&
      (audio === 'sent' || audio === 'failed' || audio === 'unsupported'),
  };
}

export function approvedAdditionalCostsDelivery(audioAvailable: boolean): DeliveryAction[] {
  if (ADDITIONAL_COSTS_DRAFT.status !== 'approved' as string) return [];
  const text = ADDITIONAL_COSTS_DRAFT.blocks.join('\n\n');
  return audioAvailable
    ? [{ kind: 'audio', sha256: ADDITIONAL_COSTS_DRAFT.audio.sha256, mimeType: ADDITIONAL_COSTS_DRAFT.audio.mimeType }, { kind: 'text', body: text }]
    : [{ kind: 'text', body: text }];
}

/** Testable transport plan. The caller must still enforce approval first. */
export function planAdditionalCostsDelivery(audioAvailable: boolean): DeliveryAction[] {
  const text = ADDITIONAL_COSTS_DRAFT.blocks.join('\n\n');
  return audioAvailable
    ? [{ kind: 'audio', sha256: ADDITIONAL_COSTS_DRAFT.audio.sha256, mimeType: ADDITIONAL_COSTS_DRAFT.audio.mimeType }, { kind: 'text', body: text }]
    : [{ kind: 'text', body: text }];
}
