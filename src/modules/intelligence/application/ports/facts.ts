/** Portas do Fact Ledger. Trocar localStorage por Supabase mexe só no adapter. */
import type { Fact, FactStatus, SourceTier } from "../../domain/facts/Fact";
import type { FactId, Page, Result } from "../../domain/shared/primitives";

export interface FactFilter {
  readonly texto?: string;
  readonly status?: FactStatus;
  readonly tier?: SourceTier;
  readonly entidadePrincipal?: string;
  readonly jurisdicao?: string;
  readonly revisorId?: string;
  readonly apenasVencidos?: boolean;
  readonly apenasContradicoes?: boolean;
  /** Fatos que sustentam um Knowledge Object específico. */
  readonly objetoAfetado?: string;
}

export interface FactRepository {
  list(filter: FactFilter): Promise<Result<Page<Fact>>>;
  findById(id: FactId): Promise<Result<Fact>>;
  /** Toda a cadeia de versões a partir da raiz, da mais nova para a mais antiga. */
  listChain(raizId: FactId): Promise<Result<Page<Fact>>>;
  save(fact: Fact): Promise<Result<Fact>>;
}