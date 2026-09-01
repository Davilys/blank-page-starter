// Testes dos 10 cenários da regra anti-duplicidade / anti-loop do módulo Financeiro.
// Executa sem rede real: o Asaas é simulado via stub de globalThis.fetch.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  MOTIVOS,
  cancelarCobrancaAsaas,
  getCrmOriginSet,
  liberarParcelas,
  registrarTratamento,
  reservarParcelas,
} from "../_shared/crmCobranca.ts";

// ───────────────────────── fake supabase client ─────────────────────────
type Tables = Record<string, any[]>;

function fakeAdmin(tables: Tables) {
  const calls: any[] = [];
  const client = {
    tables,
    calls,
    from(table: string) {
      tables[table] ??= [];
      const rows = () => tables[table];
      const filters: ((r: any) => boolean)[] = [];
      let mode: "select" | "update" | "upsert" = "select";
      let patch: any = null;
      let conflict: string[] = [];

      const builder: any = {
        select() { return builder; },
        eq(col: string, val: any) { filters.push((r) => r[col] === val); return builder; },
        is(col: string, val: any) { filters.push((r) => (r[col] ?? null) === val); return builder; },
        in(col: string, vals: any[]) { const s = new Set(vals); filters.push((r) => s.has(r[col])); return builder; },
        overlaps(col: string, vals: any[]) {
          const s = new Set(vals);
          filters.push((r) => (r[col] || []).some((v: any) => s.has(v)));
          return builder;
        },
        update(p: any) { mode = "update"; patch = p; return builder; },
        upsert(p: any, opts?: any) {
          mode = "upsert"; patch = p;
          conflict = String(opts?.onConflict || "").split(",").map((s) => s.trim()).filter(Boolean);
          return builder;
        },
        then(resolve: any, reject: any) {
          try {
            let data: any[] = [];
            if (mode === "select") {
              data = rows().filter((r) => filters.every((f) => f(r)));
            } else if (mode === "update") {
              data = rows().filter((r) => filters.every((f) => f(r)));
              for (const r of data) Object.assign(r, patch);
            } else {
              const match = conflict.length
                ? rows().find((r) => conflict.every((c) => r[c] === (patch as any)[c]))
                : undefined;
              if (match) Object.assign(match, patch);
              else rows().push({ ...patch });
              data = [patch];
            }
            calls.push({ table, mode });
            return resolve({ data, error: null });
          } catch (e) { return reject ? reject(e) : resolve({ data: null, error: e }); }
        },
      };
      return builder;
    },
  };
  return client;
}

function stubFetch(handler: (url: string, init?: RequestInit) => { status: number; body: unknown }) {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: any, init?: any) => {
    const { status, body } = handler(String(input), init);
    return Promise.resolve(new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));
  }) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

const BASE = "https://api.asaas.com/v3";

// ───────────────────────── 1 ─────────────────────────
Deno.test("1. Boleto criado pelo CRM nunca entra nas filas (originado_pelo_crm)", async () => {
  const admin = fakeAdmin({
    parcelas_devedor: [{ asaas_payment_id: "pay_novo", originado_pelo_crm: true }],
    parcelas_renegociadas: [],
    invoices: [{ asaas_invoice_id: "pay_novo", originado_pelo_crm: true }],
    cobrancas_vencidas: [],
    cobranca_tratamentos: [],
  });
  const set = await getCrmOriginSet(admin, ["pay_novo", "pay_externo"]);
  assert(set.has("pay_novo"), "boleto do CRM deve ser reconhecido");
  assert(!set.has("pay_externo"), "boleto externo deve continuar elegível à fila");
});

// ───────────────────────── 2 ─────────────────────────
Deno.test("2. Dívida com tratamento registrado é reconhecida mesmo sem parcela", async () => {
  const admin = fakeAdmin({
    parcelas_devedor: [], parcelas_renegociadas: [], invoices: [], cobrancas_vencidas: [],
    cobranca_tratamentos: [{ asaas_payment_id_original: "pay_1", nova_cobranca_asaas_id: "pay_2", novos_boletos_asaas_ids: ["pay_2", "pay_3"] }],
  });
  const set = await getCrmOriginSet(admin, ["pay_1", "pay_2", "pay_3", "pay_9"]);
  assertEquals([...set].sort(), ["pay_1", "pay_2", "pay_3"]);
  assert(!set.has("pay_9"));
});

// ───────────────────────── 3 ─────────────────────────
Deno.test("3. Cancelamento confirmado pelo Asaas retorna 'cancelado'", async () => {
  const restore = stubFetch((url, init) =>
    init?.method === "DELETE"
      ? { status: 200, body: { deleted: true, id: "pay_1" } }
      : { status: 200, body: { id: "pay_1", status: "OVERDUE" } }
  );
  try {
    const r = await cancelarCobrancaAsaas(BASE, "key", "pay_1");
    assertEquals(r.status, "cancelado");
    assertEquals(r.asaas_status, "OVERDUE");
  } finally { restore(); }
});

