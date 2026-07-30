/**
 * Relacionamentos entre Facts.
 * Toda relação é humana e justificada. Nenhuma é inferida.
 */
import type { VaultFact } from "./VaultFact";

export const VAULT_RELATION_TYPES = [
  "complementa",
  "contradiz",
  "substitui",
  "depende_de",
  "deriva_de",
  "excecao_de",
  "atualizado_por",
] as const;
export type VaultRelationType = (typeof VAULT_RELATION_TYPES)[number];

export const RELATION_LABEL: Readonly<Record<VaultRelationType, string>> = {
  complementa: "complementa",
  contradiz: "contradiz",
  substitui: "substitui",
  depende_de: "depende de",
  deriva_de: "deriva de",
  excecao_de: "exceção de",
  atualizado_por: "atualizado por",
};

/** Relações que descrevem hierarquia/sucessão não podem formar ciclo. */
export const ACYCLIC_TYPES: readonly VaultRelationType[] = [
  "substitui",
  "depende_de",
  "deriva_de",
  "excecao_de",
  "atualizado_por",
];

/** Relações simétricas: ler nos dois sentidos é equivalente. */
export const SYMMETRIC_TYPES: readonly VaultRelationType[] = [
  "complementa",
  "contradiz",
];

export interface RelationCheck {
  readonly ok: boolean;
  readonly motivo?: string;
}

/** Existe caminho de `de` até `ate` usando apenas o mesmo tipo acíclico? */
const reaches = (
  facts: readonly VaultFact[],
  de: string,
  ate: string,
  tipo: VaultRelationType,
): boolean => {
  const byId = new Map(facts.map((f) => [String(f.id), f]));
  const vistos = new Set<string>();
  const fila = [de];
  while (fila.length > 0) {
    const atual = fila.shift() as string;
    if (atual === ate) return true;
    if (vistos.has(atual)) continue;
    vistos.add(atual);
    const no = byId.get(atual);
    if (!no) continue;
    for (const r of no.relacoes) {
      if (r.tipo === tipo) fila.push(r.alvoId);
    }
  }
  return false;
};

/** Portões estruturais de uma nova relação. */
export const checkRelation = (
  facts: readonly VaultFact[],
  origemId: string,
  alvoId: string,
  tipo: VaultRelationType,
  justificativa: string,
): RelationCheck => {
  if (!alvoId) return { ok: false, motivo: "Selecione o fato de destino." };
  if (origemId === alvoId)
    return { ok: false, motivo: "Um fato não pode se relacionar consigo mesmo." };

  const origem = facts.find((f) => String(f.id) === origemId);
  const alvo = facts.find((f) => String(f.id) === alvoId);
  if (!alvo) return { ok: false, motivo: "Fato de destino inexistente." };
  if (justificativa.trim().length < 10)
    return { ok: false, motivo: "Justifique a relação com pelo menos 10 caracteres." };

  if (origem?.relacoes.some((r) => r.alvoId === alvoId && r.tipo === tipo))
    return { ok: false, motivo: "Esta relação já existe." };

  if (SYMMETRIC_TYPES.includes(tipo) && alvo.relacoes.some((r) => r.alvoId === origemId && r.tipo === tipo))
    return { ok: false, motivo: "A relação inversa já foi declarada no outro fato." };

  if (ACYCLIC_TYPES.includes(tipo) && reaches(facts, alvoId, origemId, tipo))
    return {
      ok: false,
      motivo: `Ciclo inválido: "${RELATION_LABEL[tipo]}" já leva de volta a este fato.`,
    };

  return { ok: true };
};