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
      // gt real do SQL: id > cursor (NÃO findIndex+1 — cursor deletado continua funcionando)
      const sorted = [...rows].sort((a, b) => (a.id < b.id ? -1 : 1));
      const rest = afterId === null ? sorted : sorted.filter(r => r.id > afterId);
      return { data: rest.slice(0, eff), error: null };
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

it('inserção concorrente de ID NOVO antes do cursor: NÃO entra nesta carga (limite sem snapshot, declarado)', async () => {
  const base = rows2125.slice(0, 1500).map(r => ({ ...r }));
  const pg = fakePostgrest(base, 1000);
  const orig = pg.fetchPage;
  let inseriu = false;
  pg.fetchPage = async (afterId: string | null, limit: number) => {
    const r = await orig(afterId, limit);
    if (!inseriu && afterId !== null) {
      inseriu = true;
      // UUID NOVO (nunca existiu) com valor MENOR que o cursor atual — posição já lida
      base.push({ id: '00000000-0000-0000-0000-000000000000', proximo_prazo_critico: null });
    }
    return r;
  };
  const all = await fetchAllById(pg.fetchPage, 1000);
  expect(all.some(r => r.id === '00000000-0000-0000-0000-000000000000')).toBe(false); // não entra — apareceria na próxima carga
  expect(all.length).toBe(1500);
});

it('inserção de ID NOVO após o cursor, ANTES da página correspondente ser lida: entra nesta carga', async () => {
  const base = rows2125.slice(0, 1500).map(r => ({ ...r }));
  const pg = fakePostgrest(base, 1000);
  const orig = pg.fetchPage;
  let inseriu = false;
  pg.fetchPage = async (afterId: string | null, limit: number) => {
    if (!inseriu && afterId === null) {
      inseriu = true; // insere durante a 1ª página, com id além do fim — posição ainda não lida
      base.push({ id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', proximo_prazo_critico: null });
    }
    return orig(afterId, limit);
  };
  const all = await fetchAllById(pg.fetchPage, 1000);
  expect(all.some(r => r.id === 'ffffffff-ffff-ffff-ffff-ffffffffffff')).toBe(true);
  expect(new Set(all.map(r => r.id)).size).toBe(all.length);
});

it('linha-cursor DELETADA entre páginas: leitura segue por gt(cursor) sem erro e sem omissão', async () => {
  const base = rows2125.slice(0, 1500).map(r => ({ ...r }));
  const pg = fakePostgrest(base, 1000);
  const orig = pg.fetchPage;
  pg.fetchPage = async (afterId: string | null, limit: number) => {
    const r = await orig(afterId, limit);
    if (r.data.length > 0) {
      const last = r.data[r.data.length - 1].id;
      const idx = base.findIndex(x => x.id === last);
      if (idx >= 0) base.splice(idx, 1); // deleta a linha que acabou de virar cursor
    }
    return r;
  };
  const all = await fetchAllById(pg.fetchPage, 1000);
  expect(all.length).toBe(1500); // lidas antes da deleção: presentes; nada omitido à frente
  expect(all.some(r => r.id === '00000000-0000-0000-0000-000000001000')).toBe(true);
});

it('guarda de progresso: página repetida/fora de ordem = ERRO imediato (não repete 1000 requests)', async () => {
  let n = 0;
  const quebrado = async () => {
    n++;
    return { data: rows2125.slice(0, 100), error: null }; // sempre a mesma página
  };
  await expect(fetchAllById(quebrado, 1000)).rejects.toThrow(/sem progresso|fora de ordem/);
  expect(n).toBe(2); // 1ª página ok, 2ª detectada e abortada
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
