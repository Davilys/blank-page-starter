import { test } from "node:test";
import assert from "node:assert/strict";
import { resultadoEnvioLabel, RESULTADO_ENVIO_LABEL } from "../resultadoEnvio.ts";

test("rótulo honesto por resultado", () => {
  assert.match(resultadoEnvioLabel({ resultado_envio: "aceito" }), /sem confirmação de entrega/);
  assert.equal(resultadoEnvioLabel({ resultado_envio: "parcial" }), "parcial (um canal falhou)");
  assert.equal(resultadoEnvioLabel({ resultado_envio: "falha" }), "falha no envio");
  assert.equal(resultadoEnvioLabel({ resultado_envio: "desconhecido" }), "resultado desconhecido");
});
test("sem resultado => null (UI mostra o status como antes)", () => {
  assert.equal(resultadoEnvioLabel(null), null);
  assert.equal(resultadoEnvioLabel({}), null);
});
test("todos os resultados têm rótulo", () => {
  for (const k of ["aceito", "parcial", "falha", "desconhecido"]) assert.ok(RESULTADO_ENVIO_LABEL[k]);
});
