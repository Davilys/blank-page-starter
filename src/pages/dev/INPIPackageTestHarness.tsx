/**
 * Banco de testes do pacote de exportação de Recursos INPI (rota interna).
 * Gera documentos fictícios, executa a conversão real para anexos e monta o
 * PDF final com papel timbrado, índice e anexos. Não toca em dados de cliente.
 */
import { useState } from 'react';
import jsPDF from 'jspdf';
import { convertDocument, summarizePackage, type AnnexDoc } from '@/lib/inpi/packageBuilder';
import { extractContent } from '@/lib/inpi/caseDocuments';
import { normalizeMarkers } from '@/lib/inpi/caseInventory';

import { generateNativePDF } from '@/components/admin/INPIResourcePDFPreview';

const log = (msg: string) => {
  const el = document.getElementById('log');
  if (el) el.textContent += msg + '\n';
  // eslint-disable-next-line no-console
  console.log('[inpi-package-test]', msg);
};

function makeTextPdf(): Blob {
  const d = new jsPDF();
  d.setFontSize(12);
  d.text('DESPACHO DE INDEFERIMENTO (FICTÍCIO)', 20, 30);
  d.text('Processo 900000001 — Marca TESTE PACOTE', 20, 40);
  d.text('Fundamento: artigo 124, XIX da LPI (documento de teste).', 20, 50);
  d.addPage();
  d.text('Página 2 do documento oficial fictício.', 20, 30);
  return d.output('blob');
}

function makeImage(): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = 900; c.height = 600;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 900, 600);
  ctx.fillStyle = '#005fe6'; ctx.fillRect(40, 40, 820, 120);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 42px sans-serif';
  ctx.fillText('PROVA DE USO (FICTÍCIA)', 70, 118);
  ctx.fillStyle = '#111111'; ctx.font = '28px sans-serif';
  ctx.fillText('Fachada da loja — foto de teste', 70, 260);
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
}

