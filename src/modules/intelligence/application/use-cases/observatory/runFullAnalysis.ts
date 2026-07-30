/**
 * Caso de uso: executar a análise completa do Observatory e selar a auditoria.
 * Somente leitura sobre o conhecimento; a única escrita é o append do registro.
 */
import { ok, type Result } from "../../../domain/shared/primitives";
import {
  auditRecordFor,
  runObservatory,
  type ObservatoryResult,
} from "../../../domain/observatory/runObservatory";
import type {
  ObservatoryAuditRepository,
  ObservatorySnapshotReader,
} from "../../ports/observatory";

export interface RunFullAnalysisDeps {
  readonly reader: ObservatorySnapshotReader;
  readonly audit: ObservatoryAuditRepository;
}

export const runFullAnalysis = async (
  deps: RunFullAnalysisDeps,
  autorId: string,
): Promise<Result<ObservatoryResult>> => {
  const snapshot = await deps.reader.load();
  if (!snapshot.ok) return snapshot;

  const resultado = runObservatory(snapshot.value);
  await deps.audit.append(auditRecordFor(resultado, autorId));

  return ok(resultado);
};