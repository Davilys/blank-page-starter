// @vitest-environment happy-dom
// Regressão dedicada ao fix shared: CPF visível quando contato pré-preenchido colapsa.
// Sem rede: fetchAddressByCEP mockado; onNext espião. Cobre os 5 cenários exigidos pela main.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { PersonalDataStep } from '../PersonalDataStep';

vi.mock('@/lib/validators', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/validators')>();
  return { ...orig, fetchAddressByCEP: vi.fn(async () => null) };
});

const base = { cpf: '', cep: '', address: '', addressNumber: '', city: '', state: '', neighborhood: '' };
const prefilled = { ...base, fullName: 'Carla Fixture', email: 'carla@fixture.com', phone: '(11) 99999-0001' };
const empty = { ...base, fullName: '', email: '', phone: '' };

function fillAddress() {
  fireEvent.change(screen.getByPlaceholderText('00000-000'), { target: { value: '01402000' } });
  fireEvent.change(screen.getByPlaceholderText(/Rua, Avenida/), { target: { value: 'Avenida Brigadeiro Luís Antônio' } });
  fireEvent.change(screen.getByPlaceholderText(/Bairro/), { target: { value: 'Jardim Paulista' } });
  fireEvent.change(screen.getByPlaceholderText(/Cidade/), { target: { value: 'São Paulo' } });
  fireEvent.change(screen.getByPlaceholderText(/^UF/), { target: { value: 'SP' } });
}

describe('PersonalDataStep — fix CPF com contato colapsado (regressão)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it('1) contato pré-preenchido + CPF vazio: campo CPF visível, submit bloqueia COM erro visível', async () => {
    const onNext = vi.fn();
    render(<PersonalDataStep initialData={prefilled} onNext={onNext} onBack={() => {}} />);
    expect(screen.getByText(/já informados/)).toBeTruthy();               // bloco colapsado
    expect(screen.getByPlaceholderText('000.000.000-00')).toBeTruthy();   // CPF VISÍVEL mesmo colapsado
    fillAddress();
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    await waitFor(() => expect(screen.getByText('CPF inválido')).toBeTruthy()); // erro visível
    expect(onNext).not.toHaveBeenCalled();                                 // bloqueado
  });

  it('2) contato pré-preenchido + CPF válido: avança', async () => {
    const onNext = vi.fn();
    render(<PersonalDataStep initialData={prefilled} onNext={onNext} onBack={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('000.000.000-00'), { target: { value: '52998224725' } });
    fillAddress();
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
    expect(onNext.mock.calls[0][0].cpf).toBe('529.982.247-25');
  });

  it('3) primeira passagem /consultar (sem prefill): bloco de contato visível e CPF dentro dele', () => {
    render(<PersonalDataStep initialData={empty} onNext={() => {}} onBack={() => {}} />);
    expect(screen.queryByText(/já informados/)).toBeNull();                // sem banner colapsado
    expect(screen.getByPlaceholderText('Seu nome completo')).toBeTruthy();
    expect(screen.getByPlaceholderText('000.000.000-00')).toBeTruthy();    // CPF visível como antes
  });

  it('4) retorno com dados válidos (CPF preenchido): colapsa, mostra CPF preenchido, avança sem edição', async () => {
    const onNext = vi.fn();
    const full = { ...prefilled, cpf: '529.982.247-25', cep: '01402-000', address: 'Avenida Brigadeiro Luís Antônio', neighborhood: 'Jardim Paulista', city: 'São Paulo', state: 'SP' };
    render(<PersonalDataStep initialData={full} onNext={onNext} onBack={() => {}} />);
    const cpf = screen.getByPlaceholderText('000.000.000-00') as HTMLInputElement;
    expect(cpf.value).toBe('529.982.247-25');
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
  });

  it('5) expandir via Alterar não duplica o campo CPF', async () => {
    render(<PersonalDataStep initialData={prefilled} onNext={() => {}} onBack={() => {}} />);
    expect(screen.getAllByPlaceholderText('000.000.000-00').length).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: /alterar/i }));     // expande contato
    await waitFor(() => expect(screen.getByPlaceholderText('Seu nome completo')).toBeTruthy());
    expect(screen.getAllByPlaceholderText('000.000.000-00').length).toBe(1); // segue único
    expect(screen.queryByText(/já informados/)).toBeNull();
  });
});
