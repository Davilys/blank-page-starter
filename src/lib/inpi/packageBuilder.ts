/**
 * Conversão dos documentos do caso em páginas do PDF final (pacote de protocolo).
 *
 * Isto é diferente da extração para análise: aqui cada página, aba ou tabela
 * precisa virar página imprimível. Quando qualquer documento falha, o pacote
 * NÃO pode ser anunciado como completo.
 */
import { fileExtension, isImageExt, loadPdfJs, readableFailure, type CaseCategory, type ConversionStatus } from './caseDocuments';

export interface AnnexPageImage {
  dataUrl: string;
  width: number;
  height: number;
}

export interface AnnexDoc {
  id: string;
  docNumber: number;
  title: string;
  category: CaseCategory | string;
  categoryLabel: string;
  fileName: string;
  /** Páginas rasterizadas (PDF e imagens). */
  images: AnnexPageImage[];
  /** Blocos de texto (Word, planilhas, CSV, texto) já paginados pelo jsPDF. */
  textBlocks: string[];
  pageEstimate: number;
  status: ConversionStatus;
  notes: string | null;
}

const RASTER_SCALE = 1.6;
const MAX_RASTER_W = 1400;

async function canvasToJpeg(canvas: HTMLCanvasElement): Promise<AnnexPageImage> {
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.82),
    width: canvas.width,
    height: canvas.height,
  };
}

async function rasterizePdf(blob: Blob): Promise<{ images: AnnexPageImage[]; total: number }> {
  const pdfjs = await loadPdfJs();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  const images: AnnexPageImage[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    let viewport = page.getViewport({ scale: RASTER_SCALE });
    if (viewport.width > MAX_RASTER_W) {
      viewport = page.getViewport({ scale: (RASTER_SCALE * MAX_RASTER_W) / viewport.width });
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível para converter o PDF.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas } as unknown as Parameters<typeof page.render>[0]).promise;
    images.push(await canvasToJpeg(canvas));
  }
  return { images, total: doc.numPages };
}

/**
 * Rasteriza apenas as páginas indicadas — usado para mandar páginas
 * digitalizadas (sem texto) à leitura visual da IA.
 */
export async function rasterizePdfPages(
  blob: Blob,
  pageNumbers: number[],
): Promise<{ page: number; dataUrl: string }[]> {
  const pdfjs = await loadPdfJs();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  const out: { page: number; dataUrl: string }[] = [];
  for (const p of pageNumbers) {
    if (p < 1 || p > doc.numPages) continue;
    const page = await doc.getPage(p);
    let viewport = page.getViewport({ scale: RASTER_SCALE });
    if (viewport.width > MAX_RASTER_W) {
      viewport = page.getViewport({ scale: (RASTER_SCALE * MAX_RASTER_W) / viewport.width });
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas } as unknown as Parameters<typeof page.render>[0]).promise;
    out.push({ page: p, dataUrl: canvas.toDataURL('image/jpeg', 0.82) });
  }
  return out;
}

/** Converte uma imagem em data URL para a leitura visual. */
export async function imageToDataUrl(blob: Blob): Promise<string> {
  return (await rasterizeImage(blob)).dataUrl;
}

async function rasterizeImage(blob: Blob): Promise<AnnexPageImage> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Imagem ilegível.'));
      el.src = url;
    });
    const scale = Math.min(1, MAX_RASTER_W / (img.naturalWidth || MAX_RASTER_W));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    canvas.height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvasToJpeg(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function docxToBlocks(blob: Blob): Promise<string[]> {
  const mammoth = await import('mammoth');
  const res = await mammoth.extractRawText({ arrayBuffer: await blob.arrayBuffer() });
  const text = (res.value || '').trim();
  if (!text) throw new Error('Documento Word sem texto conversível.');
  return text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

async function sheetToBlocks(blob: Blob): Promise<string[]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array' });
  const blocks: string[] = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], { header: 1, blankrows: false });
    blocks.push(`## Aba: ${name}`);
    if (!rows.length) {
      blocks.push('(aba vazia)');
      continue;
    }
    for (const row of rows) {
      blocks.push((row || []).map((c) => (c == null ? '' : String(c))).join('  |  '));
    }
  }
  if (!blocks.length) throw new Error('Planilha sem conteúdo conversível.');
  return blocks;
}

