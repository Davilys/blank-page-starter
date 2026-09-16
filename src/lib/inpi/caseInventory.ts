/**
 * Inventário único de provas por caso — Recursos INPI.
 *
 * Uma só fonte de verdade para consultoria, geração, revisão, prévia e PDF:
 * a lista persistida em `inpi_case_documents`, com doc_number persistente,
 * hash, páginas lidas e a imagem REAL derivada
 * do arquivo original guardado no armazenamento privado.
 *
 * Regras não negociáveis:
 *  - Nada é redesenhado nem gerado por IA: as imagens vêm do próprio arquivo.
 *  - A vinculação é por ID do documento e número da página. Não há
 *    correspondência aproximada por nome de arquivo ou legenda.
 *  - Marcador sem correspondência vira pendência visível — nunca escolhe uma
 *    prova automaticamente e nunca desaparece em silêncio.
 */
import { supabase } from '@/integrations/supabase/client';
import { CATEGORY_LABEL, fileExtension, isImageExt, type CaseCategory } from './caseDocuments';
import { convertDocument, imageToDataUrl, rasterizePdfPages, type AnnexDoc } from './packageBuilder';

const BUCKET = 'inpi-recursos-docs';

export interface InventoryItem {
  id: string;
  docNumber: number;
  caseId: string;
  fileName: string;
  category: CaseCategory | string;
  categoryLabel: string;
  storagePath: string;
  sha256: string | null;
  pageCount: number | null;
  interpretedPages: number | null;
  extractionStatus: string;
  conversionStatus: string;
  /** Imagem de referência (página 1 do PDF ou a própria imagem). */
  previewDataUrl?: string;
  previewWidth?: number;
  previewHeight?: number;
  previewPage?: number;
  previewError?: string;
  /** Assets keyed by actual PDF page; never substitute page 1 for page N. */
  previewPages?: Record<number, { dataUrl: string; width: number; height: number }>;
}

export interface CaseInventory {
  caseId: string;
  items: InventoryItem[];
  /** Hash do conjunto — muda sempre que uma prova é adicionada/removida/trocada. */
  documentsHash: string;
}

interface CaseDocRow {
  doc_number: number;
  id: string;
  case_id: string;
  category: string;
  file_name: string;
  storage_path: string;
  sha256: string | null;
  page_count: number | null;
  interpreted_pages: number | null;
  extraction_status: string;
  conversion_status: string;
  display_order: number | null;
  created_at: string;
}

const fingerprint = (rows: CaseDocRow[]) =>
  rows.map((r) => JSON.stringify([r.id, r.doc_number, r.category, r.sha256 || r.storage_path])).join('|');

/** Localiza o caso vinculado ao recurso e devolve o inventário persistido. */
export async function loadCaseInventory(resourceId: string): Promise<CaseInventory | null> {
  const { data: cases, error: caseErr } = await supabase
    .from('inpi_resource_cases')
    .select('id, created_at')
    .eq('resource_id', resourceId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (caseErr) throw new Error('Não foi possível verificar o vínculo do caso.');
  if (!cases?.length) return null;
  const caseId = (cases[0] as { id: string }).id;

  const { data, error } = await supabase
    .from('inpi_case_documents')
    .select(
      'id, doc_number, case_id, category, file_name, storage_path, sha256, page_count, interpreted_pages, extraction_status, conversion_status, display_order, created_at',
    )
    .eq('case_id', caseId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw new Error('Não foi possível carregar os documentos ativos do caso.');
  if (!data?.length) throw new Error('O caso vinculado não contém documentos ativos.');

  const rows = data as unknown as CaseDocRow[];
  if (rows.some(r => !Number.isInteger(r.doc_number) || r.doc_number < 1)) {
    throw new Error('Numeração documental indisponível. Aplique a migração antes de exportar.');
  }
  const items: InventoryItem[] = rows.map((r) => ({
    id: r.id,
    docNumber: r.doc_number,
    caseId: r.case_id,
    fileName: r.file_name,
    category: r.category,
    categoryLabel: CATEGORY_LABEL[r.category as CaseCategory] || r.category,
    storagePath: r.storage_path,
    sha256: r.sha256,
    pageCount: r.page_count,
    interpretedPages: r.interpreted_pages,
    extractionStatus: r.extraction_status,
    conversionStatus: r.conversion_status,
  }));
  return { caseId, items, documentsHash: fingerprint(rows) };
}

async function downloadDoc(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(error?.message || 'Arquivo não localizado no armazenamento.');
  return data;
}

/**
 * Prepara a imagem de referência de cada documento (página 1 do PDF ou a
 * própria imagem), preservando proporção e resolução do original.
 */
export async function hydrateInventoryPreviews(items: InventoryItem[], content = ''): Promise<InventoryItem[]> {
  return Promise.all(
    items.map(async (item) => {
      const ext = fileExtension(item.fileName);
      if (ext !== 'pdf' && !isImageExt(ext)) return item;
      try {
        const blob = await downloadDoc(item.storagePath);
        if (isImageExt(ext)) {
          const dataUrl = await imageToDataUrl(blob);
          const dims = await measure(dataUrl);
          return { ...item, previewDataUrl: dataUrl, previewPage: 1, ...dims,
            previewPages: { 1: { dataUrl, width: dims.previewWidth, height: dims.previewHeight } } };
        }
        const requested = new Set([1]);
        for (const match of content.matchAll(/\[IMG:([a-z0-9_-]+)\]/gi)) {
          const resolved = resolveMarker(match[0], null, match[1], items);
          if (resolved.kind === 'doc' && resolved.item.id === item.id) requested.add(resolved.page);
        }
        const pages = await rasterizePdfPages(blob, [...requested].sort((a, b) => a - b));
        const first = pages.find((page) => page.page === 1);
        if (!first) return { ...item, previewError: 'Página 1 não pôde ser renderizada.' };
        const previewPages: NonNullable<InventoryItem['previewPages']> = {};
        for (const page of pages) {
          const size = await measure(page.dataUrl);
          previewPages[page.page] = { dataUrl: page.dataUrl, width: size.previewWidth, height: size.previewHeight };
        }
        const dims = await measure(first.dataUrl);
        return { ...item, previewDataUrl: first.dataUrl, previewPage: first.page, previewPages, ...dims };
      } catch (err) {
        return { ...item, previewError: err instanceof Error ? err.message : 'Arquivo inacessível.' };
      }
    }),
  );
}

async function measure(dataUrl: string): Promise<{ previewWidth: number; previewHeight: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ previewWidth: img.naturalWidth, previewHeight: img.naturalHeight });
    img.onerror = () => reject(new Error('Não foi possível decodificar a imagem da prova.'));
    img.src = dataUrl;
  });
}

