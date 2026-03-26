/**
 * WebMarcas Intelligence PI™ — Motor de Monetização Híbrido
 * 
 * Módulo isolado, desativável, sem dependência estrutural.
 * Analisa dados existentes e gera sugestões de upsell.
 */

import { supabase } from '@/integrations/supabase/client';

// ─── Tipos ───────────────────────────────────────────
export interface UpsellRecommendation {
  id: string;
  tipo: 'classe_complementar' | 'blindagem_cnpj' | 'madrid_protocol' | 'protecao_premium';
  titulo: string;
  descricao: string;
  justificativa: string;
  prioridade: number; // 0-100
  confidence: number; // 0-100
  isPremium: boolean;
  classesSugeridas?: number[];
}

export interface EngineState {
  enabled: boolean;
  mode: 'fixed' | 'hybrid' | 'intelligent';
  globalConfidence: number;
  lastRecalculation: string | null;
}

export interface UpsellContext {
  classeAtual?: number;
  segmento?: string;
  scoreComercial?: number;
  multipleCnpjs?: boolean;
  brandName?: string;
  userId?: string;
}

// ─── Regras Fixas (Etapa 1) ─────────────────────────
const FIXED_RULES: Array<{
  condition: (ctx: UpsellContext) => boolean;
  recommendation: Omit<UpsellRecommendation, 'id' | 'confidence' | 'isPremium'>;
}> = [
  {
    // Classes 25, 3, 30, 5 → Sugerir Classe 35
    condition: (ctx) => [25, 3, 30, 5].includes(ctx.classeAtual || 0),
    recommendation: {
      tipo: 'classe_complementar',
      titulo: 'Proteção Comercial Classe 35',
      descricao: 'Proteja sua marca também na classe de serviços comerciais e publicidade.',
      justificativa: 'Sua marca está na classe {classe}. Marcas nesta categoria têm 3x mais chances de sofrer uso indevido em marketplaces e publicidade online.',
      prioridade: 85,
      classesSugeridas: [35],
    },
  },
  {
    // Score alto → Proteção complementar
    condition: (ctx) => (ctx.scoreComercial || 0) >= 80,
    recommendation: {
      tipo: 'protecao_premium',
      titulo: 'Proteção Premium Recomendada',
      descricao: 'Sua marca tem alto potencial de deferimento. Amplie a proteção.',
      justificativa: 'Com score de deferimento acima de 80%, sua marca tem excelente viabilidade. Recomendamos proteção em classes adjacentes para blindagem completa.',
      prioridade: 75,
    },
  },
  {
    // Múltiplos CNPJs → Blindagem
    condition: (ctx) => ctx.multipleCnpjs === true,
    recommendation: {
      tipo: 'blindagem_cnpj',
      titulo: 'Blindagem Multi-CNPJ',
      descricao: 'Proteja sua marca em todos os seus CNPJs cadastrados.',
      justificativa: 'Identificamos que você possui múltiplos CNPJs. Sem a blindagem, outra empresa pode registrar sua marca em um segmento diferente.',
      prioridade: 90,
    },
  },
  {
    // Potencial internacional (classes de tecnologia/software)
    condition: (ctx) => [9, 42, 41, 38].includes(ctx.classeAtual || 0),
    recommendation: {
      tipo: 'madrid_protocol',
      titulo: 'Proteção Internacional (Madrid)',
      descricao: 'Sua marca tem perfil para proteção internacional via Protocolo de Madrid.',
      justificativa: 'Marcas na classe {classe} frequentemente expandem para mercados internacionais. O Protocolo de Madrid permite proteção em 130+ países.',
      prioridade: 60,
    },
  },
];

// ─── Classes Adjacentes Comuns ──────────────────────
const CLASS_ADJACENCY: Record<number, number[]> = {
  25: [35, 18],    // Vestuário → Comércio, Bolsas
  3: [35, 5, 44],  // Cosméticos → Comércio, Farmácia, Medicina
  30: [35, 29, 43],// Alimentos → Comércio, Proteínas, Restaurantes
  5: [35, 3, 44],  // Farmácia → Comércio, Cosméticos, Medicina
  9: [42, 38, 35], // Tecnologia → Software, Telecomunicações, Comércio
  42: [9, 35, 41], // Software → Tecnologia, Comércio, Educação
  41: [42, 35, 9], // Educação → Software, Comércio, Tecnologia
  43: [30, 35, 29],// Restaurantes → Alimentos, Comércio, Proteínas
  35: [25, 3, 42], // Comércio → Vestuário, Cosméticos, Software
};

