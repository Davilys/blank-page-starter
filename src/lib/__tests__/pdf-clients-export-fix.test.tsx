// Pacote fix-pdf-clientes (CANDIDATO).
// Prova 1 (bug pré-existente em produção): o padrão ANTIGO (side-effect import
// + doc.autoTable method-style) quebra sem nenhuma compensação de harness,
// reproduzindo o TypeError do bundle ESM servido (window.jsPDF nunca definido).
// Prova 2 (correção): exportToPDF REAL do clientExporter corrigido
// (function-style) gera PDF válido com as linhas das fixtures — sem applyPlugin
// manual, sem binário externo (portável: roda igual no sandbox e no runner CI).
import { it, expect, vi } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import jsPDF from 'jspdf';
import 'jspdf-autotable'; // side-effect, como o código antigo fazia

it('bug produção (pré-existente): method-style sem registro quebra', () => {
  const doc = new jsPDF() as unknown as { autoTable?: unknown };
  expect(typeof doc.autoTable).toBe('undefined');
  expect(() => (doc as any).autoTable({ head: [['a']], body: [['1']] })).toThrow(TypeError);
});

it('correção: exportToPDF real (function-style) exporta fixtures', async () => {
  const saved: Buffer[] = [];
  const tables: Array<{ head: unknown; body: unknown[][] }> = [];
  vi.resetModules();
  vi.doMock('jspdf', async (orig) => {
    const m: any = await orig();
    const R = m.default;
    const Wrapped: any = function (...args: any[]) {
      const d: any = new R(...args);
      d.save = () => { saved.push(Buffer.from(d.output('arraybuffer'))); return d; };
      return d;
    };
    Object.assign(Wrapped, R);
    Wrapped.prototype = R.prototype;
    return { ...m, default: Wrapped };
  });
  vi.doMock('jspdf-autotable', async (orig) => {
    const m: any = await orig();
    const real = m.default;
    const wrapped = (doc: unknown, opts: { head: unknown; body: unknown[][] }) => {
      tables.push({ head: opts.head, body: opts.body });
      return real(doc, opts);
    };
    return { ...m, default: wrapped };
  });
  const { exportToPDF } = await import('@/lib/clientExporter');
  const clients = Array.from({ length: 40 }, (_, i) => ({
    full_name: `Cliente Fix ${i + 1}`,
    email: `fix${i}@exemplo-teste.com`,
    phone: `(11) 98222-${String(i).padStart(4, '0')}`,
    company_name: `Empresa Fix ${i + 1}`,
    city: 'São Paulo', state: 'SP', contract_value: 1000 + i,
  }));
  exportToPDF(clients as never);
  vi.doUnmock('jspdf');
  vi.doUnmock('jspdf-autotable');

  // PDF válido e não-trivial
  expect(saved.length).toBe(1);
  expect(saved[0].subarray(0, 5).toString()).toBe('%PDF-');
  expect(saved[0].subarray(-7).toString()).toContain('%%EOF');
  expect(saved[0].length).toBeGreaterThan(4000);
  mkdirSync('/tmp/fix', { recursive: true });
  writeFileSync('/tmp/fix/pdf-fix-clientes-function-style.pdf', saved[0]);

  // As 40 fixtures entraram na tabela renderizada
  expect(tables.length).toBe(1);
  expect(tables[0].body.length).toBe(40);
  expect(tables[0].body[0][0]).toBe('Cliente Fix 1');
  expect(tables[0].body[39][1]).toBe('fix39@exemplo-teste.com');
  expect(tables[0].body[39][6]).toContain('R$');
});
