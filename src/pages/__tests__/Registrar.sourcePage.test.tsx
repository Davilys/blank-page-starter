// @vitest-environment happy-dom
// Prova LOCAL (sem rede): o invoke create-asaas-payment de /consultar (Registrar.tsx)
// envia sourcePage: '/consultar' no body. Todos os filhos/steps e o client supabase
// são mocks; o payload é interceptado no invoke. NENHUMA chamada real é feita.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const invokeMock = vi.fn(async (name: string) => {
  if (name === 'inpi-viability-check') {
    return { data: { classes: [35], classDescriptions: ['35 - Publicidade (classe principal)'], primaryClass: 35 }, error: null };
  }
  if (name === 'create-asaas-payment') {
    return { data: { success: true, leadId: 'test-lead', contractId: 'c', invoiceId: 'i', contractNumber: '1', customerId: 'cus', paymentId: 'pay', status: 'PENDING', billingType: 'PIX', dueDate: '2026-11-04', invoiceUrl: '', bankSlipUrl: '', pixQrCode: '' }, error: null };
  }
  return { data: null, error: null };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
    functions: { invoke: (name: string, opts: unknown) => invokeMock(name, opts) },
    from: () => { throw new Error('from() não deve ser chamado sem usuário'); },
  },
}));

vi.mock('react-helmet-async', () => ({ Helmet: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (k: string) => k }) }));
vi.mock('@/components/consultar/ConsultationShell', () => ({ default: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children) }));
vi.mock('@/components/consultar/ConsultationEntry', () => ({ default: () => null }));
vi.mock('@/modules/trademark-search/useTrademarkSearch', () => ({
  useTrademarkSearch: () => ({ state: { fullName: '', email: '', phone: '', phase: 'idle' } }),
  toViabilityResult: () => ({ score: 80, recommendation: 'ok' }),
}));
vi.mock('@/modules/trademark-search/components/TrademarkSearch', () => ({
  TrademarkSearch: (p: { onContinue: (b: string, a: string, j: unknown) => void }) => {
    React.useEffect(() => { p.onContinue('Marca Teste', 'Consultoria', {}); }, []);
    return null;
  },
}));
vi.mock('@/components/cliente/checkout/PersonalDataStep', () => ({
  PersonalDataStep: (p: { onNext: (d: unknown) => void }) => {
    React.useEffect(() => { p.onNext({ fullName: 'Teste Origem', email: 't@t.com', phone: '11999999999', cpf: '', cep: '', address: '', addressNumber: '', city: '', state: '', neighborhood: '' }); }, []);
    return null;
  },
}));
vi.mock('@/components/cliente/checkout/BrandDataStep', () => ({
  BrandDataStep: (p: { onNext: (d: unknown) => void }) => {
    // onNext é bloqueado até as classes carregarem; tenta até passar.
    // Ref para SEMPRE chamar o callback da render mais recente (closure fresca
    // de classesLoading/suggestedClasses) — o interval não pode capturar p antigo.
    const ref = React.useRef(p);
    ref.current = p;
    React.useEffect(() => {
      const t = setInterval(() => ref.current.onNext({ brandName: 'Marca Teste', businessArea: 'Consultoria', hasCNPJ: false, cnpj: '', companyName: '' }), 50);
      const stop = setTimeout(() => clearInterval(t), 12000);
      return () => { clearInterval(t); clearTimeout(stop); };
    }, []);
    return null;
  },
}));
vi.mock('@/components/cliente/checkout/PlanSelectionStep', () => ({
  PlanSelectionStep: (p: { onNext: (plan: string) => void }) => {
    React.useEffect(() => { p.onNext('essencial'); }, []);
    return null;
  },
}));
vi.mock('@/components/cliente/checkout/PaymentStep', () => ({
  PaymentStep: (p: { onNext: (m: string, v: number) => void }) => {
    React.useEffect(() => { p.onNext('pix', 699); }, []);
    return null;
  },
}));
vi.mock('@/components/cliente/checkout/ContractStep', () => ({
  ContractStep: (p: { onSubmit: (html: string) => void }) => {
    React.useEffect(() => { const t = setTimeout(() => p.onSubmit('<html>contrato teste</html>'), 50); return () => clearTimeout(t); }, []);
    return null;
  },
}));

import Registrar from '../Registrar';

describe('Registrar (/consultar) — payload create-asaas-payment', () => {
  beforeEach(() => { cleanup(); invokeMock.mockClear(); });

  it('envia sourcePage: /consultar no body do invoke (interceptado, sem rede)', { timeout: 25000 }, async () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Registrar)));
    try {
    await waitFor(() => {
      const call = invokeMock.mock.calls.find(([n]) => n === 'create-asaas-payment');
      expect(call, 'invoke create-asaas-payment não foi chamado').toBeTruthy();
    }, { timeout: 8000 });
    } catch (e) { console.log('DIAG calls:', JSON.stringify(invokeMock.mock.calls.map(([n])=>n))); throw e; }
    const [, opts] = invokeMock.mock.calls.find(([n]) => n === 'create-asaas-payment')!;
    const body = (opts as { body: Record<string, unknown> }).body;
    expect(body.sourcePage).toBe('/consultar');
    expect((body.personalData as { fullName: string }).fullName).toBe('Teste Origem');
    expect(body.plan).toBe('essencial');
  });
});
