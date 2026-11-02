import { describe, it, expect } from 'vitest';
import { derivePhaseFromInpi, getDisplayedPhase, prettifySlug } from './inpiStatus';

const lookup = (current_status: string | null, queried_at = '2026-11-01T20:35:00Z') => ({
  current_status,
  queried_at,
});

describe('derivePhaseFromInpi — 12 textos oficiais reais do cache de produção', () => {
  const cases: Array<[string, string]> = [
    ['Aguardando apresentação e exame de recurso contra o indeferimento', 'Recurso contra indeferimento'],
    ['Aguardando cumprimento de exigência de mérito', 'Exigência de Mérito'],
    ['Aguardando cumprimento de exigência de pagamento', 'Deferimento'],
    ['Aguardando manifestação sobre oposição', 'Oposição'],
    ['Aguardando prazo de apresentação de oposição', 'Prazo de oposição'],
    ['Aguardando processamento da concessão do registro de marca', 'Deferimento'],
    ['Em exame de mérito', 'Em exame de mérito'],
    ['Para liberar para exame de mérito (pedido de registro sem oposição)', 'Aguardando exame de mérito'],
    ['Pedido considerado inexistente', 'Pedido inexistente'],
    ['Pedido de registro de marca indeferido (sem interposição de recurso)', 'Indeferimento'],
    ['Pedido definitivamente arquivado', 'Arquivado'],
    ['Registro de marca em vigor', 'Registro em vigor'],
  ];

  it.each(cases)('mapeia "%s"', (text, expected) => {
    expect(derivePhaseFromInpi(text)?.label).toBe(expected);
  });

  it('tolera variação de acentos, caixa e espaços', () => {
    expect(derivePhaseFromInpi('  REGISTRO   DE MARCA EM VIGOR ')?.label).toBe('Registro em vigor');
    expect(derivePhaseFromInpi('Em exame de merito')?.label).toBe('Em exame de mérito');
  });

  it('retorna null para texto desconhecido (nunca adivinha)', () => {
    expect(derivePhaseFromInpi('Texto novo do INPI nunca visto')).toBeNull();
    expect(derivePhaseFromInpi(null)).toBeNull();
    expect(derivePhaseFromInpi('')).toBeNull();
  });
});

describe('getDisplayedPhase', () => {
  it('prefere a situação oficial do INPI quando reconhecida', () => {
    const phase = getDisplayedPhase({
      lookup: lookup('Registro de marca em vigor'),
      pipelineStage: 'deferimento',
      status: 'em_andamento',
    });
    expect(phase).toMatchObject({ label: 'Registro em vigor', source: 'inpi', syncedAt: '2026-11-01T20:35:00Z' });
  });

  it('REGRESSÃO: pipeline_stage=deferimento nunca renderiza "Protocolado"', () => {
    const phase = getDisplayedPhase({ pipelineStage: 'deferimento' });
    expect(phase.label).toBe('Deferimento');
    expect(phase.source).toBe('crm');
  });

  it('usa o rótulo do cadastro central quando disponível', () => {
    const phase = getDisplayedPhase({
      pipelineStage: 'exigencia_merito',
      stageLabel: (id) => (id === 'exigencia_merito' ? 'Exigência de Mérito' : null),
    });
    expect(phase.label).toBe('Exigência de Mérito');
  });

  it('valor desconhecido do CRM vira texto legível, não "Protocolado"', () => {
    const phase = getDisplayedPhase({ pipelineStage: 'aguardando_cliente' });
    expect(phase.label).toBe('Aguardando cliente');
  });

  it('sem nenhuma informação, cai no padrão histórico Protocolado', () => {
    expect(getDisplayedPhase({}).label).toBe('Protocolado');
  });

  it('lookup com texto desconhecido cai para o CRM sem quebrar', () => {
    const phase = getDisplayedPhase({ lookup: lookup('Situação nova'), pipelineStage: 'deferimento' });
    expect(phase.label).toBe('Deferimento');
    expect(phase.source).toBe('crm');
  });
});

describe('prettifySlug', () => {
  it('converte slugs em texto legível', () => {
    expect(prettifySlug('deferimento')).toBe('Deferimento');
    expect(prettifySlug('assinou_contrato')).toBe('Assinou contrato');
  });
});