export interface SourceDoc {
  id: string;
  file_name: string;
  category: string;
  categoryLabel: string;
}

/** Converte um documento em páginas de anexo. Nunca lança: devolve o estado. */
export async function convertDocument(
  doc: SourceDoc,
  blob: Blob,
  docNumber: number,
): Promise<AnnexDoc> {
  const base: AnnexDoc = {
    id: doc.id,
    docNumber,
    title: `Doc. ${String(docNumber).padStart(2, '0')} — ${doc.file_name}`,
    category: doc.category,
    categoryLabel: doc.categoryLabel,
    fileName: doc.file_name,
    images: [],
    textBlocks: [],
    pageEstimate: 0,
    status: 'pendente',
    notes: null,
  };
  const ext = fileExtension(doc.file_name);
  try {
    if (ext === 'pdf') {
      const { images, total } = await rasterizePdf(blob);
      if (!images.length) throw new Error('PDF sem páginas conversíveis.');
      return {
        ...base,
        images,
        pageEstimate: images.length,
        status: images.length === total ? 'convertido' : 'parcial',
        notes:
          images.length === total
            ? `${total} página(s) convertida(s).`
            : `${images.length} de ${total} páginas convertidas.`,
      };
    }
    if (isImageExt(ext)) {
      const image = await rasterizeImage(blob);
      return { ...base, images: [image], pageEstimate: 1, status: 'convertido', notes: '1 página de imagem.' };
    }
    if (ext === 'docx') {
      const blocks = await docxToBlocks(blob);
      return {
        ...base,
        textBlocks: blocks,
        pageEstimate: Math.max(1, Math.ceil(blocks.join(' ').length / 2600)),
        status: 'convertido',
        notes: `${blocks.length} parágrafo(s) convertidos em páginas de texto.`,
      };
    }
    if (ext === 'xlsx' || ext === 'xls') {
      const blocks = await sheetToBlocks(blob);
      return {
        ...base,
        textBlocks: blocks,
        pageEstimate: Math.max(1, Math.ceil(blocks.length / 45)),
        status: 'convertido',
        notes: `${blocks.filter((b) => b.startsWith('## Aba:')).length} aba(s) convertida(s) em páginas legíveis.`,
      };
    }
    if (ext === 'csv' || ext === 'txt' || ext === 'rtf') {
      const text = await blob.text();
      const blocks = text.split(/\r?\n/).filter((l) => l.trim().length);
      if (!blocks.length) throw new Error('Arquivo de texto vazio.');
      return {
        ...base,
        textBlocks: blocks,
        pageEstimate: Math.max(1, Math.ceil(blocks.length / 45)),
        status: 'convertido',
        notes: `${blocks.length} linha(s) convertidas.`,
      };
    }
    throw new Error(`Formato .${ext || 'desconhecido'} não é convertido para o PDF final.`);
  } catch (err) {
    return {
      ...base,
      status: 'falha',
      notes: err instanceof Error ? err.message : 'Falha na conversão para o PDF.',
    };
  }
}

export interface PackageSummary {
  annexes: AnnexDoc[];
  failed: AnnexDoc[];
  isComplete: boolean;
  totalAnnexPages: number;
}

export function summarizePackage(annexes: AnnexDoc[]): PackageSummary {
  const failed = annexes.filter((a) => a.status === 'falha' || a.status === 'parcial');
  return {
    annexes,
    failed,
    isComplete: annexes.length > 0 && failed.length === 0,
    totalAnnexPages: annexes.reduce((s, a) => s + a.pageEstimate, 0),
  };
}
