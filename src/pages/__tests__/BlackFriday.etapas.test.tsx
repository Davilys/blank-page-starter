// @vitest-environment happy-dom
// Prova LOCAL (sem rede): etapas 2-6 de /blackfriday com STEP COMPONENTS REAIS.
// Mock apenas do client supabase (invoke/from interceptados), metaPixel e helmet.
// NENHUMA chamada real: inpi-viability-check e create-asaas-payment são fixtures.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor, cleanup, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const invokeMock = vi.fn(async (name: string) => {
  if (name === 'inpi-viability-check') {
    return { data: { classes: [35, 41], classDescriptions: ['35 - Publicidade (classe principal)', '41 - Educação'], primaryClass: 35 }, error: null };
  }
  if (name === 'create-asaas-payment') {
    return { data: { success: true, leadId: 'lead-bf', contractId: 'c', invoiceId: 'i', contractNumber: '1', customerId: 'cus', paymentId: 'pay', status: 'PENDING', billingType: 'PIX', dueDate: '2026-11-04', invoiceUrl: '', bankSlipUrl: '', pixQrCode: '' }, error: null };
  }
  return { data: null, error: null };
});

// chain supabase.from(tabela)...: métodos retornam a própria chain; await resolve fixture por tabela
const fromChain = (table: string): any => {
  const chain: any = {
    then: (res: any) => res(
      table === 'contract_templates'
        ? { data: [{ id: 't1', name: 'Contrato Essencial - Registro de Marca INPI', content: 'CONTRATO DE PRESTAÇÃO\nMarca: {{brandName}}\nTitular: {{fullName}}\nCPF: {{cpf}}', variables: [], is_active: true }], error: null }
        : { data: null, error: { message: 'fixture: sem linha' } },
    ),
  };
  for (const m of ['select', 'eq', 'or', 'order', 'limit', 'maybeSingle', 'single', 'insert', 'update', 'delete', 'in'])
    chain[m] = () => chain;
  return chain;
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
    functions: { invoke: (n: string, o: unknown) => invokeMock(n, o) },
    from: (t: string) => fromChain(t),
  },
}));
vi.mock('react-helmet-async', () => ({ Helmet: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (k: string) => k }) }));
vi.mock('@/lib/metaPixel', () => ({ trackInitiateCheckout: vi.fn(), trackEvent: vi.fn() }));
// Etapa 1 (busca) avança com fixture; etapas 2-6 são os componentes REAIS.
vi.mock('@/modules/trademark-search/components/TrademarkSearch', () => ({
  TrademarkSearch: (p: { onContinue: (b: string, a: string, j: unknown) => void }) => {
    React.useEffect(() => { p.onContinue('Marca Fixture BF', 'Consultoria Empresarial', { found: false }); }, []);
    return null;
  },
}));

import BlackFriday from '../BlackFriday';
import { TrademarkSearchProvider } from '@/modules/trademark-search/TrademarkSearchProvider';

const fill = (placeholder: string, value: string) => {
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
};