async function makeXlsx(): Promise<Blob> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Nota fiscal', 'Data', 'Valor'],
      ['NF 1001', '2025-02-10', 'R$ 1.200,00'],
      ['NF 1002', '2025-03-14', 'R$ 3.480,00'],
    ]),
    'Notas',
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Canal', 'Seguidores'], ['Instagram', 12400]]), 'Redes');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export default function INPIPackageTestHarness() {
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    try {
      const pdfBlob = makeTextPdf();
      const imgBlob = await makeImage();
      const xlsxBlob = await makeXlsx();
      const csvBlob = new Blob(['produto,quantidade\ncamiseta,120\nboné,45\n'], { type: 'text/csv' });
      const brokenBlob = new Blob(['conteúdo qualquer'], { type: 'application/octet-stream' });

      const files: [string, Blob, string][] = [
        ['despacho-inpi.pdf', pdfBlob, 'documento_inpi'],
        ['prova-uso.png', imgBlob, 'provas_cliente'],
        ['notas.xlsx', xlsxBlob, 'provas_cliente'],
        ['vendas.csv', csvBlob, 'provas_cliente'],
        ['arquivo-corrompido.zip', brokenBlob, 'complementares'],
      ];

      // 1) Extração para análise
      for (const [name, blob] of files) {
        const f = new File([blob], name, { type: blob.type });
        const r = await extractContent(f);
        log(`EXTRAÇÃO ${name}: status=${r.status} páginas=${r.pageCount ?? '-'} interpretadas=${r.interpretedPages ?? '-'} não interpretadas=${r.unreadablePages ?? '-'} | ${r.notes ?? ''}`);
      }

      // 2) Conversão para o PDF final
      const annexes: AnnexDoc[] = [];
      let n = 1;
      for (const [name, blob, cat] of files) {
        const a = await convertDocument(
          { id: name, file_name: name, category: cat, categoryLabel: cat },
          blob, n++,
        );
        annexes.push(a);
        log(`CONVERSÃO ${name}: status=${a.status} páginas=${a.pageEstimate} | ${a.notes ?? ''}`);
      }
      const sum = summarizePackage(annexes);
      log(`PACOTE: completo=${sum.isComplete} anexos=${annexes.length} páginas-anexo=${sum.totalAnnexPages} falhas=${sum.failed.length}`);

      // 3) PDF final (com e sem o documento que falhou)
      // Provas do "inventário": imagem real da página 1 de cada anexo convertido.
      const inventoryEvidences = annexes
        .filter((a) => a.images.length > 0)
        .map((a) => ({
          id: a.id,
          docNumber: a.docNumber,
          caption: `${a.categoryLabel} — ${a.fileName} (página 1)`,
          source_file_name: a.fileName,
          dataUrl: a.images[0].dataUrl,
          width: a.images[0].width,
          height: a.images[0].height,
        }));
      const evByNum = (n: number) => inventoryEvidences.find((e) => e.docNumber === n);
      const evBySlug = (slug: string) => {
        const m = slug.toLowerCase().match(/^doc[_-]?(\d{1,3})(?:[_-]?p\d{1,3})?$/);
        return m ? evByNum(parseInt(m[1], 10)) : undefined;
      };

      const body = normalizeMarkers([
        'AO INSTITUTO NACIONAL DA PROPRIEDADE INDUSTRIAL',
        '## I — DOS FATOS',
        'Trata-se de peça de teste gerada com documentos fictícios para validar a montagem do pacote. Conforme o despacho oficial (**Doc. 01**) [DOC:01].',
        '## II — DA PROVA DE USO',
        'A prova de uso do cliente demonstra a divulgação da marca [IMG:doc02], juntada ao acervo do caso.',
        'Referência repetida colada que deve ser normalizada: [DOC:02] [DOC:02].',
        'Marcador de nome livre que NÃO pode resolver: [IMG:marca_cliente].',
        '## III — DO DIREITO',
        'Texto de teste, sem qualquer conteúdo jurídico real.',
      ].join('\n\n'));

      const common = {
        bodyContent: body,
        evidences: inventoryEvidences,
        evidenceByNum: evByNum,
        findEvidenceBySlug: evBySlug,
        uncitedEvidences: [],
        documentTitleUpper: 'RECURSO CONTRA INDEFERIMENTO (TESTE)',
        resource: { id: 'test', brand_name: 'TESTE PACOTE', process_number: '900000001', ncl_class: '25', holder: 'Cliente Fictício', approved_at: null },
        approvalDate: '15 de setembro de 2026',
        isExtrajudicialDoc: false,
        isProcuradorPetition: false,
      };


      const incomplete = await generateNativePDF({
        ...common,
        pdfFileName: 'teste-pacote-incompleto.pdf',
        annexes: annexes.map((a) => ({ ...a })),
        draftStamp: 'MINUTA — PENDENTE DE CONFERÊNCIA',
        returnBlob: true,
      });
      const okAnnexes = annexes.filter((a) => a.status === 'convertido');
      const complete = await generateNativePDF({
        ...common,
        pdfFileName: 'teste-pacote-completo.pdf',
        annexes: okAnnexes.map((a, i) => ({ ...a, docNumber: i + 1, title: `Doc. ${String(i + 1).padStart(2, '0')} — ${a.fileName}` })),
        draftStamp: null,
        returnBlob: true,
      });

      const toB64 = (b: Blob) => new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(',')[1]);
        r.readAsDataURL(b);
      });
      (window as unknown as Record<string, unknown>).__pdfIncomplete = await toB64(incomplete as Blob);
      (window as unknown as Record<string, unknown>).__pdfComplete = await toB64(complete as Blob);
      log('PDFS PRONTOS');
    } catch (e) {
      log('ERRO: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setRunning(false);
      (window as unknown as Record<string, unknown>).__testDone = true;
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-lg font-bold">Teste do pacote de exportação — Recursos INPI</h1>
      <button id="run" onClick={run} disabled={running} className="rounded bg-primary px-4 py-2 text-primary-foreground">
        {running ? 'Executando...' : 'Executar teste'}
      </button>
      <pre id="log" className="whitespace-pre-wrap rounded bg-muted p-3 text-xs" />
    </div>
  );
}
