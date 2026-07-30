/** Hooks do Knowledge Vault. A UI nunca fala com repositórios. */
import { useCallback, useEffect, useState } from "react";
import type { VaultFilter } from "../../application/ports/vault";
import type {
  VaultFactDetail,
  VaultMetrics,
} from "../../application/use-cases/vault/listVaultFacts";
import type { VaultConfidence, VaultFact } from "../../domain/vault/VaultFact";
import type { VaultRelationType } from "../../domain/vault/relations";
import type { KnowledgeDraft } from "../../domain/factory/KnowledgeDraft";
import { vaultContainer } from "../../infrastructure/vaultContainer";

export const useVaultMetrics = () => {
  const [data, setData] = useState<VaultMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    setLoading(true);
    const r = await vaultContainer.getMetrics();
    if (r.ok) setData(r.value);
    setLoading(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { data, loading, recarregar };
};

export const useVaultList = (filter: VaultFilter) => {
  const [items, setItems] = useState<readonly VaultFact[]>([]);
  const [loading, setLoading] = useState(true);
  const chave = JSON.stringify(filter);

  const recarregar = useCallback(async () => {
    setLoading(true);
    const r = await vaultContainer.listFacts(JSON.parse(chave));
    if (r.ok) setItems(r.value.items);
    setLoading(false);
  }, [chave]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { items, loading, recarregar };
};

/** Opções para relacionar fatos e vincular Knowledge Objects. */
export const useVaultLinkOptions = () => {
  const [fatos, setFatos] = useState<readonly VaultFact[]>([]);
  const [objetos, setObjetos] = useState<readonly KnowledgeDraft[]>([]);

  useEffect(() => {
    void (async () => {
      const f = await vaultContainer.listFacts({});
      if (f.ok) setFatos(f.value.items);
      const d = await vaultContainer.listKnowledgeObjects();
      if (d.ok) setObjetos(d.value.items);
    })();
  }, []);

  return { fatos, objetos };
};

export const useVaultFact = (id?: string) => {
  const [detalhe, setDetalhe] = useState<VaultFactDetail | null>(null);
  const [loading, setLoading] = useState(Boolean(id));

  const recarregar = useCallback(async () => {
    if (!id || id === "novo") {
      setDetalhe(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const r = await vaultContainer.getFact(id);
    setDetalhe(r.ok ? r.value : null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const salvar = useCallback(
    async (patch: Partial<VaultFact>, autorId: string, motivo: string) => {
      const r = await vaultContainer.saveFact({
        id: id && id !== "novo" ? id : undefined,
        patch,
        autorId,
        motivo,
      });
      if (r.ok) await recarregar();
      return r;
    },
    [id, recarregar],
  );

  const validar = useCallback(
    async (revisorId: string, confianca: VaultConfidence, motivo: string) => {
      const r = await vaultContainer.validateFact({ id, revisorId, confianca, motivo });
      if (r.ok) await recarregar();
      return r;
    },
    [id, recarregar],
  );

  const revisar = useCallback(
    async (revisorId: string, observacao: string) => {
      const r = await vaultContainer.reviewFact({ id, revisorId, observacao });
      if (r.ok) await recarregar();
      return r;
    },
    [id, recarregar],
  );

  const tornarObsoleto = useCallback(
    async (autorId: string, motivo: string) => {
      const r = await vaultContainer.obsoleteFact({ id, autorId, motivo });
      if (r.ok) await recarregar();
      return r;
    },
    [id, recarregar],
  );

  const relacionar = useCallback(
    async (
      alvoId: string,
      tipo: VaultRelationType,
      justificativa: string,
      autorId: string,
    ) => {
      const r = await vaultContainer.relate({
        origemId: id as string,
        alvoId,
        tipo,
        justificativa,
        autorId,
      });
      if (r.ok) await recarregar();
      return r;
    },
    [id, recarregar],
  );

  const removerRelacao = useCallback(
    async (relacaoId: string, autorId: string, motivo: string) => {
      const r = await vaultContainer.removeRelation({
        origemId: id as string,
        relacaoId,
        autorId,
        motivo,
      });
      if (r.ok) await recarregar();
      return r;
    },
    [id, recarregar],
  );

  const vincularObjeto = useCallback(
    async (objetoId: string, vincular: boolean, autorId: string) => {
      const r = await vaultContainer.linkObject({
        fatoId: id as string,
        objetoId,
        vincular,
        autorId,
      });
      if (r.ok) await recarregar();
      return r;
    },
    [id, recarregar],
  );

  return {
    detalhe,
    loading,
    recarregar,
    salvar,
    validar,
    revisar,
    tornarObsoleto,
    relacionar,
    removerRelacao,
    vincularObjeto,
  };
};