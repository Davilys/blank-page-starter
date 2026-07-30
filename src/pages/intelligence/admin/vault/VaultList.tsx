/** Busca de fatos por título, tipo, entidade, tag, status, fonte, jurisdição e responsável. */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import type { VaultFilter } from "@/modules/intelligence/application/ports/vault";
import {
  FACT_KINDS,
  FACT_KIND_LABEL,
  VAULT_STATUSES,
  VAULT_STATUS_LABEL,
} from "@/modules/intelligence/domain/vault/VaultFact";
import { useVaultList } from "@/modules/intelligence/presentation/hooks/useVault";
import {
  ConfidenceBadge,
  VaultKindBadge,
  VaultStatusBadge,
} from "@/modules/intelligence/presentation/components/vault/VaultBadges";

const TODOS = "__todos__";

const VaultList = () => {
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState(TODOS);
  const [status, setStatus] = useState(TODOS);
  const [tag, setTag] = useState("");
  const [entidade, setEntidade] = useState("");
  const [fonte, setFonte] = useState("");
  const [jurisdicao, setJurisdicao] = useState("");
  const [responsavel, setResponsavel] = useState("");

  const filtro: VaultFilter = useMemo(
    () => ({
      texto: texto.trim() || undefined,
      tipo: tipo === TODOS ? undefined : (tipo as never),
      status: status === TODOS ? undefined : (status as never),
      tag: tag.trim() || undefined,
      entidade: entidade.trim() || undefined,
      fonte: fonte.trim() || undefined,
      jurisdicao: jurisdicao.trim() || undefined,
      responsavelId: responsavel.trim() || undefined,
    }),
    [texto, tipo, status, tag, entidade, fonte, jurisdicao, responsavel],
  );

  const { items, loading } = useVaultList(filtro);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fatos do Vault</h1>
          <p className="mt-1 text-muted-foreground">
            {loading ? "Carregando…" : `${items.length} fato(s) encontrados.`}
          </p>
        </div>
        <Button asChild>
          <Link to="/intelligence/admin/vault/fatos/novo">
            <Plus className="mr-1.5 h-4 w-4" /> Novo fato
          </Link>
        </Button>
      </div>

      <Card className="mt-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Label>Busca por título ou declaração</Label>
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="prazo de oposição" />
        </div>
        <div>
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {FACT_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {FACT_KIND_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {VAULT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {VAULT_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Tag</Label>
          <Input value={tag} onChange={(e) => setTag(e.target.value)} />
        </div>
        <div>
          <Label>Entidade</Label>
          <Input value={entidade} onChange={(e) => setEntidade(e.target.value)} />
        </div>
        <div>
          <Label>Fonte</Label>
          <Input value={fonte} onChange={(e) => setFonte(e.target.value)} />
        </div>
        <div>
          <Label>Jurisdição</Label>
          <Input value={jurisdicao} onChange={(e) => setJurisdicao(e.target.value)} />
        </div>
        <div>
          <Label>Responsável (revisor)</Label>
          <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
        </div>
      </Card>

      <div className="mt-4 space-y-3">
        {!loading && items.length === 0 && (
          <Card className="p-6 text-sm text-muted-foreground">
            Nenhum fato corresponde aos filtros. Fatos são criados apenas por revisão humana.
          </Card>
        )}
        {items.map((f) => (
          <Card key={String(f.id)} className="p-4">
            <Link to={`/intelligence/admin/vault/fatos/${f.id}`} className="block">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground">{f.titulo || "(sem título)"}</span>
                <VaultStatusBadge status={f.status} />
                <VaultKindBadge tipo={f.tipo} />
                <ConfidenceBadge nivel={f.confianca} />
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{f.declaracao}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Fonte: {f.fontePrimaria.titulo || "não informada"} · Jurisdição: {f.jurisdicao} ·{" "}
                {f.objetosConsumidores.length} objeto(s) consumidor(es)
              </p>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default VaultList;