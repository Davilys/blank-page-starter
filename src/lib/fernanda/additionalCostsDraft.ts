/**
 * User-supplied commercial response, intentionally kept in DRAFT state.
 * It must not be sent until boleto pricing and RPI wording are approved.
 * The audio bytes are not committed to the repository; only their integrity
 * metadata is recorded so the private original can be attached at deploy time.
 */
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

export function detectsAdditionalCostIntent(message: string) {
  return /(?:algo|mais|extra|adicional|outra).*(?:pagar|pagamento|custo|taxa|valor)|(?:taxa|custo|valor|honor[aá]rio).*(?:inpi|extra|adicional|depois|inclus)|(?:quanto).*(?:total|final)|(?:exig[eê]ncia|publica[cç][aã]o)|(?:o que|que).*(?:inclus)/i.test(message);
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
