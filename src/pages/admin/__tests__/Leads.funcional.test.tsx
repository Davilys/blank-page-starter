// @vitest-environment happy-dom
// Prova LOCAL (sem rede): comportamento funcional do Leads reconciliado.
// fetchAllKeyset retorna fixtures; supabase.functions.invoke é interceptado
// (NENHUMA chamada real; nenhum envio real de laudo/mensagem).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor, cleanup, fireEvent, screen } from '@testing-library/react';

const invokeMock = vi.fn(async (name: string, opts?: any) => {
  const action = opts?.body?.action;
  if (name === 'webmarcas-leads-laudo' && action === 'resend_laudo')
    return { data: { ok: true, search_id: 's-fixture-1' }, error: null };
  if (name === 'webmarcas-leads-laudo' && action === 'resend_status')
    return { data: { state: 'delivered' }, error: null };
  return { data: null, error: null };
});

const FIXTURES = [
  { id: 'l1', full_name: 'Mariana Nome Comprido', email: 'mariana@exemplo.com', phone: '11999990001',
    company_name: 'Empresa Com Nome Comprido Para Truncar Demais Ltda',
    business_area: 'Serviços Jurídicos Especializados em Propriedade Industrial',
    status: 'novo', origin: 'site-consultar', estimated_value: 1194, created_at: '2026-11-02T22:53:00Z' },
  { id: 'l2', full_name: 'João Curto', email: null, phone: null,
    company_name: 'Curta', business_area: null,
    status: 'novo', origin: 'origem-nao-mapeada-xyz', estimated_value: null, created_at: '2026-11-02T23:10:00Z' },
  { id: 'l3', full_name: 'Ana Sem Origem', email: null, phone: '11999990003',
    company_name: null, business_area: null,
    status: 'novo', origin: null, estimated_value: null, created_at: '2026-11-02T23:40:00Z' },
];

vi.mock('@/lib/fetchAllPages', () => ({
  fetchAllKeyset: vi.fn(async () => FIXTURES), PAGE_SIZE: 100,
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (n: string, o: unknown) => invokeMock(n, o) },
    from: () => { throw new Error('from() não esperado neste teste'); },
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/components/admin/leads/LeadImportExportDialog', () => ({ LeadImportExportDialog: () => null }));
vi.mock('@/components/admin/leads/LeadKanbanBoard', () => ({ LeadKanbanBoard: () => null }));
vi.mock('@/components/admin/leads/LeadSalesFunnel', () => ({ LeadSalesFunnel: () => null }));
vi.mock('@/components/admin/leads/LeadDetailSheet', () => ({ LeadDetailSheet: () => null }));
vi.mock('@/components/admin/leads/LeadRemarketingPanel', () => ({ LeadRemarketingPanel: () => null }));
vi.mock('@/components/admin/leads/LeadDirectMessageDialog', () => ({ LeadDirectMessageDialog: () => null }));

import AdminLeads from '../Leads';

const openMenu = async (name: string) => {
  const row = (await screen.findByText(name)).closest('tr')!;
  const btn = row.querySelector('td:last-child button') as HTMLElement;
  fireEvent.pointerDown(btn, { button: 0, ctrlKey: false });
  fireEvent.click(btn);
  return row;
};

describe('Leads reconciliado — funcional (fixtures, sem rede)', () => {
  beforeEach(() => { cleanup(); invokeMock.mockClear(); });

  it('tabela table-fixed + origem: site-consultar->"Site /consultar", desconhecida->raw, nula->"—"', async () => {
    render(React.createElement(AdminLeads));
    await screen.findByText('Mariana Nome Comprido');
    expect(document.querySelector('table')!.className).toContain('table-fixed');
    expect(screen.getByText('Site /consultar')).toBeTruthy();          // l1 mapeada
    expect(screen.getByText('origem-nao-mapeada-xyz')).toBeTruthy();    // l2 fallback raw
    const row3 = screen.getByText('Ana Sem Origem').closest('tr')!;
    expect(row3.textContent).toContain('—');                            // l3 fallback
  });

  it('ellipsis/expand: company e business_area expandem ao clique; sem business_area não há span', async () => {
    render(React.createElement(AdminLeads));
    await screen.findByText('Mariana Nome Comprido');
    const comp = screen.getByTitle('Empresa Com Nome Comprido Para Truncar Demais Ltda');
    expect(comp.className).toContain('truncate');
    fireEvent.click(comp);
    expect(comp.className).not.toContain('truncate');                   // expandiu
    fireEvent.click(comp);
    expect(comp.className).toContain('truncate');                       // colapsou
    const area = screen.getByTitle('Serviços Jurídicos Especializados em Propriedade Industrial');
    expect(area.className).toContain('truncate');
    fireEvent.click(area);
    expect(area.className).not.toContain('truncate');
    // negativo: l2 sem business_area -> nenhum span expansível extra
    const row2 = screen.getByText('João Curto').closest('tr')!;
    expect(row2.querySelectorAll('[title]').length).toBe(1);             // só company 'Curta'
  });

  it('reenvio laudo: payload resend_laudo com lead_id correto + poll resend_status até delivered', { timeout: 20000 }, async () => {
    render(React.createElement(AdminLeads));
    await openMenu('Mariana Nome Comprido');
    const item = await screen.findByText('Enviar laudo');
    fireEvent.click(item);
    await waitFor(() => {
      const call = invokeMock.mock.calls.find(([n, o]: any[]) => n === 'webmarcas-leads-laudo' && o?.body?.action === 'resend_laudo');
      expect(call, 'resend_laudo não chamado').toBeTruthy();
    });
    const calls = invokeMock.mock.calls.filter(([n, o]: any[]) => o?.body?.action === 'resend_laudo');
    expect(calls.length).toBe(1);                                       // 1 clique -> 1 despacho
    expect((calls[0][1] as any).body.lead_id).toBe('l1');               // lead correto
    // o menu fecha no select (radix), então a confirmação é observada pelas
    // chamadas: poll resend_status com o search_id retornado até delivered
    await waitFor(() => {
      const st = invokeMock.mock.calls.find(([n, o]: any[]) => o?.body?.action === 'resend_status');
      expect(st, 'resend_status não consultado').toBeTruthy();
      expect((st![1] as any).body.lead_id).toBe('l1');
      expect((st![1] as any).body.search_id).toBe('s-fixture-1');
    }, { timeout: 9000 });
  });

  it('negativo: lead sem telefone tem "Enviar laudo" desabilitado e NÃO dispara invoke', async () => {
    render(React.createElement(AdminLeads));
    await openMenu('João Curto');
    const item = (await screen.findByText('Enviar laudo')).closest('[role=menuitem]') as HTMLElement;
    expect(item.getAttribute('aria-disabled')).toBe('true');
    expect(item.getAttribute('data-disabled')).not.toBeNull();
    // no browser real o clique é bloqueado pela classe data-[disabled]:pointer-events-none
    // (happy-dom não aplica CSS, então o contrato é o atributo+classe, não o clique)
    expect(item.className).toContain('pointer-events-none');
    expect(invokeMock.mock.calls.filter(([n, o]: any[]) => o?.body?.action === 'resend_laudo').length).toBe(0);
  });
});
