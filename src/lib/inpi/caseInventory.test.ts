import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), download: vi.fn(), rasterize: vi.fn(), image: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: mocks.from, storage: { from: () => ({ download: mocks.download }) },
} }));
vi.mock('./packageBuilder', () => ({
  rasterizePdfPages: mocks.rasterize, imageToDataUrl: mocks.image, convertDocument: vi.fn(),
}));
import { hydrateInventoryPreviews, loadCaseInventory, normalizeMarkers, resolveMarker, type InventoryItem } from './caseInventory';
import { documentsFingerprint } from './caseDocuments';

describe('versão do acervo', () => {
  const doc = { id: 'a', doc_number: 1, category: 'provas_cliente', sha256: 'same-bytes' };
  it('detecta recategorização', () => {
    expect(documentsFingerprint([doc])).not.toBe(documentsFingerprint([{ ...doc, category: 'complementares' }]));
  });
  it('detecta substituição por outro registro com o mesmo arquivo', () => {
    expect(documentsFingerprint([doc])).not.toBe(documentsFingerprint([{ ...doc, id: 'b' }]));
  });
  it('detecta mudança da referência documental', () => {
    expect(documentsFingerprint([doc])).not.toBe(documentsFingerprint([{ ...doc, doc_number: 2 }]));
  });
  it('não depende da ordem da resposta da consulta', () => {
    const second = { ...doc, id: 'b', doc_number: 2 };
    expect(documentsFingerprint([doc, second])).toBe(documentsFingerprint([second, doc]));
  });
});

const item: InventoryItem = {
  id: 'proof-id', caseId: 'case-a', docNumber: 2, fileName: 'provas.pdf',
  category: 'provas_cliente', categoryLabel: 'Provas', storagePath: 'case-a/provas.pdf',
  sha256: 'hash', pageCount: 2, interpretedPages: 2, extractionStatus: 'lido', conversionStatus: 'convertido',
};
function query(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'limit']) q[method] = vi.fn(() => q);
  q.then = (resolve: (r: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return q;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.download.mockResolvedValue({ data: new Blob(['fixture']), error: null });
  vi.stubGlobal('Image', class {
    naturalWidth = 600; naturalHeight = 800; onload?: () => void;
    set src(_: string) { this.onload?.(); }
  });
});

describe('Resolução explícita', () => {
  it('preserva a página indicada', () => {
    expect(resolveMarker('[IMG:doc02_p2]', null, 'doc02_p2', [item])).toEqual({ kind: 'doc', item, page: 2 });
  });
  it.each(['doc02_p0', 'doc02_p3', 'marca_cliente', 'doc99'])('recusa %s sem escolher outra prova', slug => {
    expect(resolveMarker(`[IMG:${slug}]`, null, slug, [item]).kind).toBe('unresolved');
  });
  it('não encontra documento de outro inventário', () => {
    expect(resolveMarker('[DOC:02]', 2, null, []).kind).toBe('unresolved');
  });
  it('remove referência duplicada sem mudar referências distintas', () => {
    expect(normalizeMarkers('(**Doc. 02**) [DOC:02] [DOC:02] [DOC:03]')).toBe('[DOC:02] [DOC:03]');
  });
});

describe('Páginas reais da prova', () => {
  it('rasteriza a página 2 solicitada, uma vez, e mantém seus pixels separados', async () => {
    mocks.rasterize.mockResolvedValue([{ page: 1, dataUrl: 'first' }, { page: 2, dataUrl: 'second' }]);
    const [result] = await hydrateInventoryPreviews([item], '[IMG:doc02_p2] [IMG:doc02_p2]');
    expect(mocks.rasterize.mock.calls[0][1]).toEqual([1, 2]);
    expect(result.previewPages?.[2].dataUrl).toBe('second');
    expect(result.previewPages?.[1].dataUrl).toBe('first');
  });
  it('não substitui página ausente pela primeira', async () => {
    mocks.rasterize.mockResolvedValue([{ page: 1, dataUrl: 'first' }]);
    const [result] = await hydrateInventoryPreviews([item], '[IMG:doc02_p2]');
    expect(result.previewPages?.[2]).toBeUndefined();
  });
  it('registra arquivo inacessível', async () => {
    mocks.download.mockResolvedValue({ data: null, error: { message: 'inacessível' } });
    const [result] = await hydrateInventoryPreviews([item]);
    expect(result.previewError).toBe('inacessível');
    expect(result.previewDataUrl).toBeUndefined();
  });
  it('não inventa dimensões quando a imagem falha', async () => {
    vi.stubGlobal('Image', class { onerror?: () => void; set src(_: string) { this.onerror?.(); } });
    mocks.rasterize.mockResolvedValue([{ page: 1, dataUrl: 'broken' }]);
    const [result] = await hydrateInventoryPreviews([item]);
    expect(result.previewError).toContain('decodificar');
  });
});

describe('Inventário e isolamento', () => {
  it('só retorna legado quando realmente não há caso', async () => {
    mocks.from.mockReturnValue(query({ data: [], error: null }));
    expect(await loadCaseInventory('resource-a')).toBeNull();
  });
  it('não mascara falha de consulta como caso legado', async () => {
    mocks.from.mockReturnValue(query({ data: null, error: { message: 'denied' } }));
    await expect(loadCaseInventory('resource-a')).rejects.toThrow('vínculo');
  });
  it('filtra pelo caso e is_active e ordena de forma determinística', async () => {
    const cases = query({ data: [{ id: 'case-a' }], error: null });
    const docs = query({ data: [{
      id: item.id, doc_number: 7, case_id: 'case-a', file_name: item.fileName, category: item.category,
      storage_path: item.storagePath, sha256: 'hash', display_order: 0, created_at: '2026-09-16',
    }], error: null });
    mocks.from.mockReturnValueOnce(cases).mockReturnValueOnce(docs);
    const result = await loadCaseInventory('resource-a');
    expect(docs.eq).toHaveBeenCalledWith('case_id', 'case-a');
    expect(docs.eq).toHaveBeenCalledWith('is_active', true);
    expect(docs.order).toHaveBeenCalledWith('id', { ascending: true });
    expect(result?.items[0].id).toBe(item.id);
    expect(result?.items[0].docNumber).toBe(7); // Never renumber surviving documents.
  });
  it('recusa caso conhecido sem documentos ativos', async () => {
    mocks.from.mockReturnValueOnce(query({ data: [{ id: 'case-a' }], error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }));
    await expect(loadCaseInventory('resource-a')).rejects.toThrow('documentos ativos');
  });
});