// ─── Motor Principal ────────────────────────────────
export async function generateRecommendations(ctx: UpsellContext): Promise<UpsellRecommendation[]> {
  const recommendations: UpsellRecommendation[] = [];
  
  // 1) Buscar estado do motor
  const engineState = await getEngineState();
  if (!engineState.enabled) return [];

  // 2) Aplicar regras fixas
  for (const rule of FIXED_RULES) {
    if (rule.condition(ctx)) {
      const rec = { ...rule.recommendation };
      rec.justificativa = rec.justificativa.replace('{classe}', String(ctx.classeAtual || ''));
      
      let confidence = 50; // base para regras fixas
      let prioridade = rec.prioridade;
      let isPremium = false;

      // 3) Se modo híbrido/inteligente, ajustar com pesos aprendidos
      if (engineState.mode !== 'fixed') {
        const weights = await getWeights(ctx);
        
        if (weights.classeWeight !== null) {
          const factor = weights.classeWeight / 100;
          prioridade = Math.round(prioridade * (0.5 + factor * 0.5));
          confidence = Math.max(confidence, weights.classeConfidence);
        }
        
        if (weights.segmentoWeight !== null) {
          const factor = weights.segmentoWeight / 100;
          prioridade = Math.round(prioridade * (0.7 + factor * 0.3));
          confidence = Math.max(confidence, weights.segmentoConfidence);
        }

        isPremium = weights.isPremium;
      }

      // Em modo inteligente, filtrar sugestões com baixa taxa
      if (engineState.mode === 'intelligent' && confidence > 70) {
        const weights = await getWeights(ctx);
        if (weights.classeAcceptRate !== null && weights.classeAcceptRate < 30) {
          prioridade = Math.round(prioridade * 0.5); // reduzir prioridade
        }
      }

      recommendations.push({
        id: `${rec.tipo}_${ctx.classeAtual || 'gen'}`,
        ...rec,
        prioridade: Math.min(prioridade, 100),
        confidence: Math.min(confidence, 100),
        isPremium,
      });
    }
  }

  // 4) Sugerir classes adjacentes (sempre, mas com prioridade baseada em dados)
  if (ctx.classeAtual && CLASS_ADJACENCY[ctx.classeAtual]) {
    const adjacent = CLASS_ADJACENCY[ctx.classeAtual];
    const existing = recommendations.flatMap(r => r.classesSugeridas || []);
    const newClasses = adjacent.filter(c => !existing.includes(c));
    
    if (newClasses.length > 0 && !recommendations.find(r => r.tipo === 'classe_complementar')) {
      recommendations.push({
        id: `adjacent_${ctx.classeAtual}`,
        tipo: 'classe_complementar',
        titulo: 'Classes Complementares Sugeridas',
        descricao: `Proteja sua marca nas classes ${newClasses.join(', ')} para blindagem completa.`,
        justificativa: `Baseado na análise do seu segmento, essas classes são frequentemente disputadas por concorrentes.`,
        prioridade: 55,
        confidence: 40,
        isPremium: false,
        classesSugeridas: newClasses,
      });
    }
  }

  // Ordenar por prioridade
  return recommendations.sort((a, b) => b.prioridade - a.prioridade);
}

// ─── Buscar Estado do Motor ─────────────────────────
export async function getEngineState(): Promise<EngineState> {
  try {
    const { data } = await supabase
      .from('upsell_engine_config' as any)
      .select('*')
      .limit(1)
      .maybeSingle();

    if (!data) return { enabled: true, mode: 'fixed', globalConfidence: 0, lastRecalculation: null };

    const d = data as any;
    return {
      enabled: d.engine_enabled ?? true,
      mode: d.mode || 'fixed',
      globalConfidence: Number(d.global_confidence) || 0,
      lastRecalculation: d.last_recalculation || null,
    };
  } catch {
    return { enabled: true, mode: 'fixed', globalConfidence: 0, lastRecalculation: null };
  }
}

