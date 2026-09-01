// Testes do módulo Financeiro — regras anti-loop e cancelamento no Asaas.
// Não realizam chamadas reais ao Asaas nem criam cobranças: a API é simulada.
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { cancelarCobrancaAsaas, getCrmOriginSet, reservarParcelas, liberarParcelas } from "../_shared/crmCobranca.ts";

const BASE = "https://api.asaas.com/v3";
const KEY = "test-key";

// ───────────────── Fake Supabase (em memória) ─────────────────
type Row = Record<string, any>;
function fakeAdmin(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      let rows = [...(tables[table] || [])];
      const api: any = {
        select(_cols: string) { return api; },
        eq(col: string, val: unknown) { rows = rows.filter((r) => r[col] === val); return api; },
        in(col: string, vals: unknown[]) {
          rows = rows.filter((r) => vals.includes(r[col]));
          return Promise.resolve({ data: rows, error: null });
        },
        overlaps(col: string, vals: unknown[]) {
          rows = rows.filter((r) => (r[col] || []).some((v: unknown) => vals.includes(v)));
          return Promise.resolve({ data: rows, error: null });
        },
      };
      return api;
    },
  };
}

// ───────────────── Cancelamento no Asaas ─────────────────
function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: any, init?: RequestInit) =>
    Promise.resolve(handler(String(input), init))) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

Deno.test("Cenário 3 — boleto PENDING é cancelado e o Asaas confirma", async () => {
  const restore = stubFetch((url, init) => {
    if (init?.method === "DELETE") return new Response(JSON.stringify({ deleted: true, id: "pay_1" }), { status: 200 });
    return new Response(JSON.stringify({ id: "pay_1", status: "PENDING" }), { status: 200 });
  });
  const r = await cancelarCobrancaAsaas(BASE, KEY, "pay_1");
  restore();
  assertEquals(r.status, "cancelado");
});

Deno.test("Cenário 3b — cobrança já recebida NÃO é marcada como cancelada", async () => {
  const restore = stubFetch(() => new Response(JSON.stringify({ id: "pay_2", status: "RECEIVED" }), { status: 200 }));
  const r = await cancelarCobrancaAsaas(BASE, KEY, "pay_2");
  restore();
  assertEquals(r.status, "nao_aplicavel");
});

Deno.test("Cenário 3c — Asaas recusa a exclusão ⇒ falha registrada, sem falsa confirmação", async () => {
  const restore = stubFetch((_u, init) => {
    if (init?.method === "DELETE") return new Response(JSON.stringify({ errors: [{ description: "não permitido" }] }), { status: 400 });
    return new Response(JSON.stringify({ status: "OVERDUE" }), { status: 200 });
  });
  const r = await cancelarCobrancaAsaas(BASE, KEY, "pay_3");
  restore();
  assertEquals(r.status, "falhou");
});

Deno.test("Cenário 3d — resposta sem deleted:true não confirma cancelamento", async () => {
  const restore = stubFetch((_u, init) => {
    if (init?.method === "DELETE") return new Response(JSON.stringify({ deleted: false }), { status: 200 });
    return new Response(JSON.stringify({ status: "OVERDUE" }), { status: 200 });
  });
  const r = await cancelarCobrancaAsaas(BASE, KEY, "pay_4");
  restore();
  assertEquals(r.status, "falhou");
});

Deno.test("Cenário 3e — cobrança inexistente no Asaas é tratada como já cancelada", async () => {
  const restore = stubFetch(() => new Response("not found", { status: 404 }));
  const r = await cancelarCobrancaAsaas(BASE, KEY, "pay_5");
  restore();
  assertEquals(r.status, "ja_cancelado");
});