/** Converte todos os documentos do inventário em páginas do pacote de anexos. */
export async function buildInventoryAnnexes(items: InventoryItem[]): Promise<AnnexDoc[]> {
  const out: AnnexDoc[] = [];
  for (const item of items) {
    try {
      const blob = await downloadDoc(item.storagePath);
      out.push(
        await convertDocument(
          { id: item.id, file_name: item.fileName, category: String(item.category), categoryLabel: item.categoryLabel },
          blob,
          item.docNumber,
        ),
      );
    } catch (err) {
      out.push({
        id: item.id,
        docNumber: item.docNumber,
        title: `Doc. ${String(item.docNumber).padStart(2, '0')} — ${item.fileName}`,
        category: item.category,
        categoryLabel: item.categoryLabel,
        fileName: item.fileName,
        images: [],
        textBlocks: [],
        pageEstimate: 0,
        status: 'falha',
        notes: err instanceof Error ? err.message : 'Arquivo inacessível no armazenamento.',
      });
    }
  }
  return out;
}

/* ── Marcadores ──────────────────────────────────────────────────────────── */

export type MarkerResolution =
  | { kind: 'doc'; item: InventoryItem; page: number }
  | { kind: 'unresolved'; raw: string; reason: string };

/**
 * Resolve [DOC:NN] e [IMG:...] contra o inventário.
 * [IMG:] só resolve nas formas explícitas doc01 / doc01_p03 — jamais por
 * semelhança de nome, para não escolher uma prova por conta própria.
 */
export function resolveMarker(
  raw: string,
  docNum: number | null,
  slug: string | null,
  items: InventoryItem[],
): MarkerResolution {
  if (docNum != null) {
    const item = items.find((i) => i.docNumber === docNum);
    return item
      ? { kind: 'doc', item, page: 1 }
      : { kind: 'unresolved', raw, reason: `Doc. ${String(docNum).padStart(2, '0')} não consta no acervo do caso.` };
  }
  const s = (slug || '').toLowerCase();
  const m = s.match(/^doc[_-]?(\d{1,3})(?:[_-]?p(\d{1,3}))?$/);
  if (m) {
    const n = parseInt(m[1], 10);
    const page = m[2] ? parseInt(m[2], 10) : 1;
    const item = items.find((i) => i.docNumber === n);
    if (!Number.isInteger(page) || page < 1 || (item?.pageCount != null && page > item.pageCount)) {
      return { kind: 'unresolved', raw, reason: 'Página solicitada não existe no documento.' };
    }
    return item
      ? { kind: 'doc', item, page }
      : { kind: 'unresolved', raw, reason: `Doc. ${String(n).padStart(2, '0')} não consta no acervo do caso.` };
  }
  return {
    kind: 'unresolved',
    raw,
    reason: 'Referência de imagem sem vínculo com documento do acervo (informe [IMG:docNN] ou [IMG:docNN_pM]).',
  };
}

/**
 * Normaliza referências repetidas:
 *  "[DOC:02] [DOC:02]" → "[DOC:02]"
 *  "(**Doc. 02**) [DOC:02]" → "[DOC:02]" (o marcador já é renderizado como "(Doc. 02)")
 */
export function normalizeMarkers(text: string): string {
  return text
    .replace(
      /\(\*{0,2}Doc\.\s*0*(\d{1,3})\*{0,2}\)\s*\[DOC:0*(\d{1,3})\]/gi,
      (m, a: string, b: string) => (a === b ? `[DOC:${String(parseInt(a, 10)).padStart(2, '0')}]` : m),
    )
    .replace(/(\[(?:DOC:\d{1,3}|IMG:[a-z0-9_-]+)\])(\s*\1)+/gi, '$1')
    .replace(/(\(Doc\.\s*\d{1,3}\))(\s*\1)+/gi, '$1');
}
