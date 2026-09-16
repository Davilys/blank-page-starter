/**
 * Inventário único de provas por caso — Recursos INPI.
 *
 * Uma só fonte de verdade para consultoria, geração, revisão, prévia e PDF:
 * a lista persistida em `inpi_case_documents`, com número de Doc. estável
 * (ordem de exibição / criação), hash, páginas lidas e a imagem REAL derivada
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
}

export interface CaseInventory {
  caseId: string;
  items: InventoryItem[];
  /** Hash do conjunto — muda sempre que uma prova é adicionada/removida/trocada. */
  documentsHash: string;
}

interface CaseDocRow {
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
  rows.map((r) => `${r.id}:${r.sha256 || r.storage_path}`).join('|');

/** Localiza o caso vinculado ao recurso e devolve o inventário persistido. */
export async function loadCaseInventory(resourceId: string): Promise<CaseInventory | null> {
  const { data: cases, error: caseErr } = await supabase
    .from('inpi_resource_cases')
    .select('id, created_at')
    .eq('resource_id', resourceId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (caseErr || !cases?.length) return null;
  const caseId = (cases[0] as { id: string }).id;

  const { data, error } = await supabase
    .from('inpi_case_documents')
    .select(
      'id, case_id, category, file_name, storage_path, sha256, page_count, interpreted_pages, extraction_status, conversion_status, display_order, created_at',
    )
    .eq('case_id', caseId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error || !data?.length) return null;

  const rows = data as unknown as CaseDocRow[];
  const items: InventoryItem[] = rows.map((r, i) => ({
    id: r.id,
    docNumber: i + 1,
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
export async function hydrateInventoryPreviews(items: InventoryItem[]): Promise<InventoryItem[]> {
  return Promise.all(
    items.map(async (item) => {
      const ext = fileExtension(item.fileName);
      if (ext !== 'pdf' && !isImageExt(ext)) return item;
      try {
        const blob = await downloadDoc(item.storagePath);
        if (isImageExt(ext)) {
          const dataUrl = await imageToDataUrl(blob);
          const dims = await measure(dataUrl);
          return { ...item, previewDataUrl: dataUrl, previewPage: 1, ...dims };
        }
        const [first] = await rasterizePdfPages(blob, [1]);
        if (!first) return { ...item, previewError: 'Página 1 não pôde ser renderizada.' };
        const dims = await measure(first.dataUrl);
        return { ...item, previewDataUrl: first.dataUrl, previewPage: first.page, ...dims };
      } catch (err) {
        return { ...item, previewError: err instanceof Error ? err.message : 'Arquivo inacessível.' };
      }
    }),
  );
}

async function measure(dataUrl: string): Promise<{ previewWidth: number; previewHeight: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ previewWidth: img.naturalWidth, previewHeight: img.naturalHeight });
    img.onerror = () => resolve({ previewWidth: 800, previewHeight: 1000 });
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

/** Remove repetições coladas do mesmo marcador: "[DOC:02] [DOC:02]" → "[DOC:02]". */
export function normalizeMarkers(text: string): string {
  return text
    .replace(/(\[(?:DOC:\d{1,3}|IMG:[a-z0-9_-]+)\])(\s*\1)+/gi, '$1')
    .replace(/(\(Doc\.\s*\d{1,3}\))(\s*\1)+/gi, '$1');
}
