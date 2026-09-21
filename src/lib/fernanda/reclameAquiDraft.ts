/** Reclame Aqui objection package. The accusatory audio is never approved here. */
export const RECLAME_AQUI_SAFE_TEXT = `Os dados públicos do Reclame Aqui precisam ser verificados no momento da resposta, porque os números podem mudar. No retrato observado em 21/09/2026, a página mostrava 13 reclamações no histórico geral, 5 nos últimos 6 meses, 100% respondidas e nenhuma aguardando resposta.

Algumas manifestações tratam de valores e taxas adicionais, por isso fazemos questão de explicar por áudio e por escrito, antes da contratação, o que está incluso nos honorários e quais custos podem existir durante o processo.

Levamos cada manifestação a sério e permanecemos à disposição para esclarecer qualquer dúvida.`;

export const RECLAME_AQUI_PACKAGE = Object.freeze({
  status: 'blocked_pending_evidence_and_caroline' as const,
  intent: 'reclame_aqui_objection' as const,
  originalAudio: { assetId: null as string | null, approved: false },
  imageCount: 3,
  imageAssetIds: [null, null, null] as (string | null)[],
  safeFallbackText: RECLAME_AQUI_SAFE_TEXT,
  closingQuestion: 'Ficou alguma dúvida sobre isso?',
  observedSnapshot: { asOf: '2026-09-21', totalHistory: 13, lastSixMonths: 5, responseRatePercent: 100, awaitingResponse: 0 },
  commercialClaimsPendingApproval: ['mais de sete anos', 'mais de 12 mil clientes'],
  evidenceImagesAreHistoricalOnly: true,
  blockers: ['public_evidence_not_found', 'process_number_or_document_missing', 'caroline_approval_missing'],
});

export type ReclameAquiAction =
  | { kind: 'audio'; assetId: string }
  | { kind: 'text'; body: string }
  | { kind: 'image'; assetId: string; position: number };

export function detectsReclameAquiIntent(message: string) {
  return /reclame\s*aqui|reclama[cç][aã]o|voc[eê]s t[eê]m reclama[cç][aã]o|vi uma reclama[cç][aã]o/i.test(message);
}

export function formatVerifiedReclameAquiSnapshot(snapshot: { asOf: string; totalHistory: number; lastSixMonths: number; responseRatePercent: number; awaitingResponse: number }) {
  return `Dados verificados em ${snapshot.asOf}: ${snapshot.totalHistory} reclamações no histórico geral, ${snapshot.lastSixMonths} nos últimos 6 meses, ${snapshot.responseRatePercent}% respondidas e ${snapshot.awaitingResponse} aguardando resposta.`;
}

/** Images are historical context only, never proof of a current count or alleged coordination. */
export function planSafeReclameAquiFallback(imageAssetIds: string[]): ReclameAquiAction[] {
  if (imageAssetIds.length !== 3 || imageAssetIds.some((id) => !id.trim())) throw new Error('three_images_required');
  return [
    { kind: 'text', body: RECLAME_AQUI_SAFE_TEXT },
    ...imageAssetIds.map((assetId, index) => ({ kind: 'image' as const, assetId, position: index + 1 })),
    { kind: 'text', body: RECLAME_AQUI_PACKAGE.closingQuestion },
  ];
}

/** Original audio route stays empty until documentary evidence and Caroline approval are both recorded. */
export function planApprovedReclameAquiPackage(): ReclameAquiAction[] {
  if (RECLAME_AQUI_PACKAGE.status !== 'approved' as string) return [];
  return [];
}

export type ReclameAquiReceipt = {
  conversationId: string;
  audio: 'sent' | 'failed' | 'blocked' | 'not_attempted';
  safeTextSent: boolean;
  imagesSent: number;
  closingQuestionSent: boolean;
  complete: boolean;
};

export function recordReclameAquiDelivery(receipt: Omit<ReclameAquiReceipt, 'complete'>): ReclameAquiReceipt {
  if (receipt.imagesSent < 0 || receipt.imagesSent > 3) throw new Error('invalid_image_count');
  return {
    ...receipt,
    complete: receipt.safeTextSent && receipt.imagesSent === 3 && receipt.closingQuestionSent &&
      ['sent', 'failed', 'blocked', 'not_attempted'].includes(receipt.audio),
  };
}
