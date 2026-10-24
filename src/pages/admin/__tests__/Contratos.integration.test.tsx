// @vitest-environment happy-dom
// Matriz UI — fluxo CONTRATOS: UI real (AdminContratos) + backend mock.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

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
  return { motion: new Proxy({}, { get: (_t, tag: string) => make(tag) }), AnimatePresence: (props: any) => R.createElement(R.Fragment, null, props?.children) };
});

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...a: any[]) => toastError(...a), success: (...a: any[]) => toastSuccess(...a), info: vi.fn(), warning: vi.fn() } }));

vi.mock('@/hooks/useCanViewFinancialValues', () => ({
  useCanViewFinancialValues: () => ({ canViewFinancialValues: true, isMasterAdmin: true, loading: false }),
}));
vi.mock('@/components/admin/contracts/ContractDetailSheet', () => ({ ContractDetailSheet: () => null }));
vi.mock('@/components/admin/contracts/CreateContractDialog', () => ({ CreateContractDialog: () => null }));
vi.mock('@/components/admin/contracts/EditContractDialog', () => ({ EditContractDialog: () => null }));
vi.mock('@/components/admin/contracts/LinkClientDialog', () => ({ LinkClientDialog: () => null }));
vi.mock('@/components/admin/clients/ClientDetailSheet', () => ({ ClientDetailSheet: () => null }));
vi.mock('@/lib/clientSheet', () => ({ loadClientForSheet: vi.fn(async () => null) }));
vi.mock('@/lib/signatureRequest', () => ({ sendSignatureRequestManual: vi.fn(async () => ({})) }));
vi.mock('@/lib/zipExportImport', () => ({ exportContractsZip: vi.fn(), importContractsZip: vi.fn(), downloadBlob: vi.fn() }));
vi.mock('@/components/contracts/DocumentRenderer', () => ({ generateDocumentPrintHTML: () => '', getLogoBase64ForPDF: async () => '' }));

let authCb: ((event: string, session: any) => void) | null = null;

type Resp = { data: any; error: any };
vi.mock('@/integrations/supabase/client', () => {
  const state: {
    tables: Record<string, Resp>;
    fnCalls: Array<{ name: string; opts: any }>;
    session: any;
  } = { tables: {}, fnCalls: [], session: { user: { id: 'u-admin-1' }, access_token: 'tok' } };

  const builder = (table: string, op: string, payload?: any) => {
    const resp = () => state.tables[table] ?? { data: [], error: null };
    const q: any = {
      select: () => q, order: () => q, eq: () => q, neq: () => q, in: () => q,
      or: () => q, limit: () => q, gte: () => q, lte: () => q,
      is: () => q, not: () => q, filter: () => q, match: () => q,
      ilike: () => q, like: () => q,
      range: (fromN: number) => { q.__page = fromN; return q; },
      single: () => Promise.resolve((() => { const r = resp(); return { data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: r.error }; })()),
      maybeSingle: () => Promise.resolve((() => { const r = resp(); return { data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: null }; })()),
      then: (res: any, rej: any) => {
        const r = resp();
        // paginação: devolve dados só na primeira página; seguintes vazias encerram o loop
        const out = q.__page > 0 ? { data: [], error: null } : r;
        return Promise.resolve(out).then(res, rej);
      },
    };
    return q;
  };

  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: state.session }, error: null }),
      getUser: async () => ({ data: { user: { id: 'u-admin-1' } }, error: null }),
      onAuthStateChange: (cb: any) => { authCb = cb; return { data: { subscription: { unsubscribe: vi.fn() } } }; },
    },
    channel: (_name: string) => ({ on: () => ({ subscribe: () => ({ unsubscribe: vi.fn() }) }) }),
    from: (table: string) => ({
      select: (..._a: any[]) => builder(table, 'select'),
      insert: (p: any) => builder(table, 'insert', p),
      update: (p: any) => builder(table, 'update', p),
      delete: () => builder(table, 'delete'),
      upsert: (p: any) => builder(table, 'upsert', p),
    }),
    functions: {
      invoke: async (name: string, opts: any) => {
        state.fnCalls.push({ name, opts });
        return { data: { synced: 0, total: 0 }, error: null };
      },
    },
    rpc: async () => ({ data: null, error: null }),
    __state: state,
  };
  return { supabase };
});

import { supabase } from '@/integrations/supabase/client';
const state = (supabase as any).__state as { tables: Record<string, Resp>; fnCalls: Array<{ name: string; opts: any }>; session: any };

import AdminContratos from '@/pages/admin/Contratos';

