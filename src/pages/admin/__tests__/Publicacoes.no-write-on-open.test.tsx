// @vitest-environment happy-dom
// Invariancia: ABRIR a tela Publicacoes nao grava nada (zero insert/update/upsert/delete).
// Dados montados para disparar TODAS as rotinas de escrita ao carregar (criar, sync RPI,
// arquivar por prazo, enriquecer, auto-atribuir responsavel). Backend mock; producao intocada.
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
    const resp = () => state.tables[table] ?? { data: [], error: null };
    const q: any = {
      select: () => q, order: () => q, eq: () => q, neq: () => q, in: () => q,
      or: () => q, limit: () => q, range: () => q, gte: () => q, lte: () => q,
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
  id, process_id: null, client_id: 'c1', admin_id: null,
  status: '003', tipo_publicacao: 'publicacao_rpi',
  data_deposito: '2026-01-10', data_publicacao_rpi: '2026-01-01',
  prazo_oposicao: null, data_decisao: null, data_certificado: null, data_renovacao: null,
  proximo_prazo_critico: '2026-02-01', descricao_prazo: null,
  oposicao_protocolada: false, oposicao_data: null, comentarios_internos: null,
  documento_rpi_url: null, rpi_number: '2750', rpi_link: null, rpi_entry_id: null,
  brand_name_rpi: null, process_number_rpi: null, ncl_class: null,
  cumprimento_ok: false, cumprimento_status: null,
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', ...over,
});
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const seed = () => {
  __state.tables['publicacoes_marcas'] = { data: [
    PUB('expirada', { process_id: 'p1' }),                                   // auto-arquivar
    PUB('semcampos', { process_id: 'p2', proximo_prazo_critico: inDays(40) }), // enriquecer + auto-atribuir
    PUB('semana', { process_id: 'p3', proximo_prazo_critico: inDays(3) }),     // auto-atribuir bucket
  ], error: null };
  __state.tables['brand_processes'] = { data: [
    { id: 'p1', user_id: 'c1', pipeline_stage: '003', brand_name: 'M1', process_number: '111', ncl_classes: [35], status: 'em_andamento' },
    { id: 'p2', user_id: 'c1', pipeline_stage: '003', brand_name: 'M2', process_number: '222', ncl_classes: [9], status: 'em_andamento' },
    { id: 'p3', user_id: 'c1', pipeline_stage: '003', brand_name: 'M3', process_number: '333', ncl_classes: [41], status: 'em_andamento' },
    { id: 'p4', user_id: 'c1', pipeline_stage: 'oposicao', brand_name: 'M4', process_number: '444', ncl_classes: [25], status: 'em_andamento' }, // auto-criar
  ], error: null };
  __state.tables['rpi_entries'] = { data: [
    { id: 'r1', process_number: '111', brand_name: 'M1', rpi_number: '2750', matched_client_id: 'c1', matched_process_id: 'p1', dispatch_type: 'publicacao', rpi_date: '2026-10-01', status: 'matched' },
  ], error: null };
  __state.tables['profiles'] = { data: [{ id: 'c1', full_name: 'Cliente Um', email: 'c1@x.com' }], error: null };
  __state.tables['user_roles'] = { data: [], error: null };
  __state.tables['responsavel_atribuicao'] = { data: [], error: null };
};

beforeEach(() => { cleanup(); __state.tables = {}; __state.writes = []; toastError.mockClear(); });

describe('Invariancia: abrir Publicacoes', () => {
  it('abrir a tela (visao Prazos, padrao) nao dispara NENHUMA escrita', async () => {
    seed();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
    render(<QueryClientProvider client={qc}><Publicacoes /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByTitle('Lista')).toBeTruthy(), { timeout: 5000 });
    await act(async () => { await new Promise(r => setTimeout(r, 2500)); });
    expect(__state.writes).toEqual([]);
  });
});
