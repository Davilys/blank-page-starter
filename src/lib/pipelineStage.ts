export const BRAND_PROCESS_ALLOWED_PIPELINE_STAGES = new Set([
  'protocolado',
  '003',
  'oposicao',
  'exigencia_merito',
  'exigencia_de_mrito',
  'indeferimento',
  'indeferido',
  'notificacao',
  'deferimento',
  'deferido',
  'certificados',
  'certificado',
  'renovacao',
  'distrato',
  'assinou_contrato',
  'pagamento_ok',
  'pagou_taxa',
  'taxa_inpi_paga',
  'em_andamento',
  'depositada',
  'arquivado',
  'arquivados',
  'publicado_rpi',
  'em_exame',
  'concedido',
  'registrada',
]);

const PIPELINE_STAGE_ALIASES: Record<string, string> = {
  arquivados: 'arquivado',
};

export const normalizePipelineStageId = (stage?: string | null): string | null => {
  if (!stage || typeof stage !== 'string') return null;

  const cleaned = stage.trim().toLowerCase();
  if (!cleaned) return null;

  const mapped = PIPELINE_STAGE_ALIASES[cleaned] ?? cleaned;
  return BRAND_PROCESS_ALLOWED_PIPELINE_STAGES.has(mapped) ? mapped : null;
};

export const sanitizePipelineStagesConfig = <T extends { id: string }>(stages?: T[] | null): T[] => {
  if (!Array.isArray(stages)) return [];

  const seen = new Set<string>();
  return stages.reduce<T[]>((acc, stage) => {
    const normalizedId = normalizePipelineStageId(stage?.id);
    if (!normalizedId || seen.has(normalizedId)) return acc;

    seen.add(normalizedId);
    acc.push({ ...stage, id: normalizedId });
    return acc;
  }, []);
};
