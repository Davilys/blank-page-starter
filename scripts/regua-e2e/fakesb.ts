export const DB: any = { tables: {}, rpc: {} };
const rows = (t: string) => (DB.tables[t] ||= []);
function qb(t: string) {
  let filters: ((r: any) => boolean)[] = []; let upd: any = null; let ins: any = null;
  const api: any = {
    select() { return api; }, eq(k: string, v: any) { filters.push((r) => r[k] === v); return api; },
    in(k: string, vs: any[]) { filters.push((r) => vs.includes(r[k])); return api; }, limit() { return api; },
    update(v: any) { upd = v; return api; }, insert(v: any) { ins = v; rows(t).push({ id: crypto.randomUUID(), ...v }); return Promise.resolve({ data: null, error: null }); },
    then(res: any) { const m = rows(t).filter((r: any) => filters.every((f) => f(r))); if (upd) m.forEach((r: any) => Object.assign(r, upd)); res({ data: m, error: null }); },
    maybeSingle() { const m = rows(t).filter((r: any) => filters.every((f) => f(r))); if (upd) m.forEach((r: any) => Object.assign(r, upd)); return Promise.resolve({ data: m[0] ?? null, error: null }); },
  };
  return api;
}
export function createClient() { return { from: qb, rpc: (n: string, a: any) => Promise.resolve({ data: DB.rpc[n] ? DB.rpc[n](a) : null, error: null }) }; }
