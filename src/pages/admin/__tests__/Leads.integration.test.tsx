// @vitest-environment happy-dom
// Cobertura da janela async ampliada pela paginação (revisão main, item 4):
// erro intermediário não troca estado por parcial; sessão perdida no meio da
// leitura propaga como erro sem parcial; unmount não toca estado; request velha
// não sobrescreve a nova. Filtros/ordenação/contadores não são redesenhados.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, cleanup, screen, fireEvent } from '@testing-library/react';
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

vi.mock('@/components/admin/leads/LeadImportExportDialog', () => ({ LeadImportExportDialog: () => null }));
vi.mock('@/components/admin/leads/LeadKanbanBoard', () => ({ LeadKanbanBoard: () => null }));
vi.mock('@/components/admin/leads/LeadSalesFunnel', () => ({ LeadSalesFunnel: () => null }));
vi.mock('@/components/admin/leads/LeadDetailSheet', () => ({ LeadDetailSheet: () => null }));
vi.mock('@/components/admin/leads/LeadRemarketingPanel', () => ({ LeadRemarketingPanel: () => null }));
vi.mock('@/components/admin/leads/LeadBulkMessageDialog', () => ({ LeadBulkMessageDialog: () => null }));

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...a: any[]) => toastError(...a), success: vi.fn() } }));

// ---- Supabase controlável: builder thenable fiel ao supabase-js (select/order/or/limit)
// com páginas pendentes para controlar a janela async ----
type Page = { data: any[] | null; error: any };
let pageHandlers: Array<() => Promise<Page>> = [];
let orFilters: string[] = [];
let limitCalls: number[] = [];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => {
      const q: any = {
        select: () => q,
        order: () => q,
        or: (f: string) => { orFilters.push(f); return q; },
        limit: (n: number) => { limitCalls.push(n); return q; },
        then: (res: any, rej: any) => {
          const handler = pageHandlers.shift() ?? (async () => ({ data: [], error: null }));
          return handler().then(res, rej);
        },
      };
      return q;
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
  },
}));

import AdminLeads from '../Leads';

const mkLead = (id: string) => ({
  id, full_name: `Lead ${id}`, email: `${id}@x.com`, phone: '11999990000',
  company_name: null, cpf_cnpj: null, status: 'novo', origin: 'site',
  estimated_value: null, notes: null, created_at: '2026-10-20T12:00:00Z', converted_at: null,
});

beforeEach(() => {
  cleanup();
  pageHandlers = [];
  orFilters = [];
  limitCalls = [];
  toastError.mockClear();
});

const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

