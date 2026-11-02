// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

afterEach(cleanup);
import { InpiStatusCard } from './InpiStatusCard';
import type { ProcessLookup } from '@/hooks/useProcessLookup';

const fullLookup: ProcessLookup = {
  process_number: '935729771',
  brand_name: 'Arclass ar condicionado automotivo',
  holder: 'Titular Exemplo Ltda',
  ncl_class: 'NCL(12) 37',
  current_status: 'Aguardando processamento da concessão do registro de marca',
  presentation: 'Mista',
  nature: 'Produtos e/ou Serviço',
  class_status: null,
  specification: 'Serviços de manutenção.',
  legal_representative: 'DAVILYS DANQUES DE OLIVEIRA CUNHA',
  priority_date: null,
  filing_date: '23/05/2025',
  grant_date: '10/10/2026',
  expiry_date: '10/10/2036',
  source_url: 'https://busca.inpi.gov.br/pePI/',
  source: 'pePI',
  detail_status: 'ok',
  lookup_status: 'completed',
  queried_at: '2026-11-01T23:35:00.000Z',
};

function controllerWith(state: Partial<ReturnType<typeof makeState>>, sync = vi.fn()) {
  const st = makeState(state);
  return {
    get: () => st,
    hydrate: vi.fn(),
    sync,
  } as unknown as Parameters<typeof InpiStatusCard>[0]['controller'] & { sync: typeof sync };
}

function makeState(over: Partial<ReturnType<typeof Object>> = {}) {
  return { loading: false, lookup: null, fromCache: false, error: null, ...(over as object) } as {
    loading: boolean;
    lookup: ProcessLookup | null;
    fromCache: boolean;
    error: { code: string; message: string } | null;
  };
}

describe('InpiStatusCard', () => {
  it('renderiza todos os campos oficiais como no quadro da Revista INPI', () => {
    render(<InpiStatusCard processNumber="935729771" controller={controllerWith({ lookup: fullLookup, fromCache: true })} />);
    expect(screen.getByText('Situação atual consultada no INPI')).toBeTruthy();
    expect(screen.getByText('Aguardando processamento da concessão do registro de marca')).toBeTruthy();
    for (const label of ['Marca (INPI)', 'Titular (INPI)', 'Classe NCL (oficial)', 'Apresentação', 'Natureza', 'Procurador', 'Depósito', 'Vigência', 'Especificação']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText(/Atualiza sozinho toda vez que você entra/)).toBeTruthy();
  });

  it('botão Sincronizar chama a edge function do cliente com force', () => {
    const sync = vi.fn();
    render(<InpiStatusCard processNumber="935729771" controller={controllerWith({ lookup: fullLookup }, sync)} />);
    fireEvent.click(screen.getByRole('button', { name: /Sincronizar com INPI/i }));
    expect(sync).toHaveBeenCalledWith('935729771', true);
  });

  it('falha mostra aviso honesto e preserva a consulta anterior', () => {
    render(
      <InpiStatusCard
        processNumber="935729771"
        controller={controllerWith({
          lookup: fullLookup,
          fromCache: true,
          error: { code: 'upstream_unavailable', message: 'Não foi possível atualizar os dados deste processo no INPI agora. As informações existentes foram mantidas.' },
        })}
      />,
    );
    expect(screen.getByText(/informações existentes foram mantidas/i)).toBeTruthy();
    expect(screen.getByText('Aguardando processamento da concessão do registro de marca')).toBeTruthy();
  });

  it('sem consulta prévia, convida a sincronizar', () => {
    render(<InpiStatusCard processNumber="935729771" controller={controllerWith({})} />);
    expect(screen.getByText(/Nenhuma consulta realizada/)).toBeTruthy();
  });
});
