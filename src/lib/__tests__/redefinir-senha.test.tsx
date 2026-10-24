// @vitest-environment happy-dom
// RedefinirSenha: consumo do link de recuperação ISOLADO (sem backend, sem e-mail real).
// Tokens usados são sintéticos e marcados; o teste também garante que não são logados/persistidos.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const SYNTH_TOKEN = 'synthetic-token-NAO-REAL';
const updateUserMock = vi.fn();
const getSessionMock = vi.fn();
let authEventCb: ((event: string) => void) | null = null;

type HappyWindow = Window & typeof globalThis & { happyDOM: { setURL: (url: string) => void } };
const setURL = (url: string) => (window as HappyWindow).happyDOM.setURL(url);

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (event: string) => void) => {
        authEventCb = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      getSession: (...args: unknown[]) => getSessionMock(...args),
      updateUser: (...args: unknown[]) => updateUserMock(...args),
    },
    from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null }) }),
  },
}));

const toastError = vi.fn(); const toastSuccess = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) } }));

import RedefinirSenha from '../../pages/cliente/RedefinirSenha';

const renderPage = () => render(<MemoryRouter><RedefinirSenha /></MemoryRouter>);
const fireRecovery = () => act(() => { authEventCb?.('PASSWORD_RECOVERY'); });

describe('RedefinirSenha — consumo isolado do callback de recuperação', () => {
  let logSpy: ReturnType<typeof vi.spyOn>; let errSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.clearAllMocks(); authEventCb = null;
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    logSpy = vi.spyOn(console, 'log'); errSpy = vi.spyOn(console, 'error');
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    // token sintético nunca pode aparecer em log nem storage
    const logged = [...logSpy.mock.calls.flat(), ...errSpy.mock.calls.flat()].join(' ');
    expect(logged).not.toContain(SYNTH_TOKEN);
    expect(JSON.stringify(window.localStorage)).not.toContain(SYNTH_TOKEN);
    logSpy.mockRestore(); errSpy.mockRestore();
    vi.useRealTimers();
  });

  it('T1 host canônico + hash recovery (access_token&type=recovery): sem redirect, formulário após evento', async () => {
    setURL(`https://webmarcas.net/cliente/redefinir-senha#access_token=${SYNTH_TOKEN}&type=recovery`);
    renderPage();
    expect(window.location.hostname).toBe('webmarcas.net'); // ficou no canônico
    fireRecovery();
    expect(await screen.findByRole('heading', { name: 'Redefinir Senha' })).toBeTruthy();
  });

  it('T2 host de preview + PKCE ?code=: redireciona ao canônico PRESERVANDO query+hash', async () => {
    setURL(`https://id-preview--6c60bdcc-40b1-49c5-b46b-40ac18ae182b.lovable.app/cliente/redefinir-senha?code=${SYNTH_TOKEN}`);
    renderPage();
    expect(window.location.hostname).toBe('www.webmarcas.net');
    expect(window.location.search).toContain(`code=${SYNTH_TOKEN}`); // token preservado no forward
  });

  it('T4 sucesso só via updateUser mockado: senha válida → chamado com a senha, tela de sucesso', async () => {
    updateUserMock.mockResolvedValue({ error: null });
    setURL(`https://webmarcas.net/cliente/redefinir-senha#access_token=${SYNTH_TOKEN}&type=recovery`);
    renderPage(); fireRecovery();
    await screen.findByRole('heading', { name: 'Redefinir Senha' });
    fireEvent.change(screen.getByLabelText('Nova Senha'), { target: { value: 'SenhaForte1' } });
    fireEvent.change(screen.getByLabelText('Confirmar Nova Senha'), { target: { value: 'SenhaForte1' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Redefinir Senha' })); });
    expect(updateUserMock).toHaveBeenCalledTimes(1);
    expect(updateUserMock).toHaveBeenCalledWith({ password: 'SenhaForte1' });
    expect(await screen.findByText('Senha Redefinida!')).toBeTruthy();
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('T5 updateUser retorna erro: toast de erro, formulário permanece, sem sucesso', async () => {
    updateUserMock.mockResolvedValue({ error: { message: 'token expirado' } });
    setURL(`https://webmarcas.net/cliente/redefinir-senha#access_token=${SYNTH_TOKEN}&type=recovery`);
    renderPage(); fireRecovery();
    await screen.findByRole('heading', { name: 'Redefinir Senha' });
    fireEvent.change(screen.getByLabelText('Nova Senha'), { target: { value: 'SenhaForte1' } });
    fireEvent.change(screen.getByLabelText('Confirmar Nova Senha'), { target: { value: 'SenhaForte1' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Redefinir Senha' })); });
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('token expirado'));
    expect(screen.queryByText('Senha Redefinida!')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Redefinir Senha' })).toBeTruthy();
  });

  it('T3 sem payload + sem sessão (link expirado/inválido): tela Link Inválido', async () => {
    vi.useFakeTimers();
    setURL('https://webmarcas.net/cliente/redefinir-senha');
    renderPage();
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); }); // 1500 + 2000 do componente
    expect(getSessionMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Link Inválido')).toBeTruthy();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('T6 senha fraca e T7 confirmação divergente: updateUser NÃO é chamado', async () => {
    setURL(`https://webmarcas.net/cliente/redefinir-senha#access_token=${SYNTH_TOKEN}&type=recovery`);
    renderPage(); fireRecovery();
    await screen.findByRole('heading', { name: 'Redefinir Senha' });
    // fraca (sem maiúscula/número)
    fireEvent.change(screen.getByLabelText('Nova Senha'), { target: { value: 'fracafraca' } });
    fireEvent.change(screen.getByLabelText('Confirmar Nova Senha'), { target: { value: 'fracafraca' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Redefinir Senha' })); });
    expect(updateUserMock).not.toHaveBeenCalled();
    // divergente
    fireEvent.change(screen.getByLabelText('Nova Senha'), { target: { value: 'SenhaForte1' } });
    fireEvent.change(screen.getByLabelText('Confirmar Nova Senha'), { target: { value: 'SenhaForte2' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Redefinir Senha' })); });
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith('As senhas não coincidem');
  });
});
