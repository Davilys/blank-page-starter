// A valid JSON object is not, by itself, a completed legal review.
export function validateReview(value: unknown): { resumo: string; apontamentos: Record<string, unknown>[] } {
  const v = value as any;
  const types = new Set(['fato_sem_lastro', 'citacao_nao_conferida', 'fundamento_nao_respondido', 'placeholder', 'contradicao', 'documento_nao_conferido']);
  if (!v || typeof v.resumo !== 'string' || !v.resumo.trim() || !Array.isArray(v.apontamentos)) {
    throw new Error('Revisão incompleta: faltam resumo e lista de apontamentos.');
  }
  for (const finding of v.apontamentos) {
    if (!finding || !types.has(finding.tipo) || typeof finding.bloqueante !== 'boolean' ||
      typeof finding.problema !== 'string' || !finding.problema.trim() ||
      typeof finding.trecho !== 'string' || typeof finding.trecho_fonte !== 'string' ||
      typeof finding.sugestao !== 'string' || !Array.isArray(finding.fontes) ||
      !finding.fontes.every((source: unknown) => typeof source === 'string') ||
      typeof finding.conferencia_externa_necessaria !== 'boolean') {
      throw new Error('Apontamento da revisão em formato inválido.');
    }
    // The model may not downgrade these categories by setting a boolean to false.
    if (['fato_sem_lastro', 'citacao_nao_conferida', 'placeholder', 'documento_nao_conferido'].includes(finding.tipo)) {
      finding.bloqueante = true;
    }
  }
  return v;
}
