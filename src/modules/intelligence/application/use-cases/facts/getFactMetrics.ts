/** Métricas reais do Fact Ledger. Nenhum número fictício. */
import type { FactRepository } from "../../ports/facts";
import { FACT_STATUSES, type Fact, type FactStatus } from "../../../domain/facts/Fact";
import { computeConfidence } from "../../../domain/facts/confidence";
import { err, ok, type Page, type Result } from "../../../domain/shared/primitives";

export interface FactMetrics {
  readonly total: number;
  readonly porStatus: Readonly<Record<FactStatus, number>>;
  readonly confiancaMedia: number;
  readonly validacoesVencidas: readonly Fact[];
  readonly contradicoes: readonly Fact[];
  readonly semObjetoAfetado: number;
  readonly recentes: readonly Fact[];
}

export const makeGetFactMetrics =
  (repo: FactRepository) =>
  async (): Promise<Result<FactMetrics>> => {
    const r = await repo.list({});
    if (!r.ok) return err<FactMetrics>(r.error as string);
    const items = (r.value as Page<Fact>).items;

    const porStatus = FACT_STATUSES.reduce(
      (acc, s) => ({ ...acc, [s]: items.filter((f) => f.status === s).length }),
      {} as Record<FactStatus, number>,
    );

    const citaveis = items.filter((f) => f.status === "vigente");
    const media =
      citaveis.length === 0
        ? 0
        : Math.round(
            citaveis.reduce((acc, f) => acc + computeConfidence(f).score, 0) / citaveis.length,
          );

    return ok({
      total: items.length,
      porStatus,
      confiancaMedia: media,
      validacoesVencidas: items.filter(
        (f) => f.status !== "substituido" && computeConfidence(f).validacaoVencida,
      ),
      contradicoes: items.filter((f) => f.relacionamentos.some((x) => x.tipo === "contradiz")),
      semObjetoAfetado: items.filter((f) => f.objetosAfetados.length === 0).length,
      recentes: items.slice(0, 8),
    });
  };