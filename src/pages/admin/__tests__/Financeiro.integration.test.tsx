// @vitest-environment happy-dom
// Matriz UI — fluxo FINANCEIRO: UI real (AdminFinanceiro) + backend mock (RPCs + edge functions).
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
  return {
    motion: new Proxy({}, { get: (_t, tag: string) => make(tag) }),
    AnimatePresence: (props: any) => R.createElement(R.Fragment, null, props?.children),
  };
});

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...a: any[]) => toastError(...a), success: (...a: any[]) => toastSuccess(...a), info: vi.fn(), warning: vi.fn() } }));

vi.mock('@/hooks/useCanViewFinancialValues', () => ({
  useCanViewFinancialValues: () => ({ canViewFinancialValues: true, isMasterAdmin: true, loading: false }),
}));
vi.mock('@/hooks/useResponsaveis', () => ({ useResponsaveis: () => ({}) }));
vi.mock('@/components/admin/shared/ResponsavelChip', () => ({ ResponsavelChip: () => null }));
vi.mock('@/components/admin/clients/ClientDetailSheet', () => ({ ClientDetailSheet: () => null }));
vi.mock('@/lib/clientSheet', () => ({ loadClientForSheet: vi.fn(async () => null) }));

// BillingSituationSection: captura os dados que a página normalizou e repassa
let billingSeen: any = null;
vi.mock('@/components/admin/financeiro/BillingSituationSection', () => ({
  BillingSituationSection: (props: any) => {
    billingSeen = props.data;
    const cats = props.data?.categories || {};
    return React.createElement('div', { 'data-testid': 'billing-section' },
      `recebidas:${cats.recebidas?.invoices_count ?? '-'} vencidas:${cats.vencidas?.invoices_count ?? '-'} total:${props.data?.total ?? '-'}`);
  },
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

// ---- Supabase mock: tabelas + RPCs + edge functions ----
type Resp = { data: any; error: any };
vi.mock('@/integrations/supabase/client', () => {
  const state: {
    tables: Record<string, Resp>;
    rpc: Record<string, Resp | ((params: any) => Resp)>;
    fnInvoke: (name: string, opts: any) => Promise<Resp>;
    rpcCalls: Array<{ name: string; params: any }>;
    fnCalls: Array<{ name: string; opts: any }>;
    user: any;
  } = {
    tables: {},
    rpc: {},
    rpcCalls: [],
    fnCalls: [],
    user: { id: 'u-admin-1', email: 'admin@x.com' },
    fnInvoke: async () => ({ data: { run: null }, error: null }),
  };

  const builder = (table: string, op: string, payload?: any) => {
    const resp = () => state.tables[table] ?? { data: [], error: null };
    const q: any = {
      select: () => q, order: () => q, eq: () => q, neq: () => q, in: () => q,
      or: () => q, limit: () => q, gte: () => q, lte: () => q,
      is: () => q, not: () => q, filter: () => q, match: () => q,
      ilike: () => q, like: () => q,
      range: (fromN: number) => {
        // paginação de fetchClients: devolve a página 0 e vazio nas seguintes
        q.__page = fromN;
        return q;
      },
      single: () => Promise.resolve((() => { const r = resp(); return { data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: r.error }; })()),
      maybeSingle: () => Promise.resolve((() => { const r = resp(); return { data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: null }; })()),
      then: (res: any, rej: any) => {
        const r = resp();
        const out = table === 'profiles' && q.__page > 0 ? { data: [], error: null } : r;
        return Promise.resolve(out).then(res, rej);
      },
    };
    return q;
  };

  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: state.user }, error: null }),
    },
    from: (table: string) => ({
      select: (..._a: any[]) => builder(table, 'select'),
      insert: (p: any) => builder(table, 'insert', p),
      update: (p: any) => builder(table, 'update', p),
      delete: () => builder(table, 'delete'),
      upsert: (p: any) => builder(table, 'upsert', p),
    }),
    rpc: async (name: string, params: any) => {
      state.rpcCalls.push({ name, params });
      const h = state.rpc[name];
      if (!h) return { data: null, error: null };
      return typeof h === 'function' ? h(params) : h;
    },
    functions: {
      invoke: async (name: string, opts: any) => {
        state.fnCalls.push({ name, opts });
        return state.fnInvoke(name, opts);
      },
    },
    __state: state,
  };
  return { supabase };
});

import { supabase } from '@/integrations/supabase/client';
const state = (supabase as any).__state as {
  tables: Record<string, Resp>;
  rpc: Record<string, Resp | ((params: any) => Resp)>;
  rpcCalls: Array<{ name: string; params: any }>;
  fnCalls: Array<{ name: string; opts: any }>;
  fnInvoke: (name: string, opts: any) => Promise<Resp>;
};

import AdminFinanceiro from '@/pages/admin/Financeiro';

const INVOICE = {
  id: 'inv-1',
  description: 'Registro de marca - Depósito',
  amount: 1250.5,
  due_date: '2026-10-30',
  status: 'PENDING',
  classificacao: 'aguardando',
  payment_date: null,
  user_id: 'cli-1',
  created_at: '2026-10-20T10:00:00Z',
  invoice_url: null,
  pix_code: null,
  payment_method: 'PIX',
  sync_status: null,
  origem: null,
  asaas_invoice_id: null,
  cliente_nome: 'Maria Silva',
  cliente_email: 'maria@x.com',
  total_count: 1,
};

