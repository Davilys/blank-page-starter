/**
 * Classificação única e determinística dos despachos da RPI.
 *
 * Ordem de precedência (nunca usa IA):
 *  1. Código oficial do despacho extraído do XML
 *  2. Nome oficial do despacho presente no XML
 *  3. Estrutura/atributos do despacho (lista `dispatches`)
 *  4. Texto complementar
 *  5. Protocolos vinculados
 *  6. Mapeamento interno de códigos (prefixos)
 *  7. Classificação textual — somente como fallback
 *
 * O código e o nome originais são sempre preservados na saída.
 */

export type DispatchCategory =
  | 'exigencia'
  | 'indeferimento'
  | 'deferimento'
  | 'oposicao'
  | 'publicacao_oposicao'
  | 'recurso'
  | 'concessao'
  | 'arquivamento'
  | 'procurador'
  | 'peticao'
  | 'renovacao'
  | 'nulidade'
  | 'caducidade'
  | 'sobrestamento'
  | 'administrativo'
  | 'nao_classificado';

export type DispatchPriority = 'critico' | 'atencao' | 'informativo' | 'positivo';

export interface DispatchClassification {
  dispatch_code: string | null;
  dispatch_name_original: string | null;
  dispatch_type: string;
  dispatch_label: string;
  category: DispatchCategory;
  priority: DispatchPriority;
  summary: string;
  suggested_action: string;
  confidence: number;
  needs_human_review: boolean;
  source: 'codigo_oficial' | 'nome_oficial' | 'estrutura_despacho' | 'texto_complementar' | 'protocolo' | 'texto_fallback' | 'nenhuma';
}

export interface DispatchInput {
  dispatchCode?: string | null;
  dispatchName?: string | null;
  complementaryText?: string | null;
  protocols?: unknown;
  dispatches?: unknown;
  isDestituicao?: boolean;
  isNomeacao?: boolean;
  isSubstituicao?: boolean;
}

interface CategoryProfile {
  label: string;
  category: DispatchCategory;
  priority: DispatchPriority;
  summary: string;
  action: string;
}

export const CATEGORY_PROFILES: Record<DispatchCategory, CategoryProfile> = {
  exigencia: {
    label: 'Exigência de mérito',
    category: 'exigencia',
    priority: 'critico',
    summary: 'O INPI publicou exigência que precisa ser analisada e cumprida no prazo.',
    action: 'Analisar exigência',
  },
  indeferimento: {
    label: 'Indeferimento',
    category: 'indeferimento',
    priority: 'critico',
    summary: 'Pedido de registro indeferido pelo INPI.',
    action: 'Avaliar recurso',
  },
  deferimento: {
    label: 'Deferimento',
    category: 'deferimento',
    priority: 'positivo',
    summary: 'Pedido deferido e aguardando providência da etapa seguinte.',
    action: 'Conferir próxima etapa',
  },
  oposicao: {
    label: 'Oposição recebida',
    category: 'oposicao',
    priority: 'critico',
    summary: 'Foi apresentada oposição de terceiro contra o pedido.',
    action: 'Preparar manifestação',
  },
  publicacao_oposicao: {
    label: 'Publicação para oposição',
    category: 'publicacao_oposicao',
    priority: 'informativo',
    summary: 'Marca publicada para apresentação de oposição por terceiros.',
    action: 'Aguardar período de oposição',
  },
  recurso: {
    label: 'Recurso',
    category: 'recurso',
    priority: 'atencao',
    summary: 'Movimentação de recurso publicada neste processo.',
    action: 'Conferir prazo',
  },
  concessao: {
    label: 'Concessão do registro',
    category: 'concessao',
    priority: 'positivo',
    summary: 'Registro concedido pelo INPI.',
    action: 'Conferir concessão',
  },
  arquivamento: {
    label: 'Arquivamento',
    category: 'arquivamento',
    priority: 'critico',
    summary: 'Pedido arquivado pelo INPI.',
    action: 'Conferir prazo',
  },
  procurador: {
    label: 'Alteração de procurador',
    category: 'procurador',
    priority: 'atencao',
    summary: 'Publicação informa alteração de representação no processo.',
    action: 'Validar alteração',
  },
  peticao: {
    label: 'Petição',
    category: 'peticao',
    priority: 'informativo',
    summary: 'Petição publicada neste processo.',
    action: 'Somente acompanhar',
  },
  renovacao: {
    label: 'Prorrogação / Renovação',
    category: 'renovacao',
    priority: 'positivo',
    summary: 'Prorrogação do registro publicada.',
    action: 'Conferir vigência',
  },
  nulidade: {
    label: 'Nulidade',
    category: 'nulidade',
    priority: 'critico',
    summary: 'Processo administrativo de nulidade publicado.',
    action: 'Preparar manifestação',
  },
  caducidade: {
    label: 'Caducidade',
    category: 'caducidade',
    priority: 'critico',
    summary: 'Pedido de caducidade publicado contra o registro.',
    action: 'Preparar manifestação',
  },
  sobrestamento: {
    label: 'Sobrestamento',
    category: 'sobrestamento',
    priority: 'informativo',
    summary: 'Exame sobrestado até decisão de processo relacionado.',
    action: 'Somente acompanhar',
  },
  administrativo: {
    label: 'Despacho administrativo',
    category: 'administrativo',
    priority: 'informativo',
    summary: 'Andamento administrativo publicado pelo INPI.',
    action: 'Somente acompanhar',
  },
  nao_classificado: {
    label: 'Despacho não classificado',
    category: 'nao_classificado',
    priority: 'atencao',
    summary: 'Despacho publicado sem classificação segura.',
    action: 'Completar informações',
  },
};