// ───────────────────────── 4 ─────────────────────────
Deno.test("4. Asaas recusando exclusão nunca é reportado como cancelado", async () => {
  const restore = stubFetch((_url, init) =>
    init?.method === "DELETE"
      ? { status: 400, body: { errors: [{ description: "não permitido" }] } }
      : { status: 200, body: { id: "pay_1", status: "PENDING" } }
  );
  try {
    const r = await cancelarCobrancaAsaas(BASE, "key", "pay_1");
    assertEquals(r.status, "falhou");
  } finally { restore(); }
});

// ───────────────────────── 5 ─────────────────────────
Deno.test("5. Boleto já pago não é cancelado (nao_aplicavel)", async () => {
  const restore = stubFetch(() => ({ status: 200, body: { id: "pay_1", status: "RECEIVED" } }));
  try {
    const r = await cancelarCobrancaAsaas(BASE, "key", "pay_1");
    assertEquals(r.status, "nao_aplicavel");
    assertEquals(r.asaas_status, "RECEIVED");
  } finally { restore(); }
});

// ───────────────────────── 6 ─────────────────────────
Deno.test("6. Boleto inexistente/já excluído é tratado como ja_cancelado", async () => {
  const restore = stubFetch(() => ({ status: 404, body: { errors: [] } }));
  try {
    const r = await cancelarCobrancaAsaas(BASE, "key", "pay_x");
    assertEquals(r.status, "ja_cancelado");
  } finally { restore(); }
});

// ───────────────────────── 7 ─────────────────────────
Deno.test("7. Registro de tratamento é idempotente (mesmo crm_action_id não duplica)", async () => {
  const admin = fakeAdmin({ cobranca_tratamentos: [] });
  const row = {
    asaas_payment_id_original: "pay_1", crm_action_id: "act_1",
    motivo: MOTIVOS.negociacao, tipo_acao: "negociacao",
  };
  await registrarTratamento(admin, row);
  await registrarTratamento(admin, { ...row, observacao: "reprocessado" });
  assertEquals(admin.tables.cobranca_tratamentos.length, 1);
  assertEquals(admin.tables.cobranca_tratamentos[0].observacao, "reprocessado");
});

// ───────────────────────── 8 ─────────────────────────
Deno.test("8. Reserva atômica impede duas ações simultâneas sobre a mesma dívida", async () => {
  const admin = fakeAdmin({
    cobrancas_vencidas: [
      { id: "c1", tratada_em: null }, { id: "c2", tratada_em: null },
    ],
  });
  const parcelas = [{ id: "c1" }, { id: "c2" }];
  const primeira = await reservarParcelas(admin, parcelas, "act_1", "user_1");
  assertEquals(primeira.length, 2);
  const segunda = await reservarParcelas(admin, parcelas, "act_2", "user_2");
  assertEquals(segunda.length, 0, "segunda ação não pode reservar nada");
  assertEquals(admin.tables.cobrancas_vencidas[0].crm_action_id, "act_1");
});

// ───────────────────────── 9 ─────────────────────────
Deno.test("9. Falha total na criação de boletos libera a reserva (dívida volta à fila)", async () => {
  const admin = fakeAdmin({ cobrancas_vencidas: [{ id: "c1", tratada_em: null }] });
  const parcelas = [{ id: "c1" }];
  const reservadas = await reservarParcelas(admin, parcelas, "act_1", "user_1");
  assertEquals(reservadas.length, 1);
  await liberarParcelas(admin, reservadas, "act_1");
  assertEquals(admin.tables.cobrancas_vencidas[0].tratada_em, null);
  assertEquals(admin.tables.cobrancas_vencidas[0].crm_action_id, null);
  const denovo = await reservarParcelas(admin, parcelas, "act_2", "user_2");
  assertEquals(denovo.length, 1, "após rollback a dívida pode ser tratada novamente");
});

// ───────────────────────── 10 ─────────────────────────
Deno.test("10. Novo boleto do CRM vencido não reentra na fila e motivos são fixos", async () => {
  const admin = fakeAdmin({
    parcelas_devedor: [{ asaas_payment_id: "pay_neg_1" }],
    parcelas_renegociadas: [], invoices: [], cobrancas_vencidas: [],
    cobranca_tratamentos: [{ asaas_payment_id_original: "pay_orig", nova_cobranca_asaas_id: "pay_neg_1", novos_boletos_asaas_ids: ["pay_neg_1"] }],
  });
  // simula o sync trazendo o boleto de negociação já vencido
  const set = await getCrmOriginSet(admin, ["pay_neg_1"]);
  assert(set.has("pay_neg_1"), "boleto de negociação vencido permanece fora das filas");

  assertEquals(Object.values(MOTIVOS), [
    "COBRANÇA REALIZADA",
    "NEGOCIAÇÃO REALIZADA",
    "NOVO BOLETO GERADO",
    "ACORDO REALIZADO",
    "OUTRA AÇÃO",
  ]);
});
