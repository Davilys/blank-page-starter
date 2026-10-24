// @vitest-environment happy-dom
// Matriz UI — fluxo PUBLICAÇÕES: UI real (PublicacaoTab) + backend mock.
// Bateria 1: carga feliz, estado vazio, erro de carga.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('framer-motion', async () => {
  const ReactMod = await import('react');
  const R = (ReactMod as any).default ?? ReactMod;
  const MOTION_PROPS = new Set(['initial','animate','exit','transition','variants','whileHover','whileTap','whileFocus','whileInView','whileDrag','drag','dragConstraints','dragElastic','dragMomentum','layout','layoutId','layoutDependency','onAnimationStart','onAnimationComplete','onUpdate','style','transformTemplate','inherit']);
  const strip = (props: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props ?? {})) {
      if (k === 'children') continue;
      if (MOTION_PROPS.has(k)) continue;
      out[k] = v;
    }
    return out;
  };
  const make = (tag: string) => (props: any) => R.createElement(tag, strip(props), props?.children);
  return {
    motion: new Proxy({}, { get: (_t, tag: string) => make(tag) }),
    AnimatePresence: (props: any) => R.createElement(R.Fragment, null, props?.children),
  };
});

vi.mock('@/components/admin/publicacao/PublicacaoCharts', () => ({ PublicacaoCharts: () => null }));
vi.mock('@/components/admin/publicacao/PublicacaoKanban', () => ({ PublicacaoKanban: () => null }));
vi.mock('@/components/admin/publicacao/PublicacaoPrazos', () => ({ PublicacaoPrazos: () => null }));
vi.mock('@/components/admin/clients/ClientDetailSheet', () => ({ ClientDetailSheet: () => null }));
vi.mock('@/components/admin/clients/CreateInvoiceDialog', () => ({ CreateInvoiceDialog: () => null }));
vi.mock('@/components/admin/publicacao/PublicacaoPDFExport', () => ({ exportPublicacaoPDF: vi.fn() }));
vi.mock('@/hooks/useJuridicoStages', () => ({
  centralLabelMap: (m: any) => m,
  centralLabelOptions: (m: any) => Object.values(m ?? {}),
  centralLabelRecord: (m: any) => m,
  useJuridicoStages: () => ({ stages: [], isLoading: false }),
}));

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...a: any[]) => toastError(...a), success: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