const BILLING = {
  total: 1250.5,
  categories: {
    recebidas: { gross_amount: 5000, net_amount: 4900, clients_count: 4, invoices_count: 6, composition: [] },
    vencidas: { gross_amount: 800, net_amount: 780, clients_count: 2, invoices_count: 3, composition: [] },
  },
};

const seedBase = () => {
  state.tables = {
    profiles: { data: [{ id: 'cli-1', full_name: 'Maria Silva', email: 'maria@x.com', cpf_cnpj: '123', asaas_customer_id: 'cus_1' }], error: null },
    brand_processes: { data: [], error: null },
  };
  state.rpc = {
    admin_invoices_list_filtered: { data: [INVOICE], error: null },
    admin_billing_situation: { data: BILLING, error: null },
    admin_asaas_accounts: { data: [], error: null },
  };
  state.fnInvoke = async (_n, opts) => {
    if (opts?.body?.action === 'start') return { data: { run: { status: 'concluido', clientes_criados: 2, criadas: 5, atualizadas: 7 } }, error: null };
    return { data: { run: null }, error: null };
  };
};

beforeEach(() => {
  cleanup();
  state.rpcCalls = [];
  state.fnCalls = [];
  toastError.mockClear();
  toastSuccess.mockClear();
  billingSeen = null;
  seedBase();
});

describe('Financeiro — matriz UI', () => {
  it('carrega faturas via RPC e renderiza descrição, cliente e valor', async () => {
    render(<AdminFinanceiro />);
    await waitFor(() => expect(screen.getByText('Registro de marca - Depósito')).toBeTruthy(), { timeout: 5000 });
    expect(screen.getByText('Maria Silva')).toBeTruthy();
    expect(screen.getByText(/1\.250,50/)).toBeTruthy();
    const listCalls = state.rpcCalls.filter(c => c.name === 'admin_invoices_list_filtered');
    expect(listCalls.length).toBeGreaterThan(0);
    expect(listCalls[0].params.p_limit).toBe(50);
    expect(listCalls[0].params.p_offset).toBe(0);
  });

  it('erro na RPC de faturas: toast + estado de erro distinto do vazio', async () => {
    state.rpc.admin_invoices_list_filtered = { data: null, error: { message: 'permission denied' } };
    render(<AdminFinanceiro />);
    await waitFor(() => expect(toastError).toHaveBeenCalled(), { timeout: 5000 });
    await waitFor(() => expect(screen.getByText('Erro ao carregar faturas')).toBeTruthy(), { timeout: 5000 });
    expect(screen.queryByText('Nenhuma fatura encontrada')).toBeNull();
    expect(screen.getAllByText('Tentar novamente').length).toBeGreaterThan(0);
  });

  it('totais: falha na RPC admin_billing_situation mostra "Totais indisponíveis", nunca zerado silencioso', async () => {
    state.rpc.admin_billing_situation = { data: null, error: { message: 'rpc down' } };
    render(<AdminFinanceiro />);
    await waitFor(() => expect(screen.getByText('Registro de marca - Depósito')).toBeTruthy(), { timeout: 5000 });
    await waitFor(() => expect(screen.getByText('Totais indisponíveis')).toBeTruthy(), { timeout: 5000 });
    // seção de KPIs NÃO renderiza (nada de zeros fingindo ausência de receita)
    expect(screen.queryByTestId('billing-section')).toBeNull();
  });

  it('totais: dados da RPC chegam normalizados à seção de situação de cobrança', async () => {
    render(<AdminFinanceiro />);
    await waitFor(() => expect(screen.getByTestId('billing-section').textContent).toContain('recebidas:6'), { timeout: 5000 });
    expect(screen.getByTestId('billing-section').textContent).toContain('vencidas:3');
    expect(screen.getByTestId('billing-section').textContent).toContain('total:1250.5');
  });

  it('Sincronizar Asaas dispara edge function e confirma com resumo real', async () => {
    render(<AdminFinanceiro />);
    await waitFor(() => expect(screen.getByText('Registro de marca - Depósito')).toBeTruthy(), { timeout: 5000 });
    fireEvent.click(screen.getByText('Sincronizar Asaas'));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled(), { timeout: 5000 });
    const start = state.fnCalls.filter(c => c.name === 'sync-asaas-all' && c.opts?.body?.action === 'start');
    expect(start.length).toBe(1);
    expect(toastSuccess.mock.calls[0][0]).toContain('2 cliente(s)');
    expect(toastSuccess.mock.calls[0][0]).toContain('5 cobrança(s)');
  });

  it('nova fatura sem campos obrigatórios: validação bloqueia sem chamar edge function', async () => {
    render(<AdminFinanceiro />);
    await waitFor(() => expect(screen.getByText('Registro de marca - Depósito')).toBeTruthy(), { timeout: 5000 });
    fireEvent.click(screen.getByText('Nova Fatura'));
    const btn = await screen.findByText('Criar Fatura', {}, { timeout: 8000 });
    fireEvent.click(btn);
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Preencha todos os campos obrigatórios'), { timeout: 8000 });
    expect(state.fnCalls.filter(c => c.name === 'create-admin-invoice').length).toBe(0);
  }, 25000);
});
