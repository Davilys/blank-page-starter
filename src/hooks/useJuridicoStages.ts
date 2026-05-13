import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { sanitizePipelineStagesConfig } from '@/lib/pipelineStage';

export interface JuridicoStage {
  id: string;
  label: string;
  color?: string;
  borderColor?: string;
  bgColor?: string;
  textColor?: string;
  description?: string;
}

export const DEFAULT_JURIDICO_STAGES: JuridicoStage[] = [
  { id: 'protocolado', label: 'Protocolado' },
  { id: '003', label: '003' },
  { id: 'oposicao', label: 'Oposição' },
  { id: 'exigencia_merito', label: 'Exigência de Mérito' },
  { id: 'indeferimento', label: 'Indeferimento' },
  { id: 'notificacao', label: 'Notificação Extrajudicial' },
  { id: 'deferimento', label: 'Deferimento' },
  { id: 'certificado', label: 'Certificado' },
  { id: 'renovacao', label: 'Renovação' },
  { id: 'distrato', label: 'Distrato' },
  { id: 'arquivado', label: 'Arquivado' },
];

let cache: { stages: JuridicoStage[] } | null = null;
const subscribers = new Set<(s: JuridicoStage[]) => void>();

const notify = (stages: JuridicoStage[]) => {
  cache = { stages };
  subscribers.forEach(fn => fn(stages));
};

const fetchOnce = async (): Promise<JuridicoStage[]> => {
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'admin_kanban_juridico_stages')
    .maybeSingle();

  let stages: JuridicoStage[] = DEFAULT_JURIDICO_STAGES;
  if (data?.value && typeof data.value === 'object' && 'stages' in (data.value as any)) {
    const raw = (data.value as any).stages as JuridicoStage[];
    const sanitized = sanitizePipelineStagesConfig(raw) as JuridicoStage[];
    if (sanitized.length > 0) stages = sanitized;
  }
  notify(stages);
  return stages;
};

export const refreshJuridicoStages = () => fetchOnce();

export function useJuridicoStages() {
  const [stages, setStages] = useState<JuridicoStage[]>(cache?.stages ?? DEFAULT_JURIDICO_STAGES);

  useEffect(() => {
    subscribers.add(setStages);
    if (!cache) fetchOnce();
    else setStages(cache.stages);

    // Realtime: re-busca quando a configuração mudar
    const channel = supabase
      .channel('juridico_stages_settings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_settings', filter: 'key=eq.admin_kanban_juridico_stages' },
        () => { fetchOnce(); }
      )
      .subscribe();

    return () => {
      subscribers.delete(setStages);
      supabase.removeChannel(channel);
    };
  }, []);

  const stageById: Record<string, JuridicoStage> = {};
  stages.forEach(s => { stageById[s.id] = s; });

  return { stages, stageById };
}