import { describe, it, expect } from 'vitest';
import { classifyDispatch } from './classifyDispatch';

describe('classifyDispatch', () => {
  it('classifica pelos códigos oficiais da RPI 2906', () => {
    const cases: Array<[string, string]> = [
      ['IPAS009', 'publicacao_oposicao'],
      ['IPAS158', 'concessao'],
      ['IPAS029', 'deferimento'],
      ['IPAS139', 'arquivamento'],
      ['IPAS024', 'indeferimento'],
      ['IPAS136', 'exigencia'],
      ['IPAS270', 'peticao'],
      ['IPAS360', 'recurso'],
    ];
    for (const [code, type] of cases) {
      const r = classifyDispatch({ dispatchCode: code });
      expect(r.dispatch_type).toBe(type);
      expect(r.source).toBe('codigo_oficial');
      expect(r.confidence).toBe(1);
      expect(r.needs_human_review).toBe(false);
    }
  });

  it('usa o nome oficial quando o código não está mapeado', () => {
    const r = classifyDispatch({ dispatchCode: 'IPAS999', dispatchName: 'Indeferimento do pedido' });
    expect(r.dispatch_type).toBe('indeferimento');
    expect(r.source).toBe('nome_oficial');
    expect(r.dispatch_code).toBe('IPAS999');
    expect(r.dispatch_name_original).toBe('Indeferimento do pedido');
  });

  it('usa a estrutura do despacho e depois o texto complementar', () => {
    const porEstrutura = classifyDispatch({ dispatches: [{ code: 'IPAS136', name: 'Exigência de mérito' }] });
    expect(porEstrutura.dispatch_type).toBe('exigencia');
    expect(porEstrutura.source).toBe('estrutura_despacho');

    const porTexto = classifyDispatch({ complementaryText: 'Foi apresentada oposição ao pedido' });
    expect(porTexto.dispatch_type).toBe('oposicao');
    expect(porTexto.source).toBe('texto_complementar');
  });

  it('marca código desconhecido como não classificado com revisão necessária', () => {
    const r = classifyDispatch({ dispatchCode: 'IPAS777' });
    expect(r.dispatch_type).toBe('nao_classificado');
    expect(r.dispatch_label).toBe('Despacho não classificado');
    expect(r.needs_human_review).toBe(true);
    expect(r.dispatch_code).toBe('IPAS777');
  });

  it('sem código e sem texto permanece não classificado', () => {
    const r = classifyDispatch({});
    expect(r.dispatch_type).toBe('nao_classificado');
    expect(r.source).toBe('nenhuma');
    expect(r.confidence).toBe(0);
  });

  it('destituição sobrepõe rótulo, ação e revisão', () => {
    const r = classifyDispatch({ dispatchCode: 'IPAS270', dispatchName: 'Deferimento da petição', isDestituicao: true });
    expect(r.dispatch_label).toBe('Destituição de procurador');
    expect(r.category).toBe('procurador');
    expect(r.priority).toBe('atencao');
    expect(r.suggested_action).toBe('Validar destituição');
    expect(r.needs_human_review).toBe(true);
    expect(r.dispatch_code).toBe('IPAS270');
    expect(r.dispatch_name_original).toBe('Deferimento da petição');
  });

  it('define prioridades coerentes', () => {
    expect(classifyDispatch({ dispatchCode: 'IPAS024' }).priority).toBe('critico');
    expect(classifyDispatch({ dispatchCode: 'IPAS009' }).priority).toBe('informativo');
    expect(classifyDispatch({ dispatchCode: 'IPAS158' }).priority).toBe('positivo');
    expect(classifyDispatch({ dispatchCode: 'IPAS360' }).priority).toBe('atencao');
  });
});
