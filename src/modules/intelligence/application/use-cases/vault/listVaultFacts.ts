/** Consultas do Vault: busca, detalhe (com timeline) e métricas reais. */
import type {
  VaultEventRepository,
  VaultFactRepository,
  VaultFilter,
} from "../../ports/vault";
import {
  hasSource,
  VAULT_STATUSES,
  type VaultEvent,
  type VaultFact,
  type VaultFactStatus,
} from "../../../domain/vault/VaultFact";
import { blockingVaultGates, type VaultGate } from "../../../domain/vault/validation";
import { emptyPage, err, ok, type Page, type Result } from "../../../domain/shared/primitives";

export const makeListVaultFacts =
  (repo: VaultFactRepository) =>
  async (filter: VaultFilter): Promise<Result<Page<VaultFact>>> =>
    repo.list(filter);

export interface VaultFactDetail {
  readonly fato: VaultFact;
  readonly pendencias: readonly VaultGate[];
  readonly timeline: readonly VaultEvent[];
  /** Fatos relacionados, resolvidos para exibição. */
  readonly relacionados: readonly VaultFact[];
  /** Fatos que apontam para este. */
  readonly referenciadoPor: readonly VaultFact[];
}

export const makeGetVaultFact =
  (repo: VaultFactRepository, events: VaultEventRepository) =>
  async (id: string): Promise<Result<VaultFactDetail>> => {
    const found = await repo.findById(id);
    if (!found.ok) return err<VaultFactDetail>(found.error as string);
    const fato = found.value as VaultFact;

    const todos = await repo.list({});
    const itens = (todos.ok ? todos.value.items : []) as VaultFact[];
    const alvos = new Set(fato.relacoes.map((r) => r.alvoId));

    const linha = await events.listByFact(id);

    return ok({
      fato,
      pendencias: blockingVaultGates(fato),
      timeline: linha.ok ? linha.value.items : [],
      relacionados: itens.filter((f) => alvos.has(String(f.id))),
      referenciadoPor: itens.filter((f) =>
        f.relacoes.some((r) => r.alvoId === String(fato.id)),
      ),
    });
  };

export interface VaultMetrics {
  readonly total: number;
  readonly porStatus: Readonly<Record<VaultFactStatus, number>>;
  readonly semRevisao: number;
  readonly semFontePrimaria: number;
  readonly semObjetoConsumidor: number;
  readonly comContradicao: number;
  readonly ultimasAlteracoes: readonly VaultEvent[];
}

export const makeGetVaultMetrics =
  (repo: VaultFactRepository, events: VaultEventRepository) =>
  async (): Promise<Result<VaultMetrics>> => {
    const r = await repo.list({});
    if (!r.ok) return err<VaultMetrics>(r.error as string);
    const itens = r.value.items as VaultFact[];

    const porStatus = VAULT_STATUSES.reduce(
      (acc, s) => ({ ...acc, [s]: itens.filter((f) => f.status === s).length }),
      {} as Record<VaultFactStatus, number>,
    );

    const recentes = await events.listRecent(10);

    return ok({
      total: itens.length,
      porStatus,
      semRevisao: itens.filter((f) => !f.revisorId || !f.ultimaValidacaoEm).length,
      semFontePrimaria: itens.filter((f) => !hasSource(f.fontePrimaria)).length,
      semObjetoConsumidor: itens.filter((f) => f.objetosConsumidores.length === 0).length,
      comContradicao: itens.filter((f) => f.relacoes.some((x) => x.tipo === "contradiz")).length,
      ultimasAlteracoes: recentes.ok ? recentes.value.items : emptyPage<VaultEvent>().items,
    });
  };