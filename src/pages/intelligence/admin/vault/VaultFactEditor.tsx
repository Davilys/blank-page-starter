/** Editor do fato: dados, portões de validação, relações, consumidores e auditoria. */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Check, Save, Trash2, X } from "lucide-react";
import {
  CONFIDENCE_LABEL,
  CONFIDENCE_LEVELS,
  emptyVaultFact,
  type VaultConfidence,
  type VaultFact,
} from "@/modules/intelligence/domain/vault/VaultFact";
import {
  RELATION_LABEL,
  VAULT_RELATION_TYPES,
  type VaultRelationType,
} from "@/modules/intelligence/domain/vault/relations";
import { evaluateVaultGates } from "@/modules/intelligence/domain/vault/validation";
import {
  useVaultFact,
  useVaultLinkOptions,
} from "@/modules/intelligence/presentation/hooks/useVault";
import { VaultFactForm } from "@/modules/intelligence/presentation/components/vault/VaultFactForm";
import { VaultTimeline } from "@/modules/intelligence/presentation/components/vault/VaultTimeline";
import {
  ConfidenceBadge,
  RelationBadge,
  VaultKindBadge,
  VaultStatusBadge,
} from "@/modules/intelligence/presentation/components/vault/VaultBadges";

const VaultFactEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const novo = !id || id === "novo";

  const {
    detalhe,
    loading,
    salvar,
    validar,
    revisar,
    tornarObsoleto,
    relacionar,
    removerRelacao,
    vincularObjeto,
  } = useVaultFact(id);
  const { fatos, objetos } = useVaultLinkOptions();

  const [rascunho, setRascunho] = useState<VaultFact>(emptyVaultFact());
  const [autor, setAutor] = useState("");
  const [motivo, setMotivo] = useState("");

  const [revisor, setRevisor] = useState("");
  const [confianca, setConfianca] = useState<VaultConfidence>("alta");

  const [relAlvo, setRelAlvo] = useState("");
  const [relTipo, setRelTipo] = useState<VaultRelationType>("complementa");
  const [relJust, setRelJust] = useState("");

  useEffect(() => {
    if (detalhe) {
      setRascunho(detalhe.fato);
      setRevisor(detalhe.fato.revisorId ?? "");
      if (detalhe.fato.confianca) setConfianca(detalhe.fato.confianca);
    }
  }, [detalhe]);

  const gates = useMemo(() => evaluateVaultGates(rascunho), [rascunho]);
  const pendentes = gates.filter((g) => !g.ok);

  const aplicar = (patch: Partial<VaultFact>) =>
    setRascunho((atual) => ({ ...atual, ...patch }) as VaultFact);

  const onSalvar = async () => {
    const r = await salvar(rascunho, autor, motivo);
    if (!r.ok) return toast.error(r.error as string);
    toast.success("Fato gravado com auditoria.");
    setMotivo("");
    if (novo && r.value) navigate(`/intelligence/admin/vault/fatos/${r.value.id}`);
  };

  const onValidar = async () => {
    const r = await validar(revisor, confianca, motivo);
    r.ok ? toast.success("Fato validado.") : toast.error(r.error as string);
  };

  const onRevisar = async () => {
    const r = await revisar(revisor, motivo);
    r.ok ? toast.success("Revisão registrada.") : toast.error(r.error as string);
  };

  const onObsoleto = async () => {
    const r = await tornarObsoleto(autor, motivo);
    r.ok ? toast.success("Fato marcado como obsoleto.") : toast.error(r.error as string);
  };

  const onRelacionar = async () => {
    const r = await relacionar(relAlvo, relTipo, relJust, autor);
    if (!r.ok) return toast.error(r.error as string);
    toast.success("Relação criada.");
    setRelAlvo("");
    setRelJust("");
  };

  if (loading) {
    return <p className="text-muted-foreground">Carregando fato…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {novo ? "Novo fato" : rascunho.titulo || "Fato"}
          </h1>
          {!novo && (
            <div className="mt-2 flex flex-wrap gap-2">
              <VaultStatusBadge status={rascunho.status} />
              <VaultKindBadge tipo={rascunho.tipo} />
              <ConfidenceBadge nivel={rascunho.confianca} />
            </div>
          )}
        </div>
        <Button onClick={onSalvar}>
          <Save className="mr-1.5 h-4 w-4" /> Gravar
        </Button>
      </div>

      <Card className="grid gap-3 p-4 sm:grid-cols-2">
        <div>
          <Label>Autor da alteração</Label>
          <Input value={autor} onChange={(e) => setAutor(e.target.value)} placeholder="nome do responsável" />
        </div>
        <div>
          <Label>Motivo da alteração</Label>
          <Input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Atualização do dispositivo legal"
          />
        </div>
      </Card>

      <VaultFactForm valor={rascunho} onChange={aplicar} />

      <Card className="p-5">
        <h2 className="font-semibold text-foreground">Portões de validação</h2>
        <ul className="mt-3 space-y-2">
          {gates.map((g) => (
            <li key={g.id} className="flex items-start gap-2 text-sm">
              {g.ok ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              ) : (
                <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              )}
              <span>
                <span className="font-medium text-foreground">{g.rotulo}</span>{" "}
                <span className="text-muted-foreground">— {g.detalhe}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Revisor</Label>
            <Input value={revisor} onChange={(e) => setRevisor(e.target.value)} />
          </div>
          <div>
            <Label>Grau de confiança na validação</Label>
            <Select value={confianca} onValueChange={(v) => setConfianca(v as VaultConfidence)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONFIDENCE_LEVELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CONFIDENCE_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={onValidar} disabled={novo}>
            Validar fato
          </Button>
          <Button variant="outline" onClick={onRevisar} disabled={novo}>
            Registrar revisão
          </Button>
          <Button variant="destructive" onClick={onObsoleto} disabled={novo}>
            Marcar obsoleto
          </Button>
        </div>
        {pendentes.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {pendentes.length} pendência(s) impedem a validação.
          </p>
        )}
      </Card>

      {!novo && (
        <Card className="p-5">
          <h2 className="font-semibold text-foreground">Relações com outros fatos</h2>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Tipo</Label>
              <Select value={relTipo} onValueChange={(v) => setRelTipo(v as VaultRelationType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VAULT_RELATION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {RELATION_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Fato de destino</Label>
              <Select value={relAlvo} onValueChange={setRelAlvo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um fato" />
                </SelectTrigger>
                <SelectContent>
                  {fatos
                    .filter((f) => String(f.id) !== id)
                    .map((f) => (
                      <SelectItem key={String(f.id)} value={String(f.id)}>
                        {f.titulo || String(f.id)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-3">
              <Label>Justificativa</Label>
              <Textarea rows={2} value={relJust} onChange={(e) => setRelJust(e.target.value)} />
            </div>
          </div>
          <Button className="mt-3" variant="outline" onClick={onRelacionar}>
            Criar relação
          </Button>

          <ul className="mt-4 space-y-2">
            {rascunho.relacoes.length === 0 && (
              <li className="text-sm text-muted-foreground">Nenhuma relação declarada.</li>
            )}
            {rascunho.relacoes.map((r) => {
              const alvo = fatos.find((f) => String(f.id) === r.alvoId);
              return (
                <li key={r.id} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm">
                  <RelationBadge tipo={r.tipo} />
                  <span className="flex-1 truncate text-foreground">
                    {alvo?.titulo ?? r.alvoId}
                  </span>
                  <span className="hidden max-w-xs truncate text-xs text-muted-foreground md:inline">
                    {r.justificativa}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      const res = await removerRelacao(r.id, autor, motivo);
                      res.ok
                        ? toast.success("Relação removida.")
                        : toast.error(res.error as string);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>

          {detalhe && detalhe.referenciadoPor.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Referenciado por: {detalhe.referenciadoPor.map((f) => f.titulo).join(" · ")}
            </p>
          )}
        </Card>
      )}

      {!novo && (
        <Card className="p-5">
          <h2 className="font-semibold text-foreground">Knowledge Objects consumidores</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O objeto referencia o fato. O conteúdo nunca é duplicado.
          </p>
          <ul className="mt-3 space-y-2">
            {objetos.length === 0 && (
              <li className="text-sm text-muted-foreground">
                Nenhum Knowledge Object disponível na Factory.
              </li>
            )}
            {objetos.map((o) => {
              const marcado = rascunho.objetosConsumidores.includes(String(o.id));
              return (
                <li key={String(o.id)} className="flex items-center gap-3 text-sm">
                  <Checkbox
                    checked={marcado}
                    onCheckedChange={async (v) => {
                      const res = await vincularObjeto(String(o.id), Boolean(v), autor);
                      if (!res.ok) toast.error(res.error as string);
                    }}
                  />
                  <span className="text-foreground">{o.titulo || String(o.id)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {!novo && <VaultTimeline eventos={detalhe?.timeline ?? []} />}
    </div>
  );
};

export default VaultFactEditor;