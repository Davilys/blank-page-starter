// Rótulos honestos para o resultado por canal gravado em metadata.resultado_envio
// (coluna status continua "enviada" = solicitado/tratado; aceite ≠ entrega).
export const RESULTADO_ENVIO_LABEL: Record<string, string> = {
  aceito: "solicitado/aceito (sem confirmação de entrega)",
  parcial: "parcial (um canal falhou)",
  falha: "falha no envio",
  desconhecido: "resultado desconhecido",
};

export function resultadoEnvioLabel(metadata: unknown): string | null {
  const r = (metadata as { resultado_envio?: string } | null)?.resultado_envio;
  return r ? RESULTADO_ENVIO_LABEL[r] ?? r : null;
}
