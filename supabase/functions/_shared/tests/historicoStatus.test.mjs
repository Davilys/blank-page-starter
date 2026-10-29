import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveResultadoEnvio, HISTORICO_STATUS_COLUMN } from "../historicoStatus.ts";

test("coluna status permanece 'enviada' (dedupe/guarda da aba Vencidos preservados)", () => {
  assert.equal(HISTORICO_STATUS_COLUMN, "enviada");
});
test("erro de transporte/exceção => desconhecido (NÃO é falha confirmada; provedor pode ter processado)", () => {
  assert.equal(deriveResultadoEnvio({ results: { whatsapp: { success: true } } }, { message: "x" }), "desconhecido");
  assert.equal(deriveResultadoEnvio(null, { message: "invoke failed" }), "desconhecido");
});
test("results ausente/vazio/shape legado => desconhecido (não libera retry automático)", () => {
  assert.equal(deriveResultadoEnvio(null, null), "desconhecido");
  assert.equal(deriveResultadoEnvio({}, null), "desconhecido");
  assert.equal(deriveResultadoEnvio({ results: {} }, null), "desconhecido");
  assert.equal(deriveResultadoEnvio({ results: [] }, null), "desconhecido");
});
test("todos os canais tentados aceitos => aceito (aceite ≠ entrega; ex.: Rodrigo/Sérgio d3)", () => {
  assert.equal(deriveResultadoEnvio({ results: { whatsapp: { success: true }, email: { success: true } } }, null), "aceito");
});
test("um canal falhou de fato e outro aceito => parcial (ex.: Mariany d1)", () => {
  assert.equal(deriveResultadoEnvio({ results: { whatsapp: { success: false, error: "x" }, email: { success: true } } }, null), "parcial");
});
test("parcial é só observabilidade: nenhum canal já aceito pode ser reenviado por este registro", () => {
  // O helper só classifica; a coluna status continua "enviada" e a guarda/dedupe
  // não reabrem a fatura — não existe caminho de retry automático por "parcial".
  const r = deriveResultadoEnvio({ results: { whatsapp: { success: false }, email: { success: true } } }, null);
  assert.equal(r, "parcial");
  assert.equal(HISTORICO_STATUS_COLUMN, "enviada");
});
test("todos os canais falharam de fato => falha", () => {
  assert.equal(deriveResultadoEnvio({ results: { whatsapp: { success: false }, email: { success: false } } }, null), "falha");
});
test("todos pulados (sem telefone/e-mail) => falha", () => {
  assert.equal(deriveResultadoEnvio({ results: { whatsapp: { skipped: true }, sms: { skipped: true } } }, null), "falha");
});
test("pulado + aceito => aceito", () => {
  assert.equal(deriveResultadoEnvio({ results: { whatsapp: { success: true }, sms: { skipped: true } } }, null), "aceito");
});
