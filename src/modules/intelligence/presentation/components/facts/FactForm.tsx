/**
 * Formulário do fato. Cobre toda a cadeia exigida:
 * enunciado → fonte → data → versão → confiabilidade → relacionamentos →
 * objetos afetados → última validação → revisor.
 */
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { RELATIONSHIP_TYPES } from "../../../domain/shared/taxonomy";
import {
  SOURCE_TIERS,
  SOURCE_TIER_LABEL,
  type Fact,
  type FactRelationship,
} from "../../../domain/facts/Fact";
import type { FactId } from "../../../domain/shared/primitives";
import type { KnowledgeDraft } from "../../../domain/factory/KnowledgeDraft";

export interface FactFormValue extends Partial<Fact> {}

interface Props {
  readonly value: FactFormValue;
  readonly onChange: (patch: FactFormValue) => void;
  readonly fatosDisponiveis: readonly Fact[];
  readonly objetosDisponiveis: readonly KnowledgeDraft[];
  readonly bloqueado?: boolean;
}

export const FactForm = ({
  value,
  onChange,
  fatosDisponiveis,
  objetosDisponiveis,
  bloqueado,
}: Props) => {
  const fonte = value.fonte ?? { tier: "lei" as const, titulo: "", dispositivo: "" };
  const relacionamentos = value.relacionamentos ?? [];
  const objetos = value.objetosAfetados ?? [];

  const setFonte = (patch: Partial<typeof fonte>) =>
    onChange({ fonte: { ...fonte, ...patch } });

  const setRel = (i: number, patch: Partial<FactRelationship>) =>
    onChange({
      relacionamentos: relacionamentos.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    });

  const toggleObjeto = (ref: string, on: boolean) =>
    onChange({
      objetosAfetados: on ? [...objetos, ref] : objetos.filter((o) => o !== ref),
    });

  return (
    <div className="space-y-6">
      {/* ── Fato ─────────────────────────────────────────────────────────── */}
      <Card className="p-5">
        <h2 className="font-semibold text-foreground">Fato</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Uma afirmação verificável, em uma frase. Ex.: "Oposição pode ser apresentada em até
          60 dias contados da publicação do pedido na RPI."
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="f-enunciado">Enunciado</Label>
            <Textarea
              id="f-enunciado"
              className="mt-1"
              rows={3}
              disabled={bloqueado}
              value={value.enunciado ?? ""}
              onChange={(e) => onChange({ enunciado: e.target.value })}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label htmlFor="f-valor">Valor</Label>
              <Input
                id="f-valor"
                className="mt-1"
                placeholder="60"
                disabled={bloqueado}
                value={value.valor ?? ""}
                onChange={(e) => onChange({ valor: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="f-unidade">Unidade</Label>
              <Input
                id="f-unidade"
                className="mt-1"
                placeholder="dias"
                disabled={bloqueado}
                value={value.unidade ?? ""}
                onChange={(e) => onChange({ unidade: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="f-entidade">Entidade principal</Label>
              <Input
                id="f-entidade"
                className="mt-1"
                placeholder="oposicao"
                disabled={bloqueado}
                value={String(value.entidadePrincipal ?? "")}
                onChange={(e) => onChange({ entidadePrincipal: e.target.value as never })}
              />
            </div>
            <div>
              <Label htmlFor="f-jurisdicao">Jurisdição</Label>
              <Input
                id="f-jurisdicao"
                className="mt-1"
                disabled={bloqueado}
                value={value.jurisdicao ?? ""}
                onChange={(e) => onChange({ jurisdicao: e.target.value })}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* ── Fonte ────────────────────────────────────────────────────────── */}
      <Card className="p-5">
        <h2 className="font-semibold text-foreground">Fonte</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Nenhum fato existe sem fonte. O tier define o peso base da confiabilidade.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Tipo de fonte</Label>
            <Select
              value={fonte.tier}
              disabled={bloqueado}
              onValueChange={(v) => setFonte({ tier: v as never })}
            >
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCE_TIERS.map((t) => (
                  <SelectItem key={t} value={t}>{SOURCE_TIER_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="f-fonte-titulo">Fonte</Label>
            <Input
              id="f-fonte-titulo"
              className="mt-1"
              placeholder="Lei 9.279/96 (LPI)"
              disabled={bloqueado}
              value={fonte.titulo}
              onChange={(e) => setFonte({ titulo: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="f-dispositivo">Dispositivo exato</Label>
            <Input
              id="f-dispositivo"
              className="mt-1"
              placeholder="art. 158, caput"
              disabled={bloqueado}
              value={fonte.dispositivo}
              onChange={(e) => setFonte({ dispositivo: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="f-url">URL da fonte</Label>
            <Input
              id="f-url"
              className="mt-1"
              placeholder="https://…"
              disabled={bloqueado}
              value={fonte.url ?? ""}
              onChange={(e) => setFonte({ url: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="f-publicado">Publicação da fonte</Label>
            <Input
              id="f-publicado"
              type="date"
              className="mt-1"
              disabled={bloqueado}
              value={fonte.publicadoEm ?? ""}
              onChange={(e) => setFonte({ publicadoEm: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="f-acessado">Conferido em</Label>
            <Input
              id="f-acessado"
              type="date"
              className="mt-1"
              disabled={bloqueado}
              value={fonte.acessadoEm ?? ""}
              onChange={(e) => setFonte({ acessadoEm: e.target.value })}
            />
          </div>
        </div>
      </Card>

      {/* ── Datas e governança ───────────────────────────────────────────── */}
      <Card className="p-5">
        <h2 className="font-semibold text-foreground">Vigência e governança</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="f-inicio">Vigência início</Label>
            <Input
              id="f-inicio"
              type="date"
              className="mt-1"
              disabled={bloqueado}
              value={value.vigenciaInicio ?? ""}
              onChange={(e) => onChange({ vigenciaInicio: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="f-fim">Vigência fim</Label>
            <Input
              id="f-fim"
              type="date"
              className="mt-1"
              disabled={bloqueado}
              value={value.vigenciaFim ?? ""}
              onChange={(e) => onChange({ vigenciaFim: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="f-periodicidade">Revalidar a cada (dias)</Label>
            <Input
              id="f-periodicidade"
              type="number"
              min={30}
              className="mt-1"
              disabled={bloqueado}
              value={value.periodicidadeDias ?? 180}
              onChange={(e) => onChange({ periodicidadeDias: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="f-autor">Autor</Label>
            <Input
              id="f-autor"
              className="mt-1"
              disabled={bloqueado}
              value={value.autorId ?? ""}
              onChange={(e) => onChange({ autorId: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="f-obs">Observações</Label>
            <Input
              id="f-obs"
              className="mt-1"
              disabled={bloqueado}
              value={value.observacoes ?? ""}
              onChange={(e) => onChange({ observacoes: e.target.value })}
            />
          </div>
        </div>
      </Card>

      {/* ── Relacionamentos ──────────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Relacionamentos</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={bloqueado || fatosDisponiveis.length === 0}
            onClick={() =>
              onChange({
                relacionamentos: [
                  ...relacionamentos,
                  {
                    tipo: "depende-de",
                    alvoFatoId: fatosDisponiveis[0]?.id as FactId,
                  },
                ],
              })
            }
          >
            <Plus className="mr-1.5 h-4 w-4" /> Adicionar
          </Button>
        </div>

        {relacionamentos.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum relacionamento. Contradições declaradas aqui derrubam a confiabilidade.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {relacionamentos.map((r, i) => (
              <li key={i} className="grid gap-2 sm:grid-cols-[160px_1fr_auto]">
                <Select
                  value={r.tipo}
                  disabled={bloqueado}
                  onValueChange={(v) => setRel(i, { tipo: v as never })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(r.alvoFatoId)}
                  disabled={bloqueado}
                  onValueChange={(v) => setRel(i, { alvoFatoId: v as FactId })}
                >
                  <SelectTrigger><SelectValue placeholder="Fato alvo" /></SelectTrigger>
                  <SelectContent>
                    {fatosDisponiveis.map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>
                        {f.enunciado.slice(0, 70)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={bloqueado}
                  onClick={() =>
                    onChange({ relacionamentos: relacionamentos.filter((_, idx) => idx !== i) })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── Objetos afetados ─────────────────────────────────────────────── */}
      <Card className="p-5">
        <h2 className="font-semibold text-foreground">Objetos afetados</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Knowledge Objects sustentados por este fato. Se o fato mudar, eles entram na fila de
          revisão.
        </p>

        {objetosDisponiveis.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum Knowledge Object cadastrado ainda.
          </p>
        ) : (
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
            {objetosDisponiveis.map((o) => (
              <li key={o.id} className="flex items-start gap-2">
                <Checkbox
                  id={`obj-${o.id}`}
                  disabled={bloqueado}
                  checked={objetos.includes(o.id)}
                  onCheckedChange={(c) => toggleObjeto(o.id, Boolean(c))}
                />
                <Label htmlFor={`obj-${o.id}`} className="cursor-pointer text-sm font-normal">
                  {o.titulo || o.slug || o.id}
                  <span className="ml-2 text-xs text-muted-foreground">{o.estado}</span>
                </Label>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};