// ─── Buscar Pesos Aprendidos ────────────────────────
async function getWeights(ctx: UpsellContext) {
  let classeWeight: number | null = null;
  let classeConfidence = 0;
  let classeAcceptRate: number | null = null;
  let segmentoWeight: number | null = null;
  let segmentoConfidence = 0;
  let isPremium = false;

  try {
    if (ctx.classeAtual) {
      const { data } = await supabase
        .from('upsell_engine_weights' as any)
        .select('*')
        .eq('dimension', 'classe')
        .eq('dimension_value', String(ctx.classeAtual))
        .maybeSingle();
      
      if (data) {
        const d = data as any;
        classeWeight = Number(d.peso);
        classeConfidence = Number(d.confidence_index) || 0;
        classeAcceptRate = Number(d.taxa_aceite);
        isPremium = d.is_premium || false;
      }
    }

    if (ctx.segmento) {
      const { data } = await supabase
        .from('upsell_engine_weights' as any)
        .select('*')
        .eq('dimension', 'segmento')
        .eq('dimension_value', ctx.segmento)
        .maybeSingle();
      
      if (data) {
        const d = data as any;
        segmentoWeight = Number(d.peso);
        segmentoConfidence = Number(d.confidence_index) || 0;
        if (d.is_premium) isPremium = true;
      }
    }
  } catch {
    // silently fail
  }

  return { classeWeight, classeConfidence, classeAcceptRate, segmentoWeight, segmentoConfidence, isPremium };
}

// ─── Registrar Resposta do Upsell ───────────────────
export async function logUpsellResponse(params: {
  userId?: string;
  classe?: number;
  segmento?: string;
  score?: number;
  upsellSugerido: string;
  upsellTipo: string;
  aceitou: boolean;
  confidence: number;
}) {
  try {
    await supabase.from('upsell_monetization_logs' as any).insert({
      user_id: params.userId || null,
      classe_principal: params.classe ? String(params.classe) : null,
      segmento: params.segmento || null,
      score_comercial: params.score || 0,
      upsell_sugerido: params.upsellSugerido,
      upsell_tipo: params.upsellTipo,
      aceitou: params.aceitou,
      confidence_index: params.confidence,
    });
  } catch (err) {
    console.error('Failed to log upsell response:', err);
  }
}

// ─── Recalcular Pesos (chamada manual) ──────────────
export async function recalculateWeights(): Promise<{ success: boolean; message: string }> {
  try {
    const { data, error } = await supabase.rpc('recalculate_upsell_weights');
    if (error) throw error;
    return { success: true, message: `Pesos recalculados. ${(data as any)?.weights_updated || 0} dimensões atualizadas.` };
  } catch (err: any) {
    return { success: false, message: err.message || 'Erro ao recalcular' };
  }
}

// ─── Buscar Estatísticas do Motor ───────────────────
export async function getEngineStats() {
  try {
    const [logsRes, weightsRes, configRes] = await Promise.all([
      supabase.from('upsell_monetization_logs' as any).select('id, aceitou, upsell_tipo, created_at'),
      supabase.from('upsell_engine_weights' as any).select('*'),
      supabase.from('upsell_engine_config' as any).select('*').limit(1).maybeSingle(),
    ]);

    const logs = (logsRes.data || []) as any[];
    const weights = (weightsRes.data || []) as any[];
    const config = configRes.data as any;

    const totalSugestoes = logs.length;
    const totalAceites = logs.filter((l: any) => l.aceitou === true).length;
    const totalRecusas = logs.filter((l: any) => l.aceitou === false).length;
    const pendentes = logs.filter((l: any) => l.aceitou === null).length;
    const taxaGlobalAceite = totalSugestoes > 0 ? Math.round(((totalAceites) / (totalAceites + totalRecusas || 1)) * 100) : 0;

    const premiumWeights = weights.filter((w: any) => w.is_premium);
    const topClasses = weights
      .filter((w: any) => w.dimension === 'classe')
      .sort((a: any, b: any) => (b.taxa_aceite || 0) - (a.taxa_aceite || 0))
      .slice(0, 5);

    return {
      totalSugestoes,
      totalAceites,
      totalRecusas,
      pendentes,
      taxaGlobalAceite,
      premiumCount: premiumWeights.length,
      topClasses,
      engineMode: config?.mode || 'fixed',
      globalConfidence: Number(config?.global_confidence) || 0,
      lastRecalculation: config?.last_recalculation,
      engineEnabled: config?.engine_enabled ?? true,
    };
  } catch {
    return {
      totalSugestoes: 0, totalAceites: 0, totalRecusas: 0, pendentes: 0,
      taxaGlobalAceite: 0, premiumCount: 0, topClasses: [],
      engineMode: 'fixed', globalConfidence: 0, lastRecalculation: null, engineEnabled: true,
    };
  }
}
