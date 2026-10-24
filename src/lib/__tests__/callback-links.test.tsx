// @vitest-environment happy-dom
// Candidato fix-callback-links: redirect de recuperação deriva da ORIGEM atual por ambiente.
// Cobre explicitamente: produção (webmarcas.net, www) e as DUAS origens de preview presentes
// na uri_allow_list da config Auth (lovableproject.com e id-preview--*.lovable.app).
// Nenhum e-mail real é enviado: resetPasswordForEmail é mockado.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { replaceTemplateVariables } from '../../components/admin/email/EmailCompose';

const resetMock = vi.fn().mockResolvedValue({ error: null });
type HappyWindow = Window & typeof globalThis & { happyDOM: { setURL: (url: string) => void } };
const setURL = (url: string) => (window as HappyWindow).happyDOM.setURL(url);

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (...args: unknown[]) => resetMock(...args),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null }) }),
  },
}));

import RecuperarSenha from '../../pages/cliente/RecuperarSenha';

const ORIGENS = [
  'https://webmarcas.net',
  'https://www.webmarcas.net',
  'https://6c60bdcc-40b1-49c5-b46b-40ac18ae182b.lovableproject.com',
  'https://id-preview--6c60bdcc-40b1-49c5-b46b-40ac18ae182b.lovable.app',
];

describe('redirectTo de recuperação por ambiente autorizado', () => {
  beforeEach(() => resetMock.mockClear());
  afterEach(() => cleanup());

  for (const origin of ORIGENS) {
    const esperado = origin.replace(/^https:\/\/www\./, 'https://'); // www canonicaliza para o apex
    it(`redirectTo = ${esperado}/cliente/redefinir-senha (origin ${origin})`, async () => {
      setURL(`${origin}/cliente/recuperar-senha`);
      render(<MemoryRouter><RecuperarSenha /></MemoryRouter>);
      fireEvent.change(screen.getByPlaceholderText('seu@email.com'), { target: { value: 'c@teste.com' } });
      fireEvent.click(screen.getByRole('button', { name: /Enviar Link de Recuperação/i }));
      await waitFor(() => expect(resetMock).toHaveBeenCalledTimes(1));
      const [email, opts] = resetMock.mock.calls[0] as [string, { redirectTo: string }];
      expect(email).toBe('c@teste.com');
      expect(opts.redirectTo).toBe(`${esperado}/cliente/redefinir-senha`);
    });
  }

  it('em produção o redirectTo NÃO contém domínio de preview (e vice-versa é preservado)', async () => {
    setURL('https://webmarcas.net/cliente/recuperar-senha');
    render(<MemoryRouter><RecuperarSenha /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText('seu@email.com'), { target: { value: 'c@teste.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar Link de Recuperação/i }));
    await waitFor(() => expect(resetMock).toHaveBeenCalledTimes(1));
    const [, opts] = resetMock.mock.calls[0] as [string, { redirectTo: string }];
    expect(opts.redirectTo).toBe('https://webmarcas.net/cliente/redefinir-senha');
    expect(opts.redirectTo).not.toContain('lovable');
  });

  it('{{link_portal}} do e-mail composto aponta para o portal real do cliente', () => {
    const out = replaceTemplateVariables('Acesse: {{link_portal}} ok', {
      full_name: 'X', brand_name: 'Y', process_number: '1', email: 'e@e.com',
    } as never);
    expect(out).toContain('https://webmarcas.net/cliente');
    expect(out).not.toContain('lovable.app');
  });
});
