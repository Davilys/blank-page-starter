import { describe, expect, it } from 'vitest';
import { orientationItemText } from './orientationDisplay';
import { isTrustedInpiStep } from '../../../supabase/functions/_shared/inpiInternalAuth';

describe('autenticação da execução interna', () => {
  const headers = (token = 'test-server-key', internal = '1') => new Headers({ Authorization: `Bearer ${token}`, 'x-internal-job': internal });
  it('aceita a chave do servidor somente com o cabeçalho interno', () => {
    expect(isTrustedInpiStep(headers(), 'test-server-key')).toBe(true);
  });
  it('não aceita somente o cabeçalho interno com JWT de usuário', () => {
    expect(isTrustedInpiStep(headers('user-jwt'), 'test-server-key')).toBe(false);
  });
  it('não aceita chave ausente nem o sentinela antigo', () => {
    expect(isTrustedInpiStep(headers('__none__'), undefined)).toBe(false);
    expect(isTrustedInpiStep(headers(''), '')).toBe(false);
  });
  it('não trata chamada normal como job interno', () => {
    expect(isTrustedInpiStep(headers('test-server-key', '0'), 'test-server-key')).toBe(false);
    expect(isTrustedInpiStep(new Headers(), 'test-server-key')).toBe(false);
  });
});

describe('orientação legível', () => {
  it('formata fundamento e fontes', () => {
    expect(orientationItemText({ titulo: 'Cotejo', descricao: 'Comparar conjuntos.', fontes: ['DOC:01'] }))
      .toBe('Cotejo — Comparar conjuntos. · Fontes: DOC:01');
  });
  it('preserva a finalidade da prova sem JSON', () => {
    expect(orientationItemText({ documento: 'DOC:02', o_que_demonstra: 'Uso público', forca: 'media' }))
      .toBe('DOC:02 — Uso público');
  });
  it('formata recomendação documental', () => {
    expect(orientationItemText({ documento: 'GRU', finalidade: 'Conferir vinculação' }))
      .toBe('GRU — Conferir vinculação');
  });
  it('preserva textos e trata valores inesperados', () => {
    expect(orientationItemText('Sem mudanças')).toBe('Sem mudanças');
    expect(orientationItemText(null)).toBe('');
    expect(orientationItemText({ fontes: [{ segredo: 'não exibir' }] })).not.toContain('segredo');
  });
});

describe('preparação dos anexos da geração', () => {
  it('documenta o cenário que causava input_file sem conteúdo', () => {
    const mixedParts = [
      { type: 'text', text: 'Inventário' },
      { type: 'text', text: '[DOC:01]' },
      { type: 'file', file: { filename: 'decisão.pdf' } },
      { type: 'text', text: '[DOC:02]' },
      { type: 'file', file: { filename: 'prova.pdf' } },
    ];
    const attachments = mixedParts.filter((part) => part.type === 'file' || part.type === 'image_url');
    expect(attachments).toHaveLength(2);
    expect(attachments.map((part) => part.file?.filename)).toEqual(['decisão.pdf', 'prova.pdf']);
  });
});

import { isRunStale, documentsSignature, STALE_RUN_MS } from '../../../supabase/functions/process-inpi-resource/runControl.ts';

describe('controle de execução da geração', () => {
  const now = Date.now();
  const iso = (ms: number) => new Date(now - ms).toISOString();
  it('não declara falha enquanto houver sinal de vida recente', () => {
    expect(isRunStale({ status: 'processing', heartbeat_at: iso(20000) }, now)).toBe(false);
  });
  it('libera retomada quando o sinal de vida para', () => {
    expect(isRunStale({ status: 'processing', heartbeat_at: iso(STALE_RUN_MS + 1000) }, now)).toBe(true);
  });
  it('usa updated_at para trabalhos antigos sem sinal de vida', () => {
    expect(isRunStale({ status: 'processing', updated_at: iso(STALE_RUN_MS + 1000) }, now)).toBe(true);
    expect(isRunStale({ status: 'processing', updated_at: iso(5000) }, now)).toBe(false);
  });
  it('não mexe em trabalho concluído ou com erro', () => {
    expect(isRunStale({ status: 'done', heartbeat_at: iso(999999) }, now)).toBe(false);
    expect(isRunStale({ status: 'error' }, now)).toBe(false);
  });
  it('assinatura muda quando o acervo muda', () => {
    const a = [{ id: 'a', doc_number: 1, storage_path: 'p/a.pdf' }];
    const b = [{ id: 'a', doc_number: 1, storage_path: 'p/a.pdf' }, { id: 'b', doc_number: 2, storage_path: 'p/b.pdf' }];
    expect(documentsSignature(a)).toBe(documentsSignature([...a]));
    expect(documentsSignature(a)).not.toBe(documentsSignature(b));
  });
});

describe('integridade dos imports do servidor de geração', () => {
  const indexPath = 'supabase/functions/process-inpi-resource/index.ts';
  const source = readFileSync(indexPath, 'utf8');
  const control = readFileSync('supabase/functions/process-inpi-resource/runControl.ts', 'utf8');

  const exported = Array.from(control.matchAll(/export (?:const|function) (\w+)/g)).map((m) => m[1]);
  const importLine = source.match(/import \{([^}]+)\} from '\.\/runControl\.ts';/);

  it('exporta os símbolos esperados do controle de execução', () => {
    expect(exported).toContain('STALE_RUN_MS');
    expect(exported).toContain('isRunStale');
  });

  it('importa todo símbolo do controle de execução que o servidor usa', () => {
    expect(importLine).toBeTruthy();
    const imported = importLine![1].split(',').map((s) => s.trim()).filter(Boolean);
    const body = source.replace(importLine![0], '');
    for (const name of exported) {
      const used = new RegExp(`\\b${name}\\b`).test(body);
      if (used) expect(imported).toContain(name);
    }
  });
});