// ───────────────── Identificação de origem CRM ─────────────────
Deno.test("Cenários 7/8 — parcela de negociação e dívida tratada são reconhecidas", async () => {
  const admin = fakeAdmin({
    parcelas_devedor: [{ asaas_payment_id: "novo_1" }],
    parcelas_renegociadas: [{ asaas_payment_id: "novo_2" }],
    invoices: [{ asaas_invoice_id: "novo_3", originado_pelo_crm: true }],
    cobrancas_vencidas: [{ asaas_payment_id: "novo_4", originado_pelo_crm: true }],
    cobranca_tratamentos: [
      { nova_cobranca_asaas_id: "novo_5", asaas_payment_id_original: "orig_1" },
    ],
  });
  const set = await getCrmOriginSet(admin, ["novo_1", "novo_2", "novo_3", "novo_4", "novo_5", "orig_1", "externo_1"]);
  for (const id of ["novo_1", "novo_2", "novo_3", "novo_4", "novo_5", "orig_1"]) {
    assert(set.has(id), `${id} deveria ser reconhecido como origem CRM`);
  }
  assert(!set.has("externo_1"), "dívida externa não pode ser marcada como CRM");
});

Deno.test("Cenário 12 — escala: 2.500 cobranças do CRM (acima do limite de 1.000)", async () => {
  const ids = Array.from({ length: 2500 }, (_, i) => `crm_${i}`);
  const admin = fakeAdmin({
    parcelas_devedor: ids.map((id) => ({ asaas_payment_id: id })),
    parcelas_renegociadas: [],
    invoices: [],
    cobrancas_vencidas: [],
    cobranca_tratamentos: [],
  });
  const externos = ["ext_a", "ext_b"];
  const set = await getCrmOriginSet(admin, [...ids, ...externos]);
  assertEquals(set.size, 2500);
  for (const id of ids) assert(set.has(id));
  for (const e of externos) assert(!set.has(e));
});

// ───────────────── Regra das filas (simulação do sync) ─────────────────
/** Reproduz exatamente a regra aplicada em sync-overdue / sync-overdue-30. */
function filaSync(pagamentos: Array<{ id: string; diasAtraso: number }>, crmSet: Set<string>, min: number, max?: number) {
  return pagamentos.filter((p) => {
    if (crmSet.has(p.id)) return false;
    if (p.diasAtraso < min) return false;
    if (max !== undefined && p.diasAtraso > max) return false;
    return true;
  }).map((p) => p.id);
}

Deno.test("Cenários 1/8/11/12/13 — ciclo completo da dívida negociada", async () => {
  const original = { id: "orig_1", diasAtraso: 12 };
  const nova = { id: "novo_1", diasAtraso: -30 };

  // 1. Antes da negociação a dívida original aparece na fila ≤30
  assertEquals(filaSync([original], new Set(), 1, 30), ["orig_1"]);

  // 2-7. Após a negociação: original tratada, nova cobrança marcada como CRM
  const admin = fakeAdmin({
    parcelas_devedor: [{ asaas_payment_id: "novo_1" }],
    parcelas_renegociadas: [],
    invoices: [{ asaas_invoice_id: "novo_1", originado_pelo_crm: true }],
    cobrancas_vencidas: [],
    cobranca_tratamentos: [{ asaas_payment_id_original: "orig_1", nova_cobranca_asaas_id: "novo_1" }],
  });

  // 8. Nova cobrança não aparece em nenhuma fila
  let crmSet = await getCrmOriginSet(admin, ["orig_1", "novo_1"]);
  assertEquals(filaSync([original, nova], crmSet, 1, 30), []);

  // 9-11. Nova cobrança vence e o sync roda de novo → não retorna à fila ≤30
  const novaVencida = { id: "novo_1", diasAtraso: 5 };
  crmSet = await getCrmOriginSet(admin, ["orig_1", "novo_1"]);
  assertEquals(filaSync([novaVencida], crmSet, 1, 30), []);

  // 12. Após 30 dias não entra em Devedores +30 (31–59)
  assertEquals(filaSync([{ id: "novo_1", diasAtraso: 45 }], crmSet, 31, 59), []);

  // 13. Após 60 dias não entra em Devedores +60
  assertEquals(filaSync([{ id: "novo_1", diasAtraso: 90 }], crmSet, 60), []);

  // 14. A dívida original permanece fora das filas e vive no histórico
  assertEquals(filaSync([{ id: "orig_1", diasAtraso: 120 }], crmSet, 60), []);
});