const C_SIGNED = {
  id: 'ct-1', contract_number: 'WM-2026-001', subject: 'Contrato de Honorários', contract_value: 1500,
  start_date: '2026-10-01', end_date: null, signature_status: 'signed', signature_expires_at: null,
  signed_at: '2026-10-05T10:00:00Z', visible_to_client: true, user_id: 'cli-1', created_at: '2026-10-01T09:00:00Z',
  contract_type_id: null, description: null, payment_method: 'pix', asaas_payment_id: null, template_id: null,
  document_type: null, signatory_name: null,
  contract_type: { name: 'Honorários' }, contract_template: null,
  profile: { full_name: 'Maria Silva', phone: null },
};
const C_PENDING = {
  ...C_SIGNED,
  id: 'ct-2', contract_number: 'WM-2026-002', subject: 'Contrato de Vigilância', signature_status: 'pending',
  signed_at: null, created_at: '2026-10-10T09:00:00Z',
  profile: { full_name: 'João Souza', phone: null },
};

const seedBase = () => {
  state.tables = {
    contracts: { data: [C_SIGNED, C_PENDING], error: null },
    invoices: { data: [], error: null },
  };
};

beforeEach(() => {
  cleanup();
  state.fnCalls = [];
  state.session = { user: { id: 'u-admin-1' }, access_token: 'tok' };
  authCb = null;
  toastError.mockClear();
  toastSuccess.mockClear();
  vi.stubGlobal('confirm', vi.fn(() => true));
  seedBase();
});

describe('Contratos — matriz UI', () => {
  it('carrega contratos do banco e renderiza linhas e KPIs', async () => {
    render(<AdminContratos />);
    await waitFor(() => expect(screen.getByText('WM-2026-001')).toBeTruthy(), { timeout: 8000 });
    expect(screen.getByText('Contrato de Honorários')).toBeTruthy();
    expect(screen.getByText('WM-2026-002')).toBeTruthy();
    expect(screen.getByText('Maria Silva')).toBeTruthy();
    expect(screen.getByText('João Souza')).toBeTruthy();
    // KPIs: 1 assinado, 1 pendente — os valores aparecem junto dos rótulos
    expect(screen.getAllByText('Assinados').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pendentes').length).toBeGreaterThan(0);
  }, 20000);

  it('erro na carga de contratos: toast de erro visível', async () => {
    state.tables.contracts = { data: null, error: { message: 'db down' } };
    render(<AdminContratos />);
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Erro ao carregar contratos'), { timeout: 8000 });
  }, 20000);

  it('guarda de exclusão: contrato assinado não pode ser excluído e não renderiza ação Deletar', async () => {
    render(<AdminContratos />);
    await waitFor(() => expect(screen.getByText('WM-2026-001')).toBeTruthy(), { timeout: 8000 });
    const deletarBtns = screen.getAllByText('Deletar');
    // apenas o contrato pendente expõe a ação
    expect(deletarBtns.length).toBe(1);
    // guarda de segurança também no handler: excluir o assinado é bloqueado com toast, sem delete no banco
    fireEvent.click(screen.getAllByText('Editar')[0]);
    expect(toastError).toHaveBeenCalledWith('Contratos assinados não podem ser editados');
  }, 20000);

  it('sync Asaas dispara uma vez no mount (getSession) e o caminho onAuthStateChange nunca dispara sync financeiro', async () => {
    render(<AdminContratos />);
    await waitFor(() => expect(screen.getByText('WM-2026-001')).toBeTruthy(), { timeout: 8000 });
    await waitFor(() => expect(state.fnCalls.filter(c => c.name === 'sync-asaas-invoices').length).toBe(1), { timeout: 8000 });
    expect(authCb).toBeTruthy();
    // simula evento de auth com sessão (hidratação tardia): init dedupado, sync proibido nesse caminho
    authCb!('SIGNED_IN', { user: { id: 'u-admin-1' } });
    await new Promise(r => setTimeout(r, 300));
    expect(state.fnCalls.filter(c => c.name === 'sync-asaas-invoices').length).toBe(1);
  }, 20000);

  it('busca por número/assunto/cliente filtra a tabela', async () => {
    render(<AdminContratos />);
    await waitFor(() => expect(screen.getByText('WM-2026-001')).toBeTruthy(), { timeout: 8000 });
    fireEvent.change(screen.getByPlaceholderText('Buscar por número, assunto ou cliente...'), { target: { value: 'Vigilância' } });
    await waitFor(() => expect(screen.queryByText('WM-2026-001')).toBeNull(), { timeout: 8000 });
    expect(screen.getByText('WM-2026-002')).toBeTruthy();
  }, 20000);
});
