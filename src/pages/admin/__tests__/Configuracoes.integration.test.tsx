// @vitest-environment happy-dom
// Matriz UI — fluxo CONFIGURAÇÕES: UI real (Configuracoes + GeneralSettings) + backend mock.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
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

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...a: any[]) => toastError(...a), success: (...a: any[]) => toastSuccess(...a), info: vi.fn(), warning: vi.fn() } }));

// ---- Supabase mock com filtros eq/in aplicados de verdade ----
type Resp = { data: any; error: any };
vi.mock('@/integrations/supabase/client', () => {
  const state: {
    tables: Record<string, Resp>;
    writes: Array<{ table: string; op: string; payload: any; filters: any[] }>;
    user: any;
    updateErrors: Record<string, any>;
  } = { tables: {}, writes: [], user: { id: 'u-admin-1', email: 'admin@x.com' }, updateErrors: {} };

  const applyFilters = (rows: any[], filters: any[]) =>
    rows.filter(r => filters.every(([op, col, val]) => {
      if (op === 'eq') return r[col] === val;
      if (op === 'in') return Array.isArray(val) && val.includes(r[col]);
      return true;
    }));

  const builder = (table: string, op: string, payload?: any) => {
    const filters: any[] = [];
    const resp = () => state.tables[table] ?? { data: [], error: null };
    const resolveRows = () => {
      const r = resp();
      const rows = Array.isArray(r.data) ? r.data : (r.data ? [r.data] : []);
      return { rows: applyFilters(rows, filters), error: r.error };
    };
    const q: any = {
      select: () => q, order: () => q, or: () => q, limit: () => q, range: () => q,
      gte: () => q, lte: () => q, is: () => q, not: () => q, filter: () => q, match: () => q,
      ilike: () => q, like: () => q, contains: () => q, overlaps: () => q, neq: () => q,
      eq: (c: string, v: any) => { filters.push(['eq', c, v]); return q; },
      in: (c: string, v: any[]) => { filters.push(['in', c, v]); return q; },
      single: () => Promise.resolve((() => { const { rows, error } = resolveRows(); return { data: rows[0] ?? null, error: op === 'select' && !rows.length ? { message: 'PGRST116' } : error }; })()),
      maybeSingle: () => Promise.resolve((() => { const { rows } = resolveRows(); return { data: rows[0] ?? null, error: null }; })()),
      then: (res: any, rej: any) => {
        if (op !== 'select') {
          state.writes.push({ table, op, payload, filters: [...filters] });
          const forcedErr = state.updateErrors[table];
          return Promise.resolve({ data: null, error: forcedErr ?? resp().error }).then(res, rej);
        }
        const { rows, error } = resolveRows();
        return Promise.resolve({ data: rows, error }).then(res, rej);
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
    auth: {
      getUser: () => Promise.resolve({ data: { user: state.user }, error: null }),
      updateUser: () => Promise.resolve({ data: {}, error: null }),
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
  };
  return { supabase, __state: state };
});

import Configuracoes from '../Configuracoes';
// @ts-expect-error acesso ao estado interno do mock
import { __state } from '@/integrations/supabase/client';

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  return render(<QueryClientProvider client={qc}><Configuracoes /></QueryClientProvider>);
};

const seedBase = () => {
  __state.tables['profiles'] = { data: [{ id: 'u-admin-1', full_name: 'Admin Teste', phone: '11999990000' }], error: null };
  __state.tables['system_settings'] = { data: [
    { key: 'company', value: { name: 'WebMarcas', phone: '', email: '', cnpj: '', address: '', website: '', instagram: '', facebook: '', linkedin: '', youtube: '', twitter: '' } },
    { key: 'business_hours', value: { weekdays: '09:00-18:00', saturday: '09:00-13:00', sunday: 'Fechado' } },
  ], error: null };
};

beforeEach(() => {
  cleanup();
  __state.tables = {};
  __state.writes = [];
  __state.updateErrors = {};
  toastError.mockClear();
  toastSuccess.mockClear();
});

describe('Matriz UI — Configurações', () => {
  it('shell renderiza grupos de navegação', async () => {
    seedBase();
    renderPage();
    await waitFor(() => expect(screen.getAllByText('Segurança').length).toBeGreaterThan(0), { timeout: 5000 });
    for (const label of ['Geral', 'Aparência', 'Backup', 'Preços', 'Contratos', 'Processos', 'Financeiro', 'E-mail', 'WhatsApp', 'Integrações', 'API e Webhooks']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('aba Geral carrega dados da empresa do banco', async () => {
    seedBase();
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('WebMarcas')).toBeTruthy(), { timeout: 5000 });
  });

  it('salvar empresa: grava update na chave company e mostra sucesso', async () => {
    seedBase();
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('WebMarcas')).toBeTruthy(), { timeout: 5000 });
    fireEvent.click(screen.getByText('Salvar Dados da Empresa'));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled(), { timeout: 5000 });
    const w = __state.writes.find(x => x.table === 'system_settings' && x.op === 'update');
    expect(w).toBeTruthy();
    expect(w!.filters).toContainEqual(['eq', 'key', 'company']);
  });

  it('erro ao salvar empresa: mostra toast de erro, sem falso sucesso', async () => {
    seedBase();
    __state.updateErrors['system_settings'] = { message: 'row-level security' };
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('WebMarcas')).toBeTruthy(), { timeout: 5000 });
    fireEvent.click(screen.getByText('Salvar Dados da Empresa'));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Erro ao salvar dados da empresa'), { timeout: 5000 });
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