/** Mapa interno de códigos oficiais IPAS → categoria. */
export const DISPATCH_CODE_MAP: Record<string, DispatchCategory> = {
  IPAS009: 'publicacao_oposicao',
  IPAS024: 'indeferimento',
  IPAS029: 'deferimento',
  IPAS136: 'exigencia',
  IPAS139: 'arquivamento',
  IPAS158: 'concessao',
  IPAS270: 'peticao',
  IPAS360: 'recurso',
};

export function normalize(value: string | null | undefined): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function categoryFromText(text: string): DispatchCategory | null {
  if (!text) return null;
  if (text.includes('destitui') || text.includes('nomeacao de procurador') || text.includes('substituicao de procurador') || text.includes('nomeado novo representante')) return 'procurador';
  if (text.includes('caducidade')) return 'caducidade';
  if (text.includes('nulidade')) return 'nulidade';
  if (text.includes('sobrestamento') || text.includes('sobrestado')) return 'sobrestamento';
  if (text.includes('exigencia')) return 'exigencia';
  if (text.includes('publicacao de pedido de registro para oposicao') || text.includes('para oposicao')) return 'publicacao_oposicao';
  if (text.includes('oposicao')) return 'oposicao';
  if (text.includes('recurso')) return 'recurso';
  if (text.includes('arquivamento') || text.includes('arquivado')) return 'arquivamento';
  if (text.includes('indeferimento') || text.includes('indeferido')) return 'indeferimento';
  if (text.includes('concessao de registro') || text.includes('certificado')) return 'concessao';
  if (text.includes('prorrogacao') || text.includes('renovacao')) return 'renovacao';
  if (text.includes('deferimento da peticao') || text.includes('peticao')) return 'peticao';
  if (text.includes('deferimento') || text.includes('deferido')) return 'deferimento';
  return null;
}

function toArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function classifyDispatch(input: DispatchInput): DispatchClassification {
  const code = (input.dispatchCode || '').trim().toUpperCase() || null;
  const nameOriginal = input.dispatchName?.trim() || null;
  const text = input.complementaryText?.trim() || null;

  let category: DispatchCategory | null = null;
  let source: DispatchClassification['source'] = 'nenhuma';
  let confidence = 0;

  // 1. código oficial
  if (code && DISPATCH_CODE_MAP[code]) {
    category = DISPATCH_CODE_MAP[code];
    source = 'codigo_oficial';
    confidence = 1;
  }

  // 2. nome oficial do XML
  if (!category && nameOriginal) {
    const fromName = categoryFromText(normalize(nameOriginal));
    if (fromName) {
      category = fromName;
      source = 'nome_oficial';
      confidence = 0.9;
    }
  }

  // 3. estrutura/atributos do despacho
  if (!category) {
    for (const d of toArray(input.dispatches)) {
      const fromStructure =
        (d?.code && DISPATCH_CODE_MAP[String(d.code).toUpperCase()]) ||
        categoryFromText(normalize(`${d?.name || ''} ${d?.text || ''}`));
      if (fromStructure) {
        category = fromStructure as DispatchCategory;
        source = 'estrutura_despacho';
        confidence = 0.8;
        break;
      }
    }
  }

  // 4. texto complementar
  if (!category && text) {
    const fromText = categoryFromText(normalize(text));
    if (fromText) {
      category = fromText;
      source = 'texto_complementar';
      confidence = 0.65;
    }
  }

  // 5. protocolos vinculados
  if (!category) {
    for (const p of toArray(input.protocols)) {
      const fromProtocol = categoryFromText(normalize(`${p?.service || ''} ${p?.name || ''} ${p?.text || ''}`));
      if (fromProtocol) {
        category = fromProtocol;
        source = 'protocolo';
        confidence = 0.6;
        break;
      }
    }
  }

  // 6. mapeamento interno por prefixo de código
  if (!category && code) {
    const numeric = Number(code.replace(/\D/g, ''));
    if (Number.isFinite(numeric) && numeric > 0) {
      const byRange = categoryFromText(normalize(`${nameOriginal || ''} ${text || ''}`));
      if (byRange) {
        category = byRange;
        source = 'texto_fallback';
        confidence = 0.5;
      }
    }
  }

  const profile = CATEGORY_PROFILES[category ?? 'nao_classificado'];

  // Movimentações de procurador sobrepõem rótulo e ação (auditoria obrigatória)
  let label = profile.label;
  let summary = profile.summary;
  let action = profile.action;
  let priority = profile.priority;
  let needsReview = category === null;

  if (input.isDestituicao) {
    label = 'Destituição de procurador';
    summary = 'Publicação informa a destituição do procurador monitorado.';
    action = 'Validar destituição';
    priority = 'atencao';
    needsReview = true;
  } else if (input.isNomeacao) {
    label = 'Nomeação de procurador';
    summary = 'Publicação informa a nomeação de procurador no processo.';
    action = 'Validar nomeação';
    priority = 'atencao';
    needsReview = true;
  } else if (input.isSubstituicao) {
    label = 'Substituição de procurador';
    summary = 'Publicação informa a substituição de procurador no processo.';
    action = 'Validar substituição';
    priority = 'atencao';
    needsReview = true;
  }

  return {
    dispatch_code: code,
    dispatch_name_original: nameOriginal,
    dispatch_type: category ?? 'nao_classificado',
    dispatch_label: label,
    category: input.isDestituicao || input.isNomeacao || input.isSubstituicao ? 'procurador' : (category ?? 'nao_classificado'),
    priority,
    summary: nameOriginal && category === null ? `${summary} Nome original: ${nameOriginal}.` : summary,
    suggested_action: action,
    confidence: input.isDestituicao || input.isNomeacao || input.isSubstituicao ? Math.max(confidence, 0.9) : confidence,
    needs_human_review: needsReview,
    source,
  };
}

/** Cor semântica por categoria (usada nos selos e na borda lateral). */
export const CATEGORY_TONE: Record<DispatchCategory, 'red' | 'orange' | 'amber' | 'blue' | 'green' | 'purple' | 'gray'> = {
  indeferimento: 'red',
  nulidade: 'red',
  caducidade: 'red',
  arquivamento: 'red',
  exigencia: 'orange',
  oposicao: 'orange',
  publicacao_oposicao: 'blue',
  peticao: 'blue',
  recurso: 'blue',
  administrativo: 'blue',
  sobrestamento: 'blue',
  deferimento: 'green',
  concessao: 'green',
  renovacao: 'green',
  procurador: 'purple',
  nao_classificado: 'gray',
};

export const PRIORITY_LABEL: Record<DispatchPriority, string> = {
  critico: 'Crítico',
  atencao: 'Atenção',
  informativo: 'Informativo',
  positivo: 'Concluído',
};
