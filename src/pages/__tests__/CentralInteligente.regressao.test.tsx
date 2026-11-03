// @vitest-environment happy-dom
// QA de regressão CRM (03/11): prova LOCAL (sem rede) dos dois fluxos que sumiram no live:
// 1) menu mobile "Mais" exibe o botão "Central Inteligente" -> /admin/chat-ao-vivo
// 2) a Central renderiza o hub com os 6 acessos e a busca filtra de verdade
// Mocks apenas de borda: supabase client, hook de permissões (concede tudo), widgets flutuantes.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor, cleanup, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: { id: 'u1', email: 'davilys@webmarcas.net' } }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
    },
    from: () => new Proxy({}, { get: () => () => ({ then: (res: any) => res({ data: [], error: null }) }) }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
    functions: { invoke: async () => ({ data: null, error: null }) },
  },
}));

vi.mock('@/hooks/useAdminPermissions', () => ({
  useAdminPermissions: () => ({
    permissions: undefined, // componente trata undefined como "mostra tudo"
    hasPermission: () => true,
    canAccessPath: () => true,
    refetch: vi.fn(),
    userId: 'u1',
    isMasterAdmin: true,
  }),
}));

vi.mock('svg2pdf.js', () => ({})); // UMD lê window.jspdf; happy-dom não tem o global — módulo só é usado ao gerar PDF, fora deste fluxo

vi.mock('@/components/admin/AdminChatWidget', () => ({ AdminChatWidget: () => null }));
vi.mock('@/components/admin/inpi/INPILegalChatDialog', () => ({ INPILegalChatDialog: () => null }));

import { MobileBottomNav } from '@/components/admin/MobileBottomNav';

const LocationProbe = () => <div data-testid="location-probe">{useLocation().pathname}</div>;
import ChatAoVivo from '@/pages/admin/ChatAoVivo';
import { ChatModeProvider } from '@/contexts/ChatModeContext';

const qc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('Regressão CRM — Central Inteligente (bug live 03/11 08:49)', () => {
  beforeEach(() => cleanup());

  it('menu mobile "Mais" contém o botão Central Inteligente apontando para /admin/chat-ao-vivo', async () => {
    render(
      <QueryClientProvider client={qc()}>
        <MemoryRouter initialEntries={['/admin/dashboard']}>
          <LocationProbe />
          <MobileBottomNav />
        </MemoryRouter>
      </QueryClientProvider>
    );
    fireEvent.click(screen.getByText('Mais'));
    await waitFor(() => expect(screen.getByText('Central Inteligente')).toBeTruthy());
    fireEvent.click(screen.getByText('Central Inteligente'));
    await waitFor(() => expect(screen.getByTestId('location-probe').textContent).toContain('/admin/chat-ao-vivo'));
  });

  it('hub da Central renderiza os 6 acessos e a busca filtra de verdade', async () => {
    render(
      <QueryClientProvider client={qc()}>
        <ChatModeProvider>
          <MemoryRouter initialEntries={['/admin/chat-ao-vivo']}>
            <ChatAoVivo />
          </MemoryRouter>
        </ChatModeProvider>
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getAllByText(/Central Inteligente/).length).toBeGreaterThan(0));
    for (const t of ['Chat web', 'Botconversa', 'WebConversa', 'Consultoria jurídica', 'Busca de viabilidade', 'Marcas IA']) {
      expect(screen.getByText(t), `acesso ausente: ${t}`).toBeTruthy();
    }
    const search = screen.getByLabelText('Buscar acessos da Central Inteligente');
    fireEvent.change(search, { target: { value: 'marcas' } });
    await waitFor(() => {
      expect(screen.queryByText('Chat web')).toBeNull();
      expect(screen.getByText('Marcas IA')).toBeTruthy();
    });
  });
});