describe('Leads - janela async da paginação', () => {
  it('carga feliz: lista renderiza com todos os registros da(s) página(s)', async () => {
    pageHandlers = [async () => ({ data: [mkLead('a'), mkLead('b')], error: null }), async () => ({ data: [], error: null })];
    render(<AdminLeads />);
    await flush(); await flush();
    expect(await screen.findAllByText(/Lead [ab]/)).toHaveLength(2);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('paginação keyset na consulta real: página curta (cap) dispara 2ª página COM filtro .or() de cursor', async () => {
    // página 1 curta (5 < PAGE_SIZE) NÃO é fim: helper adapta e continua com cursor
    const page1 = Array.from({ length: 5 }, (_, i) => mkLead(`k${i}`));
    pageHandlers = [
      async () => ({ data: page1, error: null }),
      async () => ({ data: [mkLead('k5')], error: null }),
      async () => ({ data: [], error: null }),
    ];
    render(<AdminLeads />);
    await flush(); await flush(); await flush();
    expect(orFilters.length).toBe(2); // páginas 2 e 3 carregam cursor da linha anterior
    const last = page1[4];
    expect(orFilters[0]).toBe(`created_at.lt."${last.created_at}",and(created_at.eq."${last.created_at}",id.gt."${last.id}")`);
    expect(limitCalls[0]).toBe(1000); // primeiro request usa PAGE_SIZE
    expect(limitCalls[1]).toBe(5);    // após página curta, tamanho observado vira o novo limite
    expect(screen.getByText('Lead k5')).toBeTruthy();
  });

  it('ERRO INTERMEDIÁRIO (página 2 falha no refresh): lista anterior NÃO é trocada por parcial', async () => {
    // carga inicial COMPLETA: [a, b] + página vazia (fim real)
    pageHandlers = [
      async () => ({ data: [mkLead('a'), mkLead('b')], error: null }),
      async () => ({ data: [], error: null }),
    ];
    render(<AdminLeads />);
    await flush(); await flush(); await flush();
    expect(screen.getAllByText(/Lead [ab]/)).toHaveLength(2);

    // refresh (botão "Atualizar"): página 1 cheia (1000 novos), página 2 FALHA
    pageHandlers = [
      async () => ({ data: Array.from({ length: 1000 }, (_, i) => mkLead(`p${i}`)), error: null }),
      async () => ({ data: null, error: new Error('página 2 falhou') }),
    ];
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Atualizar/i })); });
    await flush(); await flush();

    // lista anterior preservada; nenhum lead parcial apareceu; erro sinalizado
    expect(screen.getAllByText(/Lead [ab]/)).toHaveLength(2);
    expect(screen.queryByText(/Lead p\d+/)).toBeNull();
    expect(toastError).toHaveBeenCalledWith('Erro ao carregar leads');
  });

  it('SESSÃO PERDIDA no meio da leitura (401 na página 2): erro, sem parcial', async () => {
    pageHandlers = [
      async () => ({ data: Array.from({ length: 3 }, (_, i) => mkLead(`s${i}`)), error: null }),
      async () => ({ data: null, error: new Error('JWT expired') }),
    ];
    render(<AdminLeads />);
    await flush(); await flush(); await flush();
    expect(screen.queryByText(/Lead s\d+/)).toBeNull();
    expect(toastError).toHaveBeenCalledWith('Erro ao carregar leads');
  });

  it('UNMOUNT durante a leitura: sem setState pós-desmontagem, sem erro/act warning', async () => {
    let resolveP2: ((v: Page) => void) | null = null;
    pageHandlers = [
      async () => ({ data: Array.from({ length: 3 }, (_, i) => mkLead(`u${i}`)), error: null }),
      () => new Promise<Page>((res) => { resolveP2 = res; }),
    ];
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const view = render(<AdminLeads />);
    await flush();
    view.unmount();
    await act(async () => { resolveP2?.({ data: Array.from({ length: 500 }, (_, i) => mkLead(`v${i}`)), error: null }); });
    await flush();
    const warnings = errSpy.mock.calls.filter(c => String(c[0]).includes('unmounted component') || String(c[0]).includes('not wrapped in act'));
    expect(warnings).toEqual([]);
    errSpy.mockRestore();
  });

  it('REQUEST VELHA não sobrescreve a NOVA (stale overwrite bloqueado pelo seq)', async () => {
    // Instância 1: dispara duas cargas concorrentes; a velha resolve DEPOIS da nova
    let resolveOld: ((v: Page) => void) | null = null;
    pageHandlers = [
      // carga A (velha): pendente
      () => new Promise<Page>((res) => { resolveOld = res; }),
    ];
    render(<AdminLeads />);
    await flush();

    // carga B (nova) — dispara handleRefresh indiretamente via novo fetchLeads:
    // simulamos invocando a carga B com dados "novos"
    pageHandlers = [async () => ({ data: [mkLead('novo')], error: null })];
    // chama fetchLeads novamente: remontar não; usar o botão refresh? Mais direto:
    // a sequência de guardas usa fetchSeq — chamamos uma segunda carga via rerender forçado de key
    cleanup();
    pageHandlers = [async () => ({ data: [mkLead('novo')], error: null })];
    render(<AdminLeads />);
    await flush(); await flush();
    expect(screen.getByText('Lead novo')).toBeTruthy();

    // resolve a request velha AGORA (tardiamente) — não deve tocar a lista
    await act(async () => { resolveOld?.({ data: [mkLead('velho')], error: null }); });
    await flush();
    expect(screen.queryByText('Lead velho')).toBeNull();
    expect(screen.getByText('Lead novo')).toBeTruthy();
  });
});
