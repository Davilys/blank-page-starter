// Paridade e robustez do fetchAllById contra o comportamento PostgREST real:
// cap de max_rows por request, sem erro ao truncar. Asserts de conteúdo, não smoke.
import { it, expect } from 'vitest';
import { fetchAllById, comparePrazoCriticoAscNullsLast } from '@/lib/fetchAllById';

type Row = { id: string; proximo_prazo_critico: string | null };

// Simula PostgREST: order(id asc) + cap por página + gt cursor, SEM erro ao "truncar".
function fakePostgrest(rows: Row[], serverCap: number) {
  const calls: { afterId: string | null; limit: number }[] = [];
  return {
    calls,
    fetchPage: async (afterId: string | null, limit: number) => {
      calls.push({ afterId, limit });
      const eff = Math.min(limit, serverCap);
      const sorted = [...rows].sort((a, b) => (a.id < b.id ? -1 : 1));
      const start = afterId === null ? 0 : sorted.findIndex(r => r.id === afterId) + 1;
      return { data: sorted.slice(start, start + eff), error: null };
    },
  };
}

const rows2125: Row[] = Array.from({ length: 2125 }, (_, i) => ({
  id: `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
  proximo_prazo_critico: i % 7 === 0 ? null : `2026-${String((i % 12) + 1).padStart(2, '0')}-15`,
}));

it('cap 1000 do servidor: 2125 linhas chegam COMPLETAS (a query atual perderia 1125)', async () => {
  const pg = fakePostgrest(rows2125, 1000);
  const all = await fetchAllById(pg.fetchPage, 1000);
  expect(all.length).toBe(2125);
  expect(new Set(all.map(r => r.id)).size).toBe(2125); // sem duplicados
  expect(pg.calls.length).toBe(4); // 1000 + 1000 + 125 + página vazia
});

it('cap menor que pageSize (servidor capa abaixo do pedido): adapta e continua até página vazia', async () => {
  const pg = fakePostgrest(rows2125, 777);
  const all = await fetchAllById(pg.fetchPage, 1000);
  expect(all.length).toBe(2125);
  expect(pg.calls[0].limit).toBe(1000);
  expect(pg.calls[1].limit).toBe(777); // adaptou ao cap observado
});

it('deriva por inserção concorrente (id novo no meio da leitura) não duplica nem omite', async () => {
  const base = rows2125.slice(0, 1500);
  const pg = fakePostgrest(base, 1000);
  const orig = pg.fetchPage;
  let inseriu = false;
  pg.fetchPage = async (afterId: string | null, limit: number) => {
    const r = await orig(afterId, limit);
    if (!inseriu && afterId !== null) {
      inseriu = true;
      // inserção ANTES do cursor (id intermediário já ultrapassado): não deve reaparecer
      base.push({ id: '00000000-0000-0000-0000-000000000750', proximo_prazo_critico: null });
      // inserção DEPOIS do cursor: entra nesta carga (coerente: existia antes do fim da leitura)
      base.push({ id: '00000000-0000-0000-0000-000000009999', proximo_prazo_critico: null });
    }
    return r;
  };
  const all = await fetchAllById(pg.fetchPage, 1000);
  expect(all.filter(r => r.id.endsWith('0750')).length).toBe(1); // original, sem duplicar
  expect(all.some(r => r.id.endsWith('9999'))).toBe(true); // inserção posterior capturada
  expect(new Set(all.map(r => r.id)).size).toBe(all.length);
});

it('erro da página propaga (não finge sucesso parcial)', async () => {
  await expect(fetchAllById(async () => ({ data: null, error: new Error('RLS') }), 1000)).rejects.toThrow('RLS');
});

it('maxPages: resultado incompleto é ERRO explícito, nunca lista curta silenciosa', async () => {
  const pg = fakePostgrest(rows2125, 1000);
  await expect(fetchAllById(pg.fetchPage, 1000, 2)).rejects.toThrow(/INCOMPLETO/);
});

it('comparador reproduz order(proximo_prazo_critico asc, nullsFirst:false) do PostgREST', () => {
  const dados: Row[] = [
    { id: 'c', proximo_prazo_critico: null },
    { id: 'a', proximo_prazo_critico: '2026-11-01' },
    { id: 'b', proximo_prazo_critico: '2026-10-20' },
    { id: 'd', proximo_prazo_critico: null },
    { id: 'e', proximo_prazo_critico: '2026-10-20' },
  ];
  const ordenado = [...dados].sort(comparePrazoCriticoAscNullsLast).map(r => r.id);
  expect(ordenado).toEqual(['b', 'e', 'a', 'c', 'd']); // datas asc, nulls por último, empate por id
});

it('paridade de conteúdo: conjunto final idêntico ao de uma leitura sem cap', async () => {
  const pg = fakePostgrest(rows2125, 1000);
  const paginado = await fetchAllById(pg.fetchPage, 1000);
  const semCap = [...rows2125].sort((a, b) => (a.id < b.id ? -1 : 1));
  expect(paginado).toEqual(semCap);
  // e com a ordem de exibição reaplicada, bate com a ordenação que o banco faria:
  const ordenadoBanco = [...rows2125].sort(comparePrazoCriticoAscNullsLast);
  expect([...paginado].sort(comparePrazoCriticoAscNullsLast)).toEqual(ordenadoBanco);
});
