// Aliases legados — preservam dados antigos quando renomeamos slugs
const PIPELINE_STAGE_ALIASES: Record<string, string> = {
  arquivados: 'arquivado',
};

// Conjunto de slugs reconhecidos historicamente (mantido para compatibilidade
// com chamadas que ainda referenciam o nome). Etapas customizadas não precisam
// estar aqui — `normalizePipelineStageId` aceita qualquer slug válido.
export const BRAND_PROCESS_ALLOWED_PIPELINE_STAGES = new Set([
  'protocolado', '003', 'oposicao', 'exigencia_merito', 'exigencia_de_mrito',
  'indeferimento', 'indeferido', 'notificacao', 'notificacao_extrajudicial',
  'deferimento', 'deferido', 'certificados', 'certificado', 'renovacao',
  'distrato', 'assinou_contrato', 'pagamento_ok', 'pagou_taxa',
  'taxa_inpi_paga', 'em_andamento', 'depositada', 'arquivado', 'arquivados',
  'publicado_rpi', 'em_exame', 'concedido', 'registrada',
]);

const SLUG_RE = /^[a-z0-9_]+$/;

export const normalizePipelineStageId = (stage?: string | null): string | null => {
  if (!stage || typeof stage !== 'string') return null;

  // Normaliza: lowercase, remove acentos, troca espaços/hífens por _, remove caracteres inválidos
  const cleaned = stage
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

  if (!cleaned || !SLUG_RE.test(cleaned)) return null;

  return PIPELINE_STAGE_ALIASES[cleaned] ?? cleaned;
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
