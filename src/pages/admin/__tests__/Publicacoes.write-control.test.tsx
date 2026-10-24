// @vitest-environment happy-dom
// ABRIR a tela Publicacoes: escritas ao carregar. Backend mock (producao intocada) com paginacao keyset real.
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

vi.mock('@/lib/publicacoesAutoWrite', () => ({ PUBLICACOES_AUTOWRITE_ON_LOAD: true }));
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
    let after: string | null = null;
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
  id, process_id: null, client_id: 'c1', admin_id: null,
  status: '003', tipo_publicacao: 'publicacao_rpi',
  data_deposito: '2026-01-10', data_publicacao_rpi: '2026-10-01',
  prazo_oposicao: null, data_decisao: null, data_certificado: null, data_renovacao: null,
  proximo_prazo_critico: '2027-03-01', descricao_prazo: null,
  oposicao_protocolada: false, oposicao_data: null, comentarios_internos: null,
  documento_rpi_url: null, rpi_number: '2750', rpi_link: null, rpi_entry_id: null,
  brand_name_rpi: `MARCA ${id.toUpperCase()}`, process_number_rpi: `900${id}`, ncl_class: '35',
  cumprimento_ok: false, cumprimento_status: null,
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', ...over,
});
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const PROC = (id: string, over: any = {}) => ({ id, user_id: 'c1', pipeline_stage: '003', brand_name: `PROC ${id}`, process_number: `900${id}`, ncl_classes: [35], status: 'em_andamento', deposit_date: '2026-01-10', ...over });

const base = () => {
  __state.tables['profiles'] = { data: [{ id: 'c1', full_name: 'Cliente Um', email: 'c1@x.com' }], error: null };
  __state.tables['user_roles'] = { data: [], error: null };
  __state.tables['responsavel_atribuicao'] = { data: [], error: null };
  __state.tables['rpi_entries'] = { data: [], error: null };
  __state.tables['brand_processes'] = { data: [], error: null };
  __state.tables['publicacoes_marcas'] = { data: [], error: null };
};

// Cada cenario liga UMA rotina de escrita ao carregar.
const SCENARIOS: Record<string, { seed: () => void; expect: RegExp }> = {
  autoarquivar: { // pub com prazo vencido => status arquivado
    seed: () => { __state.tables['publicacoes_marcas'] = { data: [PUB('a1', { process_id: 'p1', proximo_prazo_critico: '2026-02-01' })], error: null };
                  __state.tables['brand_processes'] = { data: [PROC('p1')], error: null }; },
    expect: /publicacoes_marcas:update:.*arquivado/,
  },
  autocriar: { // processo em etapa juridica sem publicacao => insert
    seed: () => { __state.tables['brand_processes'] = { data: [PROC('p9', { pipeline_stage: 'oposicao' })], error: null };
                  __state.tables['publicacoes_marcas'] = { data: [PUB('a1', { process_id: 'p1' })], error: null }; },
    expect: /publicacoes_marcas:insert:/,
  },
  enriquecer: { // pub sem brand/numero/ncl com processo vinculado => update de campos vazios
    seed: () => { __state.tables['publicacoes_marcas'] = { data: [PUB('a1', { process_id: 'p1', brand_name_rpi: null, process_number_rpi: null, ncl_class: null })], error: null };
                  __state.tables['brand_processes'] = { data: [PROC('p1')], error: null }; },
    expect: /publicacoes_marcas:update:.*(brand_name_rpi|ncl_class|process_number_rpi)/,
  },
  syncrpi: { // entrada da revista casada com processo sem pub => insert/update vindo do RPI
    seed: () => { __state.tables['rpi_entries'] = { data: [{ id: 'r1', process_number: '900p5', brand_name: 'M5', rpi_number: '2750', matched_client_id: 'c1', matched_process_id: 'p5', dispatch_type: 'publicacao', rpi_date: '2026-10-01', status: 'matched', matched_publicacao_id: null, publicacao_id: null }], error: null };
                  __state.tables['brand_processes'] = { data: [PROC('p5')], error: null };
                  __state.tables['publicacoes_marcas'] = { data: [PUB('a1', { process_id: 'p1', rpi_entry_id: 'zzz' })], error: null }; },
    expect: /publicacoes_marcas:(insert|update):/,
  },
  autoatribuir: { // pub no bucket de 30 dias sem responsavel => upsert responsavel_atribuicao + historico
    seed: () => { __state.tables['publicacoes_marcas'] = { data: [PUB('a1', { process_id: 'p1', proximo_prazo_critico: inDays(20) })], error: null };
                  __state.tables['brand_processes'] = { data: [PROC('p1')], error: null }; },
    expect: /responsavel_(atribuicao|historico):(upsert|insert):/,
  },
};

const open = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  render(<QueryClientProvider client={qc}><Publicacoes /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByTitle('Lista')).toBeTruthy(), { timeout: 5000 });
  await act(async () => { await new Promise(r => setTimeout(r, 2500)); });
  // anti-vacuidade: a tela carregou de verdade (sem estado de erro)
  expect(screen.queryByText('Erro ao carregar publicações')).toBeNull();
  return __state.writes.map((w: any) => `${w.table}:${w.op}:${JSON.stringify(w.payload)}`);
};

beforeEach(() => { cleanup(); __state.tables = {}; __state.writes = []; toastError.mockClear(); });

describe('CONTROLE POSITIVO (flag ligada): cada rotina DEVE gravar no mesmo cenario', () => {
  for (const [nome, sc] of Object.entries(SCENARIOS)) {
    it(`cenario ${nome}: grava`, async () => {
      base(); sc.seed();
      const w = await open();
      expect(w.join('\n')).toMatch(sc.expect);
    });
  }
});
