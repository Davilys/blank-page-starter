/** Portas do Knowledge Vault. Trocar localStorage por Supabase mexe só no adapter. */
import type {
  VaultConfidence,
  VaultEvent,
  VaultFact,
  VaultFactKind,
  VaultFactStatus,
} from "../../domain/vault/VaultFact";
import type { Page, Result } from "../../domain/shared/primitives";

export interface VaultFilter {
  readonly texto?: string;
  readonly tipo?: VaultFactKind;
  readonly status?: VaultFactStatus;
  readonly entidade?: string;
  readonly tag?: string;
  readonly fonte?: string;
  readonly jurisdicao?: string;
  readonly responsavelId?: string;
  readonly confianca?: VaultConfidence;
  readonly semFontePrimaria?: boolean;
  readonly semRevisao?: boolean;
  readonly objetoConsumidor?: string;
}

export interface VaultFactRepository {
  list(filter: VaultFilter): Promise<Result<Page<VaultFact>>>;
  findById(id: string): Promise<Result<VaultFact>>;
  save(fact: VaultFact): Promise<Result<VaultFact>>;
}

export interface VaultEventRepository {
  listByFact(fatoId: string): Promise<Result<Page<VaultEvent>>>;
  listRecent(limite: number): Promise<Result<Page<VaultEvent>>>;
  append(evento: VaultEvent): Promise<Result<VaultEvent>>;
}