// ---- Supabase mock: registro por tabela, builder thenable completo, captura de escritas ----
type Resp = { data: any; error: any };
vi.mock('@/integrations/supabase/client', () => {
  const state: {
    tables: Record<string, Resp>;
    writes: Array<{ table: string; op: string; payload: any }>;
    user: any;
  } = { tables: {}, writes: [], user: { id: 'u-admin-1', email: 'admin@x.com' } };

  const builder = (table: string, op: string, payload?: any) => {
    let after: string | null = null; // keyset: fetchAllById pagina por id (gt)
    const resp = () => {
      const r = state.tables[table] ?? { data: [], error: null };
      if (op === 'select' && after !== null && Array.isArray(r.data)) {
        return { ...r, data: [...r.data].sort((a: any, b: any) => (a.id < b.id ? -1 : 1)).filter((x: any) => x.id > after!) };
      }
      return r;
    };
    const q: any = {
      select: () => q, order: () => q, eq: () => q, neq: () => q, in: () => q,
      or: () => q, limit: () => q, range: () => q, gte: () => q, lte: () => q,
      gt: (_c: string, v: string) => { after = v; return q; },
      is: () => q, not: () => q, filter: () => q, match: () => q, upsert: () => q,
      ilike: () => q, like: () => q, contains: () => q, overlaps: () => q,
      single: () => Promise.resolve((() => { const r = resp(); return { data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: r.error }; })()),
      maybeSingle: () => Promise.resolve((() => { const r = resp(); return { data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: null }; })()),
      then: (res: any, rej: any) => {
        if (op !== 'select') state.writes.push({ table, op, payload });
        const r = resp();
        const out = op === 'select' ? r : { data: Array.isArray(r.data) ? r.data : (r.data ?? null), error: r.error };
        return Promise.resolve(out).then(res, rej);
      },
    };
    return q;
  };

  const supabase = {
    from: (table: string) => ({
      select: (..._a: any[]) => builder(table, 'select'),
      insert: (p: any) => builder(table, 'insert', p),
      update: (p: any) => builder(table, 'update', p),
      delete: () => builder(table, 'delete'),
      upsert: (p: any) => builder(table, 'upsert', p),
    }),
    rpc: () => Promise.resolve({ data: null, error: null }),
    auth: { getUser: () => Promise.resolve({ data: { user: state.user }, error: null }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
  };
  return { supabase, __state: state };
});

import Publicacoes from '../Publicacoes';
// @ts-expect-error acesso ao estado interno do mock
import { __state } from '@/integrations/supabase/client';

const PUB = (id: string, over: any = {}) => ({
  id, process_id: null, client_id: null, admin_id: null,
  status: '003', tipo_publicacao: 'publicacao_rpi',
  data_deposito: '2026-01-10', data_publicacao_rpi: '2026-10-01',
  prazo_oposicao: null, data_decisao: null, data_certificado: null, data_renovacao: null,
  proximo_prazo_critico: '2026-12-01', descricao_prazo: null,
  oposicao_protocolada: false, oposicao_data: null, comentarios_internos: null,
  documento_rpi_url: null, rpi_number: '2750', rpi_link: null, rpi_entry_id: null,
  brand_name_rpi: `MARCA ${id.toUpperCase()}`, process_number_rpi: `900000${id}`,
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', ...over,
});

const renderPage = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  const r = render(<QueryClientProvider client={qc}><Publicacoes /></QueryClientProvider>);
  // default da página é a visão 'prazos'; usuário alterna para Lista
  await waitFor(() => expect(screen.getByTitle('Lista')).toBeTruthy(), { timeout: 5000 });
  fireEvent.click(screen.getByTitle('Lista'));
  return r;
};

beforeEach(() => {
  cleanup();
  __state.tables = {};
  __state.writes = [];
  toastError.mockClear();
});

describe('Matriz UI — Publicações', () => {
  it('carga feliz: publicações aparecem na tela', async () => {
    __state.tables['publicacoes_marcas'] = { data: [PUB('a1',{client_id:'c1'}), PUB('b2',{client_id:'c2'})], error: null };
    __state.tables['brand_processes'] = { data: [], error: null };
    __state.tables['profiles'] = { data: [
      { id:'c1', full_name:'Cliente Um', email:'c1@x.com' },
      { id:'c2', full_name:'Cliente Dois', email:'c2@x.com' }], error: null };
    __state.tables['user_roles'] = { data: [], error: null };
    await renderPage();
    await waitFor(() => expect(screen.getAllByText(/MARCA A1/).length).toBeGreaterThan(0), { timeout: 5000 });
    expect(screen.getAllByText(/MARCA B2/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Cliente Um/).length).toBeGreaterThan(0);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('estado vazio: sem publicações mostra estado vazio', async () => {
    __state.tables['publicacoes_marcas'] = { data: [], error: null };
    __state.tables['brand_processes'] = { data: [], error: null };
    __state.tables['profiles'] = { data: [], error: null };
    __state.tables['user_roles'] = { data: [], error: null };
    await renderPage();
    await waitFor(() => expect(screen.getByText(/Nenhuma publicação encontrada/i)).toBeTruthy(), { timeout: 5000 });
  });

  it('publicação órfã aparece na lista com marcação "Sem cliente vinculado"', async () => {
    __state.tables['publicacoes_marcas'] = { data: [PUB('orf1',{client_id:null, process_id:null})], error: null };
    __state.tables['brand_processes'] = { data: [], error: null };
    __state.tables['profiles'] = { data: [], error: null };
    __state.tables['user_roles'] = { data: [], error: null };
    await renderPage();
    await waitFor(() => expect(screen.getAllByText(/MARCA ORF1/).length).toBeGreaterThan(0), { timeout: 5000 });
    expect(screen.getAllByText(/Sem cliente vinculado/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Nenhuma publicação encontrada/i)).toBeNull();
  });

  it('erro de carga: toast + estado de erro distinto do vazio', async () => {
    __state.tables['publicacoes_marcas'] = { data: null, error: { message: 'permission denied' } };
    __state.tables['brand_processes'] = { data: [], error: null };
    __state.tables['profiles'] = { data: [], error: null };
    __state.tables['user_roles'] = { data: [], error: null };
    await renderPage();
    await waitFor(() => expect(screen.getByText('Erro ao carregar publicações')).toBeTruthy(), { timeout: 5000 });
    expect(toastError).toHaveBeenCalled();
    expect(screen.queryByText(/Nenhuma publicação encontrada/i)).toBeNull();
    expect(screen.getByText('Tentar novamente')).toBeTruthy();
  });
});
