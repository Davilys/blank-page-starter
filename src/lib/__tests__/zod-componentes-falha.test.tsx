// @vitest-environment happy-dom
// Teste de COMPONENTE REAL: extracao safeParse + setErrors + render da mensagem
// nos casos de falha (nao e loop copiado — e o formulario de verdade).
import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('@/lib/metaPixel', () => ({ trackLead: vi.fn() }));

import { QuickLeadStep } from '@/components/formulario/QuickStepsForm';

const valido = { brandName: 'MARCA X', businessArea: 'Consultoria Jurídica', fullName: 'Maria Exemplo', email: 'maria@exemplo.com', phone: '(11) 98983-2130' };

it('QuickLeadStep falha: email invalido -> setErrors visivel no DOM, onNext NAO chamado', () => {
  const onNext = vi.fn();
  render(<QuickLeadStep initial={{ ...valido, email: 'x' }} onNext={onNext} />);
  fireEvent.submit(screen.getByRole('button', { name: /continuar/i }).closest('form')!);
  expect(screen.getByText('E-mail inválido')).toBeTruthy();
  expect(onNext).not.toHaveBeenCalled();
  cleanup();
});

it('QuickLeadStep falha: telefone >15 chars -> mensagem PRESERVADA exata da v3 (comportamento atual)', () => {
  const onNext = vi.fn();
  render(<QuickLeadStep initial={{ ...valido, phone: '(11) 98983-21309' }} onNext={onNext} />);
  fireEvent.submit(screen.getByRole('button', { name: /continuar/i }).closest('form')!);
  expect(screen.getByText('String must contain at most 15 character(s)')).toBeTruthy();
  expect(onNext).not.toHaveBeenCalled();
  cleanup();
});

it('QuickLeadStep falha: marca curta -> mensagem custom pt-BR', () => {
  const onNext = vi.fn();
  render(<QuickLeadStep initial={{ ...valido, brandName: 'A' }} onNext={onNext} />);
  fireEvent.submit(screen.getByRole('button', { name: /continuar/i }).closest('form')!);
  expect(screen.getByText('Nome da marca obrigatório')).toBeTruthy();
  expect(onNext).not.toHaveBeenCalled();
  cleanup();
});

it('QuickLeadStep sucesso: dados validos -> onNext com trims aplicados', () => {
  const onNext = vi.fn();
  render(<QuickLeadStep initial={{ ...valido, brandName: '  MARCA X  ' }} onNext={onNext} />);
  fireEvent.submit(screen.getByRole('button', { name: /continuar/i }).closest('form')!);
  expect(onNext).toHaveBeenCalledTimes(1);
  expect(onNext.mock.calls[0][0].brandName).toBe('MARCA X');
  cleanup();
});
