// Observabilidade do envio da régua — SOMENTE metadata, sem efeito em dedupe.
//
// A coluna cobranca_historico.status permanece SEMPRE "enviada" (semântica:
// cobrança solicitada/tratada). A guarda da aba Vencidos e o dedupe de 24h
// dependem desse valor; NENHUM resultado por canal pode reabrir a fatura para
// reenvio automático. Em particular, um canal já aceito/entregue NUNCA pode ser
// reenviado em duplicata por efeito deste registro.
//
// O resultado por canal é derivado aqui e gravado em metadata.resultado_envio
// (e o detalhe bruto segue em metadata.notif):
//  - "aceito":      todos os canais tentados foram aceitos pelo provedor.
//                   Aceite NÃO é confirmação de entrega (WhatsApp confirma de
//                   forma assíncrona; o send_message responde só o aceite).
//  - "parcial":     ao menos um canal aceito e outro FALHOU de fato (erro
//                   retornado pelo provedor).
//  - "falha":       todos os canais tentados falharam de fato (erro do
//                   provedor), ou todos foram pulados (sem telefone/e-mail).
//  - "desconhecido": resultado não verificável — exceção/transporte na chamada
//                   à send-multichannel-notification (não é falha confirmada:
//                   o provedor pode ter processado) ou results ausente/vazio
//                   (shape legado). Desconhecido NÃO libera reenvio automático.

export type ResultadoEnvio = "aceito" | "parcial" | "falha" | "desconhecido";

// Valor da coluna status: preservado de propósito para não alterar dedupe/guardas.
export const HISTORICO_STATUS_COLUMN = "enviada" as const;

export interface ChannelResultLike {
  success?: boolean;
  skipped?: boolean;
}

export interface NotifResultLike {
  results?: Record<string, ChannelResultLike> | null;
}

export function deriveResultadoEnvio(
  notifResult: NotifResultLike | null | undefined,
  notifErr?: { message?: string } | null,
): ResultadoEnvio {
  if (notifErr) return "desconhecido"; // transporte/exceção ≠ falha confirmada
  const results = notifResult?.results;
  if (!results || typeof results !== "object" || Array.isArray(results)) return "desconhecido";
  const entries = Object.values(results);
  if (entries.length === 0) return "desconhecido";
  const attempted = entries.filter((r) => r && r.skipped !== true);
  if (attempted.length === 0) return "falha"; // todos pulados (sem telefone/e-mail)
  const ok = attempted.filter((r) => r.success === true).length;
  if (ok === attempted.length) return "aceito";
  return ok === 0 ? "falha" : "parcial";
}
