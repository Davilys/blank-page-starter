import { describe, it, expect } from 'vitest';
import { fetchAllKeyset, type KeysetCursor, type PageResult } from '../fetchAllPages';

type Row = { id: string; created_at: string };
// Fake FIEL ao PostgREST para a consulta de Leads: ordena (created_at DESC, id ASC),
// aplica filtro keyset de sucessor estrito, limita (com cap de servidor configurável)
// e permite MUTAÇÃO da base entre chamadas.
const mkRow = (n: number, created = '2026-10-20T12:00:00.000Z'): Row => ({ id: `id-${String(n).padStart(5, '0')}`, created_at: created });

class FakeTable {
  rows: Row[];
  cap: number;
  cursors: Array<KeysetCursor | null> = [];
  constructor(rows: Row[], cap = 1000) { this.rows = rows; this.cap = cap; }
  sorted() {
    return [...this.rows].sort((a, b) =>
      a.created_at === b.created_at ? a.id.localeCompare(b.id) : (a.created_at < b.created_at ? 1 : -1));
  }
  fetchPage = async (cursor: KeysetCursor | null, limit: number): Promise<PageResult<Row>> => {
    this.cursors.push(cursor ? { ...cursor } : null);
    let out = this.sorted();
    if (cursor) out = out.filter(r => r.created_at < cursor.created_at || (r.created_at === cursor.created_at && r.id > cursor.id));
    return { data: out.slice(0, Math.min(limit, this.cap)), error: null };
  };
}
const cursorOf = (r: Row): KeysetCursor => ({ created_at: r.created_at, id: r.id });
const ids = (rs: Row[]) => rs.map(r => r.id);

describe('fetchAllKeyset', () => {
  it('2312 registros: lê todos, sem duplicar, cursor encadeado corretamente', async () => {
    const base = Array.from({ length: 2312 }, (_, i) => mkRow(i + 1));
    const t = new FakeTable(base);
    const data = await fetchAllKeyset(t.fetchPage, cursorOf);
    expect(data.length).toBe(2312);
    expect(new Set(ids(data)).size).toBe(2312);
    expect(t.cursors[0]).toBeNull();
    expect(t.cursors[1]).toEqual(cursorOf(base[999])); // última linha da página 1
  });

  it('tabela pequena (91): 2 requests (página curta adapta e sonda cursor); vazia: 1 request — fim por página vazia', async () => {
    const small = new FakeTable(Array.from({ length: 91 }, (_, i) => mkRow(i + 1)));
    expect((await fetchAllKeyset(small.fetchPage, cursorOf)).length).toBe(91);
    expect(small.cursors.length).toBe(2); // página cheia? não: 91 < 1000 → adapta size=91, próxima volta vazia
    const empty = new FakeTable([]);
    expect(await fetchAllKeyset(empty.fetchPage, cursorOf)).toEqual([]);
    expect(empty.cursors.length).toBe(1);
  });

  it('CONTRAEXEMPLO DA REVISÃO: count 1500 + INSERT no topo entre páginas — sem duplicado, sem omissão', async () => {
    const base = Array.from({ length: 1500 }, (_, i) => mkRow(i + 1));
    const t = new FakeTable(base);
    let calls = 0;
    const spy = async (c: KeysetCursor | null, l: number) => {
      calls++;
      const r = await t.fetchPage(c, l);
      if (calls === 1) t.rows.unshift(mkRow(9001, '2026-10-21T09:00:00.000Z')); // insere NO TOPO (created_at mais novo)
      return r;
    };
    const data = await fetchAllKeyset(spy, cursorOf);
    // offset+count duplicaria id-01000 e omitiria id-01500 encerrando com all.length>=1500.
    // keyset: id-01000 uma única vez, id-01500 presente; o novo (anterior ao cursor) não entra nesta carga.
    expect(ids(data).filter(x => x === 'id-01000').length).toBe(1);
    expect(ids(data)).toContain('id-01500');
    expect(ids(data)).not.toContain('id-09001');
    expect(data.length).toBe(1500);
  });

  it('DELETE+INSERT mantendo total: deletado omitido, novo anterior ao cursor fora, sem duplicar', async () => {
    const base = Array.from({ length: 1200 }, (_, i) => mkRow(i + 1));
    const t = new FakeTable(base);
    let calls = 0;
    const spy = async (c: KeysetCursor | null, l: number) => {
      calls++;
      const r = await t.fetchPage(c, l);
      if (calls === 1) {
        t.rows = t.rows.filter(r2 => r2.id !== 'id-01100'); // deleta linha ainda não lida
        t.rows.unshift(mkRow(9002, '2026-10-21T09:00:00.000Z')); // insere no topo (total volta a 1200)
      }
      return r;
    };
    const data = await fetchAllKeyset(spy, cursorOf);
    expect(ids(data)).not.toContain('id-01100');
    expect(ids(data)).not.toContain('id-09002');
    expect(new Set(ids(data)).size).toBe(data.length);
    expect(data.length).toBe(1199);
  });

  it('EMPATES de created_at: desempate por id avança sem duplicar/omitir', async () => {
    const base = Array.from({ length: 2500 }, (_, i) => mkRow(i + 1)); // mesmo created_at em todos
    const t = new FakeTable(base);
    const data = await fetchAllKeyset(t.fetchPage, cursorOf);
    expect(new Set(ids(data)).size).toBe(2500);
    expect(ids(data)).toEqual(t.sorted().map(r => r.id));
  });

  it('cap do servidor MENOR que pageSize (300): adapta e continua até página vazia', async () => {
    const t = new FakeTable(Array.from({ length: 680 }, (_, i) => mkRow(i + 1)), 300);
    const data = await fetchAllKeyset(t.fetchPage, cursorOf);
    expect(data.length).toBe(680);
    expect(new Set(ids(data)).size).toBe(680);
  });

  it('maxPages atingido: ERRO explícito (nunca parcial silencioso)', async () => {
    const t = new FakeTable(Array.from({ length: 5000 }, (_, i) => mkRow(i + 1)));
    await expect(fetchAllKeyset(t.fetchPage, cursorOf, 1000, 2)).rejects.toThrow(/limite de 2 páginas atingido/);
  });

  it('pageSize/maxPages inválidos: TypeError antes de qualquer request', async () => {
    const t = new FakeTable([mkRow(1)]);
    for (const bad of [0, -3, 1.5]) await expect(fetchAllKeyset(t.fetchPage, cursorOf, bad as number)).rejects.toThrow(TypeError);
    await expect(fetchAllKeyset(t.fetchPage, cursorOf, 1000, 0)).rejects.toThrow(TypeError);
    expect(t.cursors).toEqual([]);
  });

  it('erro do backend propaga o motivo original (RLS/rede não mascarados)', async () => {
    await expect(fetchAllKeyset(async () => ({ data: null, error: new Error('rls denied') }), cursorOf)).rejects.toThrow('rls denied');
    const t = new FakeTable(Array.from({ length: 2000 }, (_, i) => mkRow(i + 1)));
    let calls = 0;
    await expect(fetchAllKeyset(async (c, l) => {
      calls++;
      return calls === 2 ? { data: null, error: new Error('JWT expired') } : t.fetchPage(c, l);
    }, cursorOf)).rejects.toThrow('JWT expired');
  });
});