Deno.test("Cenário 9 — sincronizações repetidas não alteram o resultado (idempotência)", async () => {
  const admin = fakeAdmin({
    parcelas_devedor: [{ asaas_payment_id: "novo_1" }],
    parcelas_renegociadas: [],
    invoices: [],
    cobrancas_vencidas: [],
    cobranca_tratamentos: [{ asaas_payment_id_original: "orig_1", nova_cobranca_asaas_id: "novo_1" }],
  });
  const pagamentos = [{ id: "orig_1", diasAtraso: 20 }, { id: "novo_1", diasAtraso: 20 }, { id: "ext_1", diasAtraso: 20 }];
  let anterior: string[] | null = null;
  for (let i = 0; i < 5; i++) {
    const crmSet = await getCrmOriginSet(admin, pagamentos.map((p) => p.id));
    const fila = filaSync(pagamentos, crmSet, 1, 30);
    assertEquals(fila, ["ext_1"]);
    if (anterior) assertEquals(fila, anterior);
    anterior = fila;
  }
});


// ───────────────── Concorrência (reserva atômica) ─────────────────
/** Banco simulado com UPDATE ... WHERE tratada_em IS NULL atômico. */
function fakeFila(linhas: Row[]) {
  const store = linhas.map((l) => ({ ...l }));
  return {
    store,
    from(_t: string) {
      let patch: Row = {};
      let ids: unknown[] = [];
      let exigeNulo = false;
      let eqCol: string | null = null;
      let eqVal: unknown = null;
      const api: any = {
        update(p: Row) { patch = p; return api; },
        in(_c: string, v: unknown[]) { ids = v; return api; },
        is(_c: string, _v: null) { exigeNulo = true; return api; },
        eq(c: string, v: unknown) { eqCol = c; eqVal = v; return api; },
        select(_c: string) {
          const alvo = store.filter((r) =>
            ids.includes(r.id) &&
            (!exigeNulo || r.tratada_em == null) &&
            (eqCol === null || r[eqCol] === eqVal));
          for (const r of alvo) Object.assign(r, patch);
          return Promise.resolve({ data: alvo.map((r) => ({ id: r.id })), error: null });
        },
        then(res: any) { return api.select("id").then(res); },
      };
      return api;
    },
  };
}

Deno.test("Cenário 18 — duas ações simultâneas não geram dois acordos", async () => {
  const db = fakeFila([{ id: "c1", tratada_em: null }, { id: "c2", tratada_em: null }]);
  const parcelas = [{ id: "c1" }, { id: "c2" }];
  const [a, b] = await Promise.all([
    reservarParcelas(db, parcelas, "acao_A", "user_1"),
    reservarParcelas(db, parcelas, "acao_B", "user_2"),
  ]);
  assertEquals(a.length + b.length, 2, "cada dívida só pode ser reservada uma vez");
  assert(a.length === 0 || b.length === 0, "a segunda ação simultânea deve receber zero dívidas");
});

Deno.test("Cenário 16 — falha total no Asaas libera a reserva e a dívida volta à fila", async () => {
  const db = fakeFila([{ id: "c1", tratada_em: null }]);
  const reservadas = await reservarParcelas(db, [{ id: "c1" }], "acao_A", "user_1");
  assertEquals(reservadas.length, 1);
  assert(db.store[0].tratada_em !== null);
  await liberarParcelas(db, reservadas, "acao_A");
  assertEquals(db.store[0].tratada_em, null);
  assertEquals(db.store[0].crm_action_id, null);
});

Deno.test("Cenário 8b — todos os boletos da negociação (não só o 1º) ficam fora das filas", async () => {
  const admin = fakeAdmin({
    parcelas_devedor: [], parcelas_renegociadas: [], invoices: [], cobrancas_vencidas: [],
    cobranca_tratamentos: [{
      asaas_payment_id_original: "orig_1",
      nova_cobranca_asaas_id: "novo_1",
      novos_boletos_asaas_ids: ["novo_1", "novo_2", "novo_3", "novo_4", "novo_5"],
    }],
  });
  const set = await getCrmOriginSet(admin, ["novo_1", "novo_2", "novo_3", "novo_4", "novo_5", "ext_1"]);
  for (const id of ["novo_1", "novo_2", "novo_3", "novo_4", "novo_5"]) assert(set.has(id), id);
  assert(!set.has("ext_1"));
});
