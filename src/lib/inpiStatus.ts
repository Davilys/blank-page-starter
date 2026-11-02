/**
 * Fase EXIBIDA ao cliente na área do cliente.
 *
 * Deriva da última consulta oficial ao INPI (cache compartilhado
 * rpi_process_lookups) quando reconhecida, e cai para o vocabulário do CRM
 * (pipeline_stage / status) quando não há consulta ou o texto é desconhecido.
 * Camada de apresentação apenas: NUNCA escreve em brand_processes.
 */

export interface InpiLookupLike {
  current_status: string | null;
  queried_at: string | null;
}

export interface PhaseDisplay {
  label: string;
  /** classe Tailwind da bolinha de cor */
  dotClass: string;
  source: 'inpi' | 'crm';
  syncedAt: string | null;
}

interface MappedPhase {
  id: string;
  label: string;
}

const normalize = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Mapeamento conservador: somente textos oficiais já observados no cache de
 * produção (rpi_process_lookups, 12 valores catalogados em 01/11/2026).
 * Qualquer texto novo retorna null e a UI cai para a fase do CRM — nunca
 * adivinhamos uma fase a partir de um texto que não conhecemos.
 */
const INPI_STATUS_PHASES: Record<string, MappedPhase> = {
  'aguardando apresentacao e exame de recurso contra o indeferimento': {
    id: 'indeferimento',
    label: 'Recurso contra indeferimento',
  },
  'aguardando cumprimento de exigencia de merito': {
    id: 'exigencia_merito',
    label: 'Exigência de Mérito',
  },
  'aguardando cumprimento de exigencia de pagamento': {
    id: 'deferimento',
    label: 'Deferimento',
  },
  'aguardando manifestacao sobre oposicao': { id: 'oposicao', label: 'Oposição' },
  'aguardando prazo de apresentacao de oposicao': {
    id: 'oposicao',
    label: 'Prazo de oposição',
  },
  'aguardando processamento da concessao do registro de marca': {
    id: 'deferimento',
    label: 'Deferimento',
  },
  'em exame de merito': { id: 'em_exame', label: 'Em exame de mérito' },
  'para liberar para exame de merito (pedido de registro sem oposicao)': {
    id: 'em_exame',
    label: 'Aguardando exame de mérito',
  },
  'pedido considerado inexistente': { id: 'arquivado', label: 'Pedido inexistente' },
  'pedido de registro de marca indeferido (sem interposicao de recurso)': {
    id: 'indeferimento',
    label: 'Indeferimento',
  },
  'pedido definitivamente arquivado': { id: 'arquivado', label: 'Arquivado' },
  'registro de marca em vigor': { id: 'certificado', label: 'Registro em vigor' },
};

const PHASE_DOT: Record<string, string> = {
  protocolado: 'bg-blue-500',
  '003': 'bg-yellow-500',
  oposicao: 'bg-orange-500',
  exigencia_merito: 'bg-violet-500',
  em_exame: 'bg-amber-500',
  indeferimento: 'bg-red-500',
  notificacao: 'bg-pink-500',
  deferimento: 'bg-emerald-500',
  certificado: 'bg-teal-500',
  renovacao: 'bg-cyan-500',
  arquivado: 'bg-zinc-500',
  distrato: 'bg-zinc-500',
};

const DEFAULT_DOT = 'bg-slate-400';

export function derivePhaseFromInpi(currentStatus: string | null | undefined): MappedPhase | null {
  if (!currentStatus) return null;
  return INPI_STATUS_PHASES[normalize(currentStatus)] ?? null;
}

/** 'exigencia_merito' -> 'Exigencia merito' (fallback legível quando não há rótulo cadastrado) */
export function prettifySlug(slug: string): string {
  const clean = slug.replace(/_/g, ' ').trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Resolve a fase exibida. Precedência:
 * 1) situação oficial da última consulta ao INPI, quando reconhecida;
 * 2) pipeline_stage do CRM, com rótulo do cadastro central (ou o valor legível);
 * 3) status do CRM, mesmo critério;
 * 4) 'Protocolado' (padrão histórico para processo recém-depositado).
 *
 * Um valor desconhecido NUNCA vira "Protocolado" (regressão do bug antigo, em
 * que pipeline_stage='deferimento' renderizava "Protocolado").
 */
export function getDisplayedPhase(opts: {
  lookup?: InpiLookupLike | null;
  pipelineStage?: string | null;
  status?: string | null;
  stageLabel?: (id: string) => string | null;
}): PhaseDisplay {
  const { lookup, pipelineStage, status, stageLabel } = opts;

  const official = derivePhaseFromInpi(lookup?.current_status ?? null);
  if (official) {
    return {
      label: official.label,
      dotClass: PHASE_DOT[official.id] ?? DEFAULT_DOT,
      source: 'inpi',
      syncedAt: lookup?.queried_at ?? null,
    };
  }

  const crmValue = pipelineStage || status || 'protocolado';
  const label = stageLabel?.(crmValue) ?? prettifySlug(crmValue);
  return {
    label,
    dotClass: PHASE_DOT[crmValue] ?? DEFAULT_DOT,
    source: 'crm',
    syncedAt: null,
  };
}

export const LOOKUP_FRESH_MS = 24 * 60 * 60 * 1000;

/** Consulta oficial conta como fresca por 24 h (mesmo TTL do cache do motor). */
export function isLookupFresh(queriedAt: string | null | undefined): boolean {
  if (!queriedAt) return false;
  const t = Date.parse(queriedAt);
  return !Number.isNaN(t) && Date.now() - t < LOOKUP_FRESH_MS;
}