describe('BlackFriday — etapas 2-6 reais, payload capturado (sem rede)', { timeout: 60000 }, () => {
  beforeEach(() => { cleanup(); invokeMock.mockClear(); });

  it('fluxo completo: dados pessoais -> marca -> plano -> pagamento -> contrato -> invoke create-asaas-payment SEM sourcePage', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(React.createElement(QueryClientProvider, { client: qc },
      React.createElement(MemoryRouter, null, React.createElement(TrademarkSearchProvider, null, React.createElement(BlackFriday)))));

    // ETAPA 2 — dados pessoais (componente real, validação zod real)
    await screen.findByPlaceholderText('Seu nome completo', undefined, { timeout: 10000 });
    fill('Seu nome completo', 'Carla Fixture Silva');
    fill('seu@email.com', 'carla@fixture.com');
    fill('(00) 00000-0000', '(11) 99999-0001');
    fill('000.000.000-00', '529.982.247-25');
    fill('00000-000', '01402-000');
    fill('Rua, Avenida...', 'Av. Brigadeiro Luís Antônio');
    fill('Bairro', 'Jardim Paulista');
    fill('Cidade', 'São Paulo');
    fill('UF', 'SP');
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/ }));

    // ETAPA 3 — dados da marca (espera classes carregarem, senão o passo bloqueia)
    await waitFor(() => {
      expect(invokeMock.mock.calls.some(([n]) => n === 'inpi-viability-check')).toBe(true);
    }, { timeout: 10000 });
    await screen.findByText(/35 - Publicidade/, undefined, { timeout: 10000 });
    await waitFor(() => {
      const b = screen.getByRole('button', { name: /^Continuar$/ });
      fireEvent.click(b);
      expect(screen.queryByText('Nome da marca obrigatório')).toBeNull();
    }, { timeout: 10000 });

    // ETAPA 4 — plano (default essencial) -> Continuar
    await screen.findByText(/essencial/i, undefined, { timeout: 10000 });
    fireEvent.click(await screen.findByRole('button', { name: /^Continuar$/ }));

    // ETAPA 5 — pagamento PIX -> Continuar
    await screen.findByText(/PIX/, undefined, { timeout: 10000 });
    const pix = screen.getByText(/PIX — À Vista|PIX/).closest('button,div[role=button]') as HTMLElement;
    fireEvent.click(pix);
    fireEvent.click(await screen.findByRole('button', { name: /^Continuar$/ }));

    // ETAPA 6 — contrato real do template fixture: aceita termos e finaliza
    await screen.findByText(/Li e aceito os termos/, undefined, { timeout: 15000 });
    let node: HTMLElement | null = screen.getByText(/Li e aceito os termos/);
    let terms: HTMLInputElement | null = null;
    while (node && !terms) { terms = node.querySelector('input[type=checkbox]'); node = node.parentElement; }
    expect(terms, 'checkbox de termos não encontrada').toBeTruthy();
    fireEvent.click(terms!);
    let submitBtn: HTMLElement;
    try {
      submitBtn = await screen.findByRole('button', { name: /ASSINAR AGORA|Finalizar e Pagar|Assinar/ }, { timeout: 5000 });
    } catch (e) {
      console.log('BOTOES_VISIVEIS', JSON.stringify([...document.querySelectorAll('button')].map(b => ({ t: (b.textContent || '').trim().slice(0, 50), d: b.disabled }))));
      console.log('ACEITE_MARCADO', (document.querySelector('#accept') as HTMLInputElement)?.checked);
      throw e;
    }
    fireEvent.click(submitBtn);

    // CONTRATO DO PAYLOAD — capturado no invoke, sem rede
    await waitFor(() => {
      const call = invokeMock.mock.calls.find(([n]) => n === 'create-asaas-payment');
      expect(call, 'invoke create-asaas-payment não foi chamado').toBeTruthy();
    }, { timeout: 15000 });
    const [, opts] = invokeMock.mock.calls.find(([n]) => n === 'create-asaas-payment')!;
    const body = (opts as { body: any }).body;
    expect('sourcePage' in body).toBe(false);                 // BF NÃO envia sourcePage -> edge grava origin 'site'
    expect(body.personalData.fullName).toBe('Carla Fixture Silva');
    expect(body.brandData.brandName).toBe('Marca Fixture BF');
    expect(body.brandData.businessArea).toBe('Consultoria Empresarial');
    expect(body.paymentMethod).toBe('avista');   // id da opcao 'PIX - A Vista' do PaymentStep
    expect(body.plan).toBe('essencial');
    expect(body.selectedClasses).toEqual([35]);
    expect(typeof body.contractHtml).toBe('string');
    console.log('PAYLOAD_BF', JSON.stringify({ method: body.paymentMethod, value: body.paymentValue, classes: body.selectedClasses, marca: body.brandData.brandName, ramo: body.brandData.businessArea }));
  });
});
