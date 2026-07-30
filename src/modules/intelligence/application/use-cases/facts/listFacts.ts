/** Consultas do Fact Ledger, já com confiabilidade e impacto resolvidos. */
import type { FactFilter, FactRepository } from "../../ports/facts";
import type { DraftRepository } from "../../ports/factory";
import type { Fact } from "../../../domain/facts/Fact";
import { computeConfidence, type ConfidenceReport } from "../../../domain/facts/confidence";
import { evaluateFactGates, type FactGate } from "../../../domain/facts/validation";
import type { KnowledgeDraft } from "../../../domain/factory/KnowledgeDraft";
import {
  asFactId,
  err,
  ok,
  type Page,
  type Result,
} from "../../../domain/shared/primitives";

export interface FactView {
  readonly fato: Fact;
  readonly confianca: ConfidenceReport;
  readonly contradicoesAtivas: number;
}

/** Contradições valem apenas contra fatos que ainda são citáveis. */
const countContradictions = (fato: Fact, universo: readonly Fact[]): number =>
  fato.relacionamentos.filter((r) => {
    if (r.tipo !== "contradiz") return false;
    const alvo = universo.find((f) => f.id === r.alvoFatoId);
    return !alvo || alvo.status === "vigente" || alvo.status === "contestado";
  }).length;

export const makeListFacts =
  (repo: FactRepository) =>
  async (filter: FactFilter): Promise<Result<Page<FactView>>> => {
    const todos = await repo.list({});
    if (!todos.ok) return err<Page<FactView>>(todos.error as string);
    const universo = (todos.value as Page<Fact>).items;

    const r = await repo.list(filter);
    if (!r.ok) return err<Page<FactView>>(r.error as string);
    const items = (r.value as Page<Fact>).items.map((fato) => {
      const contradicoesAtivas = countContradictions(fato, universo);
      return { fato, contradicoesAtivas, confianca: computeConfidence(fato, contradicoesAtivas) };
    });
    return ok({ items, total: items.length });
  };

export interface FactDetail extends FactView {
  readonly portoes: readonly FactGate[];
  readonly cadeia: readonly Fact[];
  /** Knowledge Objects citados por este fato, resolvidos no repositório da Fase 06. */
  readonly objetos: readonly { readonly id: string; readonly titulo: string; readonly estado: string }[];
  readonly relacionados: readonly { readonly tipo: string; readonly alvo: Fact | null; readonly motivo?: string }[];
}

export const makeGetFact =
  (repo: FactRepository, drafts: DraftRepository) =>
  async (id: string): Promise<Result<FactDetail>> => {
    const found = await repo.findById(asFactId(id));
    if (!found.ok) return err<FactDetail>(found.error as string);
    const fato = found.value as Fact;

    const todos = await repo.list({});
    const universo = todos.ok ? (todos.value as Page<Fact>).items : [];
    const contradicoesAtivas = countContradictions(fato, universo);

    const chain = await repo.listChain(fato.raizId);
    const cadeia = chain.ok ? (chain.value as Page<Fact>).items : [];

    const draftsRes = await drafts.list({});
    const todosDrafts = draftsRes.ok ? (draftsRes.value as Page<KnowledgeDraft>).items : [];
    const objetos = fato.objetosAfetados.map((ref) => {
      const d = todosDrafts.find((x) => x.id === ref || x.slug === ref);
      return {
        id: ref,
        titulo: d ? d.titulo : ref,
        estado: d ? d.estado : "não encontrado",
      };
    });

    const relacionados = fato.relacionamentos.map((r) => ({
      tipo: r.tipo,
      motivo: r.motivo,
      alvo: universo.find((f) => f.id === r.alvoFatoId) ?? null,
    }));

    return ok({
      fato,
      contradicoesAtivas,
      confianca: computeConfidence(fato, contradicoesAtivas),
      portoes: evaluateFactGates(fato),
      cadeia,
      objetos,
      relacionados,
    });
  };