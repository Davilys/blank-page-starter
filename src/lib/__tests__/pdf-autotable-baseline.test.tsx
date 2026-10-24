// Baselines de regressão jsPDF-autotable 4.0.0 -> 4.2.1.
// CASOS 1 e 2: chamam as funções REAIS de exportação (PublicacaoPDFExport,
// clientExporter) com fixtures sintéticas e relógio congelado, capturando o
// PDF via mock de jsPDF.API.save.
// CASO 3: reprodução CONFIG-FIEL das duas chamadas autoTable internas de
// INPIResourcePDFPreview.tsx (função grande demais para invocar isolada;
// declarado: reproduz as CONFIGS, não o caminho completo do componente).
import { it, vi, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import jsPDF from 'jspdf';

// save é propriedade PRÓPRIA de cada instância no jspdf 4.x — interceptar exige
// subclass via module mock (spy em prototype/API não alcança).
const h = vi.hoisted(() => ({ bufs: [] as any[] }));
vi.mock('jspdf', async (orig) => {
  const mod: any = await orig();
  const Real = mod.default;
  // jsPDF 4.x é FACTORY: o constructor retorna um objeto (save é próprio da
  // instância retornada). Subclass não intercepta — o mock embrulha a factory
  // e sobrescreve o save da instância retornada.
  (globalThis as any).__realJsPDF = Real;
  const Wrapped: any = function (...args: any[]) {
    const inst: any = new Real(...args);
    const origSave = inst.save?.bind(inst);
    inst.save = (name?: string) => { h.bufs.push(Buffer.from(inst.output('arraybuffer'))); return origSave ? inst : inst; };
    return inst;
  };
  Object.assign(Wrapped, Real);
  Wrapped.prototype = Real.prototype;
  return { ...mod, default: Wrapped };
});

const jspdfVersion = createRequire(import.meta.url)('jspdf/package.json').version as string;
mkdirSync('/tmp/fix', { recursive: true });
const outBase = `/tmp/fix/pdf-autotable-jspdf-${jspdfVersion}`;

const capture = () => { h.bufs.length = 0; return h.bufs; };

const freeze = () => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-23T12:00:00-03:00')); };
const unfreeze = () => vi.useRealTimers();

it('caso 1 (REAL): exportPublicacaoPDF com tabela landscape + filtros + multipágina', async () => {
  freeze();
  const { exportPublicacaoPDF } = await import('@/components/admin/publicacao/PublicacaoPDFExport');
  const bufs = capture();
  const rows = Array.from({ length: 25 }, (_, i) => ({
    cliente: `Cliente Sintético ${i} & Filhos`,
    marca: `MARCA TESTE ${i}™`,
    processo: `900${String(100000 + i)}`,
    responsavel: i % 2 ? 'Responsável Fictício' : '—',
    status: ['003', 'oposicao', 'exigencia_merito', 'indeferimento', 'deferimento', 'certificado', 'renovacao', 'arquivado'][i % 8],
    dataDeposito: `0${(i % 9) + 1}/10/2026`,
    dataPubRpi: i % 3 ? `RPI ${2700 + i}` : '—',
    prazoOposicao: i % 4 ? `10/${(i % 9) + 1}/2026` : '—',
    proximoPrazo: `Texto longo de próximo prazo para exercitar quebra de célula número ${i} com caracteres especiais: çãõéà "aspas" <tags>`,
  }));
  exportPublicacaoPDF(rows, { status: 'oposicao', cliente: 'Cliente Sintético 1', prazo: 'vencido' });
  unfreeze();
  expect(bufs.length).toBe(1);
  writeFileSync(`${outBase}-publicacao.pdf`, bufs[0]);
  expect(bufs[0].subarray(0, 5).toString()).toBe('%PDF-');
});

it('caso 2 (REAL): exportToPDF de clientes com nulos, valores R$ e multipágina', async () => {
  freeze();
  const { exportToPDF } = await import('@/lib/clientExporter');
  const bufs = capture();
  // clientExporter é function-style desde cc69f1a: nenhuma compensação necessária.
  const clients = Array.from({ length: 40 }, (_, i) => ({
    id: `cli-${i}`,
    full_name: i % 5 === 0 ? null : `Cliente Exportação ${i}`,
    email: `cliente${i}@exemplo-teste.com`,
    phone: i % 3 === 0 ? null : `(11) 98${String(100 + i)}-0000`,
    company_name: i % 2 ? `Empresa de Teste ${i} LTDA` : null,
    city: ['São Paulo', 'Rio de Janeiro', null][i % 3] as any,
    state: ['SP', 'RJ', null][i % 3] as any,
    contract_value: i % 4 === 0 ? null : 1139 + i * 7.5,
  }));
  exportToPDF(clients as any);
  unfreeze();
  expect(bufs.length).toBe(1);
  writeFileSync(`${outBase}-clientes.pdf`, bufs[0]);
  expect(bufs[0].subarray(0, 5).toString()).toBe('%PDF-');
});

it('caso 3 (CONFIG-FIEL): configs autoTable do INPIResourcePDFPreview (tabela markdown + índice de anexos)', async () => {
  freeze();
  const autoTable = (await import('jspdf-autotable')).default;
  const bufs = capture();
  const pdf = new jsPDF();
  const MARGIN_L = 14, MARGIN_R = 14, MARGIN_BOTTOM = 18;
  const drawHeaderBars = () => { pdf.setFillColor(30, 58, 95); pdf.rect(0, 0, 210, 8, 'F'); };
  // Config 1: tabela de cláusulas (INPIResourcePDFPreview.tsx:694)
  autoTable(pdf, {
    head: [['Cláusula', 'Conteúdo', 'Referência']],
    body: Array.from({ length: 12 }, (_, i) => [
      `${i + 1}ª`,
      `Texto da cláusula sintética ${i + 1} com conteúdo propositalmente longo para forçar overflow linebreak em célula estreita: çãõ "aspas" €£`,
      `Fig. ${i}`,
    ]),
    startY: 20,
    margin: { left: MARGIN_L, right: MARGIN_R, bottom: MARGIN_BOTTOM },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2, textColor: [26, 26, 26], lineColor: [210, 210, 210], lineWidth: 0.15, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 249, 252] },
    didDrawPage: () => { drawHeaderBars(); },
  });
  let y = ((pdf as any).lastAutoTable?.finalY ?? 40) + 3;
  // Config 2: índice de anexos com didDrawCell de localização (INPIResourcePDFPreview.tsx:808)
  const locationCells: any[] = [];
  autoTable(pdf, {
    head: [['Doc.', 'Documento', 'Finalidade', 'Páginas', 'Localização', 'Situação']],
    body: Array.from({ length: 9 }, (_, i) => [
      String(i + 1).padStart(2, '0'), `documento_sintetico_${i}.pdf`, i % 2 ? 'Comprovante' : 'Procuração',
      String((i % 3) + 1), '', i % 3 === 0 ? 'Incluído' : i % 3 === 1 ? 'Incluído em parte' : 'NÃO INCLUÍDO',
    ]),
    startY: y,
    margin: { left: MARGIN_L, right: MARGIN_R, bottom: MARGIN_BOTTOM },
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.8, lineColor: [210, 210, 210], lineWidth: 0.15, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 249, 252] },
    didDrawPage: () => { drawHeaderBars(); },
    didDrawCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 4) {
        locationCells.push({ row: data.row.index, page: pdf.getNumberOfPages(), x: data.cell.x + 1.8, y: data.cell.y + data.cell.height - 2 });
      }
    },
  });
  for (const lc of locationCells) { pdf.setPage(lc.page); pdf.setFontSize(7); pdf.text(`pág. ${lc.page}`, lc.x, lc.y); }
  pdf.save('inpi-preview.pdf');
  unfreeze();
  expect(bufs.length).toBe(1);
  expect(locationCells.length).toBe(9);
  writeFileSync(`${outBase}-inpi-preview-configs.pdf`, bufs[0]);
  expect(bufs[0].subarray(0, 5).toString()).toBe('%PDF-');
